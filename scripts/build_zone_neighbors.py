import argparse
import json
from collections import defaultdict, deque
from itertools import groupby
from pathlib import Path

EMPTY = 65535


def append_pair(links, maps, a, b, direction, point, other_point, length=10, inferred=False):
    opposite = {'right': 'left', 'down': 'up', 'left': 'right', 'up': 'down'}[direction]
    delta = {'right': (1, 0), 'down': (0, 1), 'left': (-1, 0), 'up': (0, -1)}[direction]
    offset = {'x': other_point[0] - point[0] - delta[0], 'z': other_point[1] - point[1] - delta[1]}
    for source, target, face, start, shift in (
            (a, b, direction, point, offset),
            (b, a, opposite, other_point, {k: -v for k, v in offset.items()})):
        links[source].append({'targetMapId': maps[target]['id'], 'direction': face,
                              'from': {'x': start[0], 'z': start[1]}, 'length': length,
                              'offset': shift, 'inferred': inferred})


def matrix_contacts(maps, links):
    matrices = {item['source']['matrixId']: item['source']['matrix'] for item in maps.values()}
    for matrix_id, matrix in sorted(matrices.items()):
        owners, width = matrix['zoneIds'], matrix['width'] * 4
        for cell, a in enumerate(owners):
            if a == EMPTY:
                continue
            for step, direction in ((1, 'right'), (width, 'down')):
                if cell + step >= len(owners) or (step == 1 and cell % width == width - 1):
                    continue
                b = owners[cell + step]
                if b in (a, EMPTY):
                    continue
                if any(maps[z]['source']['matrixId'] != matrix_id for z in (a, b)):
                    raise ValueError(f'MM {matrix_id}: owner inconsistente {a}/{b}')
                x, z = cell % width * 10, cell // width * 10
                world_a = (x + 9, z) if direction == 'right' else (x, z + 9)
                world_b = (x + 10, z) if direction == 'right' else (x, z + 10)
                origins = [maps[n]['source']['originTile'] for n in (a, b)]
                points = [(p[0] - origin['x'], p[1] - origin['z']) for p, origin in zip((world_a, world_b), origins)]
                append_pair(links, maps, a, b, direction, *points)


def oldale_bridge(maps, links):
    if 7 not in maps or 24 not in maps:
        return
    a, b = maps[7], maps[24]
    left = min(x for row in a['collisions'] for x, value in enumerate(row) if value == 0)
    right = max(x for row in b['collisions'] for x, value in enumerate(row) if value == 0)
    rows = [z for z in range(min(a['height'], b['height']))
            if a['collisions'][z][left] == b['collisions'][z][right] == 0]
    if not rows:
        raise ValueError('Ponte inferida 7/24: sem lanes alinhadas transitáveis')
    for z in rows:
        append_pair(links, maps, 7, 24, 'left', (left, z), (right, z), length=1, inferred=True)


def compress_links(links):
    def fixed(edge):
        axis = 'z' if edge['direction'] in ('left', 'right') else 'x'
        other = 'x' if axis == 'z' else 'z'
        return (edge['targetMapId'], edge['direction'], edge['from'][other],
                edge['offset']['x'], edge['offset']['z'], edge['inferred'])
    result = []
    for _, group in groupby(sorted(links, key=fixed), fixed):
        records = list(group)
        axis = 'z' if records[0]['direction'] in ('left', 'right') else 'x'
        for edge in sorted(records, key=lambda e: e['from'][axis]):
            if result and fixed(result[-1]) == fixed(edge) and result[-1]['from'][axis] + result[-1]['length'] == edge['from'][axis]:
                result[-1]['length'] += edge['length']
            else:
                result.append({**edge, 'from': dict(edge['from'])})
    return result


def place_components(maps, links):
    placed = {}
    for root in sorted(links):
        if root in placed:
            continue
        component = f'continuous_{root:04d}'
        placed[root] = {'origin': dict(maps[root]['source']['originTile']), 'component': component}
        pending = deque([root])
        while pending:
            zone = pending.popleft()
            for edge in links[zone]:
                target = int(edge['targetMapId'][5:])
                origin = {k: placed[zone]['origin'][k] - edge['offset'][k] for k in ('x', 'z')}
                if target in placed:
                    if placed[target]['origin'] != origin:
                        raise ValueError(f'Ciclo de offsets inconsistente: {zone}/{target}')
                    continue
                placed[target] = {'origin': origin, 'component': component}
                pending.append(target)
    return {maps[zone]['id']: {**placed[zone], 'neighbors': compress_links(links[zone])} for zone in sorted(placed)}


def build_neighbors(maps, bridge=True):
    links = defaultdict(list)
    matrix_contacts(maps, links)
    if bridge:
        oldale_bridge(maps, links)
    return {'schemaVersion': 1, 'zones': place_components(maps, links)}


def main():
    parser = argparse.ArgumentParser(description='Gera contatos do zone-grid e ponte inferida Oldale/Route102.')
    parser.add_argument('--maps-dir', type=Path, default=Path('src/data/maps_v2'))
    args = parser.parse_args()
    maps = {int(p.stem): json.loads(p.read_text()) for p in args.maps_dir.glob('[0-9][0-9][0-9][0-9].json')}
    graph = build_neighbors(maps)
    (args.maps_dir / '_neighbors.json').write_text(json.dumps(graph, separators=(',', ':')) + '\n')
    print(f'{len(graph["zones"])} zonas, {sum(len(z["neighbors"]) for z in graph["zones"].values())} bordas dirigidas')


if __name__ == '__main__':
    main()
