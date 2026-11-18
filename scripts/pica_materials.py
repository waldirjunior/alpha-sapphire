from __future__ import annotations

import hashlib
import json
from itertools import product
import math
import struct

from character_face_uv import append_uv_accessor
from glb_native_clips import decode_glb, encode_glb


def float_values(scene: dict, binary: bytes, index: int, width: int) -> list[tuple]:
    accessor = scene['accessors'][index]
    if accessor['componentType'] != 5126 or 'sparse' in accessor:
        raise ValueError(f'PICA accessor {index}: expected nonsparse float32')
    view = scene['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    values = [struct.unpack_from('<' + 'f' * width, binary, start + i * view.get('byteStride', width * 4))
              for i in range(accessor['count'])]
    if not all(math.isfinite(x) for row in values for x in row):
        raise ValueError(f'PICA accessor {index}: nonfinite values')
    return values


def position_uvs(scene: dict, binary: bytes, primitives: list[dict]) -> list[list]:
    rows = []
    for primitive in primitives:
        attrs = primitive['attributes']
        positions = float_values(scene, binary, attrs['POSITION'], 3)
        uvs = float_values(scene, binary, attrs['TEXCOORD_0'], 2)
        if len(positions) != len(uvs):
            raise ValueError('PICA position/UV vertex counts differ')
        rows.extend([*pos, *uv] for pos, uv in zip(positions, uvs))
    return rows


def vertex_bucket(row: list) -> tuple:
    return tuple(math.floor(x * 100) for x in row[:3])


def matching_vertex(row: list, buckets: dict, mirror: bool) -> bool:
    bucket = vertex_bucket(row)
    v = 1-row[4] if mirror else row[4]
    for delta in product((-1, 0, 1), repeat=3):
        candidates = buckets.get(tuple(x+y for x, y in zip(bucket, delta)), ())
        if any(all(abs(a-b) < .001 for a, b in zip(row[:3], ref[:3])) and
               abs(row[3]-ref[3]) < .000002 and abs(v-ref[4]) < .000002 for ref in candidates):
            return True
    return False


def uv_orientation(native: list, actual: list) -> str:
    if not native or not actual:
        return 'unproven'
    buckets: dict = {}
    for row in native:
        buckets.setdefault(vertex_bucket(row), []).append(row)
    direct = all(matching_vertex(row, buckets, False) for row in actual)
    mirrored = all(matching_vertex(row, buckets, True) for row in actual)
    return 'ambiguous' if direct and mirrored else 'original' if direct else 'mirrored' if mirrored else 'unproven'


def alpha_source(material: dict, stage_index: int, source: str, previous: tuple | None,
                 slot: int, vertex_alpha: bool) -> tuple | None:
    if source == f'Texture{slot}':
        return ('texture',)
    if source == 'Previous':
        return previous
    if source == 'PrimaryColor':
        return ('vertex',) if vertex_alpha else ()
    if source == 'Constant':
        assignment = material.get('constantAssignments', [0]*6)[stage_index]
        color = material.get(f'Constant{assignment}Color', {})
        return () if color.get('A') == 255 else None
    return None


def alpha_terms(material: dict, slot: int, vertex_alpha: bool) -> tuple | None:
    previous = None
    for index, stage in enumerate(material['TexEnvStages']):
        mode = stage['Combiner']['Alpha']
        count = 1 if mode == 'Replace' else 2 if mode == 'Modulate' else 0
        if not count or stage['Scale']['Alpha'] != 'One' or stage.get('UpdateAlphaBuffer'):
            previous = None
            continue
        terms = [alpha_source(material, index, source, previous, slot, vertex_alpha)
                 if operand == 'Alpha' else None for source, operand in
                 zip(stage['Source']['Alpha'][:count], stage['Operand']['Alpha'][:count])]
        previous = tuple(term for group in terms for term in group) if all(t is not None for t in terms) else None
    return previous


def blend_kind(blend: dict, prefix: str) -> str | None:
    pair = blend[f'{prefix}SrcFunc'], blend[f'{prefix}DstFunc']
    return {('One', 'Zero'): 'replace', ('SourceAlpha', 'OneMinusSourceAlpha'): 'source-alpha'}.get(pair)


def alpha_profile(material: dict, slot: int, vertex_alpha: bool) -> dict | None:
    terms = alpha_terms(material, slot, vertex_alpha)
    expected = ('texture', 'vertex') if vertex_alpha else ('texture',)
    operation, blend, test = material['ColorOperation'], material['BlendFunction'], material['AlphaTest']
    if terms is None or sorted(terms) != sorted(expected) or operation != {'BlendMode': 'Blend', 'FragOpMode': 'Default'}:
        return None
    if blend['ColorEquation'] != 'FuncAdd' or blend['AlphaEquation'] != 'FuncAdd':
        return None
    color, alpha = blend_kind(blend, 'Color'), blend_kind(blend, 'Alpha')
    if color is None or alpha is None:
        return None
    function = test['Function'] if test['Enabled'] else 'Always'
    reference = test['Reference']
    if function not in ('Greater', 'Gequal', 'Always') or not 0 <= reference <= 255:
        return None
    cutoff = 0 if function == 'Always' else (reference + (function == 'Greater')) / 255
    return {'cutoff': cutoff, 'blend': color, 'alphaBlend': alpha,
            'depthWrite': material['DepthColorMask']['DepthWrite']}


def patch_alpha(material: dict, profile: dict) -> None:
    material.setdefault('extras', {}).update(pica=True, picaAlpha=profile)
    material['alphaMode'] = 'BLEND' if profile['blend'] == 'source-alpha' else 'MASK' if profile['cutoff'] else 'OPAQUE'
    material.pop('alphaCutoff', None)
    if material['alphaMode'] == 'MASK':
        material['alphaCutoff'] = profile['cutoff']


def patch_material(scene: dict, binary: bytearray, proof: dict, cache: dict) -> bool:
    index = next((i for i, m in enumerate(scene['materials']) if m.get('name') == proof['material']), None)
    if index is None:
        return False
    changed = False
    if proof.get('alpha') is not None:
        patch_alpha(scene['materials'][index], proof['alpha'])
        changed = True
    if proof.get('uv_orientation') != 'mirrored' or not proof.get('image_match') or not proof.get('uv_identity_base'):
        return changed
    for mesh in scene['meshes']:
        for primitive in mesh['primitives']:
            if primitive.get('material') != index:
                continue
            source = primitive['attributes']['TEXCOORD_0']
            if source not in cache:
                cache[source] = append_uv_accessor(scene, binary, source, float_values(scene, binary, source, 2))
            primitive['attributes']['TEXCOORD_0'] = cache[source]
    return True


def normalize_pica_materials(blob: bytes, evidence: dict) -> bytes:
    scene, original = decode_glb(blob)
    source_sha = evidence['glb_sha256']
    marker = scene['asset'].get('extras', {}).get('picaMaterialNormalization', {})
    proof_sha = hashlib.sha256(json.dumps(evidence['materials'], sort_keys=True).encode()).hexdigest()
    if marker.get('inputSha256') == source_sha and marker.get('evidenceSha256') == proof_sha:
        return blob
    if hashlib.sha256(blob).hexdigest() != source_sha:
        raise ValueError(f'PICA GLB SHA does not match evidence {source_sha}')
    binary, cache = bytearray(original), {}
    changed = [row['material'] for row in evidence['materials'] if patch_material(scene, binary, row, cache)]
    if not changed:
        return blob
    scene['buffers'][0]['byteLength'] = len(binary)
    scene['asset'].setdefault('extras', {})['picaMaterialNormalization'] = {
        'inputSha256': source_sha, 'evidenceSha256': proof_sha, 'materials': changed}
    return encode_glb(scene, bytes(binary))
