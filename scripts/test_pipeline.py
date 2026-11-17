#!/usr/bin/env python3
"""Testes unitários determinísticos para os parsers do pipeline da ROM (fixtures sintéticas)."""

from __future__ import annotations

import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from extract_gr_maps import parse_gr_grid
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


if __name__ == "__main__":
    unittest.main()
