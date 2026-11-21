from __future__ import annotations

import importlib.util
import struct
import unittest

from scripts.inspect_pica_lightset import (
    disassemble_pointer_loads,
    find_pointer_table_runs,
    read_runtime_string,
    read_vtable,
)

CAPSTONE_AVAILABLE = importlib.util.find_spec("capstone") is not None


class PicaLightSetInspectionTests(unittest.TestCase):
    def test_finds_contiguous_path_pointer_table(self) -> None:
        base_va = 0x100000
        blob = bytearray(96)
        blob[64:70] = b"pathA\0"
        blob[72:78] = b"pathB\0"
        struct.pack_into("<II", blob, 16, base_va + 64, base_va + 72)

        runs = find_pointer_table_runs(bytes(blob), {base_va + 64, base_va + 72})

        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]["file_offset"], 16)
        self.assertEqual(runs[0]["values"], [base_va + 64, base_va + 72])
        self.assertEqual(read_runtime_string(bytes(blob), base_va + 72, base_va), "pathB")

    def test_decodes_raw_vtable_entries_without_rebasing_function_offsets(self) -> None:
        blob = bytearray(24)
        struct.pack_into("<III", blob, 4, 0x5C0010, 0x39BCEC, 0x39BC94)

        entries = read_vtable(bytes(blob), 4, 3)

        self.assertEqual([entry["value"] for entry in entries], [0x5C0010, 0x39BCEC, 0x39BC94])
        self.assertEqual([entry["file_offset"] for entry in entries], [4, 8, 12])

    @unittest.skipUnless(CAPSTONE_AVAILABLE, "Capstone is required for ARM disassembly tests")
    def test_capstone_resolves_arm_literal_pointer_load(self) -> None:
        base_va = 0x100000
        blob = bytearray(16)
        struct.pack_into("<I", blob, 0, 0xE59F0000)  # ldr r0, [pc, #0]
        struct.pack_into("<I", blob, 8, base_va + 0x40)

        references = disassemble_pointer_loads(bytes(blob), base_va, {base_va + 0x40})

        self.assertEqual(len(references), 1)
        self.assertEqual(references[0]["instruction_offset"], 0)
        self.assertEqual(references[0]["pool_offset"], 8)
        self.assertEqual(references[0]["target_offset"], 0x40)

    @unittest.skipUnless(CAPSTONE_AVAILABLE, "Capstone is required for ARM disassembly tests")
    def test_capstone_resolves_arm_pc_relative_address_calculation(self) -> None:
        base_va = 0x100000
        blob = bytearray(16)
        struct.pack_into("<I", blob, 0, 0xE28F0004)  # add r0, pc, #4

        references = disassemble_pointer_loads(bytes(blob), base_va, {base_va + 12})

        self.assertEqual(len(references), 1)
        self.assertEqual(references[0]["reference_kind"], "arm-pc-arithmetic")
        self.assertEqual(references[0]["target_offset"], 12)


if __name__ == "__main__":
    unittest.main()
