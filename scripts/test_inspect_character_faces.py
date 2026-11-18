import copy
import hashlib
import io
import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image
from inspect_character_faces import verify_face
from glb_native_clips import decode_glb, encode_glb
from test_character_face_uv import mirrored_face_fixture
from character_face_uv import normalize_character_faces
from validate_character_faces import validate_structure


def image_fixture():
    blob, evidence = mirrored_face_fixture()
    scene, binary = decode_glb(blob)
    image = Image.new('RGBA', (2, 2), (42, 84, 128, 255))
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    png = stream.getvalue()
    scene['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(png)})
    scene['images'] = [{'bufferView': 1, 'mimeType': 'image/png'}]
    scene['textures'] = [{'source': 0}]
    scene['materials'][0]['pbrMetallicRoughness'] = {'baseColorTexture': {'index': 0}}
    face = evidence['faces'][0]
    face.update(width=2, height=2, rgba_sha256=hashlib.sha256(image.tobytes()).hexdigest())
    return face, scene, binary + png


class FaceEvidenceTests(unittest.TestCase):
    def test_native_rgba_and_mirrored_uvs_are_verified_without_rom(self):
        face, scene, binary = image_fixture()
        verified = verify_face(face, scene, binary)
        self.assertTrue(verified['image_match'])
        self.assertEqual(verified['uv_orientation'], 'mirrored')
        self.assertIsNone(verified['exclusion'])

    def test_wrong_pixels_or_dimensions_do_not_prove_orientation(self):
        face, scene, binary = image_fixture()
        for changed in ({'rgba_sha256': '0' * 64}, {'width': 1, 'height': 4}):
            result = verify_face({**face, **changed}, scene, binary)
            self.assertFalse(result['image_match'])
            self.assertIsNotNone(result['exclusion'])

    def test_bounding_box_symmetry_is_not_evidence_for_a_flip(self):
        face, scene, binary = image_fixture()
        face['uv_bounds'] = [0.125, 0.25, 0.125, 0.375]
        result = verify_face(face, scene, binary)
        self.assertEqual(result['uv_orientation'], 'original')
        face['uv_bounds'] = [0.125, 0.25, 0.125, 0.875]
        binary = struct.pack('<4f', 0.125, 0.125, 0.25, 0.875) + binary[16:]
        result = verify_face(face, scene, binary)
        self.assertEqual(result['uv_orientation'], 'ambiguous')
        self.assertIsNotNone(result['exclusion'])

    def test_real_preservation_check_rejects_material_or_bin_mutation(self):
        blob, evidence = mirrored_face_fixture()
        output = normalize_character_faces(blob, evidence)
        validate_structure(blob, output, {'synthetic_face'})
        scene, binary = decode_glb(output)
        altered = copy.deepcopy(scene)
        altered['materials'][1]['alphaMode'] = 'BLEND'
        with self.assertRaisesRegex(ValueError, 'Non-UV'):
            validate_structure(blob, encode_glb(altered, binary), {'synthetic_face'})
        with self.assertRaisesRegex(ValueError, 'BIN prefix'):
            validate_structure(blob, encode_glb(scene, b'xxxx' + binary[4:]), {'synthetic_face'})


if __name__ == '__main__':
    unittest.main()
