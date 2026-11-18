from __future__ import annotations

import hashlib
import json
import math
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from itertools import permutations, product
from pathlib import Path

from glb_native_clips import decode_glb, encode_glb
from pica_materials import float_values, position_uvs, vertex_bucket

NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}
MARKER = 'picaVertexColorNormalization'


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


def dae_sources(mesh: ET.Element) -> dict:
    sources = {}
    for source in mesh.findall('c:source', NS):
        accessor = source.find('c:technique_common/c:accessor', NS)
        width, count = int(accessor.get('stride')), int(accessor.get('count'))
        start = int(accessor.get('offset', 0))
        values = list(map(float, source.find('c:float_array', NS).text.split()))
        if not all(math.isfinite(x) for x in values):
            raise ValueError(f'Nonfinite DAE source {source.get("id")}')
        sources[source.get('id')] = [values[start+i*width:start+(i+1)*width] for i in range(count)]
    return sources


def dae_triangle_rows(mesh: ET.Element, triangles: ET.Element) -> list:
    sources = dae_sources(mesh)
    inputs = triangles.findall('c:input', NS)
    position = mesh.find('c:vertices/c:input[@semantic="POSITION"]', NS).get('source')[1:]
    vertex = next(i for i in inputs if i.get('semantic') == 'VERTEX')
    uv = next(i for i in inputs if i.get('semantic') == 'TEXCOORD' and i.get('set') == '0')
    color = next(i for i in inputs if i.get('semantic') == 'COLOR')
    indices = list(map(int, triangles.find('c:p', NS).text.split()))
    stride = 1 + max(int(i.get('offset', 0)) for i in inputs)
    offsets = [int(i.get('offset', 0)) for i in (vertex, uv, color)]
    streams = [sources[position], sources[uv.get('source')[1:]], sources[color.get('source')[1:]]]
    return [sum((stream[indices[start+offset]] for stream, offset in zip(streams, offsets)), [])
            for start in range(0, len(indices), stride)]


def dae_color_reference(blob: bytes) -> dict[str, list]:
    root = ET.fromstring(blob)
    names = {m.get('id'): m.get('name') for m in root.findall('.//c:library_materials/c:material', NS)}
    bindings = {}
    for material in root.findall('.//c:instance_material', NS):
        symbol, target = material.get('symbol'), material.get('target')[1:]
        if symbol in bindings and bindings[symbol] != target:
            raise ValueError(f'Ambiguous DAE material symbol {symbol}')
        bindings[symbol] = target
    references = {}
    for mesh in root.findall('.//c:library_geometries/c:geometry/c:mesh', NS):
        for triangles in mesh.findall('c:triangles', NS):
            name = names[bindings[triangles.get('material')]]
            references.setdefault(name, []).extend(dae_triangle_rows(mesh, triangles))
    return references


def reference_buckets(rows: list) -> dict:
    buckets = {}
    for row in rows:
        if len(row) != 9 or not all(math.isfinite(x) for x in row) or any(x < -1e-6 or x > 1+1e-6 for x in row[5:]):
            raise ValueError('Native vertex color reference requires finite position/UV/RGBA rows')
        buckets.setdefault(vertex_bucket(row), []).append(row)
    return buckets


def matching_colors(row: list, buckets: dict) -> set[tuple]:
    bucket = vertex_bucket(row)
    candidates = (ref for delta in product((-1, 0, 1), repeat=3)
                  for ref in buckets.get(tuple(x+y for x, y in zip(bucket, delta)), ()))
    return {tuple(max(0, min(1, x)) for x in ref[5:]) for ref in candidates if vertices_correspond(row, ref)}


def vertices_correspond(row: list, ref: list) -> bool:
    return (all(abs(a-b) < .001 for a, b in zip(row[:3], ref[:3])) and abs(row[3]-ref[3]) < 2e-6 and
            min(abs(row[4]-ref[4]), abs(1-row[4]-ref[4])) < 2e-6)


def triangle_index_rows(scene: dict, binary: bytes, primitive: dict, count: int) -> list | None:
    if primitive.get('mode', 4) != 4:
        return None
    if 'indices' not in primitive:
        return list(range(count))
    accessor = scene['accessors'][primitive['indices']]
    if accessor['componentType'] not in (5121, 5123, 5125) or 'sparse' in accessor:
        return None
    fmt, width = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4)}[accessor['componentType']]
    view = scene['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0)+accessor.get('byteOffset', 0)
    return [struct.unpack_from('<'+fmt, binary, start+i*view.get('byteStride', width))[0] for i in range(accessor['count'])]


def triangle_color_choices(triangle: list, references: list, candidates: set) -> set:
    choices = set()
    for index in candidates:
        for ordered in permutations(references[index:index+3]):
            if all(vertices_correspond(row, ref) for row, ref in zip(triangle, ordered)):
                choices.add(tuple(tuple(max(0, min(1, x)) for x in ref[5:]) for ref in ordered))
    return choices


def triangle_colors(rows: list, indices: list | None, references: list) -> list | None:
    if indices is None or len(indices) % 3 or len(references) % 3:
        return None
    buckets = {}
    for i in range(0, len(references), 3):
        for row in references[i:i+3]:
            buckets.setdefault(vertex_bucket(row), set()).add(i)
    resolved = [set() for _ in rows]
    for start in range(0, len(indices), 3):
        face = indices[start:start+3]
        bucket = vertex_bucket(rows[face[0]])
        candidates = set().union(*(buckets.get(tuple(a+b for a, b in zip(bucket, delta)), set()) for delta in product((-1, 0, 1), repeat=3)))
        choices = triangle_color_choices([rows[i] for i in face], references, candidates)
        if len(choices) != 1:
            return None
        for index, color in zip(face, next(iter(choices))):
            resolved[index].add(color)
    return [next(iter(colors)) for colors in resolved] if all(len(c) == 1 for c in resolved) else None


def primitive_colors(scene: dict, binary: bytes, primitive: dict, buckets: dict, references: list) -> tuple | None:
    attrs = primitive['attributes']
    if 'POSITION' not in attrs or 'TEXCOORD_0' not in attrs:
        return None
    rows = position_uvs(scene, binary, [primitive])
    old = color_vectors(scene, binary, attrs['COLOR_0']) if 'COLOR_0' in attrs else [[1]*4 for _ in rows]
    if old is None or len(old) != len(rows):
        return None
    choices = [matching_colors(row, buckets) for row in rows]
    native = ([next(iter(colors)) for colors in choices] if all(len(c) == 1 for c in choices) else
              triangle_colors(rows, triangle_index_rows(scene, binary, primitive, len(rows)), references))
    if native is None:
        return None
    if any(abs(a[3]-b[3]) > 1e-6 for a, b in zip(old, native)):
        return None
    restored = [[*color[:3], original[3]] for color, original in zip(native, old)]
    changed = sum(any(abs(a-b) > 1e-6 for a, b in zip(before, after)) for before, after in zip(old, restored))
    return restored, changed


def append_color_accessor(scene: dict, binary: bytes, rows: list) -> tuple[bytes, int]:
    padded = binary + b'\0' * (-len(binary) % 4)
    values = struct.pack('<'+'f'*len(rows)*4, *[x for row in rows for x in row])
    views, accessors = scene.setdefault('bufferViews', []), scene.setdefault('accessors', [])
    views.append({'buffer': 0, 'byteOffset': len(padded), 'byteLength': len(values)})
    accessors.append({'bufferView': len(views)-1, 'componentType': 5126, 'type': 'VEC4', 'count': len(rows)})
    scene['buffers'][0]['byteLength'] = len(padded) + len(values)
    return padded + values, len(accessors)-1


def restore_material(scene: dict, binary: bytes, index: int, rows: list) -> tuple:
    primitives = [p for mesh in scene['meshes'] for p in mesh['primitives'] if p.get('material') == index]
    buckets = reference_buckets(rows)
    try:
        mapped = [primitive_colors(scene, binary, primitive, buckets, rows) for primitive in primitives]
    except ValueError:
        mapped = [None]
    if not mapped or any(colors is None for colors in mapped):
        return binary, {'status': 'unproven', 'reason': 'Position/UV/color correspondence or unchanged alpha not established'}
    changed = sum(count for _, count in mapped)
    for primitive, (colors, count) in zip(primitives, mapped):
        if count:
            binary, accessor = append_color_accessor(scene, binary, colors)
            primitive['attributes']['COLOR_0'] = accessor
    return binary, {'status': 'restored' if changed else 'unchanged', 'changed_vertices': changed,
                    'vertices': sum(len(colors) for colors, _ in mapped), 'primitives': len(primitives)}


def normalize_vertex_colors(blob: bytes, references: dict, evidence: dict) -> tuple[bytes, list]:
    scene, binary = decode_glb(blob)
    proof = hashlib.sha256(json.dumps(evidence, sort_keys=True).encode()).hexdigest()
    marker = scene['asset'].get('extras', {}).get(MARKER)
    if marker:
        if marker['evidenceSha256'] != proof:
            raise ValueError('Vertex color evidence SHA differs from existing normalization')
        return blob, marker['materials']
    if hashlib.sha256(blob).hexdigest() != evidence['inputSha256']:
        raise ValueError('Vertex color input SHA differs from evidence')
    reports = []
    for index, material in enumerate(scene['materials']):
        name = material.get('name')
        if name in references:
            binary, report = restore_material(scene, binary, index, references[name])
            reports.append({'material': name, **report})
    if not any(report['status'] == 'restored' for report in reports):
        return blob, reports
    scene['asset'].setdefault('extras', {})[MARKER] = {'version': 1, **evidence,
                                                     'evidenceSha256': proof, 'materials': reports}
    return encode_glb(scene, binary), reports


def normalize_dae_colors(blob: bytes, native: Path, spica: Path, cache: Path) -> tuple:
    exporter = spica.with_name('SpicaExport.dll')
    tool_sha = hashlib.sha256(spica.read_bytes() + exporter.read_bytes()).hexdigest()
    native_sha = hashlib.sha256(native.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix='vertex-colors-', dir=cache) as directory:
        dae = Path(directory)/'model.dae'
        process = subprocess.run([str(Path.home()/'.dotnet/dotnet'), str(exporter), str(native), str(dae)],
                                 capture_output=True, text=True)
        if process.returncode:
            raise ValueError(f'DAE color reference failed for {native.name}: {process.stdout}\n{process.stderr}')
        dae_blob = dae.read_bytes()
    references = dae_color_reference(dae_blob)
    reference_sha = hashlib.sha256(json.dumps(references, sort_keys=True).encode()).hexdigest()
    evidence = {'inputSha256': hashlib.sha256(blob).hexdigest(), 'nativeSha256': native_sha,
                'referenceSha256': reference_sha, 'toolSha256': tool_sha}
    changed, reports = normalize_vertex_colors(blob, references, evidence)
    if normalize_vertex_colors(changed, references, evidence)[0] != changed:
        raise ValueError(f'Vertex color correction is not idempotent for {native.name}')
    return changed, {**evidence, 'daeSha256': hashlib.sha256(dae_blob).hexdigest(), 'materials': reports}
