from pathlib import Path

from scripts.extract_gr_maps import collision_layers, read_gr_permissions
from scripts.gr_ground import ground_candidates_grid, ground_grid, read_gr_ground
from scripts.gr_layers import physical_layers
from scripts.map_matrix import EMPTY, GR_TILES, WORLD_UNITS_PER_TILE, owns_tile


def gr_grid(gr_id: int, directory: Path, cache: dict) -> tuple:
    if gr_id not in cache:
        path = directory / f'{gr_id:04d}.bin'
        blob = path.read_bytes()
        width, height, permissions = read_gr_permissions(path)
        if (width, height) != (40, 40):
            raise ValueError(f'GR {gr_id}: grid {(width, height)}, esperado 40x40')
        collisions, terrain = collision_layers(permissions)
        if len(blob) >= 4 and int.from_bytes(blob[2:4], 'little') in (7, 9, 11, 13):
            layers = physical_layers(blob)
            ground = ground_grid(layers[0]['triangles'])
            triangles = [triangle for layer in layers for triangle in layer['triangles']]
            candidates = ground_candidates_grid(triangles)
        else:
            ground = read_gr_ground(path)
            candidates = [[[height] if height is not None else [] for height in row] for row in ground]
        cache[gr_id] = (width, height, collisions, terrain, permissions, ground, candidates)
    return cache[gr_id]


def compose_row(matrix: dict, zone: int, x0: int, z: int, width: int, directory: Path, cache: dict) -> tuple:
    collisions, terrain, south_ledge_columns, ground, candidates = [], [], [], [], []
    for x in range(x0, x0 + width):
        gr_id = matrix['grIds'][(z // GR_TILES) * matrix['width'] + x // GR_TILES]
        if gr_id == EMPTY or not owns_tile(matrix, zone, x, z):
            collisions.append(1)
            terrain.append(1)
            ground.append(None)
            candidates.append([])
            continue
        _, _, gr_collisions, gr_terrain, permissions, gr_ground, gr_candidates = gr_grid(gr_id, directory, cache)
        collisions.append(gr_collisions[z % GR_TILES][x % GR_TILES])
        terrain.append(gr_terrain[z % GR_TILES][x % GR_TILES])
        ground.append(gr_ground[z % GR_TILES][x % GR_TILES])
        candidates.append(gr_candidates[z % GR_TILES][x % GR_TILES])
        if permissions[z % GR_TILES][x % GR_TILES] == 0x75020021:
            south_ledge_columns.append(x - x0)
    return collisions, terrain, south_ledge_columns, ground, candidates


def compose_tiles(matrix: dict, zone: int, bounds: tuple, directory: Path, cache: dict) -> dict:
    x0, z0, width, height = bounds
    rows = [compose_row(matrix, zone, x0, z, width, directory, cache) for z in range(z0, z0 + height)]
    ledges = [{'x': x, 'z': z} for z, row in enumerate(rows) for x in row[2]]
    candidates = [{'x': x, 'z': z, 'heights': heights} for z, row in enumerate(rows)
                  for x, heights in enumerate(row[4]) if needs_height_candidates(heights, row[3][x])]
    return {'width': width, 'height': height, 'collisions': [row[0] for row in rows],
            'terrain': [row[1] for row in rows], 'groundHeights': [row[3] for row in rows],
            **({'groundHeightCandidates': candidates} if candidates else {}),
            **({'southLedges': ledges} if ledges else {})}


def needs_height_candidates(heights: list[float], primary: float | None) -> bool:
    return bool(heights) and (len(heights) > 1 or primary is None or abs(heights[0] - primary) > 1e-4)


def matrix_chunks(matrix: dict, bounds: tuple) -> list[dict]:
    x0, z0, width, height = bounds
    chunks = []
    for index, gr_id in enumerate(matrix['grIds']):
        x, z = index % matrix['width'] * 40, index // matrix['width'] * 40
        if gr_id == EMPTY or x >= x0 + width or z >= z0 + height or x + 40 <= x0 or z + 40 <= z0:
            continue
        chunks.append({'grId': gr_id, 'matrixTile': {'x': x, 'z': z}, 'localTile': {'x': x - x0, 'z': z - z0}})
    return chunks


def warp_position(warp: dict, bounds: tuple) -> dict:
    return {'x': warp['x'] // WORLD_UNITS_PER_TILE - bounds[0],
            'z': warp['y'] // WORLD_UNITS_PER_TILE - bounds[1]}


def convert_warps(zone: int, zones: dict, bounds: dict) -> list[dict]:
    converted = []
    for index, warp in enumerate(zones[zone]['warps']):
        destination, tile = warp['destinationMap'], warp['destinationTile']
        if destination not in zones or not 0 <= tile < len(zones[destination]['warps']):
            raise ValueError(f'Zona {zone}, warp {index}: destino inválido {destination}/{tile}')
        converted.append({'index': index, 'from': warp_position(warp, bounds[zone]),
                          'targetMapId': f'zone_{destination:04d}',
                          'targetPos': warp_position(zones[destination]['warps'][tile], bounds[destination]),
                          'width': warp.get('width', 1), 'height': warp.get('height', 1), 'rom': dict(warp)})
    return converted


def local_npcs(npcs: list[dict], bounds: tuple) -> list[dict]:
    return [{**npc, 'pos': {'x': npc['x'] - bounds[0], 'z': npc['y'] - bounds[1]}} for npc in npcs]


def select_spawn(collisions: list[list[int]], warps: list[dict]) -> tuple:
    width, height = len(collisions[0]), len(collisions)
    for warp in warps:
        x, z = warp['from']['x'], warp['from']['z']
        if 0 <= x < width and 0 <= z < height and collisions[z][x] == 0:
            return {'x': x, 'z': z}, 'first-walkable-warp'
    for z, row in enumerate(collisions):
        if 0 in row:
            return {'x': row.index(0), 'z': z}, 'first-walkable-tile'
    return None, 'no-walkable-tile'


def compare_tiles(reference: dict, actual: dict, offset_x: int, offset_z: int) -> dict:
    report = {'comparedTiles': 0, 'collisionsMismatched': 0, 'terrainMismatched': 0, 'mismatches': []}
    for z in range(reference['height']):
        for x in range(reference['width']):
            compare_tile(reference, actual, x, z, offset_x, offset_z, report)
    report['uncoveredTiles'] = reference['width'] * reference['height'] - report['comparedTiles']
    return report


def compare_tile(reference: dict, actual: dict, x: int, z: int, dx: int, dz: int, report: dict) -> None:
    if not (0 <= x + dx < actual['width'] and 0 <= z + dz < actual['height']):
        return
    report['comparedTiles'] += 1
    for layer in ('collisions', 'terrain'):
        expected, observed = reference[layer][z][x], actual[layer][z + dz][x + dx]
        if expected == observed:
            continue
        report[layer + 'Mismatched'] += 1
        if len(report['mismatches']) < 32:
            report['mismatches'].append({'x': x, 'z': z, 'layer': layer, 'expected': expected, 'actual': observed})
