import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from glb_native_clips import decode_glb, encode_glb
from pica_vertex_colors import color_vectors
from pokemon_glb_materials import dae_material_sampling, normalize_pokemon_glb


def fixture() -> tuple[bytes, bytes]:
    uv0 = [(0.2, 0.1), (1.2, 1.4), (-0.3, 0.6)]
    uv1 = [(0.4, 0.25), (0.8, 0.75), (0.6, -0.5)]
    binary = b''.join(struct.pack('<2f', *uv) for uv in uv0 + uv1)
    binary += bytes([255, 255, 255, 255] * 3)
    scene = {
        'asset': {'version': '2.0'},
        'buffers': [{'byteLength': len(binary)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': 24},
            {'buffer': 0, 'byteOffset': 24, 'byteLength': 24},
            {'buffer': 0, 'byteOffset': 48, 'byteLength': 12},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC2', 'min': [-0.3, 0.1], 'max': [1.2, 1.4]},
            {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC2', 'min': [0.4, -0.5], 'max': [0.8, 0.75]},
            {'bufferView': 2, 'componentType': 5121, 'normalized': True, 'count': 3, 'type': 'VEC4'},
        ],
        'images': [{'uri': 'image-a.png'}, {'uri': 'image-b.png'}],
        'textures': [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}],
        'samplers': [{}],
        'materials': [
            {'name': 'body', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}},
            {'name': 'eyes', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}}},
        ],
        'meshes': [{'primitives': [
            {'material': 0, 'attributes': {'TEXCOORD_0': 0, 'TEXCOORD_1': 1, 'COLOR_0': 2}},
            {'material': 1, 'attributes': {'TEXCOORD_0': 0, 'TEXCOORD_1': 1}},
        ]}],
    }
    dae = b'''<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema">
      <library_effects>
        <effect id="body-effect"><profile_COMMON>
          <newparam sid="body-surface"><surface type="2D"><init_from>body-image</init_from></surface></newparam>
          <newparam sid="body-sampler"><sampler2D><source>body-surface</source><wrap_s>MIRROR</wrap_s><wrap_t>WRAP</wrap_t></sampler2D></newparam>
          <technique><lambert><diffuse><texture texture="body-sampler" texcoord="UV0"/></diffuse></lambert></technique>
        </profile_COMMON></effect>
        <effect id="eyes-effect"><profile_COMMON>
          <newparam sid="eyes-surface"><surface type="2D"><init_from>eyes-image</init_from></surface></newparam>
          <newparam sid="eyes-sampler"><sampler2D><source>eyes-surface</source><wrap_s>CLAMP</wrap_s><wrap_t>CLAMP</wrap_t></sampler2D></newparam>
          <technique><phong><diffuse><texture texture="eyes-sampler" texcoord="UV0"/></diffuse></phong></technique>
        </profile_COMMON></effect>
      </library_effects>
      <library_materials>
        <material id="body" name="body"><instance_effect url="#body-effect"/></material>
        <material id="eyes" name="eyes"><instance_effect url="#eyes-effect"/></material>
      </library_materials>
    </COLLADA>'''
    return encode_glb(scene, binary), dae


def color_fixture() -> tuple[bytes, bytes]:
    positions = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
    source_uvs = [(0.1, 0.1), (0.6, 0.2), (0.9, 0.3)]
    colors = [(255, 255, 255, 204), (255, 255, 255, 153), (255, 255, 255, 102)]
    binary = b''.join(struct.pack('<3f', *row) for row in positions)
    binary += b''.join(struct.pack('<2f', *row) for row in source_uvs)
    binary += bytes(channel for row in colors for channel in row)
    scene = {
        'asset': {'version': '2.0'},
        'buffers': [{'byteLength': len(binary)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': 36},
            {'buffer': 0, 'byteOffset': 36, 'byteLength': 24},
            {'buffer': 0, 'byteOffset': 60, 'byteLength': 12},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': 3, 'type': 'VEC3'},
            {'bufferView': 1, 'componentType': 5126, 'count': 3, 'type': 'VEC2'},
            {'bufferView': 2, 'componentType': 5121, 'normalized': True, 'count': 3, 'type': 'VEC4'},
        ],
        'images': [{'uri': 'body.png'}],
        'textures': [{'source': 0, 'sampler': 0}],
        'samplers': [{}],
        'materials': [{'name': 'body', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}}}],
        'meshes': [{'primitives': [{'material': 0, 'attributes': {
            'POSITION': 0, 'TEXCOORD_0': 1, 'COLOR_0': 2}}]}],
    }
    dae = b'''<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema">
      <library_effects><effect id="body-effect"><profile_COMMON>
        <newparam sid="surface"><surface type="2D"><init_from>body-image</init_from></surface></newparam>
        <newparam sid="sampler"><sampler2D><source>surface</source><wrap_s>CLAMP</wrap_s><wrap_t>CLAMP</wrap_t></sampler2D></newparam>
        <technique><lambert><diffuse><texture texture="sampler" texcoord="UV0"/></diffuse></lambert></technique>
      </profile_COMMON></effect></library_effects>
      <library_materials><material id="body-material" name="body"><instance_effect url="#body-effect"/></material></library_materials>
      <library_geometries><geometry id="body-geometry"><mesh>
        <source id="position"><float_array id="position-array" count="9">0 0 0 1 0 0 0 1 0</float_array><technique_common><accessor source="#position-array" count="3" stride="3"><param name="X"/><param name="Y"/><param name="Z"/></accessor></technique_common></source>
        <source id="uv"><float_array id="uv-array" count="6">0.1 0.9 0.6 0.8 0.9 0.7</float_array><technique_common><accessor source="#uv-array" count="3" stride="2"><param name="S"/><param name="T"/></accessor></technique_common></source>
        <source id="color"><float_array id="color-array" count="12">0.5 0.5 0.5 0.2 0.25 0.75 1 0.3 0.75 0.25 0.5 0.4</float_array><technique_common><accessor source="#color-array" count="3" stride="4"><param name="R"/><param name="G"/><param name="B"/><param name="A"/></accessor></technique_common></source>
        <vertices id="vertices"><input semantic="POSITION" source="#position"/></vertices>
        <triangles material="body-symbol" count="1"><input semantic="VERTEX" source="#vertices" offset="0"/><input semantic="TEXCOORD" source="#uv" offset="1" set="0"/><input semantic="COLOR" source="#color" offset="2"/><p>0 0 0 1 1 1 2 2 2</p></triangles>
      </mesh></geometry></library_geometries>
      <library_visual_scenes><visual_scene><node><instance_geometry url="#body-geometry"><bind_material><technique_common>
        <instance_material symbol="body-symbol" target="#body-material"><bind_vertex_input semantic="UV0" input_semantic="TEXCOORD" input_set="0"/></instance_material>
      </technique_common></bind_material></instance_geometry></node></visual_scene></library_visual_scenes>
    </COLLADA>'''
    return encode_glb(scene, binary), dae


class PokemonGlbMaterialTests(unittest.TestCase):
    def test_restores_blender_v_flip_and_pica_sampler_wraps_per_material(self):
        source, dae = fixture()
        before, original = decode_glb(source)

        fixed = normalize_pokemon_glb(source, dae)
        scene, binary = decode_glb(fixed)

        for actual, expected in zip(struct.unpack_from('<6f', binary, 0), (0.2, 0.9, 1.2, -0.4, -0.3, 0.4)):
            self.assertAlmostEqual(actual, expected, places=6)
        for actual, expected in zip(struct.unpack_from('<6f', binary, 24), (0.4, 0.75, 0.8, 0.25, 0.6, 1.5)):
            self.assertAlmostEqual(actual, expected, places=6)
        self.assertEqual(binary[48:], original[48:])
        self.assertAlmostEqual(scene['accessors'][0]['min'][0], -0.3)
        self.assertAlmostEqual(scene['accessors'][0]['min'][1], -0.4)
        self.assertAlmostEqual(scene['accessors'][0]['max'][0], 1.2)
        self.assertAlmostEqual(scene['accessors'][0]['max'][1], 0.9)
        self.assertEqual(scene['samplers'][scene['textures'][0]['sampler']]['wrapS'], 33648)
        self.assertEqual(scene['samplers'][scene['textures'][0]['sampler']]['wrapT'], 10497)
        self.assertEqual(scene['samplers'][scene['textures'][1]['sampler']]['wrapS'], 33071)
        self.assertEqual(scene['samplers'][scene['textures'][1]['sampler']]['wrapT'], 33071)
        self.assertEqual(scene['materials'][0]['pbrMetallicRoughness']['baseColorTexture'].get('texCoord', 0), 0)
        self.assertEqual(scene['meshes'][0]['primitives'][0]['attributes']['COLOR_0'], 2)
        self.assertIn('pokemonMaterialNormalization', scene['asset']['extras'])
        self.assertEqual(normalize_pokemon_glb(fixed, dae), fixed)
        old_scene, old_binary = decode_glb(fixed)
        del old_scene['asset']['extras']['pokemonMaterialNormalization']['daeSha256']
        old_marker_glb = encode_glb(old_scene, old_binary)
        self.assertEqual(normalize_pokemon_glb(old_marker_glb, dae), old_marker_glb)
        bad_scene, bad_binary = decode_glb(fixed)
        body_sampler = bad_scene['textures'][bad_scene['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['sampler']
        bad_scene['samplers'][body_sampler]['wrapS'] = 10497
        with self.assertRaisesRegex(ValueError, 'sampler wraps'):
            normalize_pokemon_glb(encode_glb(bad_scene, bad_binary), dae)
        with self.assertRaisesRegex(ValueError, 'different COLLADA evidence'):
            normalize_pokemon_glb(fixed, dae.replace(b'<wrap_s>MIRROR</wrap_s>', b'<wrap_s>CLAMP</wrap_s>'))

    def test_maps_dae_uv_semantic_to_the_reindexed_gltf_attribute(self):
        dae = b'''<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema">
          <library_effects><effect id="body-effect"><profile_COMMON>
            <newparam sid="surface"><surface type="2D"><init_from>body-image</init_from></surface></newparam>
            <newparam sid="sampler"><sampler2D><source>surface</source><wrap_s>MIRROR</wrap_s><wrap_t>WRAP</wrap_t></sampler2D></newparam>
            <technique><lambert><diffuse><texture texture="sampler" texcoord="UV0"/></diffuse></lambert></technique>
          </profile_COMMON></effect></library_effects>
          <library_materials><material id="body-material" name="body"><instance_effect url="#body-effect"/></material></library_materials>
          <library_geometries><geometry id="body-geometry"><mesh><triangles>
            <input semantic="TEXCOORD" set="0"/><input semantic="TEXCOORD" set="3"/>
            <input semantic="TEXCOORD" set="4"/><input semantic="TEXCOORD" set="5"/>
          </triangles></mesh></geometry></library_geometries>
          <library_controllers><controller id="body-skin"><skin source="#body-geometry"/></controller></library_controllers>
          <library_visual_scenes><visual_scene><node><instance_controller url="#body-skin"><bind_material><technique_common>
            <instance_material target="#body-material"><bind_vertex_input semantic="UV0" input_semantic="TEXCOORD" input_set="3"/></instance_material>
          </technique_common></bind_material></instance_controller></node></visual_scene></library_visual_scenes>
        </COLLADA>'''

        evidence = dae_material_sampling(dae)['body']

        self.assertEqual(evidence['texCoord'], 1)
        self.assertEqual(evidence['wrapS'], 33648)
        self.assertEqual(evidence['wrapT'], 10497)
        source, _ = fixture()
        scene, binary = decode_glb(source)
        scene['materials'] = scene['materials'][:1]
        scene['meshes'][0]['primitives'] = scene['meshes'][0]['primitives'][:1]

        fixed = normalize_pokemon_glb(encode_glb(scene, binary), dae)
        normalized, _ = decode_glb(fixed)
        texture = normalized['materials'][0]['pbrMetallicRoughness']['baseColorTexture']
        self.assertEqual(texture['texCoord'], 1)
        self.assertEqual(normalized['samplers'][normalized['textures'][texture['index']]['sampler']]['wrapS'], 33648)
        normalized['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['texCoord'] = 0
        with self.assertRaisesRegex(ValueError, 'selects TEXCOORD_0'):
            normalize_pokemon_glb(encode_glb(normalized, decode_glb(fixed)[1]), dae)

    def test_clones_a_shared_texture_when_materials_need_different_pica_wraps(self):
        source, dae = fixture()
        scene, binary = decode_glb(source)
        scene['materials'][1]['pbrMetallicRoughness']['baseColorTexture']['index'] = 0

        fixed = normalize_pokemon_glb(encode_glb(scene, binary), dae)
        normalized, _ = decode_glb(fixed)
        body = normalized['materials'][0]['pbrMetallicRoughness']['baseColorTexture']
        eyes = normalized['materials'][1]['pbrMetallicRoughness']['baseColorTexture']

        self.assertEqual(body['index'], 0)
        self.assertEqual(eyes['index'], 2)
        self.assertEqual(normalized['textures'][body['index']]['source'], normalized['textures'][eyes['index']]['source'])
        self.assertEqual(normalized['samplers'][normalized['textures'][body['index']]['sampler']]['wrapS'], 33648)
        self.assertEqual(normalized['samplers'][normalized['textures'][eyes['index']]['sampler']]['wrapS'], 33071)

    def test_rejects_a_textured_gltf_material_without_matching_dae_evidence(self):
        source, dae = fixture()
        scene, binary = decode_glb(source)
        scene['materials'][1]['name'] = 'missing-material'
        with self.assertRaisesRegex(ValueError, 'missing-material'):
            normalize_pokemon_glb(encode_glb(scene, binary), dae)

    def test_restores_proven_rgb_colors_and_preserves_exported_vertex_alpha(self):
        source, dae = color_fixture()

        fixed = normalize_pokemon_glb(source, dae)
        scene, binary = decode_glb(fixed)
        accessor = scene['meshes'][0]['primitives'][0]['attributes']['COLOR_0']
        colors = color_vectors(scene, binary, accessor)
        self.assertIsNotNone(colors)

        for actual, expected in zip(colors, ([0.5, 0.5, 0.5, 204 / 255],
                                              [0.25, 0.75, 1, 153 / 255],
                                              [0.75, 0.25, 0.5, 102 / 255])):
            for actual_channel, expected_channel in zip(actual, expected):
                self.assertAlmostEqual(actual_channel, expected_channel, places=5)
        proof = scene['asset']['extras']['pokemonMaterialNormalization']['vertexColorProof']
        self.assertEqual(proof['materials'][0]['status'], 'restored')
        self.assertEqual(normalize_pokemon_glb(fixed, dae), fixed)


if __name__ == '__main__':
    unittest.main()
