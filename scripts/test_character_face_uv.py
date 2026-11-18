import hashlib
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from character_face_uv import normalize_character_faces
from audit_character_uv import uv_values
from glb_native_clips import decode_glb, encode_glb


def mirrored_face_fixture():
    binary = struct.pack('<4f', 0.125, 0.125, 0.25, 0.375)
    scene = {
        'asset': {'version': '2.0', 'generator': 'Blender synthetic fixture'},
        'buffers': [{'byteLength': len(binary)}],
        'bufferViews': [{'buffer': 0, 'byteLength': len(binary)}],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 2, 'type': 'VEC2'}],
        'materials': [{'name': 'synthetic_face'}, {'name': 'synthetic_body'}],
        'meshes': [{'primitives': [
            {'material': 0, 'attributes': {'TEXCOORD_0': 0, 'TEXCOORD_1': 0}},
            {'material': 1, 'attributes': {'TEXCOORD_0': 0}},
        ]}],
        'skins': [{'joints': [0]}], 'nodes': [{'name': 'synthetic_joint'}],
        'animations': [{'name': 'idle', 'channels': []}],
    }
    blob = encode_glb(scene, binary)
    evidence = {'source_glb': 'source.glb', 'glb_sha256': hashlib.sha256(blob).hexdigest(), 'faces': [{
        'material': 'synthetic_face', 'uv_bounds': [0.125, 0.25, 0.625, 0.875],
        'frames': 70, 'target': 'MaterialTexCoord1Trans', 'uv_source': 0,
        'scale': [1, 1], 'rotation': 0, 'translation': [0, 0],
        'transform': 'DccMaya', 'mapping': 'UvCoordinateMap',
        'palette': [{'id': 0, 'frame': 0, 'translation': [0, 0]}],
        'image_match': True, 'uv_orientation': 'mirrored',
    }]}
    return blob, evidence


class CharacterFaceUvTests(unittest.TestCase):
    def test_promotion_exports_only_the_eight_observed_material_frames(self):
        from unittest.mock import patch
        from promote_native_assets import promote_model
        blob, evidence = mirrored_face_fixture()
        palette = [{'id': i, 'frame': i * 10, 'translation': [-(i % 4) / 4, -0.5 if i >= 4 else 0]}
                   for i in range(8)]
        evidence['faces'][0]['palette'] = palette
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source.glb'
            source.write_bytes(blob)
            catalog = {'characters': {}, 'models': [], 'unavailable': []}
            model = {'id': 'character/mm_0315', 'kind': 'character', 'model_id': 315, 'status': 'merged'}
            with patch('promote_native_assets.model_source', return_value=source):
                promote_model(root, model, {}, catalog, evidence)
            self.assertEqual(catalog['models'][0]['faceAnimations'],
                             [{'material': 'synthetic_face', 'frames': palette}])
            self.assertEqual(source.read_bytes(), blob)

    def test_runtime_palette_does_not_extrapolate_incomplete_or_unsupported_evidence(self):
        from promote_native_assets import face_animations
        _, evidence = mirrored_face_fixture()
        self.assertEqual(face_animations(None), [])
        self.assertEqual(face_animations(evidence), [])
        evidence['faces'][0]['palette'] = [{'id': i, 'frame': i * 10, 'translation': [0, 0]}
                                         for i in range(8)]
        evidence['faces'][0]['uv_source'] = 1
        self.assertEqual(face_animations(evidence), [])

    def test_orientation_is_independent_of_expression_palette_length(self):
        from promote_native_assets import face_animations
        for frames in (10, 30):
            with self.subTest(frames=frames):
                blob, evidence = mirrored_face_fixture()
                evidence['faces'][0]['frames'] = frames
                corrected = normalize_character_faces(blob, evidence)
                self.assertNotEqual(corrected, blob)
                scene, binary = decode_glb(corrected)
                index = scene['meshes'][0]['primitives'][0]['attributes']['TEXCOORD_0']
                self.assertEqual(uv_values(scene, binary, index), [(0.125, 0.875), (0.25, 0.625)])
                self.assertEqual(face_animations(evidence), [])

    def test_static_face_requires_verified_image_and_unambiguous_orientation(self):
        blob, evidence = mirrored_face_fixture()
        face = evidence['faces'][0]
        face.update(frames=None, target='BaseColorUV', palette=[])
        face.pop('image_match')
        face.pop('uv_orientation')
        self.assertEqual(normalize_character_faces(blob, evidence), blob)
        face.update(image_match=True, uv_orientation='mirrored')
        self.assertNotEqual(normalize_character_faces(blob, evidence), blob)
        face['uv_orientation'] = 'ambiguous'
        self.assertEqual(normalize_character_faces(blob, evidence), blob)
        face.update(uv_orientation='mirrored', image_match=False)
        self.assertEqual(normalize_character_faces(blob, evidence), blob)

    def test_restores_original_bch_face_without_touching_shared_body_accessor(self):
        blob, evidence = mirrored_face_fixture()
        corrected = normalize_character_faces(blob, evidence)
        scene, binary = decode_glb(corrected)
        original, original_binary = decode_glb(blob)
        face, body = scene['meshes'][0]['primitives']
        self.assertEqual(uv_values(scene, binary, face['attributes']['TEXCOORD_0']),
                         [(0.125, 0.875), (0.25, 0.625)])
        self.assertEqual(face['attributes']['TEXCOORD_0'], face['attributes']['TEXCOORD_1'])
        self.assertEqual(uv_values(scene, binary, body['attributes']['TEXCOORD_0']),
                         [(0.125, 0.125), (0.25, 0.375)])
        self.assertEqual(binary[:len(original_binary)], original_binary)
        for field in ('skins', 'nodes', 'animations', 'materials'):
            self.assertEqual(scene[field], original[field])
        self.assertEqual(normalize_character_faces(corrected, evidence), corrected)

    def test_native_bounds_cover_all_primitives_of_one_material(self):
        blob, evidence = mirrored_face_fixture()
        scene, binary = decode_glb(blob)
        original = scene['accessors'][0]
        scene['accessors'] = [{**original, 'count': 1}, {**original, 'byteOffset': 8, 'count': 1}, original]
        scene['meshes'][0]['primitives'] = [
            {'material': 0, 'attributes': {'TEXCOORD_0': 0}},
            {'material': 0, 'attributes': {'TEXCOORD_0': 1}},
            {'material': 1, 'attributes': {'TEXCOORD_0': 2}},
        ]
        blob = encode_glb(scene, binary)
        evidence['glb_sha256'] = hashlib.sha256(blob).hexdigest()
        corrected = normalize_character_faces(blob, evidence)
        result, output = decode_glb(corrected)
        primitives = result['meshes'][0]['primitives']
        self.assertEqual([uv_values(result, output, p['attributes']['TEXCOORD_0']) for p in primitives[:2]],
                         [[(0.125, 0.875)], [(0.25, 0.625)]])
        self.assertEqual(uv_values(result, output, primitives[2]['attributes']['TEXCOORD_0']),
                         [(0.125, 0.125), (0.25, 0.375)])
        self.assertEqual(normalize_character_faces(corrected, evidence), corrected)

    def test_publisher_hashes_corrected_bytes_without_overwriting_source(self):
        from promote_native_assets import publish_asset
        blob, evidence = mirrored_face_fixture()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source.glb'
            source.write_bytes(blob)
            url, digest = publish_asset(root, source, 'characters', 'synthetic', evidence)
            corrected = (root / 'public' / url.lstrip('/')).read_bytes()
            self.assertNotEqual(corrected, blob)
            self.assertEqual(hashlib.sha256(corrected).hexdigest(), digest)
            self.assertEqual(source.read_bytes(), blob)
            self.assertEqual(publish_asset(root, source, 'characters', 'synthetic', evidence), (url, digest))
            evidence['source_glb'] = 'different.glb'
            with self.assertRaisesRegex(ValueError, 'source'):
                publish_asset(root, source, 'characters', 'synthetic', evidence)

    def test_unknown_provenance_remains_unchanged(self):
        blob, _ = mirrored_face_fixture()
        self.assertEqual(normalize_character_faces(blob, None), blob)

    def test_rejects_input_not_matching_evidenced_source(self):
        blob, evidence = mirrored_face_fixture()
        evidence['glb_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'SHA'):
            normalize_character_faces(blob, evidence)

    def test_does_not_guess_on_different_uv_bounds(self):
        blob, evidence = mirrored_face_fixture()
        evidence['faces'][0]['uv_bounds'][3] = 0.9
        with self.assertRaisesRegex(ValueError, 'synthetic_face'):
            normalize_character_faces(blob, evidence)

    def test_non_evidenced_material_transform_is_not_normalized(self):
        blob, evidence = mirrored_face_fixture()
        evidence['faces'][0]['translation'] = [0.25, 0]
        self.assertEqual(normalize_character_faces(blob, evidence), blob)


if __name__ == '__main__':
    unittest.main()
