import base64
import copy
import hashlib
import io
import struct
import unittest

from PIL import Image

from glb_native_clips import decode_glb, encode_glb
from pica_materials import alpha_profile, normalize_pica_materials, uv_orientation
from audit_pica_materials import archive_texture_names, material_evidence, vertex_alpha, coverage_report, vertex_color_audit
from pathlib import Path


def fixture():
    image = Image.new('RGBA', (2, 2), (100, 150, 80, 255))
    image.putpixel((0, 0), (0, 0, 0, 0))
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    positions = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
    native = [[*pos, u, v] for pos, (u, v) in zip(positions, [(0, .1), (1, .2), (0, .8)])]
    binary = b''.join(struct.pack('<3f', *pos) for pos in positions)
    binary += b''.join(struct.pack('<2f', row[3], 1-row[4]) for row in native)
    scene = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(binary)}],
             'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36},
                             {'buffer': 0, 'byteOffset': 36, 'byteLength': 24}],
             'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
                           {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC2'}],
             'images': [{'uri': 'data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode()}],
             'textures': [{'source': 0}], 'materials': [
                 {'name': 'foliage', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}, 'alphaMode': 'MASK', 'alphaCutoff': .2},
                 {'name': 'unproven'}],
             'meshes': [{'primitives': [
                 {'material': 0, 'attributes': {'POSITION': 0, 'TEXCOORD_0': 1}},
                 {'material': 1, 'attributes': {'POSITION': 0, 'TEXCOORD_0': 1}}]}]}
    blob = encode_glb(scene, binary)
    evidence = {'glb_sha256': hashlib.sha256(blob).hexdigest(), 'materials': [
        {'material': 'foliage', 'uv_orientation': 'mirrored', 'image_match': True,
         'uv_identity_base': True, 'alpha': None}]}
    return blob, evidence, native


def native_alpha(blend=False):
    return {'AlphaTest': {'Enabled': True, 'Function': 'Greater', 'Reference': 51},
            'ColorOperation': {'BlendMode': 'Blend', 'FragOpMode': 'Default'},
            'BlendFunction': {'ColorEquation': 'FuncAdd', 'AlphaEquation': 'FuncAdd',
                              'ColorSrcFunc': 'SourceAlpha' if blend else 'One',
                              'ColorDstFunc': 'OneMinusSourceAlpha' if blend else 'Zero',
                              'AlphaSrcFunc': 'SourceAlpha' if blend else 'One',
                              'AlphaDstFunc': 'OneMinusSourceAlpha' if blend else 'Zero'},
            'DepthColorMask': {'DepthWrite': not blend},
            'TexEnvStages': [{'Source': {'Alpha': ['Texture0']}, 'Operand': {'Alpha': ['Alpha']},
                              'Combiner': {'Alpha': 'Replace'}, 'Scale': {'Alpha': 'One'}}]}


class PicaMaterialTests(unittest.TestCase):
    def test_coverage_deduplicates_native_state_without_discarding_texture_identity(self):
        native = {'Name': 'leaf', 'textureNames': ['leaf_a'], 'BumpMode': 'NotUsed'}
        rows = [{'id': 'gr/1', 'changed': True, 'materials': [{'material': 'leaf', 'native': native}]},
                {'id': 'gr/2', 'changed': False, 'materials': [{'material': 'tree', 'native': {**native, 'Name': 'tree', 'textureNames': ['leaf_b']}}]}]
        report = coverage_report(rows, {})
        self.assertEqual(len(report['native_states']), 1)
        self.assertEqual(report['models'][0]['materials'][0]['native_texture_names'], ['leaf_a'])
        self.assertEqual(report['models'][1]['materials'][0]['native_texture_names'], ['leaf_b'])
        self.assertIn('native', rows[0]['materials'][0])

    def test_archive_index_uses_whole_texture_names_and_keeps_special_names(self):
        archives = {'a.bin': b'chip_wind2\0roof-a\0', 'b.bin': b'chip_wind\0roof_b\0'}
        self.assertEqual(archive_texture_names(archives, {'chip_wind', 'roof-a', 'roof_b'}),
                         {'a.bin': {'roof-a'}, 'b.bin': {'chip_wind', 'roof_b'}})

    def test_normalized_integer_vertex_alpha_is_read_without_coercing_rgb(self):
        blob, _, _ = fixture()
        scene, binary = decode_glb(blob)
        scene['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': 12})
        scene['accessors'].append({'bufferView': 2, 'componentType': 5121, 'normalized': True, 'count': 3, 'type': 'VEC4'})
        primitive = scene['meshes'][0]['primitives'][0]
        primitive['attributes']['COLOR_0'] = 2
        payload = binary + bytes([255, 255, 255, 128]*3)
        self.assertTrue(vertex_alpha(scene, payload, [primitive]))
        self.assertFalse(vertex_alpha(scene, binary + b'\xff'*12, [primitive]))
        scene['accessors'][2]['normalized'] = False
        self.assertIsNone(vertex_alpha(scene, payload, [primitive]))

    def test_vertex_color_audit_records_presence_encoding_and_native_ranges(self):
        blob, _, _ = fixture()
        scene, binary = decode_glb(blob)
        scene['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': 12})
        scene['accessors'].append({'bufferView': 2, 'componentType': 5121, 'normalized': True, 'count': 3, 'type': 'VEC4'})
        scene['meshes'][0]['primitives'][0]['attributes']['COLOR_0'] = 2
        native = {'materials': [{'Name': 'foliage'}], 'meshes': [
            {'MaterialIndex': 0, 'colorMin': [1, 0, 0, .5], 'colorMax': [1, 0, 0, .5]}]}
        rows = vertex_color_audit(scene, binary + bytes([255, 0, 0, 128]*3), native)
        self.assertEqual(rows[0]['glb_min'], [1, 0, 0, 128/255])
        self.assertEqual(rows[0]['native_min'], [1, 0, 0, .5])
        self.assertEqual(rows[0]['accessors'][0]['componentType'], 5121)
        self.assertEqual(rows[1]['accessors'], [])

    def test_missing_uv_stream_is_reported_without_guessing_a_channel(self):
        blob, _, _ = fixture()
        scene, binary = decode_glb(blob)
        scene['meshes'][0]['primitives'][0]['attributes'].pop('TEXCOORD_0')
        model = {'materials': [{'Name': 'foliage', 'textureNames': []}], 'meshes': []}
        proof = material_evidence(scene, binary, Path('/unused.glb'), model, scene['materials'][0], {}, 'gr')
        self.assertIsNone(proof['alpha'])
        self.assertFalse(proof['uv_identity_base'])
        self.assertIn('UV0', proof['reason'])

    def test_vertex_correspondence_proves_orientation_even_with_symmetric_bounds(self):
        _, _, native = fixture()
        actual = [[*row[:4], 1-row[4]] for row in native]
        self.assertEqual(uv_orientation(native, actual), 'mirrored')
        self.assertEqual(uv_orientation(native, native), 'original')
        self.assertEqual(uv_orientation(native, [[10, *row[1:]] for row in actual]), 'unproven')
        symmetric = [[0, 0, 0, 0, .5]]
        self.assertEqual(uv_orientation(symmetric, symmetric), 'ambiguous')
        native_edge = [[167.34, 65.9341, -199.285, -.805053, .756869]]
        float32_edge = [[167.33999633789062, 65.93409729003906, -199.28500366210938, -.8050529956817627, .24313098192214966]]
        self.assertEqual(uv_orientation(native_edge, float32_edge), 'mirrored')

    def test_uv_correction_clones_shared_accessor_and_preserves_original_binary(self):
        blob, proof, _ = fixture()
        before, binary = decode_glb(blob)
        changed = normalize_pica_materials(blob, proof)
        after, payload = decode_glb(changed)
        self.assertEqual(payload[:len(binary)], binary)
        primitives = after['meshes'][0]['primitives']
        self.assertNotEqual(primitives[0]['attributes']['TEXCOORD_0'], 1)
        self.assertEqual(primitives[1]['attributes']['TEXCOORD_0'], 1)
        self.assertEqual(after['materials'], before['materials'])
        self.assertEqual(after['accessors'][:2], before['accessors'])
        self.assertEqual(normalize_pica_materials(changed, proof), changed)
        for key in ('image_match', 'uv_identity_base'):
            rejected = copy.deepcopy(proof)
            rejected['materials'][0][key] = False
            self.assertEqual(normalize_pica_materials(blob, rejected), blob)
        proof['glb_sha256'] = '0'*64
        with self.assertRaisesRegex(ValueError, 'SHA'):
            normalize_pica_materials(blob, proof)

    def test_blend_and_alpha_test_are_independent_and_unknown_functions_are_not_guessed(self):
        native = native_alpha(True)
        profile = alpha_profile(native, 0, False)
        self.assertEqual(profile['cutoff'], 52/255)
        self.assertEqual(profile['blend'], 'source-alpha')
        self.assertFalse(profile['depthWrite'])
        native['AlphaTest']['Function'] = 'Gequal'
        self.assertEqual(alpha_profile(native, 0, False)['cutoff'], 51/255)
        native['AlphaTest']['Function'] = 'Less'
        self.assertIsNone(alpha_profile(native, 0, False))
        native['AlphaTest']['Function'] = 'Greater'
        native['TexEnvStages'][0]['Source']['Alpha'] = ['Texture1']
        self.assertIsNone(alpha_profile(native, 0, False))

    def test_synthetic_blend_glb_retains_cutoff_and_rejects_unsupported_rgb_blending(self):
        blob, proof, _ = fixture()
        native = native_alpha(True)
        proof['materials'][0].update(uv_orientation='original', alpha=alpha_profile(native, 0, False))
        after, payload = decode_glb(normalize_pica_materials(blob, proof))
        material = after['materials'][0]
        self.assertEqual(material['alphaMode'], 'BLEND')
        self.assertEqual(material['extras']['picaAlpha']['cutoff'], 52/255)
        self.assertEqual(payload, decode_glb(blob)[1])
        native['BlendFunction']['ColorDstFunc'] = 'One'
        self.assertIsNone(alpha_profile(native, 0, False))


if __name__ == '__main__':
    unittest.main()
