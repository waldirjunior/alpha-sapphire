import unittest

from scripts.build_zone_neighbors import build_neighbors


def zone(index, x, z, width, height, matrix=1, owners=None):
    return {'zone': index, 'id': f'zone_{index:04d}', 'width': width, 'height': height,
            'collisions': [[0] * width for _ in range(height)],
            'source': {'originTile': {'x': x, 'z': z}, 'matrixId': matrix,
                       'matrix': {'width': 1, 'height': 1, 'zoneIds': owners or []}}}


class ZoneNeighborTests(unittest.TestCase):
    def test_contact_is_derived_from_ownership_not_just_overlapping_rectangles(self):
        owners = [1, 2, 65535, 65535] * 4
        maps = {1: zone(1, 0, 0, 10, 40, owners=owners),
                2: zone(2, 10, 0, 10, 40, owners=owners)}
        graph = build_neighbors(maps, bridge=False)['zones']
        edge = graph['zone_0001']['neighbors'][0]
        self.assertEqual(edge, {'targetMapId': 'zone_0002', 'direction': 'right',
                               'from': {'x': 9, 'z': 0}, 'length': 40,
                               'offset': {'x': -10, 'z': 0}, 'inferred': False})
        self.assertEqual(graph['zone_0001']['component'], graph['zone_0002']['component'])
        self.assertEqual(graph['zone_0002']['origin'], {'x': 10, 'z': 0})

    def test_petalburg_bridge_uses_the_walkable_edge_not_the_blocked_warp_anchor(self):
        a, b = zone(13, 80, 80, 40, 80, matrix=2), zone(27, 80, 80, 80, 80, matrix=3)
        for item in (a, b):
            item['collisions'] = [[1] * item['width'] for _ in range(80)]
        for z in range(46, 51):
            a['collisions'][z][1] = 0
            b['collisions'][z][76] = 0
        graph = build_neighbors({13: a, 27: b})['zones']
        edge = graph['zone_0013']['neighbors'][0]
        self.assertTrue(edge['inferred'])
        self.assertEqual(edge['from'], {'x': 1, 'z': 46})
        self.assertEqual(edge['offset'], {'x': 76, 'z': 0})
        self.assertEqual(edge['length'], 5)
        self.assertEqual(b['collisions'][46][77], 1)
        self.assertEqual(graph['zone_0027']['origin'], {'x': 4, 'z': 80})

    def test_inferred_bridge_joins_walkable_lanes_without_editing_blocked_padding(self):
        a, b = zone(7, 80, 80, 40, 40), zone(24, 120, 120, 80, 40, matrix=2)
        for item in (a, b):
            item['collisions'] = [[1] * item['width'] for _ in range(40)]
        for z in (20, 21, 22):
            a['collisions'][z][1] = 0
            b['collisions'][z][78] = 0
        graph = build_neighbors({7: a, 24: b})['zones']
        link = graph['zone_0007']['neighbors'][0]
        self.assertTrue(link['inferred'])
        self.assertEqual(link['from'], {'x': 1, 'z': 20})
        self.assertEqual(link['offset'], {'x': 78, 'z': 0})
        self.assertEqual(link['length'], 3)
        self.assertEqual(graph['zone_0024']['origin'], {'x': 2, 'z': 80})
        self.assertEqual(a['collisions'][20][0], 1)


if __name__ == '__main__':
    unittest.main()
