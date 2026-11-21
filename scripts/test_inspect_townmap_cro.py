import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.inspect_townmap_cro import (
    CroImage,
    _find_named_texture,
    _codebin_targets,
    _scan_loose_assets,
)
from scripts.townmap_probe_formats import (
    _apply_texture_color_key,
    decode_texture_dimensions,
    decompress_lz11_payload,
    parse_darc,
    parse_garc,
    parse_mini_package,
    scan_payload,
    write_png,
)


def lz11_literals(payload):
    header = bytes((0x11, len(payload) & 255, (len(payload) >> 8) & 255, (len(payload) >> 16) & 255))
    encoded = bytearray(header)
    for start in range(0, len(payload), 8):
        encoded.append(0)
        encoded.extend(payload[start:start + 8])
    return bytes(encoded)


def synthetic_garc(payload):
    compressed = lz11_literals(payload)
    header_size = 28
    fato_size = 16
    fatb_offset = header_size + fato_size
    fatb_size = 12 + 16
    data_offset = fatb_offset + fatb_size + 8
    data = struct.pack('<4sIHHIIII', b'CRAG', header_size, 0xFEFF, 0x0400, 3,
                       data_offset, data_offset + len(compressed), 0)
    fato = struct.pack('<4sIHH', b'OTAF', fato_size, 1, 0xFFFF) + bytes(4)
    fatb = struct.pack('<4sII', b'BTAF', fatb_size, 1)
    fatb += struct.pack('<IIII', 1, 0, len(compressed), len(compressed))
    return data + fato + fatb + struct.pack('<4sI', b'GMIF', 8) + compressed


def synthetic_darc(child):
    file_table_offset = 0x1C
    node_count = 2
    name_pool = b'\0\0' + 'icon.bclim'.encode('utf-16le') + b'\0\0'
    file_table_length = node_count * 12 + len(name_pool)
    data_offset = file_table_offset + file_table_length
    file_offset = data_offset
    file_size = file_offset + len(child)
    header = struct.pack('<4sHHIIIII', b'darc', 0xFEFF, 0x1C, 1, file_size,
                         file_table_offset, file_table_length, data_offset)
    rows = struct.pack('<III', 0x01000000, 0, node_count)
    rows += struct.pack('<III', 2, file_offset, len(child))
    return header + rows + name_pool + child


def synthetic_clim(width, height, fmt=9):
    footer = bytearray(40)
    footer[0:4] = b'CLIM'
    struct.pack_into('<H', footer, 4, 0xFEFF)
    struct.pack_into('<H', footer, 6, 0x14)
    struct.pack_into('<HHH', footer, 0x1C, width, height, fmt)
    bytes_per_tile = 32 if fmt == 10 else 64 * {0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2,
                                                6: 3, 7: 2, 8: 2, 9: 4}[fmt]
    tile_count = ((width + 7) // 8) * ((height + 7) // 8)
    return bytes(bytes_per_tile * tile_count) + bytes(footer)


class InspectTownmapCroTests(unittest.TestCase):
    def test_cyan_texture_key_becomes_transparent_without_changing_other_alpha(self):
        rgba = bytes((0, 255, 255, 255, 17, 255, 221, 255, 68, 255, 255, 255, 255, 0, 0, 85))

        keyed = _apply_texture_color_key(rgba, {(0, 255, 255), (0, 255, 221)})

        self.assertEqual(
            keyed,
            bytes((0, 255, 255, 0, 17, 255, 221, 0, 68, 255, 255, 0, 255, 0, 0, 85)),
        )

    def test_garc_decompresses_entire_lz11_slot(self):
        payload = b'BCH\0' + bytes(range(64))
        entries = parse_garc(synthetic_garc(payload))
        self.assertEqual([(entry.slot, entry.subslot, entry.data) for entry in entries], [(0, 0, payload)])

    def test_lz11_backreference_copies_overlapping_output(self):
        encoded = b'\x11\x0a\0\0\x20AB\x70\x01'
        self.assertEqual(decompress_lz11_payload(encoded), (b'ABABABABAB', True, False))

    def test_darc_extracts_named_files_and_offsets(self):
        child = synthetic_clim(32, 24)
        entries = parse_darc(synthetic_darc(child), 0)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].name, 'icon.bclim')
        self.assertEqual(entries[0].data, child)
        self.assertEqual(entries[0].offset, 0x4C)

    def test_mini_package_exposes_all_sections(self):
        first, second = b'BCH\0model', b'DVLBshader'
        offsets = (16, 16 + len(first), 16 + len(first) + len(second))
        pack = struct.pack('<2sH3I', b'PC', 2, *offsets) + first + second
        self.assertEqual(parse_mini_package(pack), [first, second])
        bm = struct.pack('<2sH2I', b'BM', 1, 12, 20) + b'DVLBdata'
        self.assertEqual(parse_mini_package(bm), [b'DVLBdata'])

    def test_clim_footer_reports_dimensions_and_pixel_format(self):
        self.assertEqual(decode_texture_dimensions(synthetic_clim(60, 40)), (60, 40, 9))

    def test_nested_darc_texture_is_reported_with_archive_slot_and_dimensions(self):
        darc = synthetic_darc(synthetic_clim(48, 32))
        hits = scan_payload(darc, 'a/1/5/0', 7, 0)
        texture = next(hit for hit in hits if hit.kind == 'CLIM' and 'darc' in hit.container)
        self.assertEqual((texture.archive, texture.slot, texture.width, texture.height),
                         ('a/1/5/0', 7, 48, 32))
        self.assertIn('darc', texture.container)
        self.assertEqual(_find_named_texture(darc, texture.container), synthetic_clim(48, 32))

    def test_png_export_is_written_from_a_supported_texture_footer(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'sample.png'
            self.assertTrue(write_png(synthetic_clim(8, 8), image))
            self.assertEqual(image.read_bytes()[:8], b'\x89PNG\r\n\x1a\n')

    def test_etc1_clim_pixels_can_be_exported(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / 'map.png'
            self.assertTrue(write_png(synthetic_clim(10, 9, 10), image))
            self.assertEqual(image.read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
            self.assertEqual(struct.unpack_from('>II', image.read_bytes(), 16), (10, 9))

    def test_cro_extracts_module_name_and_named_exports(self):
        blob = bytearray(0x500)
        blob[0x80:0x84] = b'CRO0'
        struct.pack_into('<II', blob, 0xC8, 0x200, 1)
        struct.pack_into('<III', blob, 0x200, 0x180, 0x40, 0)
        struct.pack_into('<II', blob, 0xD0, 0x280, 1)
        struct.pack_into('<II', blob, 0xC0, 0x320, 4)
        struct.pack_into('<II', blob, 0xF0, 0x340, 1)
        blob[0x320:0x324] = b'Test'
        blob[0x300:0x304] = b'Foo\0'
        struct.pack_into('<II', blob, 0x280, 0x300, 0x1A0)
        struct.pack_into('<IIIII', blob, 0x340, 0x3A0, 0, 0, 0x3B0, 1)
        blob[0x3A0:0x3A9] = b'|static|\0'
        struct.pack_into('<II', blob, 0x3B0, 0x123, 0x456)
        image = CroImage(bytes(blob))
        self.assertEqual(image.module_name, 'Test')
        self.assertEqual(image.named_exports, [('Foo', 0x1A0)])
        self.assertEqual(image.imports(), [{'module': '|static|', 'count': 1,
                                            'symbols': [(0x123, 0x456)]}])

    @unittest.skipUnless(importlib.util.find_spec('capstone'), 'Capstone is not installed')
    def test_capstone_disassembles_synthetic_arm_code(self):
        blob = bytearray(0x300)
        blob[0x80:0x84] = b'CRO0'
        struct.pack_into('<II', blob, 0xC8, 0x200, 1)
        struct.pack_into('<III', blob, 0x200, 0x180, 0x40, 0)
        struct.pack_into('<I', blob, 0x180, 0xE12FFF1E)
        from scripts.inspect_townmap_cro import disassemble_arm
        self.assertEqual(disassemble_arm(bytes(blob), 0x180, 4)[0][1], 'bx')

    @unittest.skipUnless(importlib.util.find_spec('capstone'), 'Capstone is not installed')
    def test_codebin_scan_finds_direct_arm_callers(self):
        code = struct.pack('<I', 0xEB000000)
        callers = _codebin_targets(code, (0x100008,))
        self.assertEqual(callers[0x100008], [{'address': 0x100000, 'mode': 'ARM'}])

    def test_loose_shader_scan_reports_dvlb_and_file_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            romfs = Path(directory)
            shader_dir = romfs / 'shader'
            shader_dir.mkdir()
            (shader_dir / 'sample.shbin').write_bytes(b'DVLB' + bytes(12))
            report = _scan_loose_assets(romfs, ('shader', 'g3d_common'))
            self.assertEqual(report['directories'], {'shader': True, 'g3d_common': False})
            self.assertEqual(report['hits'][0]['kind'], 'DVLB')
            self.assertEqual(report['files'][0]['path'], 'shader/sample.shbin')
            self.assertEqual(len(report['files'][0]['sha256']), 64)


if __name__ == '__main__':
    unittest.main()
