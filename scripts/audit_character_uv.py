from __future__ import annotations

import argparse
import copy
import json
import struct
from pathlib import Path

from glb_native_clips import decode_glb
from glb_uv_fix import fix_doc


def uv_values(scene: dict, binary: bytes, index: int) -> list[tuple[float, float]]:
    accessor = scene['accessors'][index]
    if accessor['componentType'] != 5126 or accessor['type'] != 'VEC2':
        raise ValueError(f'UV accessor {index}: expected float32 VEC2, got {accessor}')
    view = scene['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', 8)
    return [struct.unpack_from('<2f', binary, start + row * stride) for row in range(accessor['count'])]


def face_bounds(scene: dict, binary: bytes, mesh: dict, primitive: dict) -> dict | None:
    if 'face' not in mesh.get('name', '').lower():
        return None
    material = scene['materials'][primitive['material']]
    info = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if info is None:
        return None
    channel = info.get('texCoord', 0)
    face = {'mesh': mesh['name'], 'material': material.get('name'), 'channel': channel}
    attribute = f'TEXCOORD_{channel}'
    if attribute not in primitive['attributes']:
        return {**face, 'missing_attribute': attribute}
    values = uv_values(scene, binary, primitive['attributes'][attribute])
    return {**face, 'uv_min': [min(value[axis] for value in values) for axis in range(2)],
            'uv_max': [max(value[axis] for value in values) for axis in range(2)]}


def audit_doc(scene: dict, binary: bytes) -> dict:
    comparisons, faces = [], []
    primitives = ((mesh, primitive) for mesh in scene.get('meshes', []) for primitive in mesh.get('primitives', []))
    for mesh, primitive in primitives:
        attributes = primitive['attributes']
        if 'TEXCOORD_0' in attributes and 'TEXCOORD_1' in attributes:
            comparisons.append(uv_values(scene, binary, attributes['TEXCOORD_0']) ==
                               uv_values(scene, binary, attributes['TEXCOORD_1']))
        face = face_bounds(scene, binary, mesh, primitive)
        if face is not None:
            faces.append(face)
    return {'channel_repairs_if_applied': fix_doc(copy.deepcopy(scene)), 'uv_pairs': len(comparisons),
            'all_uv_pairs_identical': bool(comparisons) and all(comparisons), 'faces': faces}


def main() -> None:
    parser = argparse.ArgumentParser(description='Audit character UV channels without modifying assets.')
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text())
    report = []
    for model in catalog['models']:
        if not model['id'].startswith('character/'):
            continue
        scene, binary = decode_glb((args.root / 'public' / model['url'].lstrip('/')).read_bytes())
        report.append({'id': model['id'], 'sha256': model['sha256'], **audit_doc(scene, binary)})
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'models': len(report), 'channel_repairs': sum(len(row['channel_repairs_if_applied']) for row in report),
                      'identical_uv_pairs': sum(row['all_uv_pairs_identical'] for row in report)}))


if __name__ == '__main__':
    main()
