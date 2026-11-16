#!/usr/bin/env python3
"""Converte arquivos GR (a/0/3/9) extraídos da RomFS para MapDefinition JSON.

Lê a seção 0 (grid 40x40 de permissões uint32) de um arquivo GR e produz:
- collisions: 0 (caminhável) | 1 (bloqueado)
- terrain: 0 (normal) | 1 (bloqueado) | 2 (grama alta / encontro selvagem)
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

BLOCKED_LOW_BYTES = {0x21}
TALL_GRASS_VALUE = 0x20004004


def parse_gr_grid(gr_path: Path) -> tuple[int, int, list[list[int]], list[list[int]]]:
    blob = gr_path.read_bytes()
    if len(blob) < 16 or blob[:2] != b"GR":
        raise ValueError(f"Arquivo GR inválido: {gr_path}")

    sec_count = struct.unpack_from("<H", blob, 2)[0]
    if sec_count < 1:
        raise ValueError(f"Arquivo GR sem seção 0: {gr_path}")

    sec0_off, sec1_off = struct.unpack_from("<II", blob, 4)
    sec0 = blob[sec0_off:sec1_off]
    width, height = struct.unpack_from("<HH", sec0, 0)

    collisions: list[list[int]] = []
    terrain: list[list[int]] = []
    for z in range(height):
        c_row: list[int] = []
        t_row: list[int] = []
        for x in range(width):
            val = struct.unpack_from("<I", sec0, 4 + (z * width + x) * 4)[0]
            if val == TALL_GRASS_VALUE:
                c_row.append(0)
                t_row.append(2)
            elif (val & 0xFF) in BLOCKED_LOW_BYTES:
                c_row.append(1)
                t_row.append(1)
            else:
                c_row.append(0)
                t_row.append(0)
        collisions.append(c_row)
        terrain.append(t_row)

    return width, height, collisions, terrain


def build_map_json(
    gr_path: Path,
    map_id: str,
    name: str,
    spawn_pos: dict[str, int],
    warps: list[dict[str, object]],
) -> dict[str, object]:
    width, height, collisions, terrain = parse_gr_grid(gr_path)
    return {
        "id": map_id,
        "name": name,
        "width": width,
        "height": height,
        "spawnPos": spawn_pos,
        "collisions": collisions,
        "terrain": terrain,
        "warps": warps,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte GR para MapDefinition JSON.")
    parser.add_argument("--gr-dir", required=True, type=Path, help="Diretório com arquivos GR extraídos (a_0_3_9)")
    parser.add_argument("--out-dir", required=True, type=Path, help="Diretório de saída para JSONs")
    args = parser.parse_args()

    specs = [
        {
            "gr": "0006.bin",
            "id": "littleroot_town",
            "name": "Littleroot Town",
            "spawnPos": {"x": 20, "z": 14},
            "warps": [
                {"from": {"x": x, "z": 0}, "targetMapId": "route_101", "targetPos": {"x": x, "z": 38}}
                for x in (19, 20, 21)
            ],
        },
        {
            "gr": "0005.bin",
            "id": "route_101",
            "name": "Route 101",
            "spawnPos": {"x": 20, "z": 35},
            "warps": [
                *[
                    {"from": {"x": x, "z": 39}, "targetMapId": "littleroot_town", "targetPos": {"x": x, "z": 1}}
                    for x in (19, 20, 21)
                ],
                *[
                    {"from": {"x": x, "z": 0}, "targetMapId": "oldale_town", "targetPos": {"x": x, "z": 38}}
                    for x in (18, 19, 20, 21, 22)
                ],
            ],
        },
        {
            "gr": "0004.bin",
            "id": "oldale_town",
            "name": "Oldale Town",
            "spawnPos": {"x": 20, "z": 20},
            "warps": [
                *[
                    {"from": {"x": x, "z": 39}, "targetMapId": "route_101", "targetPos": {"x": x, "z": 1}}
                    for x in (18, 19, 20, 21, 22)
                ],
            ],
        },
    ]

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for spec in specs:
        gr_path = args.gr_dir / str(spec["gr"])
        data = build_map_json(
            gr_path=gr_path,
            map_id=str(spec["id"]),
            name=str(spec["name"]),
            spawn_pos=spec["spawnPos"],  # type: ignore[arg-type]
            warps=spec["warps"],  # type: ignore[arg-type]
        )
        out_file = args.out_dir / f"{spec['id']}.json"
        out_file.write_text(json.dumps(data, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Gerado {out_file} ({data['width']}x{data['height']})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
