import argparse
import hashlib
import json
import struct
from collections import Counter
from functools import lru_cache
from pathlib import Path

from scripts.gr_ground import triangle_height, unique_height
from scripts.gr_layers import physical_layers


@lru_cache(maxsize=64)
def load_layers(path: Path) -> list[dict]:
    try:
        return physical_layers(path.read_bytes())
    except ValueError as error:
        raise ValueError(f'GR {path.name}: {error}') from error


def cell_context(zone: dict, x: int, z: int, directory: Path) -> dict:
    chunk = next(chunk for chunk in zone['source']['chunks']
                 if 0 <= x - chunk['localTile']['x'] < 40 and 0 <= z - chunk['localTile']['z'] < 40)
    px, pz = x - chunk['localTile']['x'], z - chunk['localTile']['z']
    layers = load_layers(directory / f"{chunk['grId']:04d}.bin")
    return {'gr': chunk['grId'], 'cell': [px, pz], 'chunk': chunk, 'layers': layers,
            'permission': f"{layers[0]['permissions'][pz][px]:08x}"}


def height_candidates(layers: list[dict], x: float, z: float) -> dict:
    return {str(layer['index']): sorted({round(height, 6) for triangle in layer['triangles']
            if (height := triangle_height(triangle, x, z)) is not None}) for layer in layers}


def sample_cell(context: dict) -> dict:
    x, z = context['cell']
    return height_candidates(context['layers'], (x - 19.5) * 18, (z - 19.5) * 18)


def audit_unknowns(zone: dict, directory: Path) -> list[dict]:
    positions = ((x, z) for z, row in enumerate(zone['groundHeights']) for x, height in enumerate(row)
                 if height is None and zone['collisions'][z][x] == 0)
    records = []
    for x, z in positions:
        context = cell_context(zone, x, z, directory)
        candidates = sample_cell(context)
        primary = candidates['0']
        kind = 'missing' if not primary else 'ambiguous' if unique_height(set(primary)) is None else 'raster_bbox'
        records.append({'zone': zone['zone'], 'pos': [x, z], 'gr': context['gr'], 'cell': context['cell'],
                        'permission': context['permission'], 'kind': kind, 'heights': candidates})
    return records


def audit_warp(zone: dict, warp: dict, directory: Path) -> dict:
    x, z = warp['from']['x'], warp['from']['z']
    context = cell_context(zone, x, z, directory)
    origin, chunk = zone['source']['originTile'], context['chunk']['localTile']
    exact_x = warp['rom']['x'] - 18 * (origin['x'] + chunk['x']) - 360
    exact_z = warp['rom']['y'] - 18 * (origin['z'] + chunk['z']) - 360
    exact = height_candidates(context['layers'], exact_x, exact_z)
    target = warp['rom']['z'] / 18
    matching = [int(index) for index, values in exact.items() if any(abs(value - target) < 0.15 for value in values)]
    kind = 'primary_exact' if 0 in matching else 'secondary' if matching else 'unresolved'
    return {'zone': zone['zone'], 'index': warp['index'], 'pos': [x, z], 'gr': context['gr'],
            'permission': context['permission'], 'ground': zone['groundHeights'][z][x], 'zoHeight': target,
            'kind': kind, 'matchingLayers': matching, 'heights': sample_cell(context), 'exact': exact}


def audit_warps(zone: dict, directory: Path) -> tuple[Counter, list[dict]]:
    counts, differences = Counter(), []
    for warp in zone['warps']:
        x, z = warp['from']['x'], warp['from']['z']
        if not (0 <= x < zone['width'] and 0 <= z < zone['height']):
            continue
        height = zone['groundHeights'][z][x]
        if height is not None and abs(height - warp['rom']['z'] / 18) < 0.15:
            counts['warp_matches'] += 1
            continue
        row = audit_warp(zone, warp, directory)
        differences.append(row)
        counts[('warp_null_' if height is None else 'warp_diff_') + row['kind']] += 1
    return counts, differences


def audit_maps(directory: Path, gr_directory: Path) -> dict:
    counts, unknowns, differences = Counter(), [], []
    for path in sorted(directory.glob('[0-9][0-9][0-9][0-9].json')):
        zone = json.loads(path.read_text())
        unknowns.extend(audit_unknowns(zone, gr_directory))
        counts['maps'] += 1
        warp_counts, warp_differences = audit_warps(zone, gr_directory)
        counts.update(warp_counts)
        differences.extend(warp_differences)
    counts.update('unknown_' + row['kind'] for row in unknowns)
    counts['unknown_secondary_candidate'] = sum(any(values for index, values in row['heights'].items() if index != '0') for row in unknowns)
    return {'counts': dict(counts), 'unknowns': unknowns, 'warpDifferences': differences}


def inventory_layers(directory: Path) -> dict:
    counts, records = Counter(), []
    for path in sorted(directory.glob('*.bin')):
        blob = path.read_bytes()
        if blob[:2] != b'GR':
            continue
        layers = load_layers(path)
        count = struct.unpack_from('<H', blob, 2)[0]
        counts[count] += 1
        records.append({'gr': path.stem, 'sha256': hashlib.sha256(blob).hexdigest(),
                        'sections': count, 'pairs': [[layer['permissionSection'], layer['collisionSection']] for layer in layers]})
    return {'sectionCounts': dict(counts), 'sources': records}


def main():
    parser = argparse.ArgumentParser(description='Audit physical GR layer candidates without selecting an actor layer')
    parser.add_argument('--gr-root', type=Path, required=True)
    parser.add_argument('--maps-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = {'scope': 'candidate-only; no runtime layer selection; ZO tolerance 0.15 tile',
              'inventory': inventory_layers(args.gr_root), **audit_maps(args.maps_root, args.gr_root)}
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'sectionCounts': result['inventory']['sectionCounts'], **result['counts']}, sort_keys=True))


if __name__ == '__main__':
    main()
