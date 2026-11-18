from __future__ import annotations

import argparse
import hashlib
import json
import io
import subprocess
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image

from native_motions import package_sections
from character_face_uv import face_rejection, matching_bounds, uv_bounds
from audit_character_uv import uv_values
from glb_native_clips import decode_glb
from promote_native_assets import character_ids, model_source


def image_matches(face: dict, scene: dict, binary: bytes, texture: int) -> bool:
    image = scene['images'][scene['textures'][texture]['source']]
    view = scene['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    with Image.open(io.BytesIO(binary[start:start + view['byteLength']])) as png:
        return (png.size == (face['width'], face['height']) and
                hashlib.sha256(png.convert('RGBA').tobytes()).hexdigest() == face['rgba_sha256'])


def verify_face(face: dict, scene: dict, binary: bytes) -> dict:
    primitives = [p for mesh in scene['meshes'] for p in mesh['primitives']
                  if scene['materials'][p['material']]['name'] == face['material']]
    matches, values = [], []
    for primitive in primitives:
        material = scene['materials'][primitive['material']]
        info = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if info is None:
            continue
        matches.append(image_matches(face, scene, binary, info['index']))
        values.extend(uv_values(scene, binary, primitive['attributes'][f"TEXCOORD_{info.get('texCoord', 0)}"]))
    actual = uv_bounds(values) if values else []
    expected = face['uv_bounds']
    original = bool(actual) and matching_bounds(actual, expected)
    mirrored = bool(actual) and matching_bounds(actual, [*expected[:2], 1 - expected[3], 1 - expected[2]])
    orientation = 'ambiguous' if original and mirrored else 'original' if original else 'mirrored' if mirrored else 'mismatch'
    verified = {**face, 'glb_uv_bounds': actual, 'image_match': bool(matches) and all(matches),
                'uv_orientation': orientation}
    return {**verified, 'exclusion': face_rejection(verified)}


def verified_faces(row: dict, blob: bytes) -> list[dict]:
    scene, binary = decode_glb(blob)
    selected = {}
    priority = lambda face: (face['exclusion'] is None, face['image_match'],
                             face['uv_orientation'] in ('original', 'mirrored'))
    for face in row['faces']:
        verified = verify_face(face, scene, binary)
        previous = selected.get(face['material'])
        if previous is None or priority(verified) > priority(previous):
            selected[face['material']] = verified
    return list(selected.values())


def manifest_catalog(root: Path, manifest: dict) -> dict:
    wanted = character_ids(root)
    models = []
    for model in manifest['models']:
        if model['kind'] == 'character' and model['model_id'] in wanted:
            source = model_source(root, model)
            if source.is_file():
                models.append({'id': model['id'], 'source': str(source.relative_to(root))})
    return {'models': models}


def inspect_faces(root: Path, catalog: dict, spica: Path, dotnet: Path) -> list[dict]:
    models = [model for model in catalog['models'] if model['id'].startswith('character/')]
    sources = [root / f"rom/extracted/garc/a_0_2_1/{model['id'][-4:]}.bin" for model in models]
    for source in sources:
        sections = package_sections(source.read_bytes())
        if not sections[0].startswith(b'BCH\0'):
            raise ValueError(f'Character model {source}: expected BCH model section')
    with tempfile.TemporaryDirectory(prefix='oras-face-') as directory:
        project = Path(directory) / 'Inspect.csproj'
        source = Path(__file__).with_suffix('.cs').resolve()
        project.write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType>'
            '<TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings>'
            '<NoWarn>CA1416</NoWarn></PropertyGroup><ItemGroup>'
            f'<Reference Include="SPICA"><HintPath>{escape(str(spica))}</HintPath></Reference>'
            f'<Compile Include="{escape(str(source))}" /></ItemGroup></Project>')
        result = subprocess.run([str(dotnet), 'run', '--project', str(project), '--',
                                 *map(str, sources)], check=True, capture_output=True, text=True)
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    if len(rows) != len(models):
        raise ValueError(f'Expected {len(models)} face records, got {len(rows)}')
    return [{**row, 'id': model['id'], 'faces': verified_faces(row, (root / model['source']).read_bytes()),
             'glb_sha256': hashlib.sha256((root / model['source']).read_bytes()).hexdigest(),
             'source_glb': model['source']} for row, model in zip(rows, models)]


def main() -> None:
    parser = argparse.ArgumentParser(description='Inspect original character UVs and BCH expression palettes.')
    parser.add_argument('--root', required=True, type=Path)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--catalog', type=Path)
    selection.add_argument('--manifest', type=Path)
    parser.add_argument('--spica-dll', required=True, type=Path)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    catalog = (json.loads(args.catalog.read_text()) if args.catalog else
               manifest_catalog(root, json.loads(args.manifest.read_text())))
    rows = inspect_faces(root, catalog, args.spica_dll.resolve(), args.dotnet)
    args.output.write_text(json.dumps(rows, indent=2) + '\n')
    print(json.dumps({'models': len(rows), 'faces': sum(len(row['faces']) for row in rows)}))


if __name__ == '__main__':
    main()
