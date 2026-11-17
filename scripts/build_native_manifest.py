from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

from attach_native_motions import BATTLE_CLIPS
from native_model_batch import manifest_summary
from native_motions import motion_slots, package_sections, read_garc_entry

ZONE_IDS = (6, 7, *range(23, 31))
STARTERS = tuple(range(252, 261))
COVER_LEGENDARIES = (382, 383)


def encounter_scope(root: Path, zone_ids: tuple[int, ...] = ZONE_IDS) -> dict:
    zones, species = [], set()
    for zone in zone_ids:
        matches = sorted((root / 'src/data/zones').glob(f'{zone:03d}_*.json'))
        if len(matches) != 1:
            raise ValueError(f'Expected one encounter JSON for zone {zone}, found {len(matches)}')
        blob = matches[0].read_bytes()
        document = json.loads(blob)
        present = sorted({slot['species'] for slot in document['encounters'] if slot['species'] > 0})
        species.update(present)
        zones.append({'zone': zone, 'path': str(matches[0].relative_to(root)),
                      'sha256': hashlib.sha256(blob).hexdigest(), 'species': present})
    return {'zones': zones, 'encounter_species': sorted(species), 'starter_species': list(STARTERS),
            'cover_species': list(COVER_LEGENDARIES),
            'species': sorted(species | set(STARTERS) | set(COVER_LEGENDARIES)),
            'pokemon_forms': 'first model per species, plus second model for cover legendaries'}


def model_table_record(table: bytes, species: int, variant: int = 0) -> dict:
    offset = (species - 1) * 4
    if species < 1 or offset + 4 > len(table):
        raise ValueError(f'Species {species} outside GARC model table')
    first, count, flags = struct.unpack_from('<HBB', table, offset)
    if not 0 <= variant < count:
        raise ValueError(f'Species {species} variant {variant} outside model count {count}')
    slot = 3 + (first + variant) * 8
    return {'table_slot': 0, 'table_offset': offset, 'first_model': first, 'model_count': count,
            'flags': flags, 'variant': variant, 'model_slot': slot, 'motion_slot': slot + 5}


def moving_clips(slots: list[dict]) -> dict[str, int]:
    moving = [slot['index'] for slot in slots if slot['frames'] > 1]
    selected = [2] if 2 in moving else moving[:1]
    return {f'overworld_{index:03d}': index for index in selected}


def pack_metadata(motion: bytes, section: int) -> tuple[dict, list[dict]]:
    slots = motion_slots(motion)
    return {'motion_section': section, 'pack_sha256': hashlib.sha256(motion).hexdigest(),
            'declared_count': struct.unpack_from('<I', motion)[0],
            'present_indices': [slot['index'] for slot in slots]}, slots


def attach_pack(job: dict, motion: bytes, section: int, clips: dict | None = None) -> dict:
    metadata, slots = pack_metadata(motion, section)
    job['mapping'].update(metadata)
    job['clips'] = moving_clips(slots) if clips is None else clips
    job['mapping']['selected_frames'] = {name: next(slot['frames'] for slot in slots if slot['index'] == index)
                                          for name, index in job['clips'].items()}
    job['status'] = 'ready' if job['clips'] else 'static_only'
    if not job['clips']:
        job['error'] = 'No moving GF1 clip with more than one frame'
    return job


def character_job(root: Path, model_id: int) -> dict:
    name = f'mm_{model_id:04d}'
    job = {'id': f'character/{name}', 'kind': 'character', 'model_id': model_id,
           'source': f'rom/extracted/garc/a_0_2_1/{model_id:04d}.bin',
           'base_glb': f'rom/extracted/models/characters/{name}/{name}.glb',
           'output': f'rom/extracted/models/clips_merged/characters/{name}/{name}.glb',
           'mapping': {'model_section': 0}}
    if not (root / job['source']).is_file() or not (root / job['base_glb']).is_file():
        return {**job, 'status': 'missing_input', 'error': 'MM source or base GLB is absent'}
    try:
        model = (root / job['source']).read_bytes()
        sections = package_sections(model)
        if model[:2] != b'MM':
            raise ValueError(f'Expected MM source for {name}')
        if len(sections) < 2:
            return {**job, 'status': 'no_motion_section', 'error': 'MM has only the model section'}
        job['mapping']['motion_offset'] = struct.unpack_from('<I', model, 8)[0]
        return attach_pack(job, sections[1], 1)
    except (ValueError, struct.error) as error:
        return {**job, 'status': 'invalid_motion', 'error': str(error)}


def pokemon_job(root: Path, garc: Path, table: bytes, species: int, variant: int, scope: dict) -> dict:
    record = model_table_record(table, species, variant)
    job = {'id': f'pokemon/{species:04d}/{variant}', 'kind': 'pokemon', 'species': species,
           'source': str(garc.relative_to(root)), 'model_slot': record['model_slot'],
           'encounter_zones': [zone['zone'] for zone in scope['zones'] if species in zone['species']],
           'mapping': {**record, 'model_section': 0}}
    try:
        model = read_garc_entry(garc, record['model_slot'])
        pack = read_garc_entry(garc, record['motion_slot'])
        if model[:2] != b'PC' or pack[:2] != b'PB':
            raise ValueError(f"Expected PC/PB at {record['model_slot']}/{record['motion_slot']}")
        tags = sorted(set(re.findall(rb'pm\d{4}_\d{2}', package_sections(model)[0])))
        if len(tags) != 1:
            raise ValueError(f'Expected one model tag for species {species}, found {tags!r}')
        tag = tags[0].decode()
        job.update(model_tag=tag, base_glb=f'rom/extracted/models/pokemon/{tag}/{tag}.glb',
                   output=f'rom/extracted/models/clips_merged/pokemon/{tag}/{tag}.glb')
        if not (root / job['base_glb']).is_file():
            return {**job, 'status': 'missing_input', 'error': f'Base GLB {tag} is absent'}
        motion = package_sections(pack)[0]
        present = {slot['index'] for slot in motion_slots(motion)}
        clips = {name: index for name, index in BATTLE_CLIPS.items() if index in present}
        job['unavailable'] = [name for name, index in BATTLE_CLIPS.items() if index not in present]
        return attach_pack(job, motion, 0, clips)
    except (ValueError, struct.error) as error:
        return {**job, 'status': 'invalid_motion', 'error': str(error)}


def build_manifest(root: Path) -> dict:
    scope = encounter_scope(root)
    directories = (root / 'rom/extracted/models/characters').glob('mm_[0-9][0-9][0-9][0-9]')
    characters = [character_job(root, int(directory.name[3:])) for directory in sorted(directories)]
    garc = root / 'rom/extracted/RomFS/a/0/0/8'
    table = read_garc_entry(garc, 0)
    pokemon = [pokemon_job(root, garc, table, species, variant, scope)
               for species in scope['species']
               for variant in range(2 if species in COVER_LEGENDARIES else 1)]
    models = characters + pokemon
    return {'schema_version': 1, 'scope': {**scope, 'character_models': len(characters),
            'character_clip_policy': 'index 2 if moving, otherwise first moving sparse index',
            'model_table_sha256': hashlib.sha256(table).hexdigest()},
            'summary': manifest_summary(models), 'models': models}


def main() -> None:
    parser = argparse.ArgumentParser(description='Inventory all character GLBs and encounter-derived Pokemon GF1 packs.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    manifest = build_manifest(args.root.resolve())
    args.output.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(manifest['summary']))
    print(json.dumps({'species': manifest['scope']['species']}))


if __name__ == '__main__':
    main()
