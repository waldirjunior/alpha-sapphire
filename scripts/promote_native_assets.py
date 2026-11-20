from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
from pathlib import Path

from character_face_uv import normalize_character_faces, supported_face
from glb_native_clips import decode_glb
from native_motions import motion_slots, package_sections
from pokemon_glb_materials import GLTF_UV_FLIP_MARKER
from validate_native_manifest import validate_model, verify_float_accessors

ZONE_IDS = (*range(6, 17), *range(23, 31))
ALIASES = {'brendan': 315, 'may': 314, 'npc': 45}


def character_ids(root: Path) -> set[int]:
    staged = (root / 'public/assets/characters').glob('mm_[0-9][0-9][0-9][0-9].glb')
    selected = set(ALIASES.values()) | {int(path.stem[3:]) for path in staged}
    for zone in ZONE_IDS:
        document = json.loads((root / f'src/data/maps_v2/{zone:04d}.json').read_text())
        selected.update(npc['model'] for npc in document['npcs'])
    return selected


def prepare_pose_jobs(root: Path, manifest: dict) -> list[dict]:
    wanted = character_ids(root)
    jobs = []
    for model in manifest['models']:
        if model['kind'] != 'character' or model['model_id'] not in wanted or model['status'] != 'merged':
            continue
        if 0 not in model['mapping']['present_indices']:
            continue
        slots = motion_slots(package_sections((root / model['source']).read_bytes())[1])
        job = copy.deepcopy(model)
        for field in ('validation', 'log', 'returncode', 'error'):
            job.pop(field, None)
        job.update(status='ready', base_glb=model['output'], clips={'overworld_000': 0},
                   output=f"rom/extracted/models/runtime_characters/mm_{model['model_id']:04d}.glb")
        job['mapping']['selected_frames'] = {'overworld_000': next(slot['frames'] for slot in slots if slot['index'] == 0)}
        if (root / job['output']).is_file():
            job['validation'] = validate_model(root, job)
            job['status'] = 'merged'
        jobs.append(job)
    return jobs


def publish_asset(root: Path, source: Path, kind: str, name: str,
                  face_evidence: dict | None = None) -> tuple[str, str]:
    blob = source.read_bytes()
    if kind == 'characters':
        if face_evidence and source.resolve() != (root / face_evidence['source_glb']).resolve():
            raise ValueError(f"Character source {source} does not match face evidence {face_evidence['source_glb']}")
        blob = normalize_character_faces(blob, face_evidence)
    scene, binary = decode_glb(blob)
    if kind == 'pokemon':
        marker = scene.get('asset', {}).get('extras', {}).get(GLTF_UV_FLIP_MARKER)
        marker_valid = (marker is not None and marker.get('version') == 1
                        and re.fullmatch(r'[0-9a-f]{64}', str(marker.get('sourceSha256', '')))
                        and re.fullmatch(r'[0-9a-f]{64}', str(marker.get('evidenceSha256', '')))
                        and isinstance(marker.get('uvAccessors'), int) and marker['uvAccessors'] > 0
                        and isinstance(marker.get('materials'), int) and marker['materials'] > 0)
        if not marker_valid:
            raise ValueError(f'Pokémon GLB {source} lacks source-backed UV/wrap correction; regenerate it from its COLLADA model')
    verify_float_accessors(scene, binary)
    digest = hashlib.sha256(blob).hexdigest()
    relative = Path(f'assets/native/{kind}/{name}-{digest[:12]}.glb')
    output = root / 'public' / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        if output.read_bytes() != blob:
            raise ValueError(f'Immutable asset collision: {relative}')
    else:
        with output.open('xb') as stream:
            stream.write(blob)
    return '/' + str(relative), digest


def model_source(root: Path, model: dict) -> Path:
    native = model['status'] == 'merged'
    if native and model['kind'] == 'character':
        augmented = root / f"rom/extracted/models/runtime_characters/mm_{model['model_id']:04d}.glb"
        if augmented.is_file():
            return augmented
    return root / model['output' if native else 'base_glb']


def pokemon_slug(model: dict, names: dict) -> str:
    base = re.sub('[^a-z0-9]', '', names[model['species']].lower())
    variant = model['mapping']['variant']
    return base + (f'-{variant}' if variant else '')


def character_urls(model_id: int) -> list[str]:
    return [f'/assets/characters/mm_{model_id:04d}.glb',
            *(f'/assets/characters/{alias}/{alias}.glb' for alias, value in ALIASES.items() if value == model_id)]


def face_animations(evidence: dict | None) -> list[dict]:
    return [{'material': face['material'], 'frames': copy.deepcopy(face['palette'])}
            for face in (evidence or {}).get('faces', []) if supported_face(face)
            and [entry['frame'] for entry in face['palette']] == list(range(0, 71, 10))]


def promote_model(root: Path, model: dict, names: dict, catalog: dict,
                  face_evidence: dict | None = None) -> None:
    native = model['status'] == 'merged'
    if not native:
        catalog['unavailable'].append({'id': model['id'], 'reason': model.get('error', model['status'])})
    source = model_source(root, model)
    name = pokemon_slug(model, names) if model['kind'] == 'pokemon' else f"mm_{model['model_id']:04d}"
    kind = 'pokemon' if model['kind'] == 'pokemon' else 'characters'
    url, digest = publish_asset(root, source, kind, name, face_evidence)
    if kind == 'pokemon':
        catalog['pokemon'][name] = url
    else:
        for canonical in character_urls(model['model_id']):
            catalog['characters'][canonical] = url
    scene, _ = decode_glb(source.read_bytes())
    entry = {'id': model['id'], 'url': url, 'sha256': digest, 'native': native,
             'source': str(source.relative_to(root)),
             'clips': [clip['name'] for clip in scene.get('animations', [])]}
    if animations := face_animations(face_evidence):
        entry['faceAnimations'] = animations
    catalog['models'].append(entry)


def promote(root: Path, manifest: dict, face_evidence: list[dict] | None = None) -> dict:
    faces = {row['id']: row for row in face_evidence or []}
    wanted = character_ids(root)
    species = json.loads((root / 'src/data/battle/species.json').read_text())
    names = {row['species']: row['name'] for row in species if row['form'] == 0}
    catalog: dict = {'pokemon': {}, 'characters': {}, 'models': [], 'unavailable': []}
    for model in manifest['models']:
        if model['kind'] != 'character' or model['model_id'] in wanted:
            promote_model(root, model, names, catalog, faces.get(model['id']))
    known = {model['model_id'] for model in manifest['models'] if model['kind'] == 'character'}
    catalog['unavailable'].extend({'id': f'character/mm_{model:04d}', 'reason': 'Unmapped ROM actor model id'}
                                  for model in sorted(wanted - known))
    return catalog


def main() -> None:
    parser = argparse.ArgumentParser(description='Promote slice-native GLBs to immutable ignored public assets.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--face-evidence', type=Path, default=Path(__file__).resolve().parents[1] /
                        'docs/features/pipeline-rom/character-face-evidence.json')
    destination = parser.add_mutually_exclusive_group(required=True)
    destination.add_argument('--catalog', type=Path)
    destination.add_argument('--pose-manifest', type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    if args.pose_manifest is not None:
        jobs = prepare_pose_jobs(args.root.resolve(), manifest)
        args.pose_manifest.write_text(json.dumps({'models': jobs}, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'pose_jobs': len(jobs)}))
        return
    face_evidence = json.loads(args.face_evidence.read_text()) if args.face_evidence else None
    catalog = promote(args.root.resolve(), manifest, face_evidence)
    args.catalog.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'pokemon': len(catalog['pokemon']), 'character_urls': len(catalog['characters']),
                      'models': len(catalog['models']), 'unavailable': catalog['unavailable']}))


if __name__ == '__main__':
    main()
