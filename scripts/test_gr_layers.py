import json
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.audit_ground_layers import audit_maps
from scripts.gr_ground import ground_grid
from scripts.gr_layers import physical_layers
from scripts.test_gr_ground import collision_blob, plane


def layered_gr(heights):
    grid = struct.pack('<HH', 40, 40) + struct.pack('<1600I', *([0x20000004] * 1600))
    sections = [grid, b'BCH visual', collision_blob(plane(heights[0])), b'', b'', b'', b'']
    sections.extend(grid for _ in heights[1:])
    sections.extend(collision_blob(plane(height)) for height in heights[1:])
    offsets = [4 + 4 * (len(sections) + 1)]
    for section in sections:
        offsets.append(offsets[-1] + len(section))
    return b'GR' + struct.pack('<H', len(sections)) + struct.pack('<' + 'I' * len(offsets), *offsets) + b''.join(sections)


class GrLayerTests(unittest.TestCase):
    def test_secondary_collision_index_depends_on_layer_count_not_always_eight(self):
        layers = physical_layers(layered_gr([0, 135, 270]))
        self.assertEqual([(layer['permissionSection'], layer['collisionSection']) for layer in layers], [(0, 2), (7, 9), (8, 10)])
        self.assertEqual([ground_grid(layer['triangles'])[20][2] for layer in layers], [0, 7.5, 15])

    def test_keeps_primary_separate_and_preserves_permission_words(self):
        layers = physical_layers(layered_gr([0, 135]))
        self.assertEqual(layers[0]['permissions'][20][2], 0x20000004)
        self.assertEqual(ground_grid(layers[0]['triangles'])[20][2], 0)
        self.assertEqual(layers[1]['collisionSection'], 8)

    def test_one_and_four_layers_match_native_loader_bounds(self):
        for heights in ([18], [0, 18, 36, 54]):
            layers = physical_layers(layered_gr(heights))
            self.assertEqual(len(layers), len(heights))
            self.assertEqual([layer['index'] for layer in layers], list(range(len(heights))))

    def test_audit_reports_candidates_without_rewriting_unknown_or_primary_height(self):
        for height in (None, 0):
            with self.subTest(height=height), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                (root / '0001.bin').write_bytes(layered_gr([0, 135]))
                zone = {'zone': 1, 'width': 1, 'height': 1, 'collisions': [[0]], 'groundHeights': [[height]],
                        'source': {'originTile': {'x': 0, 'z': 0}, 'chunks': [{'grId': 1, 'localTile': {'x': 0, 'z': 0}}]},
                        'warps': [{'index': 0, 'from': {'x': 0, 'z': 0}, 'rom': {'x': 9, 'y': 9, 'z': 135}}]}
                original = json.dumps(zone)
                path = root / '0001.json'
                path.write_text(original)
                report = audit_maps(root, root)
                self.assertEqual(report['warpDifferences'][0]['matchingLayers'], [1])
                self.assertEqual(report['warpDifferences'][0]['ground'], height)
                self.assertEqual(path.read_text(), original)
                self.assertEqual(len(report['unknowns']), int(height is None))

    def test_rejects_unknown_header_counts_offsets_and_grids(self):
        for offset, value in ((2, 8), (4, 0), (12, 0)):
            blob = bytearray(layered_gr([0]))
            struct.pack_into('<H' if offset == 2 else '<I', blob, offset, value)
            with self.assertRaises(ValueError):
                physical_layers(bytes(blob))
        blob = bytearray(layered_gr([0]))
        start = struct.unpack_from('<I', blob, 4)[0]
        struct.pack_into('<H', blob, start, 39)
        with self.assertRaisesRegex(ValueError, '40'):
            physical_layers(bytes(blob))
