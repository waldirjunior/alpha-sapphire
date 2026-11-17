#!/usr/bin/env python3
"""Gera src/data/zones.json cruzando ZO (a/0/1/3), ZoneData, MM (a/0/4/0) e metlist.

Fonte de verdade da tabela zona -> {matrix, GRs, textfile, nome}, decodificada
conforme o layout ZoneData do pk3DS (ver docs/tcc/01-pipeline-rom.md).
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_texts import decode_gen6_text

ZONE_COUNT = 536
ZONEDATA_SIZE = 0x38
METLIST_FILE = "a_0_7_3/0090.bin"


def parse_zonedata(record: bytes) -> dict:
    map_area, map_matrix, text_file = struct.unpack_from("<HHH", record, 0x02)
    pm_fc = struct.unpack_from("<H", record, 0x1C)[0]
    return {
        "mapArea": map_area,
        "mapMatrix": map_matrix,
        "textFile": text_file,
        "parentMap": pm_fc & 0x3FF,
    }


def matrix_gr_ids(mm_path: Path) -> list[int]:
    data = mm_path.read_bytes()
    if data[:2] != b"MM":
        raise ValueError(f"Matriz inválida (sem magic MM): {mm_path}")
    width, height = struct.unpack_from("<HH", data, 0x14)
    cells = [
        struct.unpack_from("<H", data, 0x18 + i * 2)[0]
        for i in range(width * height)
    ]
    return sorted({c for c in cells if c != 0xFFFF})


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera catálogo zona -> MM -> GR -> nome/texto.")
    parser.add_argument("--garc-root", required=True, type=Path, help="Diretório rom/extracted/garc")
    parser.add_argument("--out", required=True, type=Path, help="Arquivo JSON de saída")
    args = parser.parse_args()

    metlist = decode_gen6_text((args.garc_root / METLIST_FILE).read_bytes())
    master = (args.garc_root / "a_0_1_3" / "0536.bin").read_bytes()
    if len(master) != ZONE_COUNT * ZONEDATA_SIZE:
        raise ValueError(
            f"Tabela ZoneData inesperada em a_0_1_3/0536.bin: "
            f"{len(master)} bytes (esperado {ZONE_COUNT * ZONEDATA_SIZE})"
        )

    zones = []
    for zone_id in range(ZONE_COUNT):
        record = master[zone_id * ZONEDATA_SIZE : (zone_id + 1) * ZONEDATA_SIZE]
        zd = parse_zonedata(record)
        mm_path = args.garc_root / "a_0_4_0" / f"{zd['mapMatrix']:04d}.bin"
        gr_ids = matrix_gr_ids(mm_path) if mm_path.is_file() else []
        name_idx = zd["parentMap"]
        zones.append(
            {
                "zone": zone_id,
                "name": metlist[name_idx] if name_idx < len(metlist) else "",
                "mapArea": zd["mapArea"],
                "mapMatrix": zd["mapMatrix"],
                "grIds": gr_ids,
                "textFile": zd["textFile"],
            }
        )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps({"zones": zones}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    named = sum(1 for z in zones if z["name"])
    with_gr = sum(1 for z in zones if z["grIds"])
    print(f"{len(zones)} zonas ({named} nomeadas, {with_gr} com GR) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
