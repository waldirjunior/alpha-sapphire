from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_battle_arenas import BATTLE_ARENA_SOURCES, load_battle_arena_sources


class BattleArenaSourceTest(unittest.TestCase):
    def test_rom_sources_use_grass_and_water_battlefield_models(self) -> None:
        self.assertEqual(BATTLE_ARENA_SOURCES["grass"].slot, 11)
        self.assertEqual(BATTLE_ARENA_SOURCES["grass"].tag, "btl_F_kusa")
        self.assertEqual(BATTLE_ARENA_SOURCES["water"].slot, 12)
        self.assertEqual(BATTLE_ARENA_SOURCES["water"].tag, "btl_F_mizu")

    def test_loads_only_validated_bch_models_from_unpacked_rom_archive(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00" + b"btl_F_kusa\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00" + b"btl_F_mizu\x00")

            sources = load_battle_arena_sources(unpacked)

            self.assertEqual(set(sources), {"grass", "water"})
            self.assertEqual(sources["grass"].read_bytes()[4:], b"btl_F_kusa\x00")
            self.assertEqual(sources["water"].read_bytes()[4:], b"btl_F_mizu\x00")

    def test_rejects_an_archive_slot_with_an_unexpected_model_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00" + b"btl_F_city\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00" + b"btl_F_mizu\x00")

            with self.assertRaisesRegex(ValueError, "btl_F_kusa"):
                load_battle_arena_sources(unpacked)

    def test_rejects_non_bch_entry_with_a_matching_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BG\x04\x00" + b"btl_F_kusa\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00" + b"btl_F_mizu\x00")

            with self.assertRaisesRegex(ValueError, "BCH"):
                load_battle_arena_sources(unpacked)


if __name__ == "__main__":
    unittest.main()
