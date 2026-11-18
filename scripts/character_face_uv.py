from __future__ import annotations

import copy
import hashlib
import math
import struct

from audit_character_uv import uv_values
from glb_native_clips import decode_glb, encode_glb


def face_rejection(face: dict) -> str | None:
    if face['target'] not in ('MaterialTexCoord1Trans', 'BaseColorUV'):
        return 'Unsupported material target'
    if face['uv_source'] != 0:
        return 'Native texture does not use UV0'
    if (face['scale'] != [1, 1] or face['rotation'] != 0 or face['translation'] != [0, 0]
            or face['transform'] != 'DccMaya' or face['mapping'] != 'UvCoordinateMap'):
        return 'Unsupported native base texture transform'
    if face.get('image_match') is not True:
        return 'Native/GLB base-color image identity is not proven'
    if face.get('uv_orientation') not in ('original', 'mirrored'):
        return f"Unproven UV orientation: {face.get('uv_orientation', 'missing')}"
    if face['target'] == 'MaterialTexCoord1Trans' and (not face['palette'] or
            face['palette'][0]['translation'] != [0, 0]):
        return 'Nonidentity expression frame zero'
    return None


def supported_face(face: dict) -> bool:
    return face_rejection(face) is None


def uv_bounds(values: list[tuple[float, float]]) -> list[float]:
    if not values or not all(math.isfinite(value) for row in values for value in row):
        raise ValueError('Face UVs require nonempty finite coordinates')
    return [min(row[0] for row in values), max(row[0] for row in values),
            min(row[1] for row in values), max(row[1] for row in values)]


def matching_bounds(actual: list[float], expected: list[float]) -> bool:
    return all(abs(left - right) < 0.000002 for left, right in zip(actual, expected))


def append_uv_accessor(scene: dict, binary: bytearray, index: int, values: list) -> int:
    binary.extend(b'\0' * (-len(binary) % 4))
    offset = len(binary)
    for u, v in values:
        binary.extend(struct.pack('<2f', u, 1 - v))
    view = len(scene['bufferViews'])
    scene['bufferViews'].append({'buffer': 0, 'byteOffset': offset,
                                'byteLength': len(values) * 8, 'target': 34962})
    accessor = copy.deepcopy(scene['accessors'][index])
    accessor.pop('byteOffset', None)
    accessor.update(bufferView=view, min=[min(row[0] for row in values), 1 - max(row[1] for row in values)],
                    max=[max(row[0] for row in values), 1 - min(row[1] for row in values)])
    scene['accessors'].append(accessor)
    return len(scene['accessors']) - 1


def primary_uvs(scene: dict, binary: bytes, primitive: dict) -> list:
    material = scene['materials'][primitive['material']]
    texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture', {})
    index = primitive['attributes'][f"TEXCOORD_{texture.get('texCoord', 0)}"]
    if 'sparse' in scene['accessors'][index]:
        raise ValueError(f"Face {material['name']}: sparse UV accessor {index} is unsupported")
    return uv_values(scene, binary, index)


def normalize_primitive(scene: dict, binary: bytearray, primitive: dict, cache: dict) -> None:
    bounds = uv_bounds(primary_uvs(scene, binary, primitive))
    for name, index in list(primitive['attributes'].items()):
        if not name.startswith('TEXCOORD_'):
            continue
        if 'sparse' in scene['accessors'][index]:
            raise ValueError(f'Sparse face UV accessor {index} is unsupported')
        values = uv_values(scene, binary, index)
        if not matching_bounds(uv_bounds(values), bounds):
            continue
        if index not in cache:
            cache[index] = append_uv_accessor(scene, binary, index, values)
        primitive['attributes'][name] = cache[index]


def normalize_material(scene: dict, binary: bytearray, primitives: list, face: dict, cache: dict) -> bool:
    expected = face['uv_bounds']
    actual = uv_bounds([uv for primitive in primitives for uv in primary_uvs(scene, binary, primitive)])
    if matching_bounds(actual, expected):
        return False
    if not matching_bounds(actual, [*expected[:2], 1 - expected[3], 1 - expected[2]]):
        raise ValueError(f"Face {face['material']}: UV bounds {actual} do not match BCH provenance")
    for primitive in primitives:
        normalize_primitive(scene, binary, primitive, cache)
    return True


def normalize_character_faces(blob: bytes, evidence: dict | None) -> bytes:
    if evidence is None:
        return blob
    faces = {face['material']: face for face in evidence['faces'] if supported_face(face)}
    if not faces:
        return blob
    scene, original = decode_glb(blob)
    previous = scene['asset'].get('extras', {}).get('picaFaceUvNormalization', {})
    source_sha = evidence['glb_sha256']
    digest = hashlib.sha256(blob).hexdigest()
    if digest != source_sha and previous.get('inputSha256') != source_sha:
        model = evidence.get('id', ','.join(faces))
        raise ValueError(f'Character {model}: GLB SHA {digest} does not match face evidence {source_sha}')
    binary, cache, changed = bytearray(original), {}, set()
    primitives = [primitive for mesh in scene['meshes'] for primitive in mesh['primitives']]
    for material, face in faces.items():
        selected = [p for p in primitives if scene['materials'][p['material']]['name'] == material]
        if selected and normalize_material(scene, binary, selected, face, cache):
            changed.add(material)
    if not changed:
        return blob
    scene['buffers'][0]['byteLength'] = len(binary)
    scene['asset'].setdefault('extras', {})['picaFaceUvNormalization'] = {
        'inputSha256': source_sha, 'materials': sorted(changed), 'operation': 'restore-bch-v'}
    return encode_glb(scene, bytes(binary))
