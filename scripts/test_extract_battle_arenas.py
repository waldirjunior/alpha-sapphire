from __future__ import annotations

import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_battle_arenas import (
    BATTLE_ARENA_SOURCES,
    BATTLE_ARENA_STAGE_SOURCES,
    load_battle_arena_sources,
    load_battle_arena_stage_sources,
)


class BattleArenaSourceTest(unittest.TestCase):
    def test_rom_sources_identify_all_eight_gym_environments(self) -> None:
        expected = {
            f"gym{number}": (77 + number, f"btl_G_gym{number}")
            for number in range(1, 9)
        }
        self.assertEqual(
            {name: (source.slot, source.tag) for name, source in BATTLE_ARENA_SOURCES.items() if not name.startswith("gym")},
            {
                "grass": (11, "btl_F_kusa"),
                "water": (12, "btl_F_mizu"),
                "cave": (70, "btl_G_do_0"),
                "indoor": (136, "btl_O_heya_m"),
            },
        )
        self.assertEqual(
            {name: (source.slot, source.tag) for name, source in BATTLE_ARENA_SOURCES.items() if name.startswith("gym")},
            expected,
        )
        self.assertTrue(all(BATTLE_ARENA_SOURCES[name].container_magic == b"BG" for name in expected))

    def test_rom_sources_identify_each_gym_platform(self) -> None:
        expected = {
            f"gym{number}": (124 + number, f"btl_O_gym{number}_m")
            for number in range(1, 9)
        }
        self.assertEqual(
            {name: (source.slot, source.tag) for name, source in BATTLE_ARENA_STAGE_SOURCES.items() if not name.startswith("gym")},
            {
                "grass": (150, "btl_O_kusa_m"),
                "water": (139, "btl_O_mizu_m"),
                "cave": (118, "btl_O_do_0_m"),
            },
        )
        self.assertEqual(
            {name: (source.slot, source.tag) for name, source in BATTLE_ARENA_STAGE_SOURCES.items() if name.startswith("gym")},
            expected,
        )

    def test_loads_validated_models_for_all_gym_arenas_and_platforms(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)

            sources = load_battle_arena_sources(unpacked)
            stages = load_battle_arena_stage_sources(unpacked)

            expected_gyms = {f"gym{number}" for number in range(1, 9)}
            self.assertEqual(set(sources), expected_gyms | {"grass", "water", "cave", "indoor"})
            self.assertEqual(set(stages), expected_gyms | {"grass", "water", "cave"})
            for number in range(1, 9):
                self.assertIn(f"btl_G_gym{number}", sources[f"gym{number}"].read_bytes().decode("ascii"))
                self.assertIn(f"btl_O_gym{number}_m", stages[f"gym{number}"].read_bytes().decode("ascii"))

    def test_rejects_an_archive_slot_with_an_unexpected_model_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)
            (unpacked / "0011.bin").write_bytes(b"BCH\x00btl_F_city\x00")

            with self.assertRaisesRegex(ValueError, "btl_F_kusa"):
                load_battle_arena_sources(unpacked)

    def test_rejects_non_bch_entry_with_a_matching_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)
            (unpacked / "0011.bin").write_bytes(b"BG\x04\x00btl_F_kusa\x00")

            with self.assertRaisesRegex(ValueError, "BCH"):
                load_battle_arena_sources(unpacked)

    def test_rejects_bg_entry_with_wrong_cave_tag(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)
            (unpacked / "0070.bin").write_bytes(self.pack_bg(b"BCH\x00btl_G_c_b1\x00"))

            with self.assertRaisesRegex(ValueError, "btl_G_do_0"):
                load_battle_arena_sources(unpacked)

    def test_rejects_bg_entry_with_out_of_bounds_offsets(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)
            malformed = bytearray((unpacked / "0070.bin").read_bytes())
            struct.pack_into("<II", malformed, 4, 128, len(malformed) + 1)
            (unpacked / "0070.bin").write_bytes(malformed)

            with self.assertRaisesRegex(ValueError, "offset BG"):
                load_battle_arena_sources(unpacked)

    def test_rejects_truncated_bg_entry_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            unpacked = Path(temporary)
            self.write_all_sources(unpacked)
            (unpacked / "0070.bin").write_bytes(b"BG\x04\x00")

            with self.assertRaisesRegex(ValueError, "tabela BG truncada"):
                load_battle_arena_sources(unpacked)

    def write_all_sources(self, unpacked: Path) -> None:
        for sources in (BATTLE_ARENA_SOURCES, BATTLE_ARENA_STAGE_SOURCES):
            for source in sources.values():
                model = b"BCH\x00" + source.tag.encode("ascii") + b"\x00"
                blob = self.pack_bg(model) if source.container_magic == b"BG" else model
                (unpacked / f"{source.slot:04d}.bin").write_bytes(blob)

    @staticmethod
    def pack_bg(model: bytes) -> bytes:
        header = bytearray(0x80)
        header[:4] = b"BG\x01\x00"
        struct.pack_into("<II", header, 4, len(header), len(header) + len(model))
        return bytes(header) + model


if __name__ == "__main__":
    unittest.main()
