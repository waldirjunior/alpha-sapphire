import struct
import unittest

from scripts.extract_zone_scripts import decode_compact_cells, parse_amx, parse_zone_scripts


def synthetic_amx():
    header = struct.pack('<IHBBHH12I', 64, 0xF1E0, 10, 10, 28, 8,
                         60, 68, 72, 4168, 4, *([60] * 7))
    return header + bytes.fromhex('2e 80 70 7f') + b'\0\0'


def synthetic_zone():
    script = synthetic_amx()[:64]
    script = struct.pack('<I', len(script)) + script[4:]
    sections = [bytes(56), struct.pack('<IBBBBI', 8, 0, 0, 0, 0, 0) + script,
                script, bytes(16), bytes(4)]
    offsets = [28]
    for section in sections:
        offsets.append(offsets[-1] + len(section))
    return b'ZO' + struct.pack('<H6I', 5, *offsets) + b''.join(sections)


class ZoneScriptsTests(unittest.TestCase):
    def test_signed_big_endian_groups(self):
        self.assertEqual(decode_compact_cells(bytes.fromhex('3f 80 40 7f ff 3f'), 4),
                         [63, 64, 0xFFFFFFFF, 0xFFFFFFBF])

    def test_unsigned_word_wraps_to_32_bits(self):
        self.assertEqual(decode_compact_cells(bytes.fromhex('8f ff ff ff 7f'), 1),
                         [0xFFFFFFFF])

    def test_missing_terminator(self):
        with self.assertRaisesRegex(ValueError, 'truncado'):
            decode_compact_cells(b'\x80', 1)

    def test_extra_cells(self):
        with self.assertRaisesRegex(ValueError, 'excedentes'):
            decode_compact_cells(b'\0\0', 1)

    def test_cell_overflow(self):
        with self.assertRaisesRegex(ValueError, '32 bits'):
            decode_compact_cells(bytes.fromhex('81 80 80 80 80 00'), 1)

    def test_split_code_and_data(self):
        parsed = parse_amx(synthetic_amx())
        self.assertEqual(parsed['codeCells'], [46, 112])
        self.assertEqual(parsed['dataCells'], [0xFFFFFFFF])
        self.assertEqual(parsed['tables']['natives'], [])

    def test_invalid_section_order(self):
        raw = bytearray(synthetic_amx())
        struct.pack_into('<I', raw, 16, 56)
        with self.assertRaises(ValueError):
            parse_amx(bytes(raw))

    def test_truncated_header(self):
        with self.assertRaisesRegex(ValueError, 'cabeçalho'):
            parse_amx(bytes(10))

    def test_both_zone_scripts(self):
        parsed = parse_zone_scripts(synthetic_zone())
        self.assertEqual(parsed['entities']['codeCells'], [46, 112])
        self.assertEqual(parsed['map']['dataCells'], [0xFFFFFFFF])

    def test_bad_zone_pointer(self):
        raw = bytearray(synthetic_zone())
        struct.pack_into('<I', raw, 8, len(raw) + 1)
        with self.assertRaises(ValueError):
            parse_zone_scripts(bytes(raw))


if __name__ == '__main__':
    unittest.main()
