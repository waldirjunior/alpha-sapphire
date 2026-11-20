import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reprocess_pokemon_assets import pica_material_summary


def native_material(color_min, color_max, color_source):
    return {'materials': [{'Name': 'Body', 'textureNames': ['body'],
                           'TextureMappers': [{'WrapU': 'Mirror', 'WrapV': 'Repeat'}],
                           'TextureCoords': [{'Scale': {'X': 1, 'Y': 1},
                                              'Translation': {'X': 0, 'Y': 0}}],
                           'TexCoordConfig': 'UV', 'TexEnvStages': []}],
            'meshes': [{'MaterialIndex': 0, 'colorMin': color_min, 'colorMax': color_max,
                        'colorSource': color_source}]}


class ReprocessPokemonAssetsTests(unittest.TestCase):
    def test_reports_absent_vertex_color_separately_from_nonwhite_rgb(self):
        absent = pica_material_summary(native_material(None, None, 'absent'), 'Body')
        gray = pica_material_summary(native_material([0.5, 0.5, 0.5, 0], [1, 1, 1, 1], 'buffer'), 'Body')

        self.assertIsNone(absent['vertexColorRgbWhite'])
        self.assertFalse(gray['vertexColorRgbWhite'])


if __name__ == '__main__':
    unittest.main()
