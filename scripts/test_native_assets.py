import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from audit_character_uv import audit_doc
from glb_native_clips import encode_glb
from promote_native_assets import ALIASES, character_ids, publish_asset, prepare_pose_jobs, promote
from test_glb_native_clips import fixture


class NativeAssetTests(unittest.TestCase):
    def test_character_selection_includes_the_additional_staged_npcs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            maps = root / 'src/data/maps_v2'
            maps.mkdir(parents=True)
            for zone in (*range(6, 17), *range(23, 31)):
                (maps / f'{zone:04d}.json').write_text('{"npcs": []}')
            (maps / '0010.json').write_text('{"npcs": [{"model": 222}]}')
            staged = root / 'public/assets/characters'
            staged.mkdir(parents=True)
            (staged / 'mm_0179.glb').write_bytes(b'fixture')
            self.assertEqual(character_ids(root), {*ALIASES.values(), 179, 222})

    def test_pose_plan_reuses_only_validated_existing_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'motion.bin').write_bytes(b'MM')
            cached = root / 'rom/extracted/models/runtime_characters/mm_0315.glb'
            cached.parent.mkdir(parents=True)
            cached.write_bytes(b'cached output')
            model = {'id': 'character/mm_0315', 'kind': 'character', 'model_id': 315,
                     'source': 'motion.bin', 'status': 'merged', 'output': 'merged.glb',
                     'mapping': {'present_indices': [0, 2], 'selected_frames': {'overworld_002': 14}}}
            with patch('promote_native_assets.character_ids', return_value={315}), \
                 patch('promote_native_assets.package_sections', return_value=[b'', b'']), \
                 patch('promote_native_assets.motion_slots', return_value=[{'index': 0, 'frames': 1}]), \
                 patch('promote_native_assets.validate_model', return_value={'validated': True}, create=True) as validate:
                jobs = prepare_pose_jobs(root, {'models': [model]})
            self.assertEqual(jobs[0]['status'], 'merged')
            self.assertEqual(jobs[0]['validation'], {'validated': True})
            validate.assert_called_once()
            self.assertEqual(cached.read_bytes(), b'cached output')

    def test_promotion_is_immutable_and_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'model.glb'
            scene, binary = fixture()
            source.write_bytes(encode_glb(scene, binary))
            url, digest = publish_asset(root, source, 'pokemon', 'treecko')
            self.assertEqual(publish_asset(root, source, 'pokemon', 'treecko'), (url, digest))
            self.assertEqual((root / 'public' / url.lstrip('/')).read_bytes(), source.read_bytes())
            scene['asset']['generator'] = 'new revision'
            source.write_bytes(encode_glb(scene, binary))
            newer, _ = publish_asset(root, source, 'pokemon', 'treecko')
            self.assertNotEqual(newer, url)
            self.assertTrue((root / 'public' / url.lstrip('/')).exists())

    def test_promotion_rejects_nonfinite_animation_or_geometry_before_publishing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scene, binary = fixture()
            source = root / 'invalid.glb'
            source.write_bytes(encode_glb(scene, struct.pack('<f', float('nan')) + binary[4:]))
            with self.assertRaisesRegex(ValueError, 'Non-finite output accessor 0'):
                publish_asset(root, source, 'pokemon', 'treecko')
            self.assertFalse((root / 'public').exists())

    def test_missing_native_motion_keeps_the_existing_pokemon_model_and_reason(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'src/data/battle').mkdir(parents=True)
            (root / 'src/data/battle/species.json').write_text(json.dumps([
                {'species': 276, 'form': 0, 'name': 'Taillow'}]))
            scene, binary = fixture()
            (root / 'base.glb').write_bytes(encode_glb(scene, binary))
            model = {'id': 'pokemon/0276/0', 'kind': 'pokemon', 'species': 276, 'status': 'failed',
                     'error': 'zero parent scale', 'base_glb': 'base.glb', 'mapping': {'variant': 0}}
            with patch('promote_native_assets.character_ids', return_value=set()):
                catalog = promote(root, {'models': [model]})
            self.assertIn('taillow', catalog['pokemon'])
            self.assertFalse(catalog['models'][0]['native'])
            self.assertEqual(catalog['unavailable'][0]['reason'], 'zero parent scale')

    def test_pose_plan_recomputes_frames_without_mutating_the_moving_clip_job(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'motion.bin').write_bytes(b'MM')
            model = {'id': 'character/mm_0315', 'kind': 'character', 'model_id': 315,
                     'source': 'motion.bin', 'status': 'merged', 'output': 'merged.glb',
                     'mapping': {'present_indices': [0, 2], 'selected_frames': {'overworld_002': 14}}}
            with patch('promote_native_assets.character_ids', return_value={315}), \
                 patch('promote_native_assets.package_sections', return_value=[b'', b'']), \
                 patch('promote_native_assets.motion_slots', return_value=[{'index': 0, 'frames': 1}]):
                jobs = prepare_pose_jobs(root, {'models': [model]})
            self.assertEqual(jobs[0]['mapping']['selected_frames'], {'overworld_000': 1})
            self.assertEqual(jobs[0]['base_glb'], 'merged.glb')
            self.assertEqual(model['mapping']['selected_frames'], {'overworld_002': 14})

    def test_identical_uv_sets_cannot_select_a_different_atlas_cell(self):
        binary = struct.pack('<4f', 0, 0, 0.24, 0.49)
        scene = {'bufferViews': [{'byteLength': 16}],
                 'accessors': [{'componentType': 5126, 'type': 'VEC2', 'count': 2, 'bufferView': 0}],
                 'meshes': [{'name': 'face', 'primitives': [{'material': 0,
                    'attributes': {'TEXCOORD_0': 0, 'TEXCOORD_1': 0}}]}],
                 'materials': [{'name': 'face', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}]}
        report = audit_doc(scene, binary)
        self.assertEqual(report['channel_repairs_if_applied'], [])
        self.assertEqual(report['uv_pairs'], 1)
        self.assertTrue(report['all_uv_pairs_identical'])
        self.assertEqual(report['faces'][0]['channel'], 0)
        self.assertAlmostEqual(report['faces'][0]['uv_max'][1], 0.49)


if __name__ == '__main__':
    unittest.main()
