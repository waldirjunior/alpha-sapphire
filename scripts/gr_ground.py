import math
import struct
from pathlib import Path

from scripts.map_matrix import GR_TILES, WORLD_UNITS_PER_TILE


def collision_triangles(blob: bytes) -> list[tuple]:
    if len(blob) < 0x330 or blob[:4] != b'coll':
        raise ValueError('GR coll: missing header')
    end = struct.unpack_from('<I', blob, 4)[0] + 16
    if end < 0x320 or end + 16 > len(blob) or blob[end:end + 4] != b'term':
        raise ValueError('GR coll: invalid term offset')
    if struct.unpack_from('<5I', blob, 12) != (1, 3, 2, 1, 2):
        raise ValueError('GR coll: unsupported partition header')
    count = 0
    for index in range(16):
        start, length = struct.unpack_from('<II', blob, 0x2a0 + index * 8)
        if start != count or length % 3:
            raise ValueError(f'GR coll: invalid vertex range {index}: {start}/{length}')
        count += length
    if 0x320 + count * 16 != end:
        raise ValueError('GR coll: vertex ranges exceed term')
    vertices = [struct.unpack_from('<4f', blob, offset) for offset in range(0x320, end, 16)]
    if any(point[3] != 1 or not all(math.isfinite(value) for value in point) for point in vertices):
        raise ValueError('GR coll: invalid homogeneous vertex')
    return list(dict.fromkeys(tuple(vertices[index:index + 3]) for index in range(0, count, 3)))


def triangle_height(triangle: tuple, x: float, z: float) -> float | None:
    a, b, c = triangle
    determinant = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(determinant) < 1e-8:
        return None
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / determinant
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / determinant
    if min(u, v, 1 - u - v) < -1e-6:
        return None
    return (u * a[1] + v * b[1] + (1 - u - v) * c[1]) / WORLD_UNITS_PER_TILE


def ground_grid(triangles: list[tuple]) -> list[list[float | None]]:
    candidates = height_candidate_sets(triangles)
    return [[unique_height(cell) for cell in row] for row in candidates]


def ground_candidates_grid(triangles: list[tuple]) -> list[list[list[float]]]:
    candidates = height_candidate_sets(triangles)
    return [[unique_heights(cell) for cell in row] for row in candidates]


def height_candidate_sets(triangles: list[tuple]) -> list[list[set[float]]]:
    candidates = [[set() for _ in range(GR_TILES)] for _ in range(GR_TILES)]
    center = GR_TILES / 2 - 0.5
    for triangle in triangles:
        xs = [point[0] / WORLD_UNITS_PER_TILE + center for point in triangle]
        zs = [point[2] / WORLD_UNITS_PER_TILE + center for point in triangle]
        for z in range(max(0, math.ceil(min(zs))), min(GR_TILES - 1, math.floor(max(zs))) + 1):
            for x in range(max(0, math.ceil(min(xs))), min(GR_TILES - 1, math.floor(max(xs))) + 1):
                height = triangle_height(triangle, (x - center) * WORLD_UNITS_PER_TILE, (z - center) * WORLD_UNITS_PER_TILE)
                if height is not None:
                    candidates[z][x].add(round(height, 6))
    return candidates


def unique_heights(candidates: set[float]) -> list[float]:
    ordered = sorted(candidates)
    groups: list[list[float]] = []
    for height in ordered:
        if not groups or height - groups[-1][0] > 1e-4:
            groups.append([height])
            continue
        groups[-1].append(height)
    return [round(sum(group) / len(group), 6) for group in groups]


def unique_height(candidates: set[float]) -> float | None:
    if not candidates or max(candidates) - min(candidates) > 1e-4:
        return None
    return round(sum(candidates) / len(candidates), 6)


def read_gr_ground(path: Path) -> list[list[float | None]]:
    blob = path.read_bytes()
    if len(blob) < 16 or blob[:2] != b'GR':
        raise ValueError(f'GR {path.name}: invalid header')
    count = struct.unpack_from('<H', blob, 2)[0]
    if count < 3:
        return [[None] * GR_TILES for _ in range(GR_TILES)]
    start, end = struct.unpack_from('<II', blob, 12)
    if start < 4 + (count + 1) * 4 or not start <= end <= len(blob):
        raise ValueError(f'GR {path.name}: invalid coll section offsets')
    try:
        return ground_grid(collision_triangles(blob[start:end]))
    except ValueError as error:
        raise ValueError(f'GR {path.name}: {error}') from error
