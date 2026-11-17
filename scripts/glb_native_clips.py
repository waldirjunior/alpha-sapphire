from __future__ import annotations

import copy
import json
import math
import struct


def decode_glb(blob: bytes) -> tuple[dict, bytes]:
    if len(blob) < 28 or struct.unpack_from('<4sII', blob) != (b'glTF', 2, len(blob)):
        raise ValueError('Expected a complete glTF 2 GLB')
    length, kind = struct.unpack_from('<II', blob, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Expected GLB JSON chunk')
    scene = json.loads(blob[20:20 + length])
    offset = 20 + length
    binary_length, binary_kind = struct.unpack_from('<II', blob, offset)
    if binary_kind != 0x004E4942 or offset + 8 + binary_length != len(blob):
        raise ValueError('Expected one embedded GLB BIN chunk')
    if len(scene.get('buffers', [])) != 1 or 'uri' in scene['buffers'][0]:
        raise ValueError('Expected one embedded GLB buffer without URI')
    return scene, blob[offset + 8:offset + 8 + scene['buffers'][0]['byteLength']]


def encode_glb(scene: dict, binary: bytes) -> bytes:
    document = json.dumps(scene, separators=(',', ':'), allow_nan=False).encode()
    document += b' ' * (-len(document) % 4)
    payload = binary + b'\0' * (-len(binary) % 4)
    return (struct.pack('<4sII', b'glTF', 2, 28 + len(document) + len(payload))
            + struct.pack('<II', len(document), 0x4E4F534A) + document
            + struct.pack('<II', len(payload), 0x004E4942) + payload)


def node_names(scene: dict) -> dict[str, int]:
    names = {}
    for index in scene['skins'][0]['joints']:
        name = scene['nodes'][index].get('name')
        if name is None:
            continue
        if name in names:
            raise ValueError(f'Duplicate GLB node name {name!r}; retargeting is ambiguous')
        names[name] = index
    return names


def accessor_values(scene: dict, binary: bytes, index: int) -> list[tuple[float, ...]]:
    accessor = scene['accessors'][index]
    if accessor.get('componentType') != 5126 or 'sparse' in accessor:
        raise ValueError(f'Expected non-sparse float accessor {index}')
    components = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']]
    view = scene['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', components * 4)
    values = [struct.unpack_from(f'<{components}f', binary, start + i * stride)
              for i in range(accessor['count'])]
    if not all(math.isfinite(value) for row in values for value in row):
        raise ValueError(f'Non-finite values in accessor {index}')
    return values


def joint_bind_poses(scene: dict, binary: bytes) -> dict[str, tuple[float, ...]]:
    if len(scene.get('skins', [])) != 1:
        raise ValueError('Native clip integration requires exactly one skin per GLB')
    skin = scene['skins'][0]
    matrices = accessor_values(scene, binary, skin['inverseBindMatrices'])
    return {scene['nodes'][node]['name']: matrix for node, matrix in zip(skin['joints'], matrices, strict=True)}


def verify_rigs(base: dict, binary: bytes, source: dict, clip_binary: bytes) -> dict[str, int]:
    targets = joint_bind_poses(base, binary)
    joints = joint_bind_poses(source, clip_binary)
    names = node_names(base)
    node_names(source)
    for name, matrix in joints.items():
        if name not in targets:
            raise ValueError(f'Native joint {name!r} is absent in target skin')
        if not all(math.isclose(a, b, rel_tol=1e-5, abs_tol=1e-4) for a, b in zip(matrix, targets[name])):
            raise ValueError(f'Native joint {name!r} has incompatible inverse bind pose')
    return names


def append_native_clip(base: dict, binary: bytes, source: dict, clip_binary: bytes,
                       name: str, provenance: dict | None = None) -> tuple[dict, bytes]:
    names = verify_rigs(base, binary, source, clip_binary)
    if len(source.get('animations', [])) != 1:
        raise ValueError('Expected exactly one source animation per native clip')
    scene = copy.deepcopy(base)
    animation = copy.deepcopy(source['animations'][0])
    payload = bytearray(binary)
    accessors, views = {}, {}
    for sampler in animation['samplers']:
        for field in ('input', 'output'):
            index = sampler[field]
            if index not in accessors:
                accessor_values(source, clip_binary, index)
                accessors[index] = copy_accessor(scene, payload, source, clip_binary, index, views)
            sampler[field] = accessors[index]
    for channel in animation['channels']:
        target = channel['target']
        source_name = source['nodes'][target['node']]['name']
        if source_name not in names:
            raise ValueError(f'Animated node {source_name!r} is absent in target GLB')
        target['node'] = names[source_name]
    animation['name'] = name
    animation['extras'] = {**animation.get('extras', {}), 'nativeGF1': True, **(provenance or {})}
    scene['animations'] = [clip for clip in scene.get('animations', []) if clip.get('name') != name] + [animation]
    scene['buffers'][0]['byteLength'] = len(payload)
    return scene, bytes(payload)


def copy_accessor(scene: dict, payload: bytearray, source: dict, clip_binary: bytes,
                  index: int, views: dict[int, int]) -> int:
    accessor = copy.deepcopy(source['accessors'][index])
    view_index = accessor['bufferView']
    if view_index not in views:
        view = copy.deepcopy(source['bufferViews'][view_index])
        start, length = view.get('byteOffset', 0), view['byteLength']
        if view.get('buffer', 0) != 0 or start + length > len(clip_binary):
            raise ValueError(f'Invalid native bufferView {view_index}')
        payload.extend(b'\0' * (-len(payload) % 4))
        view['byteOffset'] = len(payload)
        payload.extend(clip_binary[start:start + length])
        views[view_index] = len(scene['bufferViews'])
        scene['bufferViews'].append(view)
    accessor['bufferView'] = views[view_index]
    result = len(scene['accessors'])
    scene['accessors'].append(accessor)
    return result
