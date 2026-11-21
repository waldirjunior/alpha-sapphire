from __future__ import annotations

import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_battle_arenas import BATTLE_ARENA_SOURCES, load_battle_arena_sources


class BattleArenaSourceTest(unittest.TestCase):
    def test_rom_sources_identify_grass_water_cave_and_gym_models(self) -> None:
        self.assertEqual(BATTLE_ARENA_SOURCES["grass"].slot, 11)
        self.assertEqual(BATTLE_ARENA_SOURCES["grass"].tag, "btl_F_kusa")
        self.assertEqual(BATTLE_ARENA_SOURCES["water"].slot, 12)
        self.assertEqual(BATTLE_ARENA_SOURCES["water"].tag, "btl_F_mizu")
        self.assertEqual(BATTLE_ARENA_SOURCES["cave"].slot, 44)
        self.assertEqual(BATTLE_ARENA_SOURCES["cave"].tag, "btl_G_c_a1")
        self.assertEqual(BATTLE_ARENA_SOURCES["gym"].slot, 78)
        self.assertEqual(BATTLE_ARENA_SOURCES["gym"].tag, "btl_G_gym1")

    def test_loads_validated_bch_models_from_both_rom_containers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            grass = b"BCH\x00" + b"btl_F_kusa\x00"
            water = b"BCH\x00" + b"btl_F_mizu\x00"
            cave = b"BCH\x00" + b"btl_G_c_a1\x00"
            gym = b"BCH\x00" + b"btl_G_gym1\x00"
            (unpacked / "0011.bin").write_bytes(grass)
            (unpacked / "0012.bin").write_bytes(water)
            (unpacked / "0044.bin").write_bytes(self.pack_bg(cave))
            (unpacked / "0078.bin").write_bytes(self.pack_bg(gym))

            sources = load_battle_arena_sources(unpacked)

            self.assertEqual(set(sources), {"grass", "water", "cave", "gym"})
            self.assertEqual(sources["grass"].read_bytes(), grass)
            self.assertEqual(sources["water"].read_bytes(), water)
            self.assertEqual(sources["cave"].read_bytes(), cave)
            self.assertEqual(sources["gym"].read_bytes(), gym)

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

    def test_rejects_bg_entry_with_wrong_cave_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00btl_F_kusa\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00btl_F_mizu\x00")
            (unpacked / "0044.bin").write_bytes(self.pack_bg(b"BCH\x00btl_G_c_b1\x00"))
            (unpacked / "0078.bin").write_bytes(self.pack_bg(b"BCH\x00btl_G_gym1\x00"))

            with self.assertRaisesRegex(ValueError, "btl_G_c_a1"):
                load_battle_arena_sources(unpacked)

    def test_rejects_bg_entry_with_out_of_bounds_offsets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00btl_F_kusa\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00btl_F_mizu\x00")
            malformed = bytearray(self.pack_bg(b"BCH\x00btl_G_c_a1\x00"))
            struct.pack_into("<II", malformed, 4, 128, len(malformed) + 1)
            (unpacked / "0044.bin").write_bytes(malformed)
            (unpacked / "0078.bin").write_bytes(self.pack_bg(b"BCH\x00btl_G_gym1\x00"))

            with self.assertRaisesRegex(ValueError, "offset BG"):
                load_battle_arena_sources(unpacked)

    def test_rejects_truncated_bg_entry_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00btl_F_kusa\x00")
            (unpacked / "0012.bin").write_bytes(b"BCH\x00btl_F_mizu\x00")
            (unpacked / "0044.bin").write_bytes(b"BG\x04\x00")
            (unpacked / "0078.bin").write_bytes(self.pack_bg(b"BCH\x00btl_G_gym1\x00"))

            with self.assertRaisesRegex(ValueError, "tabela BG truncada"):
                load_battle_arena_sources(unpacked)

    @staticmethod
    def pack_bg(model: bytes) -> bytes:
        header = bytearray(0x80)
        header[:4] = b"BG\x01\x00"
        struct.pack_into("<II", header, 4, len(header), len(header) + len(model))
        return bytes(header) + model


if __name__ == "__main__":
    unittest.main()
