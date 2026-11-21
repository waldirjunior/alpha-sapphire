from __future__ import annotations

import struct
import tempfile
import unittest
from pathlib import Path

from scripts.inspect_arenav_assets import (
    extract_garc_entry,
    inspect_garc_headers,
    lz11_prefix,
    scan_romfs_a,
    write_local_asset,
)


class AreaNavAssetInspectionTests(unittest.TestCase):
    def test_scans_decoded_headers_without_writing_rom_data(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            romfs = Path(temporary) / "RomFS"
            archive = romfs / "a/0/0/0"
            archive.parent.mkdir(parents=True)
            archive.write_bytes(
                synthetic_garc(
                    [
                        b"CGFXtexture",
                        b"BCH\x00model",
                        b"BCLYTlayout",
                        b"BCFLYflow",
                        b"BFLYTlayout",
                        b"BFLIMimage",
                    ]
                )
            )

            report = scan_romfs_a(romfs)

            self.assertEqual(report["garc_count"], 1)
            self.assertEqual(report["entry_count"], 6)
            self.assertEqual(
                [(item["slot"], item["magic"]) for item in report["resource_entries"]],
                [(0, "CGFX"), (1, "BCH"), (2, "BCLYT"), (3, "BCFLY"), (4, "BFLYT"), (5, "BFLIM")],
            )
            self.assertFalse((romfs / "a/0/0/0/0000.bin").exists())

    def test_extracts_only_an_entry_with_the_expected_magic(self) -> None:
        archive = synthetic_garc([b"CGFXtexture", b"BCH\x00model"])

        extracted = extract_garc_entry(archive, 0, expected_magic="CGFX")

        self.assertEqual(extracted, b"CGFXtexture")
        with self.assertRaisesRegex(ValueError, "esperado CGFX"):
            extract_garc_entry(archive, 1, expected_magic="CGFX")

    def test_prefix_decoder_reads_lz11_literals_without_expanding_the_tail(self) -> None:
        compressed = b"\x11\x05\x00\x00\x00hello"

        self.assertEqual(lz11_prefix(compressed, 5), b"hello")

    def test_scans_and_extracts_a_compressed_resource_entry(self) -> None:
        original = b"CGFX" + bytes(range(20))
        archive = synthetic_garc([lz11_literals(original)])

        report = inspect_garc_headers(archive, "a/0/0/0", deep=True)

        self.assertEqual(report["matches"][0]["magic"], "CGFX")
        self.assertEqual(report["matches"][0]["decoded_size"], len(original))
        self.assertEqual(extract_garc_entry(archive, 0, expected_magic="CGFX"), original)

    def test_rejects_malformed_garc_offsets(self) -> None:
        archive = bytearray(synthetic_garc([b"CGFXtexture"]))
        struct.pack_into("<I", archive, 60, 0x10000)

        with self.assertRaisesRegex(ValueError, "limites"):
            inspect_garc_headers(bytes(archive), "a/0/0/0")

    def test_extraction_root_must_be_ignored_asset_storage(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "rom" / "extracted" / "probe"
            target = write_local_asset(root, "candidate.bch", b"BCH\0")

            self.assertEqual(target.read_bytes(), b"BCH\0")
            with self.assertRaisesRegex(ValueError, "rom/extracted"):
                write_local_asset(Path(temporary) / "reports", "candidate.bch", b"BCH\0")


def synthetic_garc(entries: list[bytes]) -> bytes:
    fato_size = 16
    fatb_size = 12 + len(entries) * 16
    data_offset = 28 + fato_size + fatb_size
    header = struct.pack(
        "<4sIHHIIII", b"CRAG", 28, 0xFEFF, 0x400, 4, data_offset,
        data_offset + sum(map(len, entries)), sum(map(len, entries)),
    )
    fato = struct.pack("<4sIHHI", b"OTAF", fato_size, len(entries), 0, 0)
    records = bytearray()
    data = bytearray()
    offset = 0
    for entry in entries:
        records.extend(struct.pack("<IIII", 1, offset, offset + len(entry), len(entry)))
        data.extend(entry)
        offset += len(entry)
    fatb = struct.pack("<4sII", b"BTAF", fatb_size, len(entries)) + records
    return header + fato + fatb + data


def lz11_literals(blob: bytes) -> bytes:
    result = bytearray(b"\x11" + len(blob).to_bytes(3, "little"))
    for offset in range(0, len(blob), 8):
        result.append(0)
        result.extend(blob[offset : offset + 8])
    return bytes(result)


if __name__ == "__main__":
    unittest.main()
