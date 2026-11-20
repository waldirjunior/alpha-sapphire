import json
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.extract_bcsar_sfx import extract_bcsar_assets, parse_bcsar, scan_seplay_ids


SUPPORTED_PAYLOADS = [b"CSEQ" + bytes(0x20), b"CBNK" + bytes(0x20)]


def make_ref(type_id: int, source: int, target: int) -> bytes:
    return struct.pack("<HHi", type_id, 0, target - source)


def make_cwav() -> bytes:
    data = bytearray(b"CWAV" + b"\xff\xfe\x40\0" + bytes(4) + bytes(4) + bytes(0x30))
    struct.pack_into("<I", data, 0x0C, len(data))
    return bytes(data)


def build_fixture(payloads: list[bytes | str]) -> bytes:
    labels = ["SEQ_SE_MESSAGE" if isinstance(payload, bytes) else "STRM_TEST" for payload in payloads]
    strg = build_string_section(labels)
    internal_files = [payload for payload in payloads if isinstance(payload, bytes)]
    file_section, file_offsets = build_file_section(internal_files)
    info = build_info_section(payloads, file_offsets)
    return build_archive(strg, info, file_section)


def build_string_section(labels: list[str]) -> bytes:
    string_table = bytearray(struct.pack("<I", len(labels)))
    entry_start = len(string_table)
    string_table.extend(bytes(len(labels) * 12))
    for index, label in enumerate(labels):
        encoded = label.encode("ascii") + b"\0"
        entry = entry_start + index * 12
        relative = len(string_table)
        string_table.extend(encoded)
        struct.pack_into("<HHiI", string_table, entry, 0x1F01, 0, relative, len(encoded))

    section = bytearray(b"STRG" + bytes(4) + bytes(8))
    table_start = len(section)
    section.extend(string_table)
    section[8:16] = make_ref(0x2400, 8, table_start)
    struct.pack_into("<I", section, 4, len(section))
    return bytes(section)


def build_file_section(payloads: list[bytes]) -> tuple[bytes, list[int]]:
    body = bytearray(0x18)
    offsets = []
    for payload in payloads:
        offsets.append(len(body))
        body.extend(payload)
    section = bytearray(b"FILE" + bytes(4) + body)
    struct.pack_into("<I", section, 4, len(section))
    return bytes(section), offsets


def build_info_section(payloads: list[bytes | str], file_offsets: list[int]) -> bytes:
    info = bytearray(b"INFO" + bytes(4) + bytes(8 * 8))
    sound_table = append_ref_table(info, [0x2200] * len(payloads))
    file_table = append_ref_table(info, [0x220A] * len(payloads))
    sound_entries = []
    for index, payload in enumerate(payloads):
        entry = len(info)
        info.extend(bytes(28))
        detail = len(info)
        info.extend(bytes(8))
        info[entry + 12:entry + 20] = make_ref(0x2203 if isinstance(payload, bytes) else 0x2201, entry + 12, detail)
        struct.pack_into("<IIB", info, entry, index, 0x04000001, 96)
        struct.pack_into("<II", info, entry + 20, 1, index)
        sound_entries.append(entry)
    file_entries = []
    internal_index = 0
    for payload in payloads:
        entry = len(info)
        info.extend(bytes(8))
        if isinstance(payload, bytes):
            descriptor = len(info)
            info.extend(struct.pack("<HHiI", 0x1F00, 0, file_offsets[internal_index], len(payload)))
            info[entry:entry + 8] = make_ref(0x220C, entry, descriptor)
            internal_index += 1
        else:
            name = payload.encode("ascii") + b"\0"
            name_offset = len(info)
            info.extend(name)
            info[entry:entry + 8] = make_ref(0x220D, entry, name_offset)
        file_entries.append(entry)
    fill_ref_table(info, sound_table, sound_entries)
    fill_ref_table(info, file_table, file_entries)
    info_refs = [0x2100, 0x2104, 0x2101, 0x2103, 0x2105, 0x2102, 0x2106, 0x220B]
    for index, ref_type in enumerate(info_refs):
        source = 8 + index * 8
        if ref_type == 0x2100:
            target = sound_table
        elif ref_type == 0x2106:
            target = file_table
        else:
            continue
        info[source:source + 8] = struct.pack("<HHi", ref_type, 0, target - 8)
    struct.pack_into("<I", info, 4, len(info))
    return bytes(info)


def append_ref_table(data: bytearray, types: list[int]) -> int:
    table = len(data)
    data.extend(struct.pack("<I", len(types)))
    for type_id in types:
        data.extend(make_ref(type_id, len(data), len(data)))
    return table


def fill_ref_table(data: bytearray, table: int, targets: list[int]) -> None:
    for index, target in enumerate(targets):
        source = table + 4 + index * 8
        type_id = struct.unpack_from("<H", data, source)[0]
        data[source:source + 8] = struct.pack("<HHi", type_id, 0, target - table)


def build_archive(strg: bytes, info: bytes, file_section: bytes) -> bytes:
    strg_offset = 0x40
    info_offset = strg_offset + len(strg)
    file_offset = info_offset + len(info)
    header = bytearray(0x40)
    header[:4] = b"CSAR"
    struct.pack_into("<HHIIH", header, 4, 0xFEFF, 0x40, 0x01020300, 0x40 + len(strg) + len(info) + len(file_section), 3)
    struct.pack_into("<HHII", header, 0x14, 0x2000, 0, strg_offset, len(strg))
    struct.pack_into("<HHII", header, 0x20, 0x2001, 0, info_offset, len(info))
    struct.pack_into("<HHII", header, 0x2C, 0x2002, 0, file_offset, len(file_section))
    return bytes(header) + strg + info + file_section


class ExtractBcsarSfxTests(unittest.TestCase):
    def test_parses_sequence_labels_and_internal_and_external_file_entries(self) -> None:
        archive = parse_bcsar(build_fixture([SUPPORTED_PAYLOADS[0], "bgm_test.bcstm"]))

        self.assertEqual(archive["sounds"][0]["label"], "SEQ_SE_MESSAGE")
        self.assertEqual(archive["sounds"][0]["fileId"], 0)
        self.assertEqual(archive["files"][0]["signature"], "CSEQ")
        self.assertEqual(archive["files"][1]["name"], "bgm_test.bcstm")

    def test_extracts_sequence_bank_archive_and_cwav_samples(self) -> None:
        cwar = b"CWAR" + make_cwav() + make_cwav()
        fixture = build_fixture([*SUPPORTED_PAYLOADS, cwar])

        with tempfile.TemporaryDirectory() as directory:
            manifest = extract_bcsar_assets(fixture, Path(directory))

            extensions = {asset["extension"] for asset in manifest["assets"]}
            self.assertEqual(extensions, {"cseq", "cbnk", "cwar", "cwav"})
            cwavs = [asset for asset in manifest["assets"] if asset["extension"] == "cwav"]
            self.assertEqual(len(cwavs), 2)
            self.assertTrue(all((Path(directory) / str(asset["path"])).is_file() for asset in cwavs))

    def test_scans_literal_seplay_ids_and_aggregates_source_zones(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "0006.json"
            source.write_text(json.dumps({
                "zoneId": 6,
                "programs": {"map": {"instructions": [
                    {"mnemonic": "push.c", "operands": [393216]},
                    {"native": {"name": "SEPlay"}},
                    {"mnemonic": "push.c", "operands": [123]},
                    {"native": {"name": "Other"}},
                ]}},
            }))

            result = scan_seplay_ids(Path(directory))

        self.assertEqual(result, [{"id": 393216, "hex": "0x00060000", "count": 1, "sources": ["0006"], "zones": [6]}])


if __name__ == "__main__":
    unittest.main()
