import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.build_zone_catalog import ZONE_COUNT, ZONEDATA_SIZE, parse_zonedata
from scripts.extract_texts import decode_gen6_text
from scripts.extract_zones import parse_zo_sections, parse_entities, parse_encounters
from scripts.map_matrix import EMPTY, parse_matrix, zone_bounds
from scripts.zone_map_validation import validation_report
from scripts.zone_map_builder import compose_tiles, matrix_chunks, convert_warps, local_npcs, select_spawn, compare_tiles

REFERENCE_GRS = {'littleroot_town': 6, 'route_101': 5, 'oldale_town': 4, 'route_102': 10,
                 'route_102_west': 9, 'petalburg_city': 8, 'route_103': 1,
                 'brendan_house': 506, 'may_house': 508, 'birch_lab': 510}


def load_zones(root: Path) -> dict:
    master = (root / 'a_0_1_3/0536.bin').read_bytes()
    if len(master) != ZONE_COUNT * ZONEDATA_SIZE:
        raise ValueError(f'ZoneData: tamanho {len(master)}, esperado {ZONE_COUNT * ZONEDATA_SIZE}')
    names = decode_gen6_text((root / 'a_0_7_3/0090.bin').read_bytes())
    zones = {}
    for zone in range(ZONE_COUNT):
        record = parse_zonedata(master[zone * ZONEDATA_SIZE:(zone + 1) * ZONEDATA_SIZE])
        path = root / f'a_0_1_3/{zone:04d}.bin'
        sections = parse_zo_sections(path)
        zones[zone] = {**record, 'name': names[record['parentMap']] if record['parentMap'] < len(names) else '',
                       **parse_entities(sections[1]), 'encounters': parse_encounters(sections[3]),
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    return zones


def load_matrices(root: Path, zones: dict) -> dict:
    matrices = {int(path.stem): parse_matrix(path.read_bytes())
                for path in sorted((root / 'a_0_4_0').glob('[0-9][0-9][0-9][0-9].bin'))}
    for index, matrix in matrices.items():
        owners = set(matrix['zoneIds']) - {EMPTY}
        invalid = [owner for owner in owners if owner not in zones or zones[owner]['mapMatrix'] != index]
        if invalid:
            raise ValueError(f'MM {index}: zonas inconsistentes com ZoneData: {invalid}')
    return matrices


def build_zone_map(zone: int, zones: dict, matrices: dict, bounds: dict, gr_dir: Path, cache: dict) -> dict:
    record, rect = zones[zone], bounds[zone]
    matrix = matrices[record['mapMatrix']]
    tiles = compose_tiles(matrix, zone, rect, gr_dir, cache)
    warps = convert_warps(zone, zones, bounds)
    spawn, spawn_policy = select_spawn(tiles['collisions'], warps)
    return {'schemaVersion': 2, 'id': f'zone_{zone:04d}', 'zone': zone, 'name': record['name'], **tiles,
            'spawnPos': spawn, 'spawnDerived': True, 'spawnPolicy': spawn_policy, 'warps': warps,
            'npcs': local_npcs(record['npcs'], rect), 'encounters': record['encounters'],
            'source': {'zoSha256': record['sha256'], 'mapArea': record['mapArea'], 'textFile': record['textFile'],
                       'matrixId': record['mapMatrix'], 'matrix': matrix, 'worldUnitsPerTile': 18,
                       'originTile': {'x': rect[0], 'z': rect[1]},
                       'boundsPolicy': 'zone-grid' if matrix['zoneIds'] else 'occupied-gr-extent',
                       'chunks': matrix_chunks(matrix, rect)}}


def compare_references(maps: list[dict], reference_dir: Path) -> list[dict]:
    reports = []
    for name, gr_id in REFERENCE_GRS.items():
        reference = json.loads((reference_dir / f'{name}.json').read_text())
        matches = [(zone_map, chunk) for zone_map in maps for chunk in zone_map['source']['chunks']
                   if chunk['grId'] == gr_id]
        if not matches:
            raise ValueError(f'Referência {name}: GR {gr_id} ausente nos mapas gerados')
        for zone_map, chunk in matches:
            offset = chunk['localTile']
            reports.append({'reference': name, 'zone': zone_map['zone'], 'grId': gr_id,
                            **compare_tiles(reference, zone_map, offset['x'], offset['z'])})
    return reports


def main() -> int:
    parser = argparse.ArgumentParser(description='Compõe mapas por zona a partir de MM/GR/ZO da ROM ORAS.')
    parser.add_argument('--garc-root', type=Path, required=True)
    parser.add_argument('--out-dir', type=Path, default=Path('src/data/maps_v2'))
    parser.add_argument('--reference-dir', type=Path, default=Path('src/data/maps'))
    args = parser.parse_args()
    zones = load_zones(args.garc_root)
    matrices = load_matrices(args.garc_root, zones)
    bounds = {zone: zone_bounds(matrices[record['mapMatrix']], zone) for zone, record in zones.items()}
    cache = {}
    maps = [build_zone_map(zone, zones, matrices, bounds, args.garc_root / 'a_0_3_9', cache) for zone in zones]
    comparisons = compare_references(maps, args.reference_dir)
    write_maps(args.out_dir, maps, validation_report(maps, matrices, comparisons))
    print(f'{len(maps)} zonas, {sum(len(m["warps"]) for m in maps)} warps, {len(cache)} GRs, {len(comparisons)} comparações')
    return 0


def write_maps(directory: Path, maps: list[dict], validation: dict) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for zone_map in maps:
        (directory / f'{zone_map["zone"]:04d}.json').write_text(
            json.dumps(zone_map, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
    (directory / '_validation.json').write_text(json.dumps(validation, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    raise SystemExit(main())
