#!/usr/bin/env python3
"""Inspeção e relocalização de saves (`main`, 0x76000 bytes) de Pokémon Alpha Sapphire.

    python3 -m scripts.oras_save inspect
    python3 -m scripts.oras_save relocate --zone 6 --x 17 --z 14
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

from scripts.azahar_session import emulator_home, save_path

SAVE_SIZE = 0x76000
BEEF_OFFSET = 0x75E10
BEEF_MAGIC = 0x42454546
BLOCK_TABLE_OFFSET = 0x75E14
BLOCK_COUNT = 58
BLOCK_ENTRY = struct.Struct("<IHH")
BLOCK_ALIGNMENT = 0x200
SITUATION_BLOCK_ID = 4
ACTORS_BLOCK_ID = 10
ACTOR_SLOT_SIZE = 0x108
ACTOR_SLOT_COUNT = 32
PLAYER_ACTOR_ID = 0x00FF
WORLD_UNITS_PER_TILE = 18.0

# Offsets dentro do bloco Situation (ID 4, 0x150 bytes): slot primário e cópia de retomada.
SIT_ZONE_PRIMARY = 0x002
SIT_POS_PRIMARY = 0x010
SIT_ZONE_SECONDARY = 0x0F4
SIT_POS_SECONDARY = 0x104
MIN_SITUATION_LENGTH = 0x110
MIN_ACTORS_LENGTH = ACTOR_SLOT_COUNT * ACTOR_SLOT_SIZE

DEFAULT_MAPS_DIR = Path(__file__).resolve().parent.parent / "src" / "data" / "maps_v2"


@dataclass(frozen=True)
class SaveBlock:
    """Metadados de um bloco da tabela 0x42454546 ('BEEF') do save."""

    index: int
    block_id: int
    offset: int
    length: int
    crc: int


def crc16_ccitt(data: bytes) -> int:
    """Calcula CRC-16/CCITT-FALSE (poly=0x1021, init=0xFFFF) usado pelos blocos Gen 6."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else ((crc << 1) & 0xFFFF)
    return crc


def _validate_header(raw: bytes) -> None:
    if len(raw) != SAVE_SIZE:
        raise ValueError(f"Tamanho inválido de save: {len(raw):#x}; esperado {SAVE_SIZE:#x}")
    (magic,) = struct.unpack_from("<I", raw, BEEF_OFFSET)
    if magic != BEEF_MAGIC:
        raise ValueError(f"Assinatura ausente em {BEEF_OFFSET:#x}: {magic:#010x}; esperado {BEEF_MAGIC:#010x}")


def parse_blocks(raw: bytes) -> list[SaveBlock]:
    """Lê os 58 blocos do save, valida limites e verifica o CRC-16 de cada bloco."""
    _validate_header(raw)
    blocks: list[SaveBlock] = []
    pos = 0
    for index in range(BLOCK_COUNT):
        length, block_id, stored_crc = BLOCK_ENTRY.unpack_from(raw, BLOCK_TABLE_OFFSET + index * BLOCK_ENTRY.size)
        if pos + length > BEEF_OFFSET:
            raise ValueError(f"Bloco {block_id} excede tabela em {pos + length:#x} (limite {BEEF_OFFSET:#x})")
        actual_crc = crc16_ccitt(raw[pos : pos + length])
        if actual_crc != stored_crc:
            raise ValueError(
                f"CRC inválido no bloco {block_id} (offset {pos:#x}): gravado {stored_crc:#06x}, calculado {actual_crc:#06x}"
            )
        blocks.append(SaveBlock(index=index, block_id=block_id, offset=pos, length=length, crc=stored_crc))
        pos = (pos + length + BLOCK_ALIGNMENT - 1) & ~(BLOCK_ALIGNMENT - 1)
    return blocks


def _block_by_id(blocks: list[SaveBlock], block_id: int, min_length: int) -> SaveBlock:
    for block in blocks:
        if block.block_id == block_id:
            if block.length < min_length:
                raise ValueError(f"Bloco {block_id} curto demais: {block.length:#x}; mínimo {min_length:#x}")
            return block
    raise ValueError(f"Bloco id={block_id} não encontrado na tabela do save")


def _update_crc(buf: bytearray, block: SaveBlock) -> None:
    new_crc = crc16_ccitt(bytes(buf[block.offset : block.offset + block.length]))
    entry_offset = BLOCK_TABLE_OFFSET + block.index * BLOCK_ENTRY.size
    BLOCK_ENTRY.pack_into(buf, entry_offset, block.length, block.block_id, new_crc)


def _update_actors(
    buf: bytearray,
    actors: SaveBlock,
    old_zone: int,
    zone: int,
    matrix_x: float,
    matrix_y: float,
    matrix_z: float,
) -> None:
    player_index = next(
        (i for i in range(ACTOR_SLOT_COUNT) if struct.unpack_from("<H", buf, actors.offset + i * ACTOR_SLOT_SIZE + 4)[0] == PLAYER_ACTOR_ID),
        None,
    )
    if player_index is None:
        raise ValueError(f"Slot do jogador (eid={PLAYER_ACTOR_ID:#06x}) ausente no bloco {ACTORS_BLOCK_ID}")

    src_offset = actors.offset + player_index * ACTOR_SLOT_SIZE
    player_slot = bytearray(buf[src_offset : src_offset + ACTOR_SLOT_SIZE])
    struct.pack_into("<H", player_slot, 0x006, zone)
    struct.pack_into("<fff", player_slot, 0x040, matrix_x, matrix_y, matrix_z)
    struct.pack_into("<ffff", player_slot, 0x068, 0.0, matrix_x, 0.0, matrix_z)

    if old_zone != zone:
        buf[actors.offset : actors.offset + actors.length] = b"\x00" * actors.length
        dst_offset = actors.offset
    else:
        dst_offset = src_offset
    buf[dst_offset : dst_offset + ACTOR_SLOT_SIZE] = player_slot
    _update_crc(buf, actors)


def read_situation(raw: bytes) -> tuple[int, float, float, float]:
    """Retorna `(zone, world_x, world_y, world_z)` do bloco Situation após validar o save."""
    sit = _block_by_id(parse_blocks(raw), SITUATION_BLOCK_ID, MIN_SITUATION_LENGTH)
    (zone,) = struct.unpack_from("<H", raw, sit.offset + SIT_ZONE_PRIMARY)
    wx, wy, wz = struct.unpack_from("<fff", raw, sit.offset + SIT_POS_PRIMARY)
    return zone, wx, wy, wz


def relocate_save(
    raw: bytes,
    zone: int,
    tile_x: float,
    tile_z: float,
    tile_y: float = 0.0,
    origin_x: float = 0.0,
    origin_z: float = 0.0,
    units_per_tile: float = WORLD_UNITS_PER_TILE,
) -> bytes:
    """Retorna nova imagem de save posicionada em `(zone, tile_x, tile_z, tile_y)` com CRCs recalculados."""
    blocks = parse_blocks(raw)
    sit = _block_by_id(blocks, SITUATION_BLOCK_ID, MIN_SITUATION_LENGTH)
    actors = _block_by_id(blocks, ACTORS_BLOCK_ID, MIN_ACTORS_LENGTH)
    (old_zone,) = struct.unpack_from("<H", raw, sit.offset + SIT_ZONE_PRIMARY)
    world_x = (origin_x + tile_x + 0.5) * units_per_tile
    world_z = (origin_z + tile_z + 0.5) * units_per_tile

    buf = bytearray(raw)
    for zone_off, pos_off in ((SIT_ZONE_PRIMARY, SIT_POS_PRIMARY), (SIT_ZONE_SECONDARY, SIT_POS_SECONDARY)):
        struct.pack_into("<H", buf, sit.offset + zone_off, zone)
        struct.pack_into("<fff", buf, sit.offset + pos_off, world_x, tile_y, world_z)
    _update_crc(buf, sit)

    _update_actors(buf, actors, old_zone, zone, origin_x + tile_x, tile_y / units_per_tile, origin_z + tile_z)
    return bytes(buf)


def zone_transform(
    zone: int,
    tile_x: float,
    tile_z: float,
    tile_y: float | None,
    maps_dir: Path = DEFAULT_MAPS_DIR,
) -> tuple[float, float, float, float]:
    """Obtém `(origin_x, origin_z, units_per_tile, height)` de `maps_v2/<zone>.json` quando existir."""
    zone_path = maps_dir / f"{zone:04d}.json"
    if not zone_path.exists():
        return 0.0, 0.0, WORLD_UNITS_PER_TILE, float(tile_y or 0.0)

    data = json.loads(zone_path.read_text())
    source = data.get("source") or {}
    origin = source.get("originTile") or {}
    origin_x = float(origin.get("x", 0.0))
    origin_z = float(origin.get("z", 0.0))
    scale = float(source.get("worldUnitsPerTile", WORLD_UNITS_PER_TILE))
    if tile_y is not None:
        return origin_x, origin_z, scale, float(tile_y)

    heights = data.get("groundHeights") or []
    row_idx, col_idx = int(round(tile_z)), int(round(tile_x))
    height = 0.0
    if 0 <= row_idx < len(heights) and 0 <= col_idx < len(heights[row_idx]):
        candidate = heights[row_idx][col_idx]
        if candidate is not None and not math.isnan(float(candidate)):
            height = float(candidate) * scale
    return origin_x, origin_z, scale, height


def _format_situation(raw: bytes, maps_dir: Path = DEFAULT_MAPS_DIR) -> str:
    zone, wx, wy, wz = read_situation(raw)
    ox, oz, scale, _ = zone_transform(zone, 0.0, 0.0, 0.0, maps_dir)
    tx = wx / scale - 0.5 - ox
    tz = wz / scale - 0.5 - oz
    return f"zone={zone} tile=({tx:.2f}, {tz:.2f}) world=({wx:.2f}, {wy:.2f}, {wz:.2f})"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    default_save = save_path(emulator_home())
    sub = parser.add_subparsers(dest="command", required=True)

    inspect_cmd = sub.add_parser("inspect", help="valida CRCs e imprime zona/posição atual do save")
    inspect_cmd.add_argument("--save", type=Path, default=default_save, help=f"caminho do main (padrão {default_save})")

    reloc_cmd = sub.add_parser("relocate", help="altera zona e célula do jogador e recalcula o CRC do bloco Situation")
    reloc_cmd.add_argument("--zone", type=int, required=True, help="ID numérico da zona de destino")
    reloc_cmd.add_argument("--x", type=float, required=True, help="coluna do grid local da zona")
    reloc_cmd.add_argument("--z", type=float, required=True, help="linha do grid local da zona")
    reloc_cmd.add_argument("--y", type=float, default=None, help="altura Y em unidades de mundo (padrão: groundHeights)")
    reloc_cmd.add_argument("--save", type=Path, default=default_save, help=f"caminho do main (padrão {default_save})")

    args = parser.parse_args()
    raw = args.save.read_bytes()
    if args.command == "inspect":
        print(_format_situation(raw))
        return

    ox, oz, scale, height = zone_transform(args.zone, args.x, args.z, args.y)
    updated = relocate_save(raw, args.zone, args.x, args.z, height, origin_x=ox, origin_z=oz, units_per_tile=scale)
    args.save.write_bytes(updated)
    print(_format_situation(updated))


if __name__ == "__main__":
    main()
