import hashlib
import math
import struct

GR_TILES = 40
ZONE_CELL_TILES = 10
WORLD_UNITS_PER_TILE = 18
EMPTY = 0xFFFF


def matrix_sections(blob: bytes) -> tuple[bytes, bytes]:
    if len(blob) < 16 or blob[:2] != b'MM':
        raise ValueError('MM inválida: esperado cabeçalho MINI MM de 16 bytes')
    count, start, second, end = struct.unpack_from('<HIII', blob, 2)
    if count != 2 or start != 16 or not start < second < end or end != len(blob):
        raise ValueError(f'MM inválida: count/offsets {(count, start, second, end)}, tamanho {len(blob)}')
    return blob[start:second], blob[second:end]


def parse_regions(section: bytes) -> list[dict]:
    if len(section) != 324:
        raise ValueError(f'MM sec1: esperado 324 bytes, recebido {len(section)}')
    count = struct.unpack_from('<I', section)[0]
    if count > 16 or any(section[4 + count * 20:]):
        raise ValueError(f'MM sec1: count {count} inválido ou padding não nulo')
    regions = []
    for offset in range(4, 4 + count * 20, 20):
        *bounds, flags = struct.unpack_from('<4fI', section, offset)
        if not all(math.isfinite(value) for value in bounds):
            raise ValueError(f'MM sec1: float não finito @{offset}')
        regions.append(dict(zip(('x1', 'x2', 'z1', 'z2', 'flags'), (*bounds, flags))))
    return regions


def parse_matrix(blob: bytes) -> dict:
    grid, region_section = matrix_sections(blob)
    if len(grid) < 8:
        raise ValueError('MM sec0: cabeçalho de grid truncado')
    version, width, height = struct.unpack_from('<IHH', grid)
    if version not in (0, 1):
        raise ValueError(f'MM sec0: versão {version}, esperado 0 ou 1')
    cells = width * height
    expected = 8 + cells * (36 if version else 2)
    expected = (expected + 3) & ~3
    if not cells or len(grid) != expected:
        raise ValueError(f'MM sec0: grid {width}x{height}, {len(grid)} bytes, esperado {expected}')
    gr_ids = list(struct.unpack_from(f'<{cells}H', grid, 8))
    zone_ids = list(struct.unpack_from(f'<{cells * 16}H', grid, 8 + cells * 2)) if version else []
    auxiliary = list(struct.unpack_from(f'<{cells}H', grid, 8 + cells * 34)) if version else []
    if not version and any(grid[8 + cells * 2:]):
        raise ValueError('MM sec0: padding não nulo')
    return {'version': version, 'width': width, 'height': height, 'grIds': gr_ids,
            'zoneIds': zone_ids, 'auxiliaryIds': auxiliary, 'regions': parse_regions(region_section),
            'sha256': hashlib.sha256(blob).hexdigest()}


def zone_bounds(matrix: dict, zone: int) -> tuple[int, int, int, int]:
    owners = matrix['zoneIds']
    width = matrix['width'] * (4 if owners else 1)
    if owners:
        indices = [i for i, value in enumerate(owners) if value == zone]
    else:
        indices = [i for i, value in enumerate(matrix['grIds']) if value != EMPTY]
    if not indices:
        raise ValueError(f'MM: nenhuma região para zona {zone}')
    unit = ZONE_CELL_TILES if owners else GR_TILES
    x0 = min(i % width for i in indices) * unit
    z0 = min(i // width for i in indices) * unit
    x1 = (max(i % width for i in indices) + 1) * unit
    z1 = (max(i // width for i in indices) + 1) * unit
    return x0, z0, x1 - x0, z1 - z0


def owns_tile(matrix: dict, zone: int, x: int, z: int) -> bool:
    if not matrix['zoneIds']:
        return True
    return matrix['zoneIds'][(z // 10) * matrix['width'] * 4 + x // 10] == zone
