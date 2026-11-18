import struct

from scripts.gr_ground import collision_triangles
from scripts.map_matrix import GR_TILES


def physical_layers(blob: bytes) -> list[dict]:
    if len(blob) < 4 or blob[:2] != b'GR':
        raise ValueError('GR layers: expected GR header')
    count = struct.unpack_from('<H', blob, 2)[0]
    if count not in (7, 9, 11, 13) or len(blob) < 4 + 4 * (count + 1):
        raise ValueError(f'GR layers: unsupported section count {count}, expected 7/9/11/13')
    offsets = struct.unpack_from('<' + 'I' * (count + 1), blob, 4)
    if offsets[0] < 4 + 4 * (count + 1) or offsets[-1] > len(blob) or list(offsets) != sorted(offsets):
        raise ValueError('GR layers: invalid section offsets')
    additional = (count - 7) // 2
    pairs = [(0, 2)] + [(6 + index, 6 + additional + index) for index in range(1, additional + 1)]
    return [physical_layer(blob, offsets, index, grid, collision) for index, (grid, collision) in enumerate(pairs)]


def physical_layer(blob: bytes, offsets: tuple, index: int, grid: int, collision: int) -> dict:
    start, end = offsets[grid:grid + 2]
    size = 4 + GR_TILES * GR_TILES * 4
    if end - start < size or struct.unpack_from('<HH', blob, start) != (GR_TILES, GR_TILES):
        raise ValueError(f'GR layer {index}: section {grid} requires a 40x40 permission grid')
    words = struct.unpack_from('<' + 'I' * (GR_TILES * GR_TILES), blob, start + 4)
    try:
        triangles = collision_triangles(blob[offsets[collision]:offsets[collision + 1]])
    except ValueError as error:
        raise ValueError(f'GR layer {index}, section {collision}: {error}') from error
    return {'index': index, 'permissionSection': grid, 'collisionSection': collision,
            'permissions': [list(words[z * GR_TILES:(z + 1) * GR_TILES]) for z in range(GR_TILES)],
            'triangles': triangles}
