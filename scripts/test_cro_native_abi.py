import struct
import unittest

from scripts.cro_native_abi import CroImage


def synthetic_cro():
    blob = bytearray(1024)
    blob[0x80:0x84] = b'CRO0'
    struct.pack_into('<II', blob, 0xC8, 0x200, 2)
    struct.pack_into('<III', blob, 0x200, 0x180, 0x80, 0)
    struct.pack_into('<III', blob, 0x20C, 0x280, 0x80, 1)
    struct.pack_into('<II', blob, 0x128, 0x300, 2)
    struct.pack_into('<III', blob, 0x300, 0x201, 0x102, 0x10)
    struct.pack_into('<III', blob, 0x30C, 0x241, 0x002, 0x04)
    blob[0x290:0x298] = b'Example\0'
    return blob


class CroNativeAbiTests(unittest.TestCase):
    def test_name_and_function_are_adjacent_relocations(self):
        image = CroImage(synthetic_cro())
        self.assertEqual(image.native('Example'), (0x2A0, 0x184))
        self.assertEqual(struct.unpack_from('<II', image.relocated(), 0x2A0), (0x290, 0x184))

    def test_message_selector_decodes_rotated_immediate_and_literal(self):
        blob = synthetic_cro()
        blob[0x290:0x298] = b'MsgLoad\0'
        struct.pack_into('<I', blob, 0x12C, 4)
        struct.pack_into('<III', blob, 0x318, 0x100, 2, 0x40)
        struct.pack_into('<III', blob, 0x324, 0x140, 2, 0x50)
        struct.pack_into('<II', blob, 0x184, 0xE3570002, 0x379FF107)
        struct.pack_into('<I', blob, 0x1C0, 0xE3A07F41)
        struct.pack_into('<I', blob, 0x1D0, 0xE59F7000)
        struct.pack_into('<I', blob, 0x1D8, 461)
        self.assertEqual(CroImage(blob).message_files(), [260, 461])

    def test_static_imports_follow_anonymous_batches_and_addends(self):
        blob = synthetic_cro()
        struct.pack_into('<II', blob, 0xF0, 0x340, 1)
        struct.pack_into('<II', blob, 0xF8, 0x360, 2)
        struct.pack_into('<IIIII', blob, 0x340, 0x3A0, 0, 0, 0x380, 1)
        blob[0x3A0:0x3A9] = b'|static|\0'
        struct.pack_into('<II', blob, 0x380, 0x200, 0x360)
        struct.pack_into('<III', blob, 0x360, 0x40, 2, 4)
        struct.pack_into('<III', blob, 0x36C, 0x80, 0x102, 8)
        static = synthetic_cro()
        struct.pack_into('<I', static, 0x200, 0x100000)
        crs = CroImage(static)
        self.assertEqual(CroImage(blob).static_imports(crs), {0x184: 0x100024, 0x188: 0x100028})
        struct.pack_into('<I', blob, 0x370, 2)
        with self.assertRaisesRegex(ValueError, 'terminador'):
            CroImage(blob).static_imports(crs)
        struct.pack_into('<I', blob, 0x384, 0x3F8)
        with self.assertRaisesRegex(ValueError, 'batch'):
            CroImage(blob).static_imports(crs)

    def test_missing_or_non_unique_reference_is_rejected(self):
        image = CroImage(synthetic_cro())
        with self.assertRaisesRegex(ValueError, 'Absent.*obtidas 0'):
            image.native('Absent')
        image.references.update({0x2B0: 0x290, 0x2B4: 0x184})
        with self.assertRaisesRegex(ValueError, 'Example.*obtidas 2'):
            image.native('Example')

    def test_invalid_header_table_and_segment_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'CRO0'):
            CroImage(bytes(1024))
        blob = synthetic_cro()
        struct.pack_into('<I', blob, 0x12C, 100)
        with self.assertRaisesRegex(ValueError, 'Tabela CRO'):
            CroImage(blob)
        blob = synthetic_cro()
        struct.pack_into('<I', blob, 0x308, 0x81)
        with self.assertRaisesRegex(ValueError, 'segmento'):
            CroImage(blob)


if __name__ == '__main__':
    unittest.main()
