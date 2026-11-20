from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from audit_pica_materials import inspect_native, vertex_color_audit
from build_native_manifest import model_table_record
from extract_pokemon_glb import SPICA_EXPORT
from glb_native_clips import decode_glb
from native_motions import read_garc_entry
from pokemon_glb_materials import dae_material_sampling, normalize_pokemon_glb
from promote_native_assets import publish_asset

MODEL_TAG = re.compile(rb'pm\d{4}_\d{2}')


def catalog_models(catalog: dict) -> list[dict]:
    rows = [model for model in catalog.get('models', []) if model.get('id', '').startswith('pokemon/')]
    if not rows:
        raise ValueError('Runtime catalog has no pokemon/* records to reprocess')
    return rows


def model_tag(model: dict) -> str:
    tag = Path(model['source']).stem
    if not re.fullmatch(r'pm\d{4}_\d{2}', tag):
        raise ValueError(f"Pokemon model {model['id']} has no pmNNNN_NN source tag in {model['source']}")
    return tag


def catalog_slug(model: dict, catalog: dict) -> str:
    matches = [name for name, url in catalog['pokemon'].items() if url == model['url']]
    if len(matches) != 1:
        raise ValueError(f"Pokemon model {model['id']} maps to {len(matches)} catalog slugs; expected one")
    return matches[0]


def source_model(garc: Path, table: bytes, model: dict, tag: str) -> tuple[bytes, bytes]:
    _species, species_id, variant = model['id'].split('/')
    slot = model_table_record(table, int(species_id), int(variant))['model_slot']
    pc = read_garc_entry(garc, slot)
    tags = sorted({value.decode() for value in MODEL_TAG.findall(pc)})
    if pc[:2] != b'PC' or tags != [tag]:
        raise ValueError(f"GARC slot {slot} for {model['id']} contains {tags!r}; expected {tag}")
    textures = read_garc_entry(garc, slot + 2)
    if textures[:2] != b'PT':
        raise ValueError(f"GARC texture slot {slot + 2} for {tag} starts with {textures[:4]!r}; expected PT")
    return pc, textures


def export_dae(pc: bytes, textures: bytes, tag: str, directory: Path, spica_export: Path) -> tuple[Path, Path]:
    pc_path, pt_path = directory / f'{tag}.pc', directory / f'{tag}.pt'
    dae_path = directory / f'{tag}.dae'
    pc_path.write_bytes(pc)
    pt_path.write_bytes(textures)
    result = subprocess.run([str(spica_export), str(pc_path), str(dae_path), str(pt_path)],
                            capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f'SpicaExport failed for {tag}: {result.stdout}\n{result.stderr}')
    if not dae_path.is_file():
        raise ValueError(f'SpicaExport returned success without a DAE for {tag}')
    return dae_path, pc_path


def pica_material_summary(native: dict, name: str) -> dict | None:
    index = next((i for i, material in enumerate(native['materials']) if material['Name'] == name), None)
    if index is None:
        return None
    material = native['materials'][index]
    meshes = [mesh for mesh in native['meshes'] if mesh['MaterialIndex'] == index]
    sources = sorted({source for stage in material['TexEnvStages']
                      for channel in ('Color', 'Alpha')
                      for source in stage['Source'][channel]})
    bounds = [value for mesh in meshes for key in ('colorMin', 'colorMax')
              if (value := mesh[key]) is not None]
    vertex_color_rgb_white = (None if not bounds else
                              all(abs(channel - 1) < 0.00001
                                  for row in bounds for channel in row[:3]))
    return {'textureNames': material['textureNames'],
            'wrapU': material['TextureMappers'][0]['WrapU'],
            'wrapV': material['TextureMappers'][0]['WrapV'],
            'texture0Scale': material['TextureCoords'][0]['Scale'],
            'texture0Translation': material['TextureCoords'][0]['Translation'],
            'texCoordConfig': material['TexCoordConfig'],
            'combinerSources': sources,
            'vertexColorSource': sorted({mesh['colorSource'] for mesh in meshes}),
            'vertexColorRgbWhite': vertex_color_rgb_white}


def current_sampler(scene: dict, material: dict) -> dict:
    texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if texture is None:
        return {'texCoord': None, 'wrapS': None, 'wrapT': None}
    textures = scene.get('textures', [])
    texture_row = textures[texture['index']]
    sampler = scene.get('samplers', [{}])[texture_row.get('sampler', 0)]
    return {'texCoord': texture.get('texCoord', 0), 'wrapS': sampler.get('wrapS', 10497),
            'wrapT': sampler.get('wrapT', 10497)}


def inspect_model(model: dict, tag: str, dae: bytes, native: dict, source: Path) -> dict:
    scene, binary = decode_glb(source.read_bytes())
    sampling = dae_material_sampling(dae)
    native_model = native['models'][0]
    colors = {row['material']: row for row in vertex_color_audit(scene, binary, native_model)}
    rows = []
    for material in scene.get('materials', []):
        expected = sampling.get(material.get('name'))
        actual = current_sampler(scene, material)
        if expected is None:
            continue
        rows.append({'name': material.get('name'), 'expected': expected, 'current': actual,
                     'wrapMatchesNativePica': (expected['wrapS'] == {'Repeat': 10497, 'Mirror': 33648, 'Clamp': 33071}[pica_material_summary(native_model, material['name'])['wrapU']]
                                                and expected['wrapT'] == {'Repeat': 10497, 'Mirror': 33648, 'Clamp': 33071}[pica_material_summary(native_model, material['name'])['wrapV']]),
                     'nativePica': pica_material_summary(native_model, material['name']),
                     'vertexColors': colors.get(material.get('name'))})
    names = [node.get('name', '') for node in scene.get('nodes', [])
             if re.search(r'mouth|iris|eye', node.get('name', ''), re.IGNORECASE)]
    return {'id': model['id'], 'tag': tag, 'source': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'materials': rows, 'expressionMeshes': names,
            'visibilityChannels': sum(channel.get('target', {}).get('path') == 'visibility'
                                      for animation in scene.get('animations', [])
                                      for channel in animation.get('channels', []))}


def normalize_paths(root: Path, catalog: dict, daes: dict[str, bytes]) -> dict[Path, bytes]:
    outputs: dict[Path, bytes] = {}
    paths_by_tag: dict[str, set[Path]] = {}
    for model in catalog_models(catalog):
        tag = model_tag(model)
        paths_by_tag.setdefault(tag, set()).add(root / model['source'])
        paths_by_tag[tag].add(root / f'rom/extracted/models/pokemon/{tag}/{tag}.glb')
    for asset in sorted((root / 'public/assets/pokemon').glob('*/*.glb')):
        slug = asset.parent.name
        url = catalog.get('pokemon', {}).get(slug)
        record = next((model for model in catalog_models(catalog) if model.get('url') == url), None)
        if record is None:
            raise ValueError(f'Legacy Pokemon GLB {asset} has no source record for catalog slug {slug}')
        paths_by_tag.setdefault(model_tag(record), set()).add(asset)

    for tag, paths in paths_by_tag.items():
        for path in paths:
            if not path.is_file():
                raise FileNotFoundError(f'Pokemon model {tag} is missing its generated GLB: {path}')
            outputs[path] = normalize_pokemon_glb(path.read_bytes(), daes[tag])
    return outputs


def reprocess(root: Path, catalog_path: Path, garc: Path, spica_export: Path,
              spica_dll: Path, report_path: Path) -> dict:
    catalog = json.loads(catalog_path.read_text())
    models = catalog_models(catalog)
    table = read_garc_entry(garc, 0)
    daes: dict[str, bytes] = {}
    pc_paths: dict[str, Path] = {}
    with tempfile.TemporaryDirectory(prefix='oras-pokemon-fix-') as temporary:
        directory = Path(temporary)
        for model in models:
            tag = model_tag(model)
            if tag in daes:
                continue
            pc, textures = source_model(garc, table, model, tag)
            dae_path, pc_path = export_dae(pc, textures, tag, directory, spica_export)
            daes[tag], pc_paths[tag] = dae_path.read_bytes(), pc_path
        native_rows = inspect_native(list(pc_paths.values()), spica_dll)
        native_by_tag = dict(zip(pc_paths, native_rows))
        audit = [inspect_model(model, model_tag(model), daes[model_tag(model)],
                               native_by_tag[model_tag(model)], root / model['source']) for model in models]
        outputs = normalize_paths(root, catalog, daes)
        for path, blob in outputs.items():
            if path.read_bytes() != blob:
                path.write_bytes(blob)

        for model in models:
            slug = catalog_slug(model, catalog)
            source = root / model['source']
            url, digest = publish_asset(root, source, 'pokemon', slug)
            model['url'], model['sha256'] = url, digest
            catalog['pokemon'][slug] = url

    report = {'models': audit, 'summary': {
        'pokemonModels': len(models), 'sourceTags': len(daes), 'normalizedGlbs': len(outputs),
        'materialBindings': sum(len(model['materials']) for model in audit),
        'wrongTexCoord': sum(row['current']['texCoord'] != row['expected']['texCoord']
                             for model in audit for row in model['materials']),
        'wrongWrap': sum((row['current']['wrapS'], row['current']['wrapT']) !=
                         (row['expected']['wrapS'], row['expected']['wrapT'])
                         for model in audit for row in model['materials']),
        'expressionMeshes': sum(bool(model['expressionMeshes']) for model in audit),
        'modelsWithVisibilityChannels': sum(bool(model['visibilityChannels']) for model in audit)}}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
    return report['summary']


def main() -> None:
    parser = argparse.ArgumentParser(description='Re-export PICA material evidence, normalize and promote catalogued Pokemon GLBs.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--garc', type=Path)
    parser.add_argument('--spica-export', type=Path, default=SPICA_EXPORT)
    parser.add_argument('--spica-dll', required=True, type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    summary = reprocess(root, args.catalog.resolve(),
                        (args.garc or root / 'rom/extracted/RomFS/a/0/0/8').resolve(),
                        args.spica_export.resolve(), args.spica_dll.resolve(),
                        (args.report or root / 'rom/pokemon-material-normalization.json').resolve())
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
