"""Testes unitários do parser e editor de saves de Pokémon Alpha Sapphire."""

from __future__ import annotations

import json
import struct
import tempfile
import unittest
from pathlib import Path

from scripts.oras_save import (
    ACTOR_SLOT_COUNT,
    ACTOR_SLOT_SIZE,
    ACTORS_BLOCK_ID,
    BEEF_MAGIC,
    BEEF_OFFSET,
    BLOCK_COUNT,
    BLOCK_ENTRY,
    BLOCK_TABLE_OFFSET,
    PLAYER_ACTOR_ID,
    SAVE_SIZE,
    SITUATION_BLOCK_ID,
    crc16_ccitt,
    parse_blocks,
    read_situation,
    relocate_save,
    zone_transform,
)


def make_synthetic_save(zone: int = 223, tile_x: float = 17.0, tile_z: float = 18.0, tile_y: float = 2.5) -> bytes:
    """Constrói um arquivo `main` sintético de 0x76000 bytes com 58 blocos e CRC-16 válido."""
    buf = bytearray(SAVE_SIZE)
    struct.pack_into("<I", buf, BEEF_OFFSET, BEEF_MAGIC)

    pos = 0
    for blk_id in range(BLOCK_COUNT):
        if blk_id == SITUATION_BLOCK_ID:
            length = 0x150
            world_x = (tile_x + 0.5) * 18.0
            world_z = (tile_z + 0.5) * 18.0
            struct.pack_into("<H", buf, pos + 0x002, zone)
            struct.pack_into("<fff", buf, pos + 0x010, world_x, tile_y, world_z)
            struct.pack_into("<H", buf, pos + 0x0F4, zone)
            struct.pack_into("<fff", buf, pos + 0x104, world_x, tile_y, world_z)
        elif blk_id == ACTORS_BLOCK_ID:
            length = ACTOR_SLOT_COUNT * ACTOR_SLOT_SIZE
            struct.pack_into("<HHHH", buf, pos, 0x0003, 0x0801, 0, zone)
            player_off = pos + ACTOR_SLOT_SIZE
            struct.pack_into("<HHHHHH", buf, player_off, 0x0443, 0x0001, PLAYER_ACTOR_ID, zone, 0x00AC, 0x0001)
            struct.pack_into("<fff", buf, player_off + 0x040, tile_x, tile_y / 18.0, tile_z)
            struct.pack_into("<ffff", buf, player_off + 0x068, 0.0, tile_x, 0.0, tile_z)
        else:
            length = 0x20
            buf[pos] = (blk_id + 1) & 0xFF
        crc = crc16_ccitt(bytes(buf[pos : pos + length]))
        BLOCK_ENTRY.pack_into(buf, BLOCK_TABLE_OFFSET + blk_id * BLOCK_ENTRY.size, length, blk_id, crc)
        pos = (pos + length + 0x1FF) & ~0x1FF
    return bytes(buf)


class OrasSaveTest(unittest.TestCase):
    def test_parses_all_58_blocks_and_validates_crc16(self) -> None:
        raw = make_synthetic_save()
        blocks = parse_blocks(raw)
        self.assertEqual(len(blocks), BLOCK_COUNT)
        self.assertEqual(blocks[SITUATION_BLOCK_ID].block_id, SITUATION_BLOCK_ID)
        self.assertEqual(blocks[SITUATION_BLOCK_ID].length, 0x150)

    def test_reads_zone_and_world_coordinates_from_situation(self) -> None:
        raw = make_synthetic_save(zone=223, tile_x=17.0, tile_z=18.0, tile_y=2.6)
        zone, wx, wy, wz = read_situation(raw)
        self.assertEqual(zone, 223)
        self.assertAlmostEqual(wx, 315.0, places=4)
        self.assertAlmostEqual(wy, 2.6, places=4)
        self.assertAlmostEqual(wz, 333.0, places=4)

    def test_relocate_updates_both_situation_slots_and_recalculates_crc16(self) -> None:
        raw = make_synthetic_save(zone=223, tile_x=17.0, tile_z=18.0, tile_y=2.6)
        relocated = relocate_save(raw, zone=6, tile_x=17.0, tile_z=14.0, tile_y=0.0, origin_x=80.0, origin_z=160.0)

        blocks = parse_blocks(relocated)
        sit = blocks[SITUATION_BLOCK_ID]
        self.assertEqual(sit.crc, crc16_ccitt(relocated[sit.offset : sit.offset + sit.length]))

        zone, wx, wy, wz = read_situation(relocated)
        self.assertEqual(zone, 6)
        self.assertAlmostEqual(wx, 1755.0, places=4)
        self.assertAlmostEqual(wy, 0.0, places=4)
        self.assertAlmostEqual(wz, 3141.0, places=4)

        sec_zone = struct.unpack_from("<H", relocated, sit.offset + 0x0F4)[0]
        sec_pos = struct.unpack_from("<fff", relocated, sit.offset + 0x104)
        self.assertEqual(sec_zone, 6)
        self.assertAlmostEqual(sec_pos[0], 1755.0, places=4)
        self.assertAlmostEqual(sec_pos[1], 0.0, places=4)
        self.assertAlmostEqual(sec_pos[2], 3141.0, places=4)

        actors = blocks[ACTORS_BLOCK_ID]
        self.assertEqual(actors.crc, crc16_ccitt(relocated[actors.offset : actors.offset + actors.length]))
        self.assertEqual(struct.unpack_from("<HHHH", relocated, actors.offset), (0x0443, 0x0001, PLAYER_ACTOR_ID, 6))
        self.assertEqual(struct.unpack_from("<fff", relocated, actors.offset + 0x040), (97.0, 0.0, 174.0))
        self.assertEqual(struct.unpack_from("<ffff", relocated, actors.offset + 0x068), (0.0, 97.0, 0.0, 174.0))
        self.assertEqual(relocated[actors.offset + ACTOR_SLOT_SIZE : actors.offset + actors.length], b"\x00" * ((ACTOR_SLOT_COUNT - 1) * ACTOR_SLOT_SIZE))

    def test_relocate_same_zone_updates_player_actor_in_place_keeping_npcs(self) -> None:
        raw = make_synthetic_save(zone=223, tile_x=17.0, tile_z=18.0, tile_y=2.6)
        relocated = relocate_save(raw, zone=223, tile_x=13.0, tile_z=15.0, tile_y=2.6)
        blocks = parse_blocks(relocated)
        actors = blocks[ACTORS_BLOCK_ID]
        self.assertEqual(struct.unpack_from("<HHHH", relocated, actors.offset), (0x0003, 0x0801, 0, 223))
        slot1 = actors.offset + ACTOR_SLOT_SIZE
        self.assertEqual(struct.unpack_from("<HH", relocated, slot1 + 4), (PLAYER_ACTOR_ID, 223))
        self.assertAlmostEqual(struct.unpack_from("<f", relocated, slot1 + 0x040)[0], 13.0, places=4)
        self.assertAlmostEqual(struct.unpack_from("<f", relocated, slot1 + 0x048)[0], 15.0, places=4)
        self.assertAlmostEqual(struct.unpack_from("<f", relocated, slot1 + 0x06C)[0], 13.0, places=4)
        self.assertAlmostEqual(struct.unpack_from("<f", relocated, slot1 + 0x074)[0], 15.0, places=4)

    def test_rejects_wrong_size_bad_magic_and_corrupted_crc(self) -> None:
        with self.assertRaisesRegex(ValueError, "0x76000"):
            parse_blocks(b"\x00" * 128)

        bad_magic = bytearray(make_synthetic_save())
        bad_magic[BEEF_OFFSET] = 0
        with self.assertRaisesRegex(ValueError, "0x42454546"):
            parse_blocks(bytes(bad_magic))

        bad_crc = bytearray(make_synthetic_save())
        sit_off = parse_blocks(bytes(bad_crc))[SITUATION_BLOCK_ID].offset
        bad_crc[sit_off + 0x010] ^= 0xFF
        with self.assertRaisesRegex(ValueError, "CRC"):
            parse_blocks(bytes(bad_crc))

    def test_zone_transform_reads_origin_and_ground_height_from_maps_v2(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            maps_dir = Path(directory)
            zone_file = maps_dir / "0006.json"
            zone_file.write_text(
                json.dumps(
                    {
                        "zone": 6,
                        "groundHeights": [[0.0, 0.0], [1.5, 9.0]],
                        "source": {"worldUnitsPerTile": 18, "originTile": {"x": 80, "z": 160}},
                    }
                )
            )
            ox, oz, scale, height = zone_transform(6, 0, 1, None, maps_dir)
            self.assertEqual((ox, oz, scale, height), (80.0, 160.0, 18.0, 27.0))


if __name__ == "__main__":
    unittest.main()
