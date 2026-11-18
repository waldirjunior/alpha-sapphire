import struct
import tempfile
import unittest
from pathlib import Path

from scripts.build_zone_maps import build_zone_map
from scripts.zone_map_validation import spatial_audit
from scripts.map_matrix import parse_matrix, zone_bounds
from scripts.zone_map_builder import compose_tiles, convert_warps, local_npcs, select_spawn, compare_tiles


def matrix_blob(version=1):
    sec0 = struct.pack('<IHH2H', version, 2, 1, 3, 4)
    if version:
        owners = [10] * 4 + [11] * 4
        sec0 += struct.pack('<32H2H', *(owners * 4), 65535, 2)
    sec1 = struct.pack('<I4fI', 1, 9, 711, 27, 333, 0) + bytes(300)
    return b'MM' + struct.pack('<HIII', 2, 16, 16 + len(sec0), 16 + len(sec0) + len(sec1)) + sec0 + sec1


class MatrixTests(unittest.TestCase):
    def test_extended_grid_ownership_and_auxiliary_table(self):
        matrix = parse_matrix(matrix_blob())
        self.assertEqual(matrix['grIds'], [3, 4])
        self.assertEqual(matrix['zoneIds'][:8], [10] * 4 + [11] * 4)
        self.assertEqual(matrix['auxiliaryIds'], [65535, 2])
        self.assertEqual(matrix['regions'], [{'flags': 0, 'x1': 9.0, 'x2': 711.0, 'z1': 27.0, 'z2': 333.0}])
        self.assertEqual(zone_bounds(matrix, 11), (40, 0, 40, 40))
        with self.assertRaisesRegex(ValueError, 'zona 12'):
            zone_bounds(matrix, 12)

    def test_sec1_count_is_not_a_record_flag_or_sentinel(self):
        blob = bytearray(matrix_blob())
        start = struct.unpack_from('<I', blob, 8)[0]
        blob[start:] = struct.pack('<I4fI4fI', 2, 9, 711, 27, 333, 0, 18, 720, 36, 342, 1) + bytes(280)
        self.assertEqual(len(parse_matrix(bytes(blob))['regions']), 2)

    def test_basic_matrix_uses_gr_extent_not_camera_bounds(self):
        matrix = parse_matrix(matrix_blob(0))
        self.assertEqual(zone_bounds(matrix, 223), (0, 0, 80, 40))
        self.assertEqual(matrix['zoneIds'], [])

    def test_rejects_truncation_invalid_offsets_and_versions(self):
        for blob in (matrix_blob()[:-1], b'??' + matrix_blob()[2:],
                     matrix_blob()[:4] + struct.pack('<I', 0) + matrix_blob()[8:]):
            with self.assertRaises(ValueError):
                parse_matrix(blob)
        with self.assertRaisesRegex(ValueError, 'versão'):
            parse_matrix(matrix_blob(2))

    def test_rejects_data_hidden_in_unused_region_slots(self):
        blob = bytearray(matrix_blob())
        blob[-4:] = b'\x01\0\0\0'
        with self.assertRaisesRegex(ValueError, 'padding'):
            parse_matrix(bytes(blob))


class ZoneCompositionTests(unittest.TestCase):
    def test_composes_two_grs_and_blocks_empty_cells(self):
        matrix = parse_matrix(matrix_blob(0))
        matrix['grIds'][1] = 65535
        with tempfile.TemporaryDirectory() as folder:
            gr = Path(folder) / '0003.bin'
            grid = struct.pack('<HH', 40, 40) + struct.pack('<1600I', *([0x20004004] * 1600))
            gr.write_bytes(b'GR' + struct.pack('<HII', 1, 12, 12 + len(grid)) + grid)
            result = compose_tiles(matrix, 10, (0, 0, 80, 40), Path(folder), {})
        self.assertEqual(result['terrain'][0], [2] * 40 + [1] * 40)
        self.assertEqual(result['collisions'][0], [0] * 40 + [1] * 40)

    def test_composes_physical_heights_with_crop_and_zone_mask(self):
        matrix = parse_matrix(matrix_blob())
        base = (40, 40, [[0] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)])
        cache = {3: (*base, [[27] * 40 for _ in range(40)]), 4: (*base, [[7.5] * 40 for _ in range(40)])}
        result = compose_tiles(matrix, 10, (30, 0, 20, 40), Path('.'), cache)
        self.assertEqual(result['groundHeights'][0], [27] * 10 + [None] * 10)
        self.assertEqual(result['collisions'][0], [0] * 10 + [1] * 10)

    def test_extracts_exact_south_ledge_permission_without_opening_grid_or_neighbor_zone(self):
        matrix = parse_matrix(matrix_blob())
        values = [0x20000004] * 1600
        values[5 * 40 + 10] = 0x75020021
        values[6 * 40 + 11] = 0x75000021
        values[7 * 40 + 12] = 0x75640021
        with tempfile.TemporaryDirectory() as folder:
            grid = struct.pack('<HH1600I', 40, 40, *values)
            for gr in (3, 4):
                (Path(folder) / f'{gr:04}.bin').write_bytes(
                    b'GR' + struct.pack('<HII', 1, 12, 12 + len(grid)) + grid)
            result = compose_tiles(matrix, 10, (0, 0, 80, 40), Path(folder), {})
        self.assertEqual(result.get('southLedges'), [{'x': 10, 'z': 5}])
        self.assertEqual(result['collisions'][5][10], 1)
        self.assertEqual(result['collisions'][6][11], 1)
        self.assertEqual(result['collisions'][7][12], 1)
        self.assertEqual(result['collisions'][5][50], 1)

    def test_masks_neighbor_zone_even_when_gr_has_walkable_tiles(self):
        matrix = parse_matrix(matrix_blob())
        grid = (40, 40, [[0] * 40 for _ in range(40)], [[2] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)])
        result = compose_tiles(matrix, 10, (0, 0, 80, 40), Path('.'), {3: grid, 4: grid})
        self.assertEqual(result['collisions'][0], [0] * 40 + [1] * 40)

    def test_map_area_is_metadata_not_a_region_array_index(self):
        matrix = parse_matrix(matrix_blob())
        grid = (40, 40, [[0] * 40 for _ in range(40)], [[2] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)], [[0] * 40 for _ in range(40)])
        zones = {10: {'mapMatrix': 1, 'mapArea': 112, 'textFile': 65, 'name': 'Synthetic',
                      'npcs': [], 'warps': [], 'encounters': [], 'sha256': 'synthetic'}}
        result = build_zone_map(10, zones, {1: matrix}, {10: zone_bounds(matrix, 10)}, Path('.'), {3: grid})
        self.assertEqual(result['id'], 'zone_0010')
        self.assertEqual(result['width'], 40)
        self.assertEqual(result['source']['mapArea'], 112)
        self.assertEqual(result['spawnPolicy'], 'first-walkable-tile')
        self.assertTrue(result['spawnDerived'])

    def test_spatial_audit_preserves_and_reports_off_map_entities(self):
        zone_map = {'zone': 0, 'id': 'zone_0000', 'width': 1, 'height': 1,
                    'source': {'originTile': {'x': 0, 'z': 0}, 'matrix': {'zoneIds': []}},
                    'warps': [{'index': 0, 'from': {'x': 1, 'z': 0}, 'targetMapId': 'zone_0000',
                               'targetPos': {'x': 0, 'z': 0}, 'rom': {'x': 27, 'y': 9}}],
                    'npcs': [{'id': 3, 'pos': {'x': 3, 'z': 3}}]}
        audit = spatial_audit([zone_map])
        self.assertEqual(audit['warpsOutsideRegion'], [{'zone': 0, 'index': 0, 'pos': {'x': 1, 'z': 0}}])
        self.assertEqual(audit['targetsOutsideRegion'], [])
        self.assertEqual(len(audit['npcsOutsideRegion']), 1)
        self.assertEqual(audit['centeredWorldWarps'], 1)
        self.assertEqual(len(zone_map['warps']), 1)

    def test_world_warps_and_tile_npcs_do_not_use_same_scale(self):
        zones = {6: {'warps': [{'x': 1701, 'y': 3087, 'z': 0, 'width': 1, 'height': 1,
                               'destinationMap': 223, 'destinationTile': 0}]},
                 223: {'warps': [{'x': 279, 'y': 333, 'z': 0, 'width': 3, 'height': 1,
                                 'destinationMap': 6, 'destinationTile': 0}]}}
        bounds = {6: (80, 160, 40, 40), 223: (0, 0, 40, 40)}
        warp = convert_warps(6, zones, bounds)[0]
        self.assertEqual(warp['from'], {'x': 14, 'z': 11})
        self.assertEqual(warp['targetMapId'], 'zone_0223')
        self.assertEqual(warp['targetPos'], {'x': 15, 'z': 18})
        npc = local_npcs([{'id': 0, 'x': 104, 'y': 179}], bounds[6])[0]
        self.assertEqual(npc['pos'], {'x': 24, 'z': 19})
        self.assertEqual(zones[6]['warps'][0]['x'], 1701)

    def test_invalid_destination_is_not_silently_resolved(self):
        zones = {6: {'warps': [{'x': 9, 'y': 9, 'destinationMap': 999, 'destinationTile': 0}]}}
        with self.assertRaisesRegex(ValueError, '999'):
            convert_warps(6, zones, {6: (0, 0, 40, 40)})

    def test_spawn_policy_is_explicit_and_never_chooses_blocked_tile(self):
        self.assertEqual(select_spawn([[1, 0], [0, 0]], [{'from': {'x': 0, 'z': 1}}]),
                         ({'x': 0, 'z': 1}, 'first-walkable-warp'))
        self.assertEqual(select_spawn([[1, 0]], []), ({'x': 1, 'z': 0}, 'first-walkable-tile'))
        self.assertEqual(select_spawn([[1]], []), (None, 'no-walkable-tile'))

    def test_comparison_reports_each_layer_and_mismatch_coordinates(self):
        reference = {'width': 2, 'height': 1, 'collisions': [[0, 1]], 'terrain': [[0, 1]]}
        actual = {'width': 3, 'height': 1, 'collisions': [[1, 0, 0]], 'terrain': [[1, 0, 1]]}
        report = compare_tiles(reference, actual, 1, 0)
        self.assertEqual(report['comparedTiles'], 2)
        self.assertEqual(report['collisionsMismatched'], 1)
        self.assertEqual(report['terrainMismatched'], 0)
        self.assertEqual(report['mismatches'], [{'x': 1, 'z': 0, 'layer': 'collisions', 'expected': 1, 'actual': 0}])


if __name__ == '__main__':
    unittest.main()
