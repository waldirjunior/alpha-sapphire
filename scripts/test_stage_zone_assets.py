import tempfile
import unittest
from pathlib import Path

from scripts.glb_native_clips import decode_glb, encode_glb
from scripts.stage_zone_assets import copy_character, select_slice, stage_audio, stage_object_models


class StageZoneAssetsTests(unittest.TestCase):
    def test_selects_only_roots_and_direct_destinations(self):
        maps = {6: {'warps': [{'targetMapId': 'zone_0223'}]},
                223: {'warps': [{'targetMapId': 'zone_0300'}]}, 300: {'warps': []}}
        self.assertEqual(select_slice(maps, (6,)), [6, 223])

    def test_includes_only_one_hop_of_visible_neighbors_of_requested_roots(self):
        maps = {6: {'warps': [{'targetMapId': 'zone_0223'}]}, 7: {'warps': []},
                8: {'warps': []}, 223: {'warps': []}}
        graph = {'zone_0006': {'neighbors': [{'targetMapId': 'zone_0007'}]},
                 'zone_0007': {'neighbors': [{'targetMapId': 'zone_0008'}]}}
        self.assertEqual(select_slice(maps, (6,), graph), [6, 7, 223])

    def test_stages_only_audio_declared_for_requested_zones(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            audio = root / 'audio'
            audio.mkdir()
            (audio / 'bgm_route.mp3').write_bytes(b'synthetic mp3')
            entries = [{'zone': 27, 'bgmName': 'bgm_route', 'hasMp3': True},
                       {'zone': 16, 'bgmName': 'not-selected', 'hasMp3': True}]
            self.assertEqual(stage_audio(audio, root / 'public', entries, (27,)), ['bgm_route'])
            self.assertEqual((root / 'public/assets/audio/bgm_route.mp3').read_bytes(), b'synthetic mp3')

    def test_character_embeds_external_images_without_changing_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / 'source'
            source.mkdir()
            (source / 'texture.png').write_bytes(b'synthetic png')
            scene = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 4}],
                     'images': [{'uri': 'texture.png'}]}
            (source / 'actor.glb').write_bytes(encode_glb(scene, b'abcd'))
            target = root / 'actor.glb'
            copy_character(source / 'actor.glb', target)
            output, binary = decode_glb(target.read_bytes())
            self.assertEqual(binary, b'abcd')
            self.assertTrue(output['images'][0]['uri'].startswith('data:image/png;base64,'))
            copy_character(source / 'actor.glb', target)
            target.write_bytes(b'existing asset')
            with self.assertRaisesRegex(ValueError, 'existe'):
                copy_character(source / 'actor.glb', target)

    def test_stages_bm_models_under_the_object_asset_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / 'models/objects/bm_0057/bm_0057.glb'
            source.parent.mkdir(parents=True)
            blob = encode_glb({'asset': {'version': '2.0'}, 'buffers': [{'byteLength': 4}],
                               'scenes': [{'nodes': []}], 'scene': 0}, b'abcd')
            source.write_bytes(blob)
            self.assertEqual(stage_object_models(root / 'models', root / 'public', {57}), [])
            target = root / 'public/assets/objects/bm_0057/bm_0057.glb'
            self.assertEqual(target.read_bytes(), blob)


if __name__ == '__main__':
    unittest.main()
