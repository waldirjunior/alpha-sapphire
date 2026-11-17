import copy
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from glb_native_clips import append_native_clip, decode_glb, encode_glb
from attach_native_motions import integrate_model, select_clips


def fixture(names=('Origin', 'Head'), clip='idle'):
    identity = struct.pack('<16f', 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)
    binary = identity * 2 + struct.pack('<2f6f', 0, 1, 0, 0, 0, 1, 2, 3)
    scene = {
        'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(binary)}],
        'nodes': [{'name': name} for name in names],
        'skins': [{'joints': [0, 1], 'inverseBindMatrices': 0}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 128},
                        {'buffer': 0, 'byteOffset': 128, 'byteLength': 8},
                        {'buffer': 0, 'byteOffset': 136, 'byteLength': 24}],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 2, 'type': 'MAT4'},
                      {'bufferView': 1, 'componentType': 5126, 'count': 2, 'type': 'SCALAR'},
                      {'bufferView': 2, 'componentType': 5126, 'count': 2, 'type': 'VEC3'}],
        'animations': [{'name': clip, 'channels': [{'sampler': 0, 'target': {'node': 0, 'path': 'translation'}}],
                        'samplers': [{'input': 1, 'output': 2}]}],
        'materials': [{'name': 'original', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}],
        'images': [{'bufferView': 1, 'mimeType': 'image/png'}],
        'textures': [{'source': 0}], 'meshes': [{'name': 'original_mesh'}],
    }
    return scene, binary


class NativeClipMergeTests(unittest.TestCase):
    def test_roundtrip_preserves_embedded_binary(self):
        scene, binary = fixture()
        restored, payload = decode_glb(encode_glb(scene, binary))
        self.assertEqual(restored, scene)
        self.assertEqual(payload, binary)

    def test_merge_keeps_geometry_textures_and_retargets_by_name(self):
        base, binary = fixture()
        source, clip_binary = fixture(('Head', 'Origin'), 'motion_8')
        original = copy.deepcopy(base)
        merged, payload = append_native_clip(base, binary, source, clip_binary, 'physical')
        self.assertEqual(base, original)
        self.assertTrue(payload.startswith(binary))
        for field in ('meshes', 'materials', 'textures', 'images', 'skins', 'nodes'):
            self.assertEqual(merged[field], original[field])
        animation = merged['animations'][-1]
        self.assertEqual(animation['name'], 'physical')
        self.assertEqual(animation['channels'][0]['target']['node'], 1)
        self.assertEqual(len(payload) - len(binary), 32)
        self.assertEqual(merged['accessors'][animation['samplers'][0]['input']]['bufferView'], 3)

    def test_duplicate_mesh_name_does_not_shadow_skin_joint(self):
        base, binary = fixture()
        base['nodes'].append({'name': 'Origin', 'mesh': 0})
        source, clip_binary = fixture()
        source['nodes'].append({'name': 'Origin', 'mesh': 0})
        merged, _ = append_native_clip(base, binary, source, clip_binary, 'idle')
        self.assertEqual(merged['animations'][0]['channels'][0]['target']['node'], 0)

    def test_native_idle_replaces_procedural_idle(self):
        base, binary = fixture()
        source, clip_binary = fixture(clip='motion_0')
        merged, _ = append_native_clip(base, binary, source, clip_binary, 'idle')
        self.assertEqual([clip['name'] for clip in merged['animations']], ['idle'])
        self.assertTrue(merged['animations'][0]['extras']['nativeGF1'])

    def test_rejects_incompatible_skeleton(self):
        base, binary = fixture()
        source, clip_binary = fixture(('Origin', 'Other'))
        with self.assertRaisesRegex(ValueError, 'joint'):
            append_native_clip(base, binary, source, clip_binary, 'idle')

    def test_rejects_incompatible_bind_pose(self):
        base, binary = fixture()
        source, clip_binary = fixture()
        clip_binary = struct.pack('<f', 2) + clip_binary[4:]
        with self.assertRaisesRegex(ValueError, 'bind'):
            append_native_clip(base, binary, source, clip_binary, 'idle')

    def test_rejects_duplicate_target_names(self):
        base, binary = fixture(('Origin', 'Origin'))
        source, clip_binary = fixture()
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            append_native_clip(base, binary, source, clip_binary, 'idle')


class NativePipelineTests(unittest.TestCase):
    def test_battle_uses_sparse_semantic_indices(self):
        slots = [{'index': index} for index in (0, 3, 8, 12, 16, 17, 25)]
        clips, missing = select_clips('PB', slots)
        self.assertEqual(clips, {'idle': 0, 'physical': 8, 'special': 12, 'damage': 16, 'faint': 17})
        self.assertEqual(missing, [])

    def test_absent_default_clips_are_reported_not_fabricated(self):
        clips, missing = select_clips('PB', [{'index': 0}, {'index': 8}])
        self.assertEqual(clips, {'idle': 0, 'physical': 8})
        self.assertEqual(missing, ['special', 'damage', 'faint'])

    def test_missing_explicit_clip_fails(self):
        with self.assertRaisesRegex(ValueError, 'absent'):
            select_clips('MM', [{'index': 2}], {'walk': 1})

    def test_overworld_defaults_do_not_guess_semantics(self):
        clips, missing = select_clips('MM', [{'index': 2}, {'index': 93}])
        self.assertEqual(clips, {'overworld_002': 2, 'overworld_093': 93})
        self.assertEqual(missing, [])

    def test_pk_is_not_treated_as_battle(self):
        with self.assertRaisesRegex(ValueError, 'PB battle'):
            select_clips('PK', [{'index': 0}])

    def test_pipeline_integrates_native_clips_without_modifying_base(self):
        scene, binary = fixture()
        packed = encode_glb(scene, binary)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / 'base.glb'
            base.write_bytes(packed)
            output = root / 'native.glb'
            plan = {'output': output, 'base_glb': base, 'model': b'MM', 'motion': b'GF1',
                    'clips': {'idle': 0, 'physical': 8}, 'frames': {0: 30, 8: 30},
                    'family': 'PB', 'unavailable': []}
            tools = SimpleNamespace(spica_dll=Path('SPICA.dll'), blender=Path('blender'), dotnet=Path('dotnet'))
            with patch('attach_native_motions.export_clip', side_effect=lambda args, model, motion: args.output.write_bytes(packed)) as export:
                report = integrate_model(plan, tools)
                self.assertEqual(export.call_count, 2)
                with self.assertRaises(FileExistsError):
                    integrate_model(plan, tools)
            result, payload = decode_glb(output.read_bytes())
            self.assertEqual(base.read_bytes(), packed)
            self.assertTrue(payload.startswith(binary))
            self.assertEqual([clip['name'] for clip in result['animations']], ['idle', 'physical'])
            self.assertEqual(result['animations'][1]['extras']['sourceIndex'], 8)
            self.assertEqual(len(report['nativeClips']), 2)


if __name__ == '__main__':
    unittest.main()
