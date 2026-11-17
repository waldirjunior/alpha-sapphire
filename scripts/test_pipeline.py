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

from extract_gr_maps import parse_gr_grid
from convert_gr_to_glb import (
    parse_missing_textures,
    patch_glb_materials,
    pica_alpha_state,
    select_texture_archive,
)
from extract_texts import decode_gen6_text
from unpack_garc import decompress_lz11


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
