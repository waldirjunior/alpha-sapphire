from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

from glb_native_clips import accessor_values, decode_glb
from native_model_batch import write_manifest


def sample_models(models: list[dict], count: int) -> list[dict]:
    groups = [[model for model in models if model['status'] == 'merged' and model['kind'] == kind]
              for kind in sorted({model['kind'] for model in models})]
    chosen = []
    for group in groups:
        take = min(len(group), max(1, count // len(groups)))
        indices = [round(index * (len(group) - 1) / (take - 1)) for index in range(take)] if take > 1 else [0]
        chosen.extend(group[index] for index in indices if group)
    remainder = [model for model in models if model['status'] == 'merged' and model not in chosen]
    return (chosen + remainder)[:count]


def verify_float_accessors(scene: dict, binary: bytes) -> None:
    components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
    for index, accessor in enumerate(scene['accessors']):
        if accessor['componentType'] != 5126:
            continue
        view = scene['bufferViews'][accessor['bufferView']]
        width = components[accessor['type']]
        position = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', width * 4)
        for row in range(accessor['count']):
            values = struct.unpack_from(f'<{width}f', binary, position + row * stride)
            if not all(math.isfinite(value) for value in values):
                raise ValueError(f'Non-finite output accessor {index}, row {row}')


def validate_animation(scene: dict, binary: bytes, animation: dict, frames: int) -> dict:
    varying, duration = 0, 0.0
    joints = scene['skins'][0]['joints']
    for channel in animation['channels']:
        if channel['target']['node'] not in joints:
            raise ValueError(f"Animation {animation['name']} targets a node outside the skin")
    for sampler in animation['samplers']:
        times = [row[0] for row in accessor_values(scene, binary, sampler['input'])]
        values = accessor_values(scene, binary, sampler['output'])
        if abs(times[0]) > 1e-6 or abs(times[-1] - frames / 30) > 1e-5:
            raise ValueError(f"Animation {animation['name']} duration {times[-1]} differs from {frames}/30")
        if any(left >= right for left, right in zip(times, times[1:])):
            raise ValueError(f"Animation {animation['name']} timestamps are not strictly increasing")
        varying += len(set(values)) > 1
        duration = times[-1]
    return {'name': animation['name'], 'frames': frames, 'duration': duration,
            'channels': len(animation['channels']), 'variable_samplers': varying}


def validate_model(root: Path, model: dict) -> dict:
    base, original = decode_glb((root / model['base_glb']).read_bytes())
    output = (root / model['output']).read_bytes()
    scene, binary = decode_glb(output)
    if not binary.startswith(original):
        raise ValueError('Original model BIN was modified')
    for field in base:
        if field not in ('animations', 'accessors', 'bufferViews', 'buffers') and base[field] != scene[field]:
            raise ValueError(f'Original model field {field} was modified')
    for field in ('accessors', 'bufferViews'):
        if scene[field][:len(base[field])] != base[field]:
            raise ValueError(f'Original model {field} were modified')
    if any('bufferView' not in image for image in scene.get('images', [])):
        raise ValueError('Expected embedded image data when relocating the GLB')
    verify_float_accessors(scene, binary)
    clips = {clip['name']: clip for clip in scene['animations'] if clip.get('extras', {}).get('nativeGF1')}
    results = []
    for name, index in model['clips'].items():
        if name not in clips or clips[name]['extras']['sourceIndex'] != index:
            raise ValueError(f'Native clip {name} index {index} missing from output')
        results.append(validate_animation(scene, binary, clips[name], model['mapping']['selected_frames'][name]))
    return {'status': 'passed', 'bytes': len(output), 'output_sha256': hashlib.sha256(output).hexdigest(),
            'base_binary_sha256': hashlib.sha256(original).hexdigest(), 'base_preserved': True,
            'all_float_accessors_finite': True, 'images': len(scene.get('images', [])),
            'skin_joints': len(scene['skins'][0]['joints']), 'native_animations': results}


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate a deterministic, kind-balanced sample of merged native GLBs.')
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--sample', type=int, default=10)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    selected = sample_models(manifest['models'], args.sample)
    if args.sample < 1 or len(selected) < args.sample:
        parser.error(f'Expected {args.sample} merged models, found {len(selected)}')
    failures = []
    for model in selected:
        try:
            model['validation'] = validate_model(args.root.resolve(), model)
        except (ValueError, KeyError, IndexError, struct.error) as error:
            model['validation'] = {'status': 'failed', 'error': str(error)}
            failures.append(model['id'])
        print(json.dumps({'id': model['id'], 'validation': model['validation']}), flush=True)
    manifest['validation'] = {'mode': 'structural-only', 'sample_policy': 'kind-balanced, evenly spaced',
                              'models': [model['id'] for model in selected], 'failures': failures}
    write_manifest(args.manifest, manifest)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
