"""Small readers for the containers used by the local TownMap resource scan."""

from __future__ import annotations

import binascii
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

RESOURCE_MAGICS = (b'CLYT', b'BCH\0', b'CGFX', b'DVLB')
MINI_MAGICS = (b'PC', b'MM', b'AR', b'BG', b'PT', b'PB', b'PK', b'AD', b'GR', b'ZO', b'BM')


@dataclass(frozen=True)
class GarcEntry:
    slot: int
    subslot: int
    data: bytes
    compressed: bool
    decompression_failed: bool = False


@dataclass(frozen=True)
class DarcEntry:
    index: int
    name: str
    offset: int
    data: bytes


@dataclass(frozen=True)
class ResourceHit:
    archive: str
    slot: int
    subslot: int
    container: str
    kind: str
    offset: int
    width: int | None = None
    height: int | None = None
    pixel_format: int | None = None


def decode_texture_dimensions(blob: bytes) -> tuple[int, int, int] | None:
    if len(blob) < 40 or blob[-40:-36] not in (b'CLIM', b'FLIM'):
        return None
    width, height, pixel_format = struct.unpack_from('<HHH', blob, len(blob) - 40 + 0x1C)
    if not width or not height or width > 4096 or height > 4096:
        return None
    return width, height, pixel_format


def parse_garc(blob: bytes) -> list[GarcEntry]:
    return list(iter_garc_entries(blob))


def iter_garc_entries(blob: bytes) -> Iterator[GarcEntry]:
    if len(blob) < 40 or blob[:4] != b'CRAG':
        raise ValueError('Expected a complete CRAG GARC header')
    _, header_size, _, _, _, data_offset, file_size, _ = struct.unpack_from('<4sIHHIIII', blob)
    if file_size > len(blob) or header_size + 12 > len(blob):
        raise ValueError(f'GARC header exceeds file size: {file_size}/{len(blob)}')
    fato_size = struct.unpack_from('<I', blob, header_size + 4)[0]
    fatb_offset = header_size + fato_size
    if fatb_offset + 12 > len(blob) or blob[fatb_offset:fatb_offset + 4] != b'BTAF':
        raise ValueError('GARC FATO does not lead to a BTAF/FATB table')
    fatb_size, slot_count = struct.unpack_from('<II', blob, fatb_offset + 4)
    if fatb_offset + fatb_size > len(blob):
        raise ValueError(f'GARC FATB table exceeds file size: {fatb_size}')
    cursor = fatb_offset + 12
    for slot in range(slot_count):
        if cursor + 4 > fatb_offset + fatb_size:
            raise ValueError(f'GARC slot {slot} has no complete bitmask')
        mask = struct.unpack_from('<I', blob, cursor)[0]
        cursor += 4
        for subslot in range(mask.bit_count()):
            if cursor + 12 > fatb_offset + fatb_size:
                raise ValueError(f'GARC slot {slot} subslot {subslot} has no complete range')
            start, _, length = struct.unpack_from('<III', blob, cursor)
            cursor += 12
            if length == 0:
                continue
            first = data_offset + start
            if first + length > len(blob):
                raise ValueError(f'GARC slot {slot} range exceeds file size: {first}+{length}')
            raw = blob[first:first + length]
            payload, compressed, failed = decompress_lz11_payload(raw)
            yield GarcEntry(slot, subslot, payload, compressed, failed)


def decompress_lz11_payload(raw: bytes) -> tuple[bytes, bool, bool]:
    if len(raw) < 4 or raw[0] != 0x11:
        return raw, False, False
    output_length = raw[1] | (raw[2] << 8) | (raw[3] << 16)
    cursor = 4
    if output_length == 0 and len(raw) >= 8:
        output_length = struct.unpack_from('<I', raw, 4)[0]
        cursor = 8
    output = bytearray()
    try:
        while len(output) < output_length and cursor < len(raw):
            flags = raw[cursor]
            cursor += 1
            for bit in range(7, -1, -1):
                if len(output) >= output_length or cursor >= len(raw):
                    break
                if flags & (1 << bit):
                    length, displacement, cursor = _lz11_reference(raw, cursor)
                    remaining = min(length, output_length - len(output))
                    if displacement > len(output):
                        raise ValueError('LZ11 reference points before output start')
                    seed = bytes(output[-displacement:])
                    output.extend((seed * ((remaining + displacement - 1) // displacement))[:remaining])
                    continue
                output.append(raw[cursor])
                cursor += 1
    except (IndexError, struct.error, ValueError):
        return raw, False, True
    return bytes(output), True, False


def _lz11_reference(raw: bytes, cursor: int) -> tuple[int, int, int]:
    first = raw[cursor]
    cursor += 1
    indicator = first >> 4
    if indicator == 0:
        second, third = raw[cursor], raw[cursor + 1]
        length = (((first & 15) << 4) | (second >> 4)) + 0x11
        displacement = (((second & 15) << 8) | third) + 1
        return length, displacement, cursor + 2
    if indicator == 1:
        second, third, fourth = raw[cursor], raw[cursor + 1], raw[cursor + 2]
        length = (((first & 15) << 12) | (second << 4) | (third >> 4)) + 0x111
        displacement = (((third & 15) << 8) | fourth) + 1
        return length, displacement, cursor + 3
    second = raw[cursor]
    return indicator + 1, (((first & 15) << 8) | second) + 1, cursor + 1


def _darc_name(name_pool: bytes, encoded_offset: int) -> str:
    start = encoded_offset & 0x00FFFFFF
    if start >= len(name_pool):
        return ''
    end = start
    while end + 1 < len(name_pool) and name_pool[end:end + 2] != b'\0\0':
        end += 2
    return name_pool[start:end].decode('utf-16le', 'replace')


def parse_darc(blob: bytes, offset: int = 0) -> list[DarcEntry]:
    if offset < 0 or offset + 0x1C > len(blob) or blob[offset:offset + 4] != b'darc':
        raise ValueError(f'Expected DARC at offset {offset:#x}')
    _, bom, header_size, _, file_size, table_offset, table_length, _ = struct.unpack_from(
        '<4sHHIIIII', blob, offset
    )
    if bom != 0xFEFF or header_size != 0x1C or file_size > len(blob) - offset:
        raise ValueError(f'Invalid DARC header at {offset:#x}')
    if table_offset + 12 > file_size or table_offset + table_length > file_size:
        raise ValueError(f'DARC file table exceeds archive at {offset:#x}')
    count = struct.unpack_from('<I', blob, offset + table_offset + 8)[0]
    if not 1 <= count <= table_length // 12:
        raise ValueError(f'DARC node count {count} exceeds table length {table_length}')
    name_start = table_offset + count * 12
    table_end = table_offset + table_length
    if name_start > table_end:
        raise ValueError('DARC node table overlaps its name pool')
    name_pool = blob[offset + name_start:offset + table_end]
    directories: dict[int, str] = {0: ''}
    active: list[tuple[int, int, str]] = [(0, count, '')]
    results = []
    for index in range(1, count):
        while active and active[-1][1] <= index:
            active.pop()
        encoded_name, file_offset, length = struct.unpack_from('<III', blob, offset + table_offset + index * 12)
        name = _darc_name(name_pool, encoded_name)
        if encoded_name & 0x01000000:
            parent = directories.get(file_offset)
            if parent is None or length <= index or length > count:
                raise ValueError(f'DARC directory {index} has invalid parent/end index')
            path = '/'.join(part for part in (parent, name) if part)
            directories[index] = path
            active.append((index, length, path))
            continue
        if file_offset + length > file_size:
            raise ValueError(f'DARC file {index} range exceeds archive: {file_offset}+{length}')
        parent_path = active[-1][2] if active else ''
        relative = '/'.join(part for part in (parent_path, name or f'entry_{index:04d}') if part)
        first = offset + file_offset
        results.append(DarcEntry(index, relative, file_offset, blob[first:first + length]))
    return results


def parse_mini_package(blob: bytes) -> list[bytes]:
    if len(blob) < 8 or blob[:2] not in MINI_MAGICS:
        raise ValueError('Expected a supported two-letter Game Freak package')
    count = struct.unpack_from('<H', blob, 2)[0]
    header_end = 8 + count * 4
    if count < 1 or count > 4096 or header_end > len(blob):
        raise ValueError(f'Mini package count {count} exceeds input length {len(blob)}')
    offsets = struct.unpack_from(f'<{count + 1}I', blob, 4)
    if offsets[0] < header_end or offsets[-1] > len(blob) or any(a > b for a, b in zip(offsets, offsets[1:])):
        raise ValueError(f'Invalid mini package offsets: {offsets}')
    return [blob[left:right] for left, right in zip(offsets, offsets[1:])]


def _resource_hits(blob: bytes, archive: str, slot: int, subslot: int,
                   container: str, base: int) -> list[ResourceHit]:
    hits = []
    for magic in RESOURCE_MAGICS:
        offset = 0
        while True:
            offset = blob.find(magic, offset)
            if offset < 0:
                break
            hits.append(ResourceHit(archive, slot, subslot, container,
                                    magic.rstrip(b'\0').decode('ascii'), base + offset))
            offset += 1
    dimensions = decode_texture_dimensions(blob)
    if dimensions:
        width, height, pixel_format = dimensions
        kind = blob[-40:-36].decode('ascii')
        hits.append(ResourceHit(archive, slot, subslot, container, kind,
                                base + len(blob) - 40, width, height, pixel_format))
    return hits


def scan_payload(blob: bytes, archive: str, slot: int, subslot: int,
                 container: str = 'GARC slot', base: int = 0, depth: int = 0) -> list[ResourceHit]:
    hits = _resource_hits(blob, archive, slot, subslot, container, base)
    if depth < 4:
        hits.extend(_scan_darc_children(blob, archive, slot, subslot, container, base, depth))
        hits.extend(_scan_mini_children(blob, archive, slot, subslot, container, base, depth))
    return _deduplicate_hits(hits)


def _scan_darc_children(blob, archive, slot, subslot, container, base, depth):
    hits = []
    offset = 0
    while (offset := blob.find(b'darc', offset)) >= 0:
        try:
            entries = parse_darc(blob, offset)
        except ValueError:
            offset += 1
            continue
        for entry in entries:
            label = f'{container} / darc@{offset:#x} / {entry.name}'
            hits.extend(scan_payload(entry.data, archive, slot, subslot, label,
                                     base + offset + entry.offset, depth + 1))
        offset += 4
    return hits


def _scan_mini_children(blob, archive, slot, subslot, container, base, depth):
    hits = []
    magic = blob[:2]
    if magic not in MINI_MAGICS:
        return hits
    try:
        sections = parse_mini_package(blob)
    except (ValueError, struct.error):
        return hits
    for index, section in enumerate(sections):
        section_offset = struct.unpack_from('<I', blob, 4 + index * 4)[0]
        label = f'{container} / {magic.decode()}[section {index}]'
        hits.extend(scan_payload(section, archive, slot, subslot, label,
                                 base + section_offset, depth + 1))
    return hits


def _deduplicate_hits(hits: list[ResourceHit]) -> list[ResourceHit]:
    unique: dict[tuple[str, int], ResourceHit] = {}
    for hit in hits:
        key = hit.kind, hit.offset
        previous = unique.get(key)
        if previous is None or len(hit.container) > len(previous.container):
            unique[key] = hit
    return list(unique.values())


def _morton8(x: int, y: int) -> int:
    result = 0
    for bit in range(3):
        result |= ((x >> bit) & 1) << (2 * bit)
        result |= ((y >> bit) & 1) << (2 * bit + 1)
    return result


def decode_texture_pixels(blob: bytes) -> tuple[int, int, bytes] | None:
    metadata = decode_texture_dimensions(blob)
    if metadata is None:
        return None
    width, height, fmt = metadata
    storage_width, storage_height = _storage_dimension(width), _storage_dimension(height)
    if fmt == 10:
        return _decode_etc1_texture(blob[:-40], width, height, storage_width, storage_height)
    bytes_per_pixel = {0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 2, 8: 2, 9: 4}.get(fmt)
    if bytes_per_pixel is None:
        return None
    pixels = blob[:-40]
    tiles_x = storage_width // 8
    bytes_needed = tiles_x * (storage_height // 8) * 64 * bytes_per_pixel
    if len(pixels) < bytes_needed:
        return None
    output = bytearray(width * height * 4)
    for y in range(height):
        for x in range(width):
            tile = ((y // 8) * tiles_x + x // 8) * 64 + _morton8(x & 7, y & 7)
            pos = tile * bytes_per_pixel
            rgba = _rgba_pixel(pixels, pos, fmt)
            start = (y * width + x) * 4
            output[start:start + 4] = rgba
    return width, height, bytes(output)


def _storage_dimension(dimension: int) -> int:
    return 1 << (dimension - 1).bit_length()


def _rgba_pixel(pixels: bytes, pos: int, fmt: int) -> bytes:
    if fmt == 0:
        value = pixels[pos]
        return bytes((value, value, value, 255))
    if fmt == 1:
        return bytes((255, 255, 255, pixels[pos]))
    if fmt == 2:
        value = pixels[pos]
        luminance = ((value >> 4) & 15) * 17
        return bytes((luminance, luminance, luminance, (value & 15) * 17))
    if fmt == 3:
        return bytes((pixels[pos], pixels[pos], pixels[pos], pixels[pos + 1]))
    if fmt == 4:
        return bytes((pixels[pos], pixels[pos + 1], 0, 255))
    if fmt in (5, 7, 8):
        return _rgba_16bit(int.from_bytes(pixels[pos:pos + 2], 'little'), fmt)
    if fmt == 6:
        return bytes((pixels[pos], pixels[pos + 1], pixels[pos + 2], 255))
    return pixels[pos:pos + 4]


def _rgba_16bit(value: int, fmt: int) -> bytes:
    if fmt == 5:
        return bytes((((value >> 11) & 31) * 255 // 31, ((value >> 5) & 63) * 255 // 63,
                      (value & 31) * 255 // 31, 255))
    if fmt == 7:
        return bytes((((value >> 11) & 31) * 255 // 31, ((value >> 6) & 31) * 255 // 31,
                      ((value >> 1) & 31) * 255 // 31, 255 if value & 1 else 0))
    return bytes(((value & 15) * 17, ((value >> 4) & 15) * 17,
                  ((value >> 8) & 15) * 17, ((value >> 12) & 15) * 17))


def _decode_etc1_texture(pixels: bytes, width: int, height: int,
                         storage_width: int, storage_height: int) -> tuple[int, int, bytes] | None:
    tiles_x = storage_width // 8
    tiles_y = storage_height // 8
    if len(pixels) < tiles_x * tiles_y * 32:
        return None
    output = bytearray(width * height * 4)
    for tile_y in range(tiles_y):
        for tile_x in range(tiles_x):
            tile_offset = (tile_y * tiles_x + tile_x) * 32
            for index, (block_x, block_y) in enumerate(((0, 0), (4, 0), (0, 4), (4, 4))):
                block = _decode_etc1_block(pixels[tile_offset + index * 8:tile_offset + index * 8 + 8])
                _paste_etc1_block(output, width, height, tile_x * 8 + block_x, tile_y * 8 + block_y, block)
    return width, height, bytes(output)


def _decode_etc1_block(encoded: bytes) -> bytes:
    word = int.from_bytes(encoded[::-1], 'big')
    diff_mode = (word >> 33) & 1
    flip = (word >> 32) & 1
    if diff_mode:
        bases = _etc1_differential_bases(word)
    else:
        bases = _etc1_individual_bases(word)
    tables = ((word >> 37) & 7, (word >> 34) & 7)
    result = bytearray(4 * 4 * 4)
    for y in range(4):
        for x in range(4):
            half = int(y >= 2) if flip else int(x >= 2)
            pixel_index = x * 4 + y
            low = (word >> pixel_index) & 1
            high = (word >> (pixel_index + 16)) & 1
            modifier = _ETC1_MODIFIERS[tables[half]][high * 2 + low]
            color = bytes(max(0, min(255, channel + modifier)) for channel in bases[half]) + b'\xff'
            target = (y * 4 + x) * 4
            result[target:target + 4] = color
    return bytes(result)


_ETC1_MODIFIERS = ((2, 8, -2, -8), (5, 17, -5, -17), (9, 29, -9, -29),
                   (13, 42, -13, -42), (18, 60, -18, -60), (24, 80, -24, -80),
                   (33, 106, -33, -106), (47, 183, -47, -183))


def _etc1_individual_bases(word: int) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    first = (((word >> 60) & 15) * 17, ((word >> 52) & 15) * 17, ((word >> 44) & 15) * 17)
    second = (((word >> 56) & 15) * 17, ((word >> 48) & 15) * 17, ((word >> 40) & 15) * 17)
    return first, second


def _etc1_differential_bases(word: int) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    red, green, blue = (word >> 59) & 31, (word >> 51) & 31, (word >> 43) & 31
    delta = (_signed3((word >> 56) & 7), _signed3((word >> 48) & 7), _signed3((word >> 40) & 7))
    first = tuple(_expand5(channel) for channel in (red, green, blue))
    second = tuple(_expand5(max(0, min(31, channel + diff))) for channel, diff in zip((red, green, blue), delta))
    return first, second


def _signed3(value: int) -> int:
    return value - 8 if value & 4 else value


def _expand5(value: int) -> int:
    return (value << 3) | (value >> 2)


def _paste_etc1_block(output: bytearray, width: int, height: int, x0: int, y0: int, block: bytes) -> None:
    for y in range(4):
        for x in range(4):
            x_pos, y_pos = x0 + x, y0 + y
            if x_pos >= width or y_pos >= height:
                continue
            source = (y * 4 + x) * 4
            target = (y_pos * width + x_pos) * 4
            output[target:target + 4] = block[source:source + 4]


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    body = tag + payload
    return struct.pack('>I', len(payload)) + body + struct.pack('>I', binascii.crc32(body) & 0xFFFFFFFF)


def write_png(
    blob: bytes,
    destination: Path,
    transparent_colors: set[tuple[int, int, int]] | None = None,
) -> bool:
    decoded = decode_texture_pixels(blob)
    if decoded is None:
        return False
    width, height, rgba = decoded
    if transparent_colors:
        rgba = _apply_texture_color_key(rgba, transparent_colors)
    scanlines = b''.join(b'\0' + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(b'\x89PNG\r\n\x1a\n' + _png_chunk(b'IHDR', header)
                            + _png_chunk(b'IDAT', zlib.compress(scanlines)) + _png_chunk(b'IEND', b''))
    return True


def _apply_texture_color_key(
    rgba: bytes,
    transparent_colors: set[tuple[int, int, int]],
) -> bytes:
    keyed = bytearray(rgba)
    cyan_key_enabled = bool(transparent_colors & {(0, 255, 255), (0, 255, 221)})
    for offset in range(0, len(keyed), 4):
        red, green, blue = keyed[offset:offset + 3]
        if (red, green, blue) in transparent_colors or (
            cyan_key_enabled and _is_cyan_texture_key(red, green, blue)
        ):
            keyed[offset + 3] = 0
    return bytes(keyed)


def _is_cyan_texture_key(red: int, green: int, blue: int) -> bool:
    return red <= 85 and green >= 238 and blue >= 204
