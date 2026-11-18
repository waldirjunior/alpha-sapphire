import math
import struct
import unittest
import tempfile
from pathlib import Path

from scripts.gr_ground import collision_triangles, ground_grid, read_gr_ground


def collision_blob(triangles):
    vertices = [point for triangle in triangles for point in triangle]
    end = 0x320 + len(vertices) * 16
    blob = bytearray(end + 16)
    struct.pack_into('<4s7I', blob, 0, b'coll', end - 16, 0x5d8, 1, 3, 2, 1, 2)
    for leaf in range(16):
        struct.pack_into('<II', blob, 0x2a0 + leaf * 8, 0 if leaf == 0 else len(vertices), len(vertices) if leaf == 0 else 0)
    for index, point in enumerate(vertices):
        struct.pack_into('<4f', blob, 0x320 + index * 16, *point, 1)
    struct.pack_into('<4s3I', blob, end, b'term', 0, 0x5d8, 1)
    return bytes(blob)


def plane(height):
    return [((-360, height, -360), (-360, height, 360), (360, height, 360)),
            ((-360, height, -360), (360, height, 360), (360, height, -360))]


class GrGroundTests(unittest.TestCase):
    def test_elevation_and_native_coordinates(self):
        grid = ground_grid(collision_triangles(collision_blob(plane(486))))
        self.assertEqual(grid[5][38], 27)
        self.assertEqual(grid[39][0], 27)

    def test_sloped_physical_floor_not_a_constant_gr_offset(self):
        triangles = [((-360, 0, -360), (-360, 720, 360), (360, 720, 360)),
                     ((-360, 0, -360), (360, 720, 360), (360, 0, -360))]
        grid = ground_grid(collision_triangles(collision_blob(triangles)))
        self.assertEqual(grid[29][38], 29.5)
        self.assertEqual(grid[31][38], 31.5)

    def test_height_changes_within_a_gr_at_cells_29_and_31(self):
        upper = [tuple((x, y, min(z, 180)) for x, y, z in triangle) for triangle in plane(378)]
        lower = [tuple((x, y, max(z, 180)) for x, y, z in triangle) for triangle in plane(369)]
        grid = ground_grid(collision_triangles(collision_blob(upper + lower)))
        self.assertEqual(grid[29][38], 21)
        self.assertEqual(grid[31][38], 20.5)

    def test_reads_primary_physics_not_visual_roof_or_secondary_floor(self):
        sections = [b'grid', b'BCH visual roof', collision_blob(plane(0)), b'', b'', b'', b'',
                    b'secondary grid', collision_blob(plane(135))]
        offsets = [4 + 4 * (len(sections) + 1)]
        for section in sections:
            offsets.append(offsets[-1] + len(section))
        blob = b'GR' + struct.pack('<H10I', len(sections), *offsets) + b''.join(sections)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'synthetic.bin'
            path.write_bytes(blob)
            self.assertEqual(read_gr_ground(path)[20][2], 0)

    def test_duplicate_partition_triangles_do_not_create_another_layer(self):
        grid = ground_grid(collision_triangles(collision_blob(plane(18) * 16)))
        self.assertEqual(grid[16][14], 1)

    def test_overlapping_physical_layers_remain_unknown_not_max_or_min(self):
        grid = ground_grid(collision_triangles(collision_blob(plane(0) + plane(135))))
        self.assertIsNone(grid[20][2])

    def test_missing_surface_and_vertical_wall_remain_unknown(self):
        wall = [((0, 0, 0), (0, 36, 0), (0, 36, 36))]
        self.assertIsNone(ground_grid(collision_triangles(collision_blob(wall)))[20][20])

    def test_rejects_corrupt_range_and_terminator(self):
        blob = bytearray(collision_blob(plane(0)))
        struct.pack_into('<I', blob, 0x2a0, 1)
        with self.assertRaisesRegex(ValueError, 'range'):
            collision_triangles(bytes(blob))
        blob = bytearray(collision_blob(plane(0)))
        blob[-16:-12] = b'xxxx'
        with self.assertRaisesRegex(ValueError, 'term'):
            collision_triangles(bytes(blob))

    def test_rejects_nonfinite_and_nonhomogeneous_vertices(self):
        for value in (math.nan, math.inf):
            blob = bytearray(collision_blob(plane(0)))
            struct.pack_into('<f', blob, 0x324, value)
            with self.assertRaisesRegex(ValueError, 'vert'):
                collision_triangles(bytes(blob))
        blob = bytearray(collision_blob(plane(0)))
        struct.pack_into('<f', blob, 0x32c, 0)
        with self.assertRaisesRegex(ValueError, 'vert'):
            collision_triangles(bytes(blob))


if __name__ == '__main__':
    unittest.main()
