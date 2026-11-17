import runpy
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent))
from native_motions import motion_slots, package_sections, read_garc_entry


class NativeMotionTests(unittest.TestCase):
    def test_sparse_indices_are_not_compacted(self):
        pack = bytearray(40)
        struct.pack_into('<5I', pack, 0, 4, 20, 24, 0, 32)
        struct.pack_into('<HH', pack, 24, 11, 14)
        struct.pack_into('<HH', pack, 32, 13, 224)
        self.assertEqual(motion_slots(bytes(pack)), [
            {'index': 0, 'offset': 24, 'octals': 11, 'frames': 14},
            {'index': 2, 'offset': 32, 'octals': 13, 'frames': 224},
        ])

    def test_ef_is_a_count_not_magic(self):
        pack = bytearray(972)
        struct.pack_into('<I', pack, 0, 239)
        struct.pack_into('<I', pack, 4, 960)
        struct.pack_into('<I', pack, 8, 964)
        struct.pack_into('<HH', pack, 964, 291, 1)
        self.assertEqual(motion_slots(bytes(pack))[0]['index'], 0)

    def test_mini_sections_preserve_empty_entries(self):
        pack = struct.pack('<2sH4I', b'PB', 3, 20, 24, 24, 28) + b'abcdBCH\0'
        self.assertEqual(package_sections(pack), [b'abcd', b'', b'BCH\0'])

    def test_reject_invalid_section_bounds(self):
        pack = struct.pack('<2sH3I', b'MM', 2, 16, 20, 19) + b'abcd'
        with self.assertRaisesRegex(ValueError, 'offset'):
            package_sections(pack)

    def test_reject_invalid_motion_pointer(self):
        with self.assertRaisesRegex(ValueError, 'offset'):
            motion_slots(struct.pack('<3I', 2, 12, 100))

    def test_garc_entry_decompresses_only_selected_slot(self):
        payload = b'\x11\x04\x00\x00\x00test'
        header = struct.pack('<4sIHHIIII', b'CRAG', 28, 0xFEFF, 0x400, 4, 72, 81, 4)
        fato = struct.pack('<4sIHHI', b'OTAF', 16, 1, 0, 0)
        fatb = struct.pack('<4sII4I', b'BTAF', 28, 1, 1, 0, 9, 9)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.garc'
            path.write_bytes(header + fato + fatb + payload)
            self.assertEqual(read_garc_entry(path, 0), b'test')
            with self.assertRaisesRegex(ValueError, 'outside'):
                read_garc_entry(path, 1)

    def test_blender_preserves_last_integer_native_frame(self):
        keyframe = SimpleNamespace(co=SimpleNamespace(x=49.999996))
        curve = SimpleNamespace(keyframe_points=[keyframe], update=MagicMock())
        action = SimpleNamespace(fcurves=[curve], frame_range=(0.0, 49.999996))
        animation = SimpleNamespace(action=action, nla_tracks=MagicMock())
        armature = SimpleNamespace(type='ARMATURE', animation_data=animation)
        bpy = MagicMock()
        bpy.data.objects = [armature]
        bpy.data.actions = [action]
        script = Path(__file__).with_name('native_motion_blender.py')
        with patch.dict(sys.modules, {'bpy': bpy}), patch.object(
            sys, 'argv', ['blender', '--', 'input.dae', 'output.glb', 'motion_8']
        ):
            runpy.run_path(str(script))
        self.assertEqual(keyframe.co.x, 50)
        self.assertEqual(bpy.context.scene.frame_end, 50)
        self.assertEqual(action.name, 'motion_8')
        self.assertTrue(bpy.ops.export_scene.gltf.call_args.kwargs['export_animations'])


if __name__ == '__main__':
    unittest.main()
