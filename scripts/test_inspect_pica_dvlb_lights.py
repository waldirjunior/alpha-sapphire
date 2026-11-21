from __future__ import annotations

import hashlib
import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.inspect_pica_dvlb_lights import (
    inspect_dvlb,
    inspect_romfs_shaders,
)
from scripts.pica_dvlb_light_xrefs import (
    class_vtable_groups,
    direct_callers,
    scan_thumb_literal_loads,
)


def synthetic_dvlb(uniform_name: str = "projection") -> bytes:
    blob = bytearray(0x110)
    struct.pack_into("<4sI", blob, 0, b"DVLB", 1)
    struct.pack_into("<I", blob, 8, 0x80)

    dvlp = 0x0C
    code = bytes.fromhex("01020304aabbccdd")
    file_symbols = b"synthetic.vsh\0"
    struct.pack_into(
        "<4s9I",
        blob,
        dvlp,
        b"DVLP",
        1,
        0x28,
        2,
        0x30,
        0,
        0x30,
        0,
        0x30,
        len(file_symbols),
    )
    blob[dvlp + 0x28 : dvlp + 0x28 + len(code)] = code
    blob[dvlp + 0x30 : dvlp + 0x30 + len(file_symbols)] = file_symbols

    dvle = 0x80
    symbol_table = uniform_name.encode("ascii") + b"\0"
    struct.pack_into(
        "<4sHBBIIHHBBBB10I",
        blob,
        dvle,
        b"DVLE",
        1,
        0,
        0,
        0,
        2,
        0x0001,
        0x0002,
        0,
        0,
        0,
        0,
        0x40,
        0,
        0x40,
        0,
        0x40,
        0,
        0x40,
        1,
        0x48,
        len(symbol_table),
    )
    struct.pack_into("<IHH", blob, dvle + 0x40, 0, 0x10, 0x10)
    blob[dvle + 0x48 : dvle + 0x48 + len(symbol_table)] = symbol_table
    return bytes(blob)


def synthetic_garc(payload: bytes) -> bytes:
    header_size, fato_size = 28, 16
    fatb_offset = header_size + fato_size
    fatb_size = 28
    data_offset = fatb_offset + fatb_size + 8
    data = struct.pack(
        "<4sIHHIIII",
        b"CRAG",
        header_size,
        0xFEFF,
        0x0400,
        3,
        data_offset,
        data_offset + len(payload),
        0,
    )
    fato = struct.pack("<4sIHH", b"OTAF", fato_size, 1, 0xFFFF) + bytes(4)
    fatb = struct.pack("<4sII", b"BTAF", fatb_size, 1)
    fatb += struct.pack("<IIII", 1, 0, len(payload), len(payload))
    return data + fato + fatb + struct.pack("<4sI", b"GMIF", 8) + payload


class PicaDvlbLightInspectionTests(unittest.TestCase):
    def test_decodes_dvlp_dvle_symbols_uniform_registers_and_program_hash(self) -> None:
        shader = synthetic_dvlb("LightPowScale")

        report = inspect_dvlb(shader, 0, "synthetic.shbin")

        self.assertEqual(report["dvlb_offset"], 0)
        self.assertEqual(report["executable_count"], 1)
        self.assertEqual(report["record_size"], 0xD6)
        self.assertEqual(report["program"]["instruction_words"], 2)
        self.assertEqual(report["program"]["filename_symbols"], ["synthetic.vsh"])
        self.assertEqual(report["program"]["code_sha256"], hashlib.sha256(bytes.fromhex("01020304aabbccdd")).hexdigest())
        executable = report["executables"][0]
        self.assertEqual(executable["type"], "vertex")
        self.assertEqual(executable["uniforms"], [{
            "name": "LightPowScale",
            "register_start": 0x10,
            "register_end": 0x10,
            "register_class": "float-constant",
            "register_count": 1,
        }])
        self.assertEqual(executable["symbols"], ["LightPowScale"])

    def test_rejects_invalid_dvle_offsets_instead_of_reading_neighbor_data(self) -> None:
        shader = bytearray(synthetic_dvlb())
        struct.pack_into("<I", shader, 8, 0xFFFFFFF0)

        with self.assertRaisesRegex(ValueError, "DVLE offset"):
            inspect_dvlb(bytes(shader), 0, "invalid.shbin")

    def test_romfs_scan_finds_shader_in_garc_and_loose_shbin_deterministically(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            romfs = Path(directory)
            archive = romfs / "a" / "0" / "0" / "8"
            archive.parent.mkdir(parents=True)
            shader = synthetic_dvlb()
            package = struct.pack("<2sHII", b"PC", 1, 12, 12 + len(shader)) + shader
            archive.write_bytes(synthetic_garc(package))
            loose = romfs / "shader" / "sample.shbin"
            loose.parent.mkdir(parents=True)
            loose.write_bytes(synthetic_dvlb("projection"))

            first = inspect_romfs_shaders(romfs)
            second = inspect_romfs_shaders(romfs)

        self.assertEqual(first, second)
        self.assertEqual(len(first["shaders"]), 2)
        self.assertEqual(
            [(row["archive"], row["slot"], row["source_kind"]) for row in first["shaders"]],
            [("a/0/0/8", 0, "garc"), ("shader/sample.shbin", -1, "loose")],
        )

    def test_finds_thumb_literal_pool_reference_to_shader_table(self) -> None:
        base_va = 0x100000
        target = base_va + 0x44
        code = bytearray(0x50)
        struct.pack_into("<H", code, 0, 0x4800)  # ldr r0, [pc, #0]
        struct.pack_into("<I", code, 4, target)

        references = scan_thumb_literal_loads(bytes(code), base_va, {target})

        self.assertEqual(references, [{
            "instruction_offset": 0,
            "reference_kind": "thumb-literal-load",
            "instruction": 0x4800,
            "pool_offset": 4,
            "pool_va": base_va + 4,
            "value": target,
        }])

    def test_resolves_lightset_rtti_to_vtable_group(self) -> None:
        base_va = 0x100000
        blob = bytearray(0x100)
        name = b"N3gfl3grp3g3d8LightSetE\0"
        blob[0x40:0x40 + len(name)] = name
        struct.pack_into("<I", blob, 0x30, base_va + 0x40)
        struct.pack_into("<II", blob, 0x20, base_va + 0x2C, 0x80)

        groups = class_vtable_groups(bytes(blob), base_va)

        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["class_rtti"], "N3gfl3grp3g3d8LightSetE")
        self.assertEqual(groups[0]["vtable_typeinfo_pointer_offset"], 0x20)
        self.assertEqual(groups[0]["method_entries"][0]["code_file_offset"], 0x80)

    @unittest.skipUnless(importlib.util.find_spec("capstone"), "Capstone is required for ARM call tests")
    def test_finds_direct_arm_callers_for_a_vtable_method_candidate(self) -> None:
        base_va = 0x100000
        code = struct.pack("<II", 0xEB000000, 0xE12FFF1E)

        callers = direct_callers(code, {base_va + 8}, base_va)

        self.assertIn({"address": 0, "mode": "ARM", "mnemonic": "bl", "operands": "#0x100008"},
                      callers[base_va + 8])

    @unittest.skipUnless(importlib.util.find_spec("capstone"), "Capstone is required for Thumb call tests")
    def test_finds_direct_thumb_callers(self) -> None:
        base_va = 0x100000
        code = struct.pack("<HH", 0xF000, 0xF800)

        callers = direct_callers(code, {base_va + 4}, base_va)

        self.assertIn({"address": 0, "mode": "Thumb", "mnemonic": "bl", "operands": "#0x100004"},
                      callers[base_va + 4])


if __name__ == "__main__":
    unittest.main()
