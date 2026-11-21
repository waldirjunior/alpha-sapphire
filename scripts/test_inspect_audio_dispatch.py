import importlib.util
import struct
import unittest

from scripts.inspect_audio_dispatch import (
    EXEFS_BASE_VA,
    direct_flow_targets,
    read_dispatch_tables,
    read_garc_entries,
    read_trainer_class_audio_arguments,
    read_trainer_data_classes,
    resolve_seplay_bcsar_id,
    disassemble_arm_range,
)


CAPSTONE_AVAILABLE = importlib.util.find_spec("capstone") is not None


def make_dispatch_fixture() -> bytes:
    blob = bytearray(0x200)
    table_offset = 0x20
    struct.pack_into("<II", blob, table_offset + 6 * 8, 2, EXEFS_BASE_VA + 0x100)
    struct.pack_into("<II", blob, 0x100, 0x01000105, 0x01000166)
    return bytes(blob)


def make_single_entry_garc(payload: bytes) -> bytes:
    header_length = 28
    fato_offset = header_length
    fatb_offset = fato_offset + 12
    data_offset = fatb_offset + 28
    file_size = data_offset + len(payload)
    blob = bytearray(file_size)
    struct.pack_into("<4sIHHIIII", blob, 0, b"CRAG", header_length, 0xFEFF, 4, 2, data_offset, file_size, 0x10)
    struct.pack_into("<4sIHH", blob, fato_offset, b"OTAF", 12, 1, 0)
    struct.pack_into("<4sII", blob, fatb_offset, b"BTAF", 28, 1)
    struct.pack_into("<I", blob, fatb_offset + 12, 1)
    struct.pack_into("<III", blob, fatb_offset + 16, 0, len(payload), len(payload))
    blob[data_offset:] = payload
    return bytes(blob)


class InspectAudioDispatchTests(unittest.TestCase):
    def test_flow_targets_include_call_and_tail_branch(self):
        rows = [
            {"mnemonic": "bl", "operands": "#0x100120"},
            {"mnemonic": "b", "operands": "#0x100180"},
            {"mnemonic": "bx", "operands": "lr"},
        ]

        self.assertEqual(direct_flow_targets(rows), [0x100120, 0x100180])

    def test_dispatch_table_uses_exefs_virtual_pointers_and_bounds(self):
        groups = read_dispatch_tables(make_dispatch_fixture(), EXEFS_BASE_VA + 0x20)

        self.assertEqual(groups[0], [])
        self.assertEqual(groups[6], [0x01000105, 0x01000166])

    def test_seplay_splits_group_and_local_id_and_ignores_top_byte(self):
        groups = {6: [0x01000105, 0x01000166]}

        self.assertEqual(resolve_seplay_bcsar_id(0x00060000, groups), 0x01000105)
        self.assertEqual(resolve_seplay_bcsar_id(0xAB060001, groups), 0x01000166)
        self.assertIsNone(resolve_seplay_bcsar_id(0x00060002, groups))
        self.assertIsNone(resolve_seplay_bcsar_id(0x00070000, groups))
        self.assertIsNone(resolve_seplay_bcsar_id(0x1_0000_0000, groups))

    def test_garc_entry_reader_accepts_one_uncompressed_record(self):
        entries = read_garc_entries(make_single_entry_garc(b"trainer-record"))

        self.assertEqual(entries, [b"trainer-record"])

    def test_trdata_and_trclass_audio_fields_are_read_from_rom_offsets(self):
        trainer = bytearray(24)
        struct.pack_into("<H", trainer, 2, 137)
        trainer[7] = 1
        empty = bytes(24)
        class_record = bytearray(16)
        struct.pack_into("<I", class_record, 12, 0x00010091)

        self.assertEqual(read_trainer_data_classes([empty, bytes(trainer)]), [{"trainerId": 1, "classId": 137}])
        self.assertEqual(read_trainer_class_audio_arguments([bytes(class_record)]), [0x00010091])

    @unittest.skipUnless(CAPSTONE_AVAILABLE, "Capstone is required for ARM disassembly tests")
    def test_capstone_disassembles_synthetic_arm_instruction(self):
        rows = disassemble_arm_range(bytes.fromhex("01 00 a0 e1"), 0, 4, 0x100000)

        self.assertEqual(rows, ["00100000: mov r0, r1"])

    def test_invalid_garc_and_malformed_dispatch_pointers_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "CRAG"):
            read_garc_entries(b"not-garc")

        blob = bytearray(make_dispatch_fixture())
        struct.pack_into("<I", blob, 0x20 + 6 * 8 + 4, EXEFS_BASE_VA + len(blob))
        with self.assertRaisesRegex(ValueError, "fora do arquivo"):
            read_dispatch_tables(bytes(blob), EXEFS_BASE_VA + 0x20)


if __name__ == "__main__":
    unittest.main()
