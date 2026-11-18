from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from native_motions import motion_slots, package_sections


def motion_profile(slots: list[dict], clips: list[str]) -> dict:
    frames = {slot['index']: slot['frames'] for slot in slots}
    standing = 0 in frames and 'overworld_000' in clips
    movement = 2 in frames and 'overworld_002' in clips
    return {'status': 'native_pair' if standing and movement else 'incomplete_pair',
            'native_standing': standing, 'native_movement': movement,
            'standing_frames': frames.get(0), 'movement_frames': frames.get(2)}


def inspect_model(root: Path, model_id: int, entries: dict) -> dict:
    entry = entries.get(f'character/mm_{model_id:04d}')
    if entry is None:
        return {'model': model_id, 'status': 'unmapped', 'reason': 'No corresponding MM catalog entry; no ID remapping'}
    source = root / f'rom/extracted/garc/a_0_2_1/{model_id:04d}.bin'
    blob = source.read_bytes()
    sections = package_sections(blob)
    slots = motion_slots(sections[1]) if len(sections) > 1 else []
    profile = motion_profile(slots, entry['clips'])
    if len(sections) < 2:
        profile.update(status='no_motion_section', reason='MM has no GF1 motion section; existing fallback retained')
    return {'model': model_id, **profile, 'pack': str(source.relative_to(root)),
            'pack_sha256': hashlib.sha256(blob).hexdigest(), 'source_glb': entry['source'],
            'url': entry['url'], 'sha256': entry['sha256'], 'clips': entry['clips']}


def audit(root: Path, catalog: dict, zones: list[int]) -> dict:
    actors = {}
    for zone in zones:
        document = json.loads((root / f'src/data/maps_v2/{zone:04d}.json').read_text())
        actors[str(zone)] = sorted({npc['model'] for npc in document['npcs']})
    wanted = {model for models in actors.values() for model in models} | {314, 315}
    entries = {entry['id']: entry for entry in catalog['models']}
    models = [inspect_model(root, model, entries) for model in sorted(wanted)]
    return {'zones': actors, 'players': [314, 315], 'models': models,
            'semantics': {'overworld_000': 'Native standing pose, not an inferred breathing cycle',
                          'overworld_002': 'Locomotion candidate; visual validation is separate from availability',
                          'original_state_dispatch': 'Not proven by this inventory'},
            'summary': {status: sum(row['status'] == status for row in models)
                        for status in ('native_pair', 'incomplete_pair', 'no_motion_section', 'unmapped')}}


def main() -> None:
    parser = argparse.ArgumentParser(description='Audit native standing/movement availability without inventing clip names.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--zones', type=int, nargs='+', default=list(range(6, 17)))
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    report = audit(args.root.resolve(), json.loads(args.catalog.read_text()), args.zones)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['summary']))


if __name__ == '__main__':
    main()
