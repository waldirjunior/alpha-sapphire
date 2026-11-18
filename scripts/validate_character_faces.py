from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

from audit_character_uv import uv_values
from character_face_uv import normalize_character_faces, supported_face
from glb_native_clips import decode_glb
from validate_native_manifest import verify_float_accessors


def restore_uv_references(before: dict, after: dict, original: bytes, binary: bytes, materials: set[str]) -> None:
    for old_mesh, mesh in zip(before['meshes'], after['meshes'], strict=True):
        for old, primitive in zip(old_mesh['primitives'], mesh['primitives'], strict=True):
            for name, index in primitive['attributes'].items():
                previous = old['attributes'][name]
                if index == previous:
                    continue
                material = before['materials'][old['material']]['name']
                if not name.startswith('TEXCOORD_') or material not in materials:
                    raise ValueError(f'Unexpected attribute change: {material}/{name}')
                source = uv_values(before, original, previous)
                target = uv_values(after, binary, index)
                if not all(math.isclose(u, x, abs_tol=2e-6) and math.isclose(1 - v, y, abs_tol=2e-6)
                           for (u, v), (x, y) in zip(source, target, strict=True)):
                    raise ValueError(f'Unexpected UV transform: {material}/{name}')
                primitive['attributes'][name] = previous


def validate_structure(source: bytes, output: bytes, materials: set[str]) -> None:
    before, original = decode_glb(source)
    after, binary = decode_glb(output)
    verify_float_accessors(after, binary)
    if not binary.startswith(original):
        raise ValueError('Original BIN prefix changed')
    restored = copy.deepcopy(after)
    restore_uv_references(before, restored, original, binary, materials)
    restored['accessors'] = restored['accessors'][:len(before['accessors'])]
    restored['bufferViews'] = restored['bufferViews'][:len(before['bufferViews'])]
    restored['buffers'][0]['byteLength'] = before['buffers'][0]['byteLength']
    restored['asset'].get('extras', {}).pop('picaFaceUvNormalization', None)
    if not restored['asset'].get('extras') and 'extras' not in before['asset']:
        restored['asset'].pop('extras', None)
    if restored != before:
        raise ValueError('Non-UV GLB structure changed')


def validate_model(root: Path, model: dict, evidence: dict) -> dict:
    source = (root / model['source']).read_bytes()
    output = (root / 'public' / model['url'].lstrip('/')).read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != evidence['glb_sha256'] or hashlib.sha256(output).hexdigest() != model['sha256']:
        raise ValueError(f"Character {model['id']}: source/output SHA mismatch")
    eligible = {f['material'] for f in evidence['faces'] if supported_face(f)}
    validate_structure(source, output, eligible)
    if normalize_character_faces(source, evidence) != output or normalize_character_faces(output, evidence) != output:
        raise ValueError(f"Character {model['id']}: normalization is not reproducible/idempotent")
    scene, _ = decode_glb(output)
    corrected = scene['asset'].get('extras', {}).get('picaFaceUvNormalization', {}).get('materials', [])
    exclusions = [{'material': f['material'], 'reason': f['exclusion']}
                  for f in evidence['faces'] if f['exclusion']]
    return {'id': model['id'], 'url': model['url'], 'source': model['source'], 'sha256': model['sha256'],
            'status': 'normalized' if corrected else 'unchanged', 'materials': corrected,
            'exclusions': exclusions, 'reason': None if corrected else
            '; '.join(sorted({item['reason'] for item in exclusions})) or 'No native face/head material candidate',
            'structural_preservation': True, 'idempotent': True}


def coverage(root: Path, catalog: dict, evidence: list[dict]) -> dict:
    rows = {row['id']: row for row in evidence}
    models = [validate_model(root, model, rows[model['id']]) for model in catalog['models']
              if model['id'].startswith('character/')]
    by_id = {row['id']: row for row in models}
    zones = []
    for zone in range(6, 17):
        document = json.loads((root / f'src/data/maps_v2/{zone:04d}.json').read_text())
        actors = []
        for model_id in sorted({npc['model'] for npc in document['npcs']}):
            record = by_id.get(f'character/mm_{model_id:04d}')
            actors.append({'model': model_id, 'status': record['status'] if record else 'unmapped',
                           'reason': record['reason'] if record else 'No corresponding MM GLB; raw actor ID not remapped'})
        zones.append({'zone': zone, 'models': actors})
    return {'models': models, 'zones': zones, 'unavailable': catalog['unavailable'],
            'summary': {'audited_models': len(models), 'normalized_models': sum(bool(m['materials']) for m in models),
                        'normalized_materials': sum(len(m['materials']) for m in models),
                        'palette_materials': sum(bool(f['animation']) for row in evidence for f in row['faces']),
                        'excluded_materials': sum(len(m['exclusions']) for m in models)}}


def main() -> None:
    parser = argparse.ArgumentParser(description='Verify face normalization preservation and playable-zone coverage.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    report = coverage(args.root.resolve(), json.loads(args.catalog.read_text()), json.loads(args.evidence.read_text()))
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report['summary']))


if __name__ == '__main__':
    main()
