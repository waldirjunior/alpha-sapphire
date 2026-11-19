import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from object_models import mm_model_index, extract_bm_model_section
from convert_object_models import object_model_indices


def bm_file(sections: list[bytes]) -> bytes:
    header_size = 4 + len(sections) * 4
    first_offset = (header_size + 127) & ~127
    offsets = [first_offset]
    for section in sections[:-1]:
        offsets.append(offsets[-1] + len(section))
    header = b"BM" + struct.pack("<H", len(sections))
    header += struct.pack(f"<{len(offsets)}I", *offsets)
    return header.ljust(first_offset, b"\0") + b"".join(sections)


class ObjectModelTests(unittest.TestCase):
    def test_object_actor_banks_resolve_to_dllfield_mm_indices(self) -> None:
        self.assertEqual(mm_model_index(289), 289)
        self.assertEqual(mm_model_index(0x2000), 354)
        self.assertEqual(mm_model_index(0x200C), 366)
        self.assertEqual(mm_model_index(0x2049), 427)
        self.assertEqual(mm_model_index(0x205B), 445)
        self.assertEqual(mm_model_index(0x1000), 446)
        self.assertEqual(mm_model_index(0x102A), 488)
        self.assertEqual(mm_model_index(0x1039), 503)
        self.assertEqual(mm_model_index(0x103C), 506)
        self.assertEqual(mm_model_index(0x103F), 509)

    def test_out_of_range_and_unknown_object_ids_are_rejected(self) -> None:
        self.assertIsNone(mm_model_index(354))
        self.assertIsNone(mm_model_index(0x205C))
        self.assertIsNone(mm_model_index(0x1040))
        self.assertIsNone(mm_model_index(0x3000 | 11))
        self.assertIsNone(mm_model_index(0x2FFF))

    def test_extracts_first_bch_model_section_and_rejects_invalid_bm(self) -> None:
        first = b"BCH\0real-object-model"
        second = b"BCH\0alternate-object-data"
        self.assertEqual(extract_bm_model_section(bm_file([first, second])), first)
        with self.assertRaisesRegex(ValueError, "BM"):
            extract_bm_model_section(b"not-a-BM-file")

    def test_discovers_mm_object_indices_from_zone_actor_models(self) -> None:
        import tempfile

        with tempfile.TemporaryDirectory() as directory:
            maps = Path(directory)
            (maps / "0006.json").write_text('{"npcs":[{"model":4153},{"model":8204},{"model":289}]}')
            (maps / "0007.json").write_text('{"npcs":[{"model":4096}]}')
            (maps / "_neighbors.json").write_text('{"npcs":[{"model":4096}]}')
            self.assertEqual(object_model_indices(maps), [366, 446, 503])


if __name__ == "__main__":
    unittest.main()
