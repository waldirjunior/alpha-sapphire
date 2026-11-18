import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert_character_glb


class ConvertCharacterGlbTests(unittest.TestCase):
    def test_preserves_player_shoes_mesh_sw_parts02_and_wrist_sw_parts01(self) -> None:
        self.assertFalse(convert_character_glb.should_discard_sw_part("sw_parts02_4_0"))
        self.assertFalse(convert_character_glb.should_discard_sw_part("sw_parts01_3_0"))

    def test_discards_alternate_head_and_shoe_sw_parts03_to_05(self) -> None:
        self.assertTrue(convert_character_glb.should_discard_sw_part("sw_parts03_0"))
        self.assertTrue(convert_character_glb.should_discard_sw_part("sw_parts04_0"))
        self.assertTrue(convert_character_glb.should_discard_sw_part("sw_parts05_0"))

    def test_blender_script_uses_discarded_sw_parts_without_sw_parts02(self) -> None:
        self.assertEqual(
            convert_character_glb.DISCARDED_SW_PARTS,
            ("sw_parts03", "sw_parts04", "sw_parts05"),
        )
        self.assertNotIn("sw_parts02", convert_character_glb.DISCARDED_SW_PARTS)
        self.assertNotIn("sw_parts02", convert_character_glb.BLENDER_SCRIPT)
        for tag in ("sw_parts03", "sw_parts04", "sw_parts05"):
            self.assertIn(tag, convert_character_glb.BLENDER_SCRIPT)


if __name__ == "__main__":
    unittest.main()
