#!/usr/bin/env python3
"""Testes unitários determinísticos para os parsers do pipeline da ROM (fixtures sintéticas)."""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from extract_battle_tables import (
    PERSONAL_SIZE,
    TM_SIGNATURE,
    parse_learnset,
    parse_move,
    parse_personal,
    parse_personal_table,
    parse_tm_moves,
    parse_type_chart,
    resolve_form_owners,
    unpack_mini,
)
from extract_gr_maps import parse_gr_grid
from convert_gr_to_glb import (
    parse_missing_textures,
    patch_glb_materials,
    pica_alpha_state,
    select_texture_archive,
)
from extract_texts import decode_gen6_text
from unpack_garc import decompress_lz11


def encode_single_line(codes: list[int]) -> bytes:
    key = 0x7C89
    encoded: list[int] = []
    for code in [*codes, 0]:
        encoded.append(code ^ key)
        key = ((key << 3) | (key >> 13)) & 0xFFFF
    char_bytes = struct.pack(f"<{len(encoded)}H", *encoded)
    sec_header = struct.pack("<I", len(char_bytes)) + struct.pack("<IHH", 12, len(encoded), 0)
    header = struct.pack("<HHIII", 1, 1, 16 + len(sec_header) + len(char_bytes), 0, len(sec_header) + len(char_bytes))
    return header + sec_header + char_bytes


class PipelineParsersTest(unittest.TestCase):
    def test_decompress_lz11_literal_only(self) -> None:
        # 4 bytes descomprimidos: b"ABCD", flag byte 0x00 = 8 literais
        payload = bytes([0x11, 0x04, 0x00, 0x00, 0x00]) + b"ABCD"
        self.assertEqual(decompress_lz11(payload), b"ABCD")

    def test_parse_gr_grid_synthetic(self) -> None:
        # Mini-container GR com 1 seção (2x2 tiles)
        sec0 = struct.pack("<HH", 2, 2) + struct.pack("<4I", 0x00000020, 0x01000021, 0x20004004, 0x00000020)
        sec0_off = 16
        sec1_off = sec0_off + len(sec0)
        gr_blob = struct.pack("<2sHII4s", b"GR", 1, sec0_off, sec1_off, b"\x00" * 4) + sec0

        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "test.gr"
            p.write_bytes(gr_blob)
            w, h, collisions, terrain = parse_gr_grid(p)

        self.assertEqual((w, h), (2, 2))
        self.assertEqual(collisions, [[0, 1], [0, 0]])
        self.assertEqual(terrain, [[0, 1], [2, 0]])

    def test_decode_gen6_text_synthetic(self) -> None:
        text = "Hi"
        key = 0x7C89
        encoded_chars: list[int] = []
        for ch in text:
            encoded_chars.append(ord(ch) ^ key)
            key = ((key << 3) | (key >> 13)) & 0xFFFF
        encoded_chars.append(0 ^ key)

        char_bytes = struct.pack(f"<{len(encoded_chars)}H", *encoded_chars)
        line_table_off = 4 + 8  # dentro da seção (base = 16)
        sec_header = struct.pack("<I", len(char_bytes)) + struct.pack("<IHH", line_table_off, len(encoded_chars), 0)
        header = struct.pack("<HHIII", 1, 1, 16 + len(sec_header) + len(char_bytes), 0, len(sec_header) + len(char_bytes))
        blob = header + sec_header + char_bytes

        self.assertEqual(decode_gen6_text(blob), ["Hi"])

    def test_decode_gen6_text_maps_gender_glyphs(self) -> None:
        self.assertEqual(decode_gen6_text(encode_single_line([0x4E, 0xE08F])), ["N♀"])
        self.assertEqual(decode_gen6_text(encode_single_line([0x4E, 0xE08E])), ["N♂"])


def build_personal(stats: tuple[int, ...], form_index: int = 0, form_count: int = 1, tm_bits: tuple[int, ...] = ()) -> bytes:
    entry = bytearray(PERSONAL_SIZE)
    entry[0:6] = bytes(stats)
    entry[0x06:0x08] = bytes([12, 12])
    entry[0x0A:0x0C] = struct.pack("<H", 1 << 6)
    entry[0x15] = 3
    entry[0x16:0x18] = bytes([1, 14])
    entry[0x18:0x1B] = bytes([65, 65, 84])
    entry[0x1C:0x1E] = struct.pack("<H", form_index)
    entry[0x20] = form_count
    for bit in tm_bits:
        entry[0x28 + bit // 8] |= 1 << (bit % 8)
    return bytes(entry)


class BattleTablesTest(unittest.TestCase):
    def test_parse_personal_reads_treecko_layout(self) -> None:
        # Ordem do arquivo: HP, ATK, DEF, SPE, SPA, SPD (Treecko 40/45/35/70/65/55)
        entry = parse_personal(build_personal((40, 45, 35, 70, 65, 55), tm_bits=(0, 99, 100, 106)))
        self.assertEqual(entry["baseStats"], {"hp": 40, "atk": 45, "def": 35, "spe": 70, "spa": 65, "spd": 55})
        self.assertEqual(entry["types"], [12, 12])
        self.assertEqual(entry["evYield"]["spe"], 1)
        self.assertEqual(entry["growthRate"], "medium_slow")
        self.assertEqual(entry["eggGroups"], ["monster", "dragon"])
        self.assertEqual(entry["abilities"], [65, 65, 84])
        self.assertEqual((entry["tms"], entry["hms"]), ([1, 100], [1, 7]))

    def test_parse_personal_rejects_wrong_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "esperado 80"):
            parse_personal(bytes(0x40))

    def test_resolve_form_owners_maps_alt_forms_past_national_dex(self) -> None:
        table = [build_personal((1,) * 6) for _ in range(722)]
        table[386] = build_personal((50,) * 6, form_index=722, form_count=3)
        table += [build_personal((2,) * 6), build_personal((3,) * 6)]
        entries = parse_personal_table(b"".join(table))
        self.assertEqual(resolve_form_owners(entries), {722: (386, 1), 723: (386, 2)})

    def test_unpack_mini_splits_by_offsets(self) -> None:
        blob = b"WD" + struct.pack("<H3I", 2, 16, 18, 21) + b"ab" + b"cde"
        self.assertEqual(unpack_mini(blob, b"WD"), [b"ab", b"cde"])
        with self.assertRaisesRegex(ValueError, "magic"):
            unpack_mini(b"XX" + blob[2:], b"WD")

    def test_parse_move_reads_tackle_and_signed_fields(self) -> None:
        raw = bytearray(0x22)
        raw[0:7] = bytes([0, 0, 1, 50, 100, 35, 0xFF])
        raw[0x15], raw[0x18], raw[0x1B] = 2, 0xFF, 100
        move = parse_move(bytes(raw))
        self.assertEqual((move["category"], move["power"], move["accuracy"], move["pp"]), ("physical", 50, 100, 35))
        self.assertEqual(move["priority"], -1)
        self.assertEqual(move["statChanges"], [{"stat": 2, "stages": -1, "percent": 100}])

    def test_parse_learnset_stops_at_terminator(self) -> None:
        blob = struct.pack("<4h", 1, 1, 71, 5) + struct.pack("<i", -1)
        self.assertEqual(parse_learnset(blob), [{"level": 1, "move": 1}, {"level": 5, "move": 71}])

    def test_parse_type_chart_scales_and_validates(self) -> None:
        raw = bytearray([4] * 18 * 18)
        raw[9 * 18 + 11] = 8
        raw[0 * 18 + 7] = 0
        chart = parse_type_chart(b"\xAA" * 3 + bytes(raw), offset=3)
        self.assertEqual((chart[9][11], chart[0][7], chart[0][0]), (2.0, 0.0, 1.0))
        with self.assertRaisesRegex(ValueError, "inválida"):
            parse_type_chart(b"\x03" * 400, offset=0)

    def test_parse_tm_moves_follows_oras_interleaving(self) -> None:
        values = list(range(1000, 1107))
        code = bytes(0x400000) + TM_SIGNATURE + struct.pack("<107H", *values)
        machines = parse_tm_moves(code)
        self.assertEqual(len(machines["tms"]), 100)
        self.assertEqual(machines["tms"][91:93], [1091, 1098])
        self.assertEqual(machines["hms"], [1092, 1093, 1094, 1095, 1096, 1097, 1106])


def build_glb(materials: list[dict[str, object]]) -> bytes:
    payload = json.dumps({"asset": {"version": "2.0"}, "materials": materials}).encode()
    payload += b" " * (-len(payload) % 4)
    total = 12 + 8 + len(payload)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(payload), b"JSON") + payload


class PicaMaterialConversionTest(unittest.TestCase):
    def test_parse_missing_textures_ignores_other_warnings(self) -> None:
        warnings = (
            "Material 'a' references missing texture 'chip_wind'.\n"
            "Material 'a' uses a standard shading fallback.\n"
            "Material 'b' references missing texture 'chip_wind'.\n"
            "Material 'b' references missing texture 't101_01'.\n"
        )
        self.assertEqual(parse_missing_textures(warnings), {"chip_wind", "t101_01"})

    def test_select_texture_archive_prefers_full_coverage_and_whole_names(self) -> None:
        archives = {
            "0004": b"\x00chip_wind\x00",
            "0008": b"\x00chip_wind\x00t101_01\x00",
            "0009": b"\x00chip_wind2\x00t101_012\x00",
        }
        self.assertEqual(select_texture_archive({"chip_wind", "t101_01"}, archives), "0008")

    def test_select_texture_archive_returns_none_without_any_match(self) -> None:
        self.assertIsNone(select_texture_archive({"x_tex"}, {"0001": b"nothing"}))

    def test_pica_alpha_state_blend_mask_and_opaque(self) -> None:
        blend = {"BlendFunction": {"ColorSrcFunc": "SourceAlpha"}, "AlphaTest": {"Enabled": True, "Reference": 0}}
        mask = {"BlendFunction": {"ColorSrcFunc": "One"}, "AlphaTest": {"Enabled": True, "Reference": 127}}
        opaque = {"BlendFunction": {"ColorSrcFunc": "One"}, "AlphaTest": {"Enabled": False, "Reference": 0}}
        self.assertEqual(pica_alpha_state(blend), ("BLEND", None))
        self.assertEqual(pica_alpha_state(mask), ("MASK", 128 / 255))
        self.assertEqual(pica_alpha_state(opaque), ("OPAQUE", None))

    def test_patch_glb_materials_sets_alpha_mode_and_marker(self) -> None:
        glb = build_glb([{"name": "shadow1"}, {"name": "t01_01"}, {"name": "sem_pica"}])
        states = {"shadow1": ("BLEND", None), "t01_01": ("MASK", 0.5)}
        patched = patch_glb_materials(glb, states)
        length = struct.unpack_from("<I", patched, 12)[0]
        doc = json.loads(patched[20 : 20 + length])
        shadow, wall, untouched = doc["materials"]
        self.assertEqual(shadow["alphaMode"], "BLEND")
        self.assertEqual(wall["alphaMode"], "MASK")
        self.assertEqual(wall["alphaCutoff"], 0.5)
        self.assertTrue(wall["extras"]["pica"])
        self.assertNotIn("extras", untouched)
        self.assertEqual(struct.unpack_from("<I", patched, 8)[0], len(patched))
        self.assertEqual(len(patched) % 4, 0)


if __name__ == "__main__":
    unittest.main()
