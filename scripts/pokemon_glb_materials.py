from __future__ import annotations

import hashlib
import json
import math
import struct
import xml.etree.ElementTree as ET

from glb_native_clips import decode_glb, encode_glb
from pica_vertex_colors import dae_color_reference, normalize_vertex_colors

COLLADA_NS = '{http://www.collada.org/2005/11/COLLADASchema}'
WRAP_MODES = {'WRAP': 10497, 'REPEAT': 10497, 'MIRROR': 33648, 'MIRRORED_REPEAT': 33648,
              'CLAMP': 33071, 'CLAMP_TO_EDGE': 33071}
GLTF_UV_FLIP_MARKER = 'pokemonMaterialNormalization'


def dae_material_sampling(dae: bytes) -> dict[str, dict]:
    root = ET.fromstring(dae)
    materials = {effect.get('id'): effect for effect in root.findall(f'.//{COLLADA_NS}effect')}
    result = {}
    for material in root.findall(f'.//{COLLADA_NS}library_materials/{COLLADA_NS}material'):
        name = material.get('name') or material.get('id')
        reference = material.find(f'{COLLADA_NS}instance_effect')
        effect = materials.get((reference.get('url', '')[1:] if reference is not None else ''))
        if effect is None:
            continue
        texture = diffuse_texture(effect)
        if texture is None:
            continue
        sampler = sampler_for_texture(effect, texture)
        result[name] = {'wrapS': wrap_mode(sampler.findtext(f'{COLLADA_NS}wrap_s', 'WRAP')),
                        'wrapT': wrap_mode(sampler.findtext(f'{COLLADA_NS}wrap_t', 'WRAP')),
                        'texCoord': dae_texture_channel(root, material.get('id'), texture.get('texcoord', 'UV0'))}
    return result


def diffuse_texture(effect: ET.Element) -> ET.Element | None:
    for technique in effect.findall(f'{COLLADA_NS}profile_COMMON/{COLLADA_NS}technique'):
        for shading in ('constant', 'lambert', 'phong', 'blinn'):
            texture = technique.find(f'{COLLADA_NS}{shading}/{COLLADA_NS}diffuse/{COLLADA_NS}texture')
            if texture is not None:
                return texture
    return None


def sampler_for_texture(effect: ET.Element, texture: ET.Element) -> ET.Element:
    sampler_name = texture.get('texture')
    for parameter in effect.findall(f'{COLLADA_NS}profile_COMMON/{COLLADA_NS}newparam'):
        if parameter.get('sid') == sampler_name:
            sampler = parameter.find(f'{COLLADA_NS}sampler2D')
            if sampler is not None:
                return sampler
    raise ValueError(f"COLLADA texture {sampler_name!r} has no sampler2D")


def wrap_mode(value: str) -> int:
    normalized = value.strip().upper().replace('-', '_')
    if normalized not in WRAP_MODES:
        raise ValueError(f'Unsupported Pokémon texture wrap mode {value!r}')
    return WRAP_MODES[normalized]


def semantic_channel(semantic: str) -> int:
    if not semantic.startswith('UV') or not semantic[2:].isdigit():
        raise ValueError(f'Unsupported Pokémon texture coordinate semantic {semantic!r}; expected UV0/UV1/...')
    return int(semantic[2:])


def dae_texture_channel(root: ET.Element, material_id: str | None, semantic: str) -> int:
    controller_sources = {controller.get('id'): skin.get('source', '').lstrip('#')
                          for controller in root.findall(f'.//{COLLADA_NS}controller')
                          if (skin := controller.find(f'{COLLADA_NS}skin')) is not None}
    geometry_sets = {}
    for geometry in root.findall(f'.//{COLLADA_NS}library_geometries/{COLLADA_NS}geometry'):
        sets = {int(row.get('set', '0')) for row in geometry.findall(f'.//{COLLADA_NS}input')
                if row.get('semantic') == 'TEXCOORD'}
        geometry_sets[geometry.get('id')] = sorted(sets)

    channels = set()
    instances = [*root.findall(f'.//{COLLADA_NS}instance_geometry'),
                 *root.findall(f'.//{COLLADA_NS}instance_controller')]
    for instance in instances:
        target = instance.get('url', '').lstrip('#')
        geometry_id = controller_sources.get(target, target)
        sets = geometry_sets.get(geometry_id, [])
        for material in instance.findall(f'.//{COLLADA_NS}instance_material'):
            if material.get('target', '').lstrip('#') != material_id:
                continue
            binding = next((row for row in material.findall(f'{COLLADA_NS}bind_vertex_input')
                            if row.get('semantic') == semantic and row.get('input_semantic') == 'TEXCOORD'), None)
            if binding is None:
                continue
            input_set = int(binding.get('input_set', str(semantic_channel(semantic))))
            if input_set not in sets:
                raise ValueError(f'COLLADA material {material_id!r} binds {semantic} to missing TEXCOORD set {input_set}')
            channels.add(sets.index(input_set))
    if len(channels) > 1:
        raise ValueError(f'COLLADA material {material_id!r} binds {semantic} to multiple GLTF UV channels {sorted(channels)}')
    return next(iter(channels), semantic_channel(semantic))


def accessor_values(scene: dict, binary: bytearray, index: int) -> list[tuple[float, float]]:
    accessor = scene['accessors'][index]
    if accessor.get('componentType') != 5126 or accessor.get('type') != 'VEC2' or 'sparse' in accessor:
        raise ValueError(f'Pokémon UV accessor {index}: expected nonsparse float32 VEC2')
    view = scene['bufferViews'][accessor['bufferView']]
    stride = view.get('byteStride', 8)
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    values = [struct.unpack_from('<2f', binary, start + position * stride)
              for position in range(accessor['count'])]
    if not all(math.isfinite(value) for uv in values for value in uv):
        raise ValueError(f'Pokémon UV accessor {index}: contains a nonfinite value')
    return values


def flip_uv_v(scene: dict, binary: bytearray) -> int:
    indices = {index for mesh in scene.get('meshes', []) for primitive in mesh['primitives']
               for name, index in primitive['attributes'].items() if name.startswith('TEXCOORD_')}
    for index in indices:
        accessor = scene['accessors'][index]
        values = accessor_values(scene, binary, index)
        view = scene['bufferViews'][accessor['bufferView']]
        stride = view.get('byteStride', 8)
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        corrected = [(u, 1.0 - v) for u, v in values]
        for position, uv in enumerate(corrected):
            struct.pack_into('<2f', binary, start + position * stride, *uv)
        accessor['min'] = [min(uv[0] for uv in corrected), min(uv[1] for uv in corrected)]
        accessor['max'] = [max(uv[0] for uv in corrected), max(uv[1] for uv in corrected)]
    return len(indices)


def sampler_for(scene: dict, wraps: tuple[int, int]) -> int:
    samplers = scene.setdefault('samplers', [])
    for index, sampler in enumerate(samplers):
        if sampler.get('wrapS', 10497) == wraps[0] and sampler.get('wrapT', 10497) == wraps[1]:
            return index
    samplers.append({'wrapS': wraps[0], 'wrapT': wraps[1]})
    return len(samplers) - 1


def validate_material_sampling(scene: dict, material_sampling: dict[str, dict]) -> int:
    checked = 0
    for index, material in enumerate(scene.get('materials', [])):
        texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture is None:
            continue
        name = material.get('name', f'material-{index}')
        expected = material_sampling.get(name)
        if expected is None:
            raise ValueError(f"Pokémon material {name!r} has a baseColorTexture but no COLLADA evidence")
        if texture.get('texCoord', 0) != expected['texCoord']:
            raise ValueError(f"Pokémon material {name!r} selects TEXCOORD_{texture.get('texCoord', 0)}; expected TEXCOORD_{expected['texCoord']}")
        try:
            texture_row = scene['textures'][texture['index']]
            sampler_index = texture_row.get('sampler', 0)
            sampler = scene.get('samplers', [])[sampler_index]
        except (IndexError, KeyError, TypeError) as error:
            raise ValueError(f"Pokémon material {name!r} has an invalid texture or sampler reference") from error
        wraps = (sampler.get('wrapS', 10497), sampler.get('wrapT', 10497))
        if wraps != (expected['wrapS'], expected['wrapT']):
            raise ValueError(f"Pokémon material {name!r} sampler wraps {wraps}; expected {(expected['wrapS'], expected['wrapT'])}")
        checked += 1
    return checked


def assign_pica_samplers(scene: dict, material_sampling: dict[str, dict]) -> int:
    groups: dict[tuple[int, int, int], list[int]] = {}
    for index, material in enumerate(scene.get('materials', [])):
        texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if texture is None:
            continue
        name = material.get('name', f'material-{index}')
        proof = material_sampling.get(name)
        if proof is None:
            raise ValueError(f"Pokémon material {name!r} has a baseColorTexture but no COLLADA evidence")
        channel = proof['texCoord']
        if texture.get('texCoord', 0) != channel:
            texture['texCoord'] = channel
        for mesh in scene.get('meshes', []):
            for primitive in mesh['primitives']:
                if primitive.get('material') == index and f'TEXCOORD_{channel}' not in primitive['attributes']:
                    raise ValueError(f"Pokémon material {name!r} needs TEXCOORD_{channel}, which its GLB primitive lacks")
        wraps = (proof['wrapS'], proof['wrapT'])
        groups.setdefault((texture['index'], *wraps), []).append(index)

    by_texture: dict[int, list[tuple[tuple[int, int], list[int]]]] = {}
    for (texture_index, wrap_s, wrap_t), materials in groups.items():
        by_texture.setdefault(texture_index, []).append(((wrap_s, wrap_t), materials))
    assigned = 0
    for texture_index, variants in by_texture.items():
        for variant_index, (wraps, materials) in enumerate(variants):
            target = texture_index
            if variant_index:
                scene['textures'].append(dict(scene['textures'][texture_index]))
                target = len(scene['textures']) - 1
                for material_index in materials:
                    scene['materials'][material_index]['pbrMetallicRoughness']['baseColorTexture']['index'] = target
            scene['textures'][target]['sampler'] = sampler_for(scene, wraps)
            assigned += len(materials)
    return assigned


def restore_pokemon_vertex_colors(blob: bytes, dae: bytes, marker: dict) -> bytes:
    proof = marker.get('vertexColorProof')
    dae_sha = hashlib.sha256(dae).hexdigest()
    if proof is not None:
        if proof.get('daeSha256') != dae_sha:
            raise ValueError('Pokémon vertex color evidence was built from different COLLADA data')
        return blob

    references = dae_color_reference(dae)
    evidence = {'inputSha256': hashlib.sha256(blob).hexdigest(), 'daeSha256': dae_sha,
                'referenceSha256': hashlib.sha256(json.dumps(references, sort_keys=True).encode()).hexdigest(),
                'alphaPolicy': 'preserve-glb-alpha'}
    corrected, materials = normalize_vertex_colors(blob, references, evidence,
                                                    require_matching_alpha=False)
    scene, binary = decode_glb(corrected)
    scene['asset']['extras'][GLTF_UV_FLIP_MARKER]['vertexColorProof'] = {
        **evidence, 'evidenceSha256': hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest(),
        'materials': materials}
    return encode_glb(scene, binary)


def normalize_pokemon_glb(blob: bytes, dae: bytes) -> bytes:
    scene, source_binary = decode_glb(blob)
    extras = scene.setdefault('asset', {}).setdefault('extras', {})
    marker = extras.get(GLTF_UV_FLIP_MARKER)
    dae_sha = hashlib.sha256(dae).hexdigest()
    material_sampling = dae_material_sampling(dae)
    if marker is not None:
        if marker.get('version') != 1:
            raise ValueError(f'Unsupported Pokémon material normalization marker: {marker!r}')
        if marker.get('daeSha256') is not None and marker['daeSha256'] != dae_sha:
            raise ValueError('Normalized Pokémon GLB was built from different COLLADA evidence; regenerate it from the original GLB')
        validate_material_sampling(scene, material_sampling)
        return restore_pokemon_vertex_colors(blob, dae, marker)

    binary = bytearray(source_binary)
    uv_accessors = flip_uv_v(scene, binary)
    material_count = assign_pica_samplers(scene, material_sampling)
    validate_material_sampling(scene, material_sampling)
    evidence = {'daeSha256': hashlib.sha256(dae).hexdigest(), 'uvAccessors': uv_accessors,
                'materials': material_sampling, 'assignedMaterials': material_count}
    extras[GLTF_UV_FLIP_MARKER] = {'version': 1,
                                   'sourceSha256': hashlib.sha256(blob).hexdigest(),
                                   'evidenceSha256': hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest(),
                                   'daeSha256': dae_sha,
                                   'materialSampling': material_sampling,
                                   'uvAccessors': uv_accessors, 'materials': material_count}
    normalized = encode_glb(scene, bytes(binary))
    return restore_pokemon_vertex_colors(normalized, dae, extras[GLTF_UV_FLIP_MARKER])
