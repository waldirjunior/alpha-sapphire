from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image

from convert_gr_to_glb import _contains_whole_name
from glb_native_clips import decode_glb, encode_glb
from pica_materials import alpha_profile, float_values, normalize_pica_materials, position_uvs, uv_orientation


def sha(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def inspect_native(files: list[Path], spica: Path) -> list[dict]:
    source = Path(__file__).with_suffix('.cs').with_name('inspect_pica_materials.cs').resolve()
    with tempfile.TemporaryDirectory(prefix='oras-pica-') as directory:
        project = Path(directory) / 'Inspect.csproj'
        project.write_text('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType>'
                          '<TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings>'
                          '<NoWarn>CA1416</NoWarn></PropertyGroup><ItemGroup>'
                          f'<Reference Include="SPICA"><HintPath>{escape(str(spica))}</HintPath></Reference>'
                          f'<Compile Include="{escape(str(source))}" /></ItemGroup></Project>')
        result = subprocess.run([str(Path.home()/'.dotnet/dotnet'), 'run', '--project', str(project), '--',
                                 *map(str, files)], capture_output=True, text=True)
    if result.returncode:
        raise ValueError(f'Native PICA inspection failed: {result.stdout}\n{result.stderr}')
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    if len(rows) != len(files):
        raise ValueError(f'Native PICA inspector returned {len(rows)} of {len(files)} records')
    return rows


def image_bytes(scene: dict, binary: bytes, image: dict, source: Path) -> bytes:
    if 'bufferView' in image:
        view = scene['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        return binary[start:start+view['byteLength']]
    uri = image['uri']
    if uri.startswith('data:'):
        return base64.b64decode(uri.split(',', 1)[1])
    path = (source.parent/uri).resolve()
    path.relative_to(source.parent.resolve())
    return path.read_bytes()


def image_hash(scene: dict, binary: bytes, source: Path, material: dict) -> str | None:
    texture = material.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if texture is None:
        return None
    image = scene['images'][scene['textures'][texture['index']]['source']]
    return sha(Image.open(io.BytesIO(image_bytes(scene, binary, image, source))).convert('RGBA').tobytes())


def identity_base(native: dict, slot: int) -> bool:
    coord = native['TextureCoords'][slot]
    return (native['TextureSources'][slot] == 0 and coord['MappingType'] == 'UvCoordinateMap'
            and coord['Scale'] == {'X': 1, 'Y': 1} and coord['Rotation'] == 0
            and coord['Translation'] == {'X': 0, 'Y': 0})


def color_vectors(scene: dict, binary: bytes, index: int) -> list | None:
    accessor = scene['accessors'][index]
    if accessor['type'] not in ('VEC3', 'VEC4') or 'sparse' in accessor:
        return None
    channels = int(accessor['type'][-1])
    if accessor['componentType'] == 5126:
        rows = float_values(scene, binary, index, channels)
    elif accessor.get('normalized') and accessor['componentType'] in (5121, 5123):
        fmt, width, maximum = ('B', 1, 255) if accessor['componentType'] == 5121 else ('H', 2, 65535)
        view = scene['bufferViews'][accessor['bufferView']]
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        rows = [tuple(x/maximum for x in struct.unpack_from('<'+fmt*channels, binary,
                start+i*view.get('byteStride', channels*width))) for i in range(accessor['count'])]
    else:
        return None
    return [list(row) + ([1.0] if channels == 3 else []) for row in rows]


def color_alphas(scene: dict, binary: bytes, index: int) -> list[float] | None:
    rows = color_vectors(scene, binary, index)
    return [row[3] for row in rows] if rows is not None else None


def color_bounds(rows: list) -> tuple:
    return ([min(row[i] for row in rows) for i in range(4)],
            [max(row[i] for row in rows) for i in range(4)]) if rows else (None, None)


def vertex_color_audit(scene: dict, binary: bytes, model: dict) -> list[dict]:
    results = []
    for index, material in enumerate(scene['materials']):
        accessors = sorted({p['attributes']['COLOR_0'] for mesh in scene['meshes'] for p in mesh['primitives']
                            if p.get('material') == index and 'COLOR_0' in p['attributes']})
        vectors = [color_vectors(scene, binary, accessor) for accessor in accessors]
        glb_min, glb_max = color_bounds([row for vector in vectors if vector is not None for row in vector])
        native_index = next((i for i, m in enumerate(model['materials']) if m['Name'] == material.get('name')), None)
        native_min, native_max = color_bounds([m[key] for m in model['meshes'] if m['MaterialIndex'] == native_index
                                               for key in ('colorMin', 'colorMax') if m[key] is not None])
        results.append({'material': material.get('name'), 'glb_min': glb_min, 'glb_max': glb_max,
                        'native_min': native_min, 'native_max': native_max, 'supported': all(v is not None for v in vectors),
                        'accessors': [{**{k: v for k, v in scene['accessors'][a].items() if k in ('type', 'componentType', 'normalized', 'count')}, 'index': a} for a in accessors]})
    return results


def vertex_alpha(scene: dict, binary: bytes, primitives: list) -> bool | None:
    varies = False
    for primitive in primitives:
        index = primitive['attributes'].get('COLOR_0')
        if index is None:
            continue
        alphas = color_alphas(scene, binary, index)
        if alphas is None:
            return None
        varies |= any(abs(alpha-1) > 1e-6 for alpha in alphas)
    return varies


def unsupported_material(name: str, reason: str, native: dict | None = None) -> dict:
    return {'material': name, 'uv_orientation': 'unproven', 'image_match': False,
            'uv_identity_base': False, 'alpha': None, 'reason': reason,
            'native': {k: v for k, v in (native or {}).items() if k != 'VtxShaderUniforms'}}


def material_evidence(scene: dict, binary: bytes, source: Path, model: dict,
                      material: dict, textures: dict, kind: str) -> dict:
    name = material.get('name')
    native_index = next((i for i, row in enumerate(model['materials']) if row['Name'] == name), None)
    if native_index is None:
        return unsupported_material(name, 'No native material with this name')
    native = model['materials'][native_index]
    primitives = [p for m in scene['meshes'] for p in m['primitives'] if scene['materials'][p['material']].get('name') == name]
    if not primitives or any('TEXCOORD_0' not in p['attributes'] for p in primitives):
        return unsupported_material(name, 'Missing UV0; no channel substitution attempted', native)
    if material.get('pbrMetallicRoughness', {}).get('baseColorTexture', {}).get('texCoord', 0) != 0:
        return unsupported_material(name, 'Diffuse texture does not select UV0', native)
    actual_hash = image_hash(scene, binary, source, material)
    slots = [i for i, texture in enumerate(native['textureNames']) if actual_hash in textures.get(texture, set())]
    slot = slots[0] if len(slots) == 1 else None
    native_uvs = [v for mesh in model['meshes'] if mesh['MaterialIndex'] == native_index for v in mesh['positionUv0']]
    orientation = uv_orientation(native_uvs, position_uvs(scene, binary, primitives)) if kind == 'gr' else 'actor-policy-unchanged'
    has_vertex_alpha = vertex_alpha(scene, binary, primitives)
    factor_alpha = material.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])[3]
    alpha = alpha_profile(native, slot, has_vertex_alpha) if slot is not None and has_vertex_alpha is not None and factor_alpha == 1 else None
    base = slot is not None and identity_base(native, slot) and kind == 'gr'
    return {'material': name, 'uv_orientation': orientation, 'image_match': slot is not None,
            'uv_identity_base': base, 'base_slot': slot, 'rgba_sha256': actual_hash,
            'alpha': alpha, 'native': {k: v for k, v in native.items() if k != 'VtxShaderUniforms'},
            'reason': 'Static alpha subset only; RGB lighting/LUT/projection remain unsupported' if alpha else
                      'Alpha expression/blend or texture identity unsupported; RGB lighting/LUT/projection remain unsupported'}


def targets(root: Path, catalog: Path, ids: list[int] | None) -> list[dict]:
    rows = [{'id': 'gr/'+p.parent.name, 'kind': 'gr', 'source': p,
             'url': '/'+str(p.relative_to(root/'public')), 'native': root/f'rom/extracted/garc/a_0_3_9/{p.parent.name[3:]}.bin'}
            for p in sorted((root/'public/assets/maps').glob('gr_*/gr_*.glb'))]
    for record in json.loads(catalog.read_text())['models']:
        if record['id'].startswith('character/'):
            rows.append({'id': record['id'], 'kind': 'character', 'source': root/'public'/record['url'].lstrip('/'),
                         'url': record['url'], 'native': root/f"rom/extracted/garc/a_0_2_1/{record['id'][-4:]}.bin"})
    return [row for row in rows if ids is None or int(row['native'].stem) in ids]


def archive_texture_names(archives: dict[str, bytes], needed: set[str]) -> dict[str, set[str]]:
    tokens = {name.encode(): name for name in needed if re.fullmatch('[A-Za-z0-9_]+', name)}
    special = needed - set(tokens.values())
    minimum = min(map(len, tokens), default=1)
    pattern = rb'[A-Za-z0-9_]{' + str(minimum).encode() + rb',}'
    coverage = {}
    for name, blob in archives.items():
        found = set(re.findall(pattern, blob)) & tokens.keys()
        coverage[name] = {tokens[token] for token in found} | {text for text in special if _contains_whole_name(blob, text)}
    return coverage


def select_archives(root: Path, selected: list, records: dict) -> dict:
    needed = {row['id']: {t for m in records[str(row['native'])]['models'][0]['materials']
                         for t in m['textureNames'] if t and t != 'projection_dummy'}
              for row in selected if row['kind'] == 'gr'}
    archives = {p.name: p.read_bytes() for p in sorted((root/'rom/extracted/garc/a_0_1_4').glob('*.bin'))}
    coverage = archive_texture_names(archives, set().union(*needed.values()))
    choices = {}
    for model, names in needed.items():
        best = max(sorted(coverage), key=lambda archive: len(coverage[archive] & names), default=None)
        choices[model] = best if best and coverage[best] & names else None
    return choices


def refresh_native(records: dict, paths: list, spica: Path) -> None:
    missing = [path for path in paths if records.get(str(path), {}).get('sha256') != sha(path.read_bytes())]
    if missing:
        records.update({row['source']: row for row in inspect_native(missing, spica)})


def native_inventory(root: Path, selected: list[dict], spica: Path) -> tuple[dict, dict, dict]:
    cache = root/'rom/pica-material-validation/native-inventory.json'
    tool_sha = sha(Path(__file__).with_name('inspect_pica_materials.cs').read_bytes()+spica.read_bytes())
    old = json.loads(cache.read_text()) if cache.exists() else {}
    records = old.get('records', {}) if old.get('tool_sha256') == tool_sha else {}
    refresh_native(records, [row['native'] for row in selected], spica)
    choices = select_archives(root, selected, records)
    ad_files = {root/'rom/extracted/garc/a_0_1_4'/name for name in choices.values() if name}
    refresh_native(records, sorted(ad_files), spica)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({'tool_sha256': tool_sha, 'records': records}))
    return records, choices, {'inspector_sha256': tool_sha}


def self_contained(blob: bytes, source: Path) -> bytes:
    scene, binary = decode_glb(blob)
    for image in scene.get('images', []):
        if image.get('uri', '').startswith('data:') or 'bufferView' in image:
            continue
        image['uri'] = 'data:image/png;base64,'+base64.b64encode(image_bytes(scene, binary, image, source)).decode()
    return encode_glb(scene, binary)


def verify_preservation(before: bytes, after: bytes, evidence: dict) -> None:
    source, binary = decode_glb(before)
    output, payload = decode_glb(after)
    if payload[:len(binary)] != binary or output['accessors'][:len(source['accessors'])] != source['accessors']:
        raise ValueError('PICA correction changed original BIN/accessors')
    for key in ('nodes', 'skins', 'animations', 'textures', 'samplers'):
        if source.get(key) != output.get(key):
            raise ValueError(f'PICA correction changed {key}')
    if normalize_pica_materials(after, evidence) != after:
        raise ValueError('PICA material correction is not idempotent')


def inspect_target(root: Path, target: dict, records: dict, choices: dict, publish: bool) -> dict:
    native = records[str(target['native'])]
    archive = choices.get(target['id'])
    extra = records[str(root/'rom/extracted/garc/a_0_1_4'/archive)] if archive else None
    textures: dict = {}
    for texture in (extra or native)['textures']:
        textures.setdefault(texture['Name'], set()).add(texture['rgba_sha256'])
    blob = target['source'].read_bytes()
    scene, binary = decode_glb(blob)
    evidence = {'glb_sha256': sha(blob), 'materials': [material_evidence(scene, binary, target['source'], native['models'][0], m, textures, target['kind']) for m in scene.get('materials', [])]}
    changed = normalize_pica_materials(blob, evidence)
    verify_preservation(blob, changed, evidence)
    result = {'id': target['id'], 'source_url': target['url'], 'source_sha256': sha(blob),
              'native_pack': str(target['native'].relative_to(root)), 'native_sha256': native['sha256'],
              'texture_archive': archive, 'texture_archive_sha256': extra['sha256'] if extra else None,
              'materials': evidence['materials'], 'vertex_colors': vertex_color_audit(scene, binary, native['models'][0]),
              'changed': changed != blob,
              'preserved': True, 'idempotent': True}
    if changed != blob and publish:
        published = self_contained(changed, target['source'])
        digest = sha(published)
        url = f"/assets/native/materials/{target['id'].replace('/', '_')}-{digest[:12]}.glb"
        path = root/'public'/url.lstrip('/')
        if path.exists() and path.read_bytes() != published:
            raise ValueError(f'Immutable PICA URL collision: {path}')
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_bytes(published)
        result.update(url=url, sha256=digest)
    return result


def compact_material(row: dict, states: dict) -> dict:
    compact = {k: v for k, v in row.items() if k != 'native'}
    native = row.get('native', {})
    state = {k: v for k, v in native.items() if k not in ('Name', 'textureNames')}
    if state:
        digest = sha(json.dumps(state, sort_keys=True, separators=(',', ':')).encode())
        states[digest] = state
        compact.update(native_state=digest, native_texture_names=native.get('textureNames', []))
    return compact


def coverage_report(rows: list[dict], tools: dict) -> dict:
    states: dict = {}
    models = [{**row, 'materials': [compact_material(m, states) for m in row['materials']]} for row in rows]
    materials = [m for row in models for m in row['materials']]
    restored = lambda m: m.get('uv_orientation') == 'mirrored' and m.get('image_match') and m.get('uv_identity_base')
    return {'tools': tools, 'models': models, 'native_states': states, 'summary': {
        'models': len(rows), 'changed': sum(r['changed'] for r in rows), 'materials': len(materials),
        'uv_models': sum(any(restored(m) for m in r['materials']) for r in rows),
        'uv_materials': sum(bool(restored(m)) for m in materials),
        'alpha_materials': sum(m.get('alpha') is not None for m in materials), 'native_states': len(states)}}


def main() -> None:
    parser = argparse.ArgumentParser(description='Audit native PICA material state and publish only proven per-material corrections.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--spica-dll', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--runtime-catalog', type=Path)
    parser.add_argument('--ids', type=int, nargs='+')
    args = parser.parse_args()
    selected = targets(args.root, args.catalog, args.ids)
    native, choices, tools = native_inventory(args.root, selected, args.spica_dll)
    rows = [inspect_target(args.root, row, native, choices, args.runtime_catalog is not None) for row in selected]
    report = coverage_report(rows, tools)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    if args.runtime_catalog:
        aliases = {r['source_url']: r['url'] for r in rows if 'url' in r}
        args.runtime_catalog.write_text(json.dumps({'models': aliases}, indent=2)+'\n')
    print(json.dumps(report['summary']))


if __name__ == '__main__':
    main()
