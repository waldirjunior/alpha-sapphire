import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from pokemon_battle_expressions import battle_expression_sections


class PokemonBattleExpressionTests(unittest.TestCase):
    def test_maps_battle_clips_to_paired_visibility_and_material_sections(self):
        expected = {
            0: (2, 20),
            8: (10, 28),
            12: (14, 32),
            16: (18, 36),
            17: (19, 37),
        }
        self.assertEqual({index: battle_expression_sections(index) for index in expected}, expected)


if __name__ == '__main__':
    unittest.main()
