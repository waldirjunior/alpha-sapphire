import copy
import hashlib
import struct
import unittest

from glb_native_clips import decode_glb, encode_glb
from pica_vertex_colors import color_vectors, dae_color_reference, normalize_vertex_colors


def fixture():
    positions = [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
    uvs = [(0, .1), (1, .2), (0, .3)]
    binary = struct.pack('<9f6f12f', *[x for p in positions for x in p],
                         *[x for uv in uvs for x in uv], *([1]*12))
    primitive = {'attributes': {'POSITION': 0, 'TEXCOORD_0': 1, 'COLOR_0': 2}, 'material': 0}
    scene = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(binary)}],
             'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 36},
                             {'buffer': 0, 'byteOffset': 36, 'byteLength': 24},
                             {'buffer': 0, 'byteOffset': 60, 'byteLength': 48}],
             'accessors': [{'bufferView': 0, 'componentType': 5126, 'type': 'VEC3', 'count': 3},
                           {'bufferView': 1, 'componentType': 5126, 'type': 'VEC2', 'count': 3},
                           {'bufferView': 2, 'componentType': 5126, 'type': 'VEC4', 'count': 3}],
             'materials': [{'name': 'body'}, {'name': 'unrelated'}],
             'meshes': [{'primitives': [primitive, {**copy.deepcopy(primitive), 'material': 1}]}],
             'nodes': [{'mesh': 0}], 'scenes': [{'nodes': [0]}], 'scene': 0}
    references = {'body': [[*p, u, 1-v, .5, .25, 0, 1.0000002] for p, (u, v) in zip(positions, uvs)]}
    blob = encode_glb(scene, binary)
    evidence = {'inputSha256': hashlib.sha256(blob).hexdigest(), 'nativeSha256': 'native',
                'daeSha256': 'dae', 'toolSha256': 'tool'}
    return blob, references, evidence


class VertexColorsTest(unittest.TestCase):
    def test_restores_native_colors_by_position_uv_without_mutating_shared_accessors(self):
        blob, references, evidence = fixture()
        changed, report = normalize_vertex_colors(blob, references, evidence)
        before, old_binary = decode_glb(blob)
        after, binary = decode_glb(changed)
        primitives = after['meshes'][0]['primitives']
        color = primitives[0]['attributes']['COLOR_0']
        self.assertEqual(color_vectors(after, binary, color), [[.5, .25, 0, 1]]*3)
        self.assertEqual(primitives[1]['attributes']['COLOR_0'], 2)
        self.assertEqual(after['accessors'][:3], before['accessors'])
        self.assertEqual(binary[:len(old_binary)], old_binary)
        self.assertEqual(after['nodes'], before['nodes'])
        self.assertEqual(after['materials'], before['materials'])
        self.assertEqual(report[0]['status'], 'restored')
        self.assertEqual(report[0]['changed_vertices'], 3)
        self.assertEqual(normalize_vertex_colors(changed, references, evidence)[0], changed)

    def test_triangle_context_resolves_a_color_seam_without_splitting_geometry(self):
        blob, _, evidence = fixture()
        scene, _ = decode_glb(blob)
        positions = [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 0), (0, 1, 0), (-1, 0, 0)]
        uvs = [(0, .1), (1, .2), (0, .3), (0, .1), (0, .3), (-1, .2)]
        binary = struct.pack('<18f12f24f', *[x for p in positions for x in p],
                             *[x for uv in uvs for x in uv], *([1]*24))
        scene['buffers'][0]['byteLength'] = len(binary)
        for view, offset, size in zip(scene['bufferViews'], (0, 72, 120), (72, 48, 96)):
            view.update(byteOffset=offset, byteLength=size)
        for accessor in scene['accessors']:
            accessor['count'] = 6
        blob = encode_glb(scene, binary)
        evidence['inputSha256'] = hashlib.sha256(blob).hexdigest()
        references = {'body': [[*p, *uv, 1 if i < 3 else 0, 0, 0, 1] for i, (p, uv) in enumerate(zip(positions, uvs))]}
        changed, report = normalize_vertex_colors(blob, references, evidence)
        after, payload = decode_glb(changed)
        index = after['meshes'][0]['primitives'][0]['attributes']['COLOR_0']
        self.assertEqual(color_vectors(after, payload, index), [[1, 0, 0, 1]]*3 + [[0, 0, 0, 1]]*3)
        self.assertEqual(report[0]['status'], 'restored')
        self.assertEqual(after['accessors'][0], scene['accessors'][0])

    def test_rejects_conflicting_colors_at_same_position_uv(self):
        blob, references, evidence = fixture()
        references['body'].append([*references['body'][0][:5], 0, 1, 0, 1])
        changed, report = normalize_vertex_colors(blob, references, evidence)
        self.assertEqual(changed, blob)
        self.assertEqual(report[0]['status'], 'unproven')

    def test_requires_every_vertex_to_match_and_preserves_alpha(self):
        for kind in ('missing', 'alpha'):
            blob, references, evidence = fixture()
            if kind == 'missing':
                references['body'].pop()
            else:
                references['body'][0][-1] = .5
            changed, report = normalize_vertex_colors(blob, references, evidence)
            self.assertEqual(changed, blob)
            self.assertEqual(report[0]['status'], 'unproven')

    def test_original_uv_orientation_and_duplicate_split_vertices_are_supported(self):
        blob, references, evidence = fixture()
        references['body'] = [[*row[:4], 1-row[4], *row[5:]] for row in references['body']]
        references['body'].append(references['body'][0].copy())
        changed, report = normalize_vertex_colors(blob, references, evidence)
        self.assertNotEqual(changed, blob)
        self.assertEqual(report[0]['status'], 'restored')

    def test_rejects_wrong_input_sha_and_does_not_add_marker_for_unchanged_colors(self):
        blob, references, evidence = fixture()
        with self.assertRaisesRegex(ValueError, 'SHA'):
            normalize_vertex_colors(blob, references, {**evidence, 'inputSha256': 'wrong'})
        references['body'] = [[*row[:5], 1, 1, 1, 1] for row in references['body']]
        changed, report = normalize_vertex_colors(blob, references, evidence)
        self.assertEqual(changed, blob)
        self.assertEqual(report[0]['status'], 'unchanged')

    def test_dae_parser_honors_separate_position_color_uv_indices(self):
        xml = '''<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema">
          <library_materials><material id="m0" name="body"/></library_materials>
          <library_geometries><geometry><mesh>
            <source id="p"><float_array>0 0 0 1 0 0 0 1 0</float_array><technique_common><accessor count="3" stride="3"/></technique_common></source>
            <source id="uv"><float_array>0 .1 1 .2 0 .3</float_array><technique_common><accessor count="3" stride="2"/></technique_common></source>
            <source id="c"><float_array>1 0 0 1 0 1 0 1 0 0 1 1</float_array><technique_common><accessor count="3" stride="4"/></technique_common></source>
            <vertices><input semantic="POSITION" source="#p"/></vertices>
            <triangles material="symbol"><input semantic="VERTEX" offset="0"/>
              <input semantic="COLOR" offset="1" source="#c"/><input semantic="TEXCOORD" set="0" offset="2" source="#uv"/>
              <p>0 2 0 1 1 1 2 0 2</p></triangles>
          </mesh></geometry></library_geometries>
          <library_visual_scenes><instance_material symbol="symbol" target="#m0"/></library_visual_scenes>
        </COLLADA>'''
        rows = dae_color_reference(xml.encode())['body']
        self.assertEqual(rows[0], [0, 0, 0, 0, .1, 0, 0, 1, 1])
        self.assertEqual(rows[2], [0, 1, 0, 0, .3, 1, 0, 0, 1])


if __name__ == '__main__':
    unittest.main()
