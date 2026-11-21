from __future__ import annotations

import json
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.extract_arenav_ui import extract_arenav_ui, parse_clyt


class AreaNavUiExtractionTests(unittest.TestCase):
    def test_parses_clyt_pane_names_positions_and_dimensions(self) -> None:
        layout = synthetic_clyt([
            clyt_pane("pan1", "RootPane", 0, 0, 320, 240),
            clyt_pane("pic1", "MapTexture", 0, 15, 380, 270),
            clyt_pane("txt1", "LocationLabel", 12.5, 3.25, 190, 20),
        ])

        panes = parse_clyt(layout)

        self.assertEqual(
            [(pane.kind, pane.name, pane.x, pane.y, pane.width, pane.height) for pane in panes],
            [
                ("pan1", "RootPane", 0, 0, 320, 240),
                ("pic1", "MapTexture", 0, 15, 380, 270),
                ("txt1", "LocationLabel", 12.5, 3.25, 190, 20),
            ],
        )

    def test_rejects_clyt_chunk_sizes_outside_the_file(self) -> None:
        malformed = bytearray(synthetic_clyt([clyt_pane("pan1", "RootPane", 0, 0, 320, 240)]))
        struct.pack_into("<I", malformed, 24, 0xFFFFFFFF)

        with self.assertRaisesRegex(ValueError, "CLYT chunk"):
            parse_clyt(bytes(malformed))

    def test_extracts_named_bclim_pngs_and_layout_json_from_garc_darc(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            romfs = root / "RomFS"
            output = root / "public/assets/ui/arenav"
            archive_dir = romfs / "a/0/6"
            archive_dir.mkdir(parents=True)
            (archive_dir / "7").write_bytes(synthetic_garc([lz11_literals(synthetic_darc([
                ("./timg/poke_navi_map.bclim", synthetic_bclim(8, 8)),
                ("./timg/map_city_icon01.bclim", synthetic_bclim(8, 8)),
                ("./blyt/map_lower.bclyt", synthetic_clyt([
                    clyt_pane("pan1", "RootPane", 0, 0, 320, 240),
                    clyt_pane("pic1", "MapTexture", 0, 15, 380, 270),
                ])),
            ]))]))
            nav_archive = romfs / "a/2/7/6"
            nav_archive.parent.mkdir(parents=True)
            nav_archive.write_bytes(synthetic_garc([
                lz11_literals(synthetic_darc([("./timg/not_english.bclim", synthetic_bclim(8, 8))])),
                lz11_literals(synthetic_darc([("./timg/map_navi01.bclim", synthetic_bclim(8, 8))])),
            ]))

            extracted = extract_arenav_ui(romfs, output)

            self.assertIn("poke_navi_map.png", extracted)
            self.assertIn("map_city_icon01.png", extracted)
            self.assertIn("map_navi01.png", extracted)
            self.assertIn("map_lower.layout.json", extracted)
            self.assertEqual((output / "poke_navi_map.png").read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual((output / "map_city_icon01.png").read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            layout = json.loads((output / "map_lower.layout.json").read_text(encoding="utf-8"))
            self.assertEqual(layout[0]["name"], "RootPane")


def clyt_pane(kind: str, name: str, x: float, y: float, width: float, height: float) -> bytes:
    expected_size = {"pan1": 76, "pic1": 128, "txt1": 140}[kind]
    header = struct.pack("<4sI", kind.encode("ascii"), expected_size)
    flags = bytes((1, 4, 255, 0))
    encoded_name = name.encode("ascii")[:24].ljust(24, b"\0")
    transform = struct.pack("<10f", x, y, 0, 0, 0, 0, 1, 1, width, height)
    return header + flags + encoded_name + transform + bytes(expected_size - 8 - 4 - 24 - 40)


def synthetic_clyt(panes: list[bytes]) -> bytes:
    chunks = b"".join(panes)
    file_size = 20 + len(chunks)
    header = struct.pack("<4sHHIII", b"CLYT", 0xFEFF, 20, 0x02020000, file_size, len(panes))
    return header + chunks


def synthetic_darc(files: list[tuple[str, bytes]]) -> bytes:
    names = bytearray(b"\0\0")
    records: list[tuple[int, bytes]] = []
    for name, content in files:
        name_offset = len(names)
        names.extend(name.encode("utf-16le") + b"\0\0")
        records.append((name_offset, content))
    node_count = len(records) + 1
    table_offset = 0x1C
    table_length = node_count * 12 + len(names)
    data_offset = table_offset + table_length
    file_offset = data_offset
    rows = bytearray(struct.pack("<III", 0x01000000, 0, node_count))
    data = bytearray()
    for name_offset, content in records:
        rows.extend(struct.pack("<III", name_offset, file_offset, len(content)))
        data.extend(content)
        file_offset += len(content)
    file_size = file_offset
    header = struct.pack(
        "<4sHHIIIII", b"darc", 0xFEFF, 0x1C, 1, file_size,
        table_offset, table_length, data_offset,
    )
    return header + rows + names + data


def synthetic_garc(subfiles: list[bytes]) -> bytes:
    header_size = 28
    fato_size = 16
    fatb_size = 12 + 4 + len(subfiles) * 12
    data_offset = header_size + fato_size + fatb_size + 8
    file_size = data_offset + sum(map(len, subfiles))
    header = struct.pack(
        "<4sIHHIIII", b"CRAG", header_size, 0xFEFF, 0x0400, 3,
        data_offset, file_size, 0,
    )
    fato = struct.pack("<4sIHHI", b"OTAF", fato_size, 1, 0xFFFF, 0)
    fatb = bytearray(struct.pack("<4sII", b"BTAF", fatb_size, len(subfiles)))
    fatb.extend(struct.pack("<I", (1 << len(subfiles)) - 1))
    data = bytearray()
    offset = 0
    for subfile in subfiles:
        fatb.extend(struct.pack("<III", offset, offset + len(subfile), len(subfile)))
        data.extend(subfile)
        offset += len(subfile)
    return header + fato + fatb + struct.pack("<4sI", b"GMIF", 8) + data


def lz11_literals(payload: bytes) -> bytes:
    result = bytearray(b"\x11" + len(payload).to_bytes(3, "little"))
    for offset in range(0, len(payload), 8):
        result.append(0)
        result.extend(payload[offset:offset + 8])
    return bytes(result)


def synthetic_bclim(width: int, height: int) -> bytes:
    pixel_data = bytes((255, 64, 32, 255)) * (width * height)
    footer = bytearray(40)
    footer[:4] = b"CLIM"
    struct.pack_into("<H", footer, 4, 0xFEFF)
    struct.pack_into("<H", footer, 6, 0x14)
    struct.pack_into("<HHH", footer, 0x1C, width, height, 9)
    return pixel_data + footer


if __name__ == "__main__":
    unittest.main()
