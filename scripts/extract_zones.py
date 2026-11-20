#!/usr/bin/env python3
"""Extrai entidades, warps, triggers e encontros de cada ZO (a/0/1/3) para JSON.

Layout conforme OWSEStructs.cs do pk3DS (ZoneEntities/EntityNPC/EntityWarp/
EntityTrigger/ZoneEncounters). Coordenadas seguem a escala ORAS (1/18 por tile).
Saída: src/data/zones/<zone>_<slug>.json
"""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

# A-117: keep every slot so the adapter can index the documented ORAS method groups.
ENCOUNTER_FORMAT = "oras-61-slot-v1"
ENCOUNTER_SLOT_COUNT = 61


def parse_zo_sections(zo_path: Path) -> list[bytes]:
    data = zo_path.read_bytes()
    if data[:2] != b"ZO":
        raise ValueError(f"Arquivo sem magic ZO: {zo_path}")
    count = struct.unpack_from("<H", data, 2)[0]
    offsets = struct.unpack_from(f"<{count}I", data, 4)
    sections = []
    for i in range(count):
        end = offsets[i + 1] if i + 1 < count else len(data)
        sections.append(data[offsets[i] : end])
    return sections


def parse_entities(sec: bytes) -> dict:
    _length, furn, npcs, warps, trig1 = struct.unpack_from("<IBBBB", sec, 0)
    trig2 = struct.unpack_from("<I", sec, 8)[0]
    pos = 12

    furniture = []
    for _ in range(furn):
        r = sec[pos : pos + 0x14]
        furniture.append(
            {
                "script": struct.unpack_from("<H", r, 0)[0],
                "x": struct.unpack_from("<H", r, 0x08)[0],
                "y": struct.unpack_from("<H", r, 0x0A)[0],
                "wx": struct.unpack_from("<h", r, 0x0C)[0],
                "wy": struct.unpack_from("<h", r, 0x0E)[0],
            }
        )
        pos += 0x14

    npc_list = []
    for _ in range(npcs):
        r = sec[pos : pos + 0x30]
        npc_list.append(
            {
                "id": struct.unpack_from("<H", r, 0x00)[0],
                "model": struct.unpack_from("<H", r, 0x02)[0],
                "movePermissions": struct.unpack_from("<H", r, 0x04)[0],
                "spawnFlag": struct.unpack_from("<H", r, 0x08)[0],
                "script": struct.unpack_from("<H", r, 0x0A)[0],
                "faceDirection": struct.unpack_from("<H", r, 0x0C)[0],
                "sightRange": struct.unpack_from("<H", r, 0x0E)[0],
                "x": struct.unpack_from("<H", r, 0x28)[0],
                "y": struct.unpack_from("<H", r, 0x2A)[0],
                "degrees": struct.unpack_from("<f", r, 0x2C)[0],
            }
        )
        pos += 0x30

    warp_list = []
    for _ in range(warps):
        r = sec[pos : pos + 0x18]
        warp_list.append(
            {
                "destinationMap": struct.unpack_from("<H", r, 0x00)[0],
                "destinationTile": struct.unpack_from("<H", r, 0x02)[0],
                "faceDirection": r[0x04],
                "transitionEffect": r[0x05],
                "x": struct.unpack_from("<h", r, 0x08)[0],
                "z": struct.unpack_from("<h", r, 0x0A)[0],
                "y": struct.unpack_from("<h", r, 0x0C)[0],
                "width": struct.unpack_from("<h", r, 0x0E)[0],
                "height": struct.unpack_from("<h", r, 0x10)[0],
                "directionality": struct.unpack_from("<H", r, 0x12)[0],
            }
        )
        pos += 0x18

    def parse_trigger(r: bytes) -> dict:
        return {
            "script": struct.unpack_from("<H", r, 0x00)[0],
            "constant": struct.unpack_from("<H", r, 0x04)[0],
            "x": struct.unpack_from("<H", r, 0x0C)[0],
            "y": struct.unpack_from("<H", r, 0x0E)[0],
            "width": struct.unpack_from("<h", r, 0x10)[0],
            "height": struct.unpack_from("<h", r, 0x12)[0],
        }

    triggers = []
    for _ in range(trig1):
        triggers.append(parse_trigger(sec[pos : pos + 0x18]))
        pos += 0x18
    triggers2 = []
    for _ in range(trig2):
        triggers2.append(parse_trigger(sec[pos : pos + 0x18]))
        pos += 0x18

    script_len = struct.unpack_from("<I", sec, pos)[0] if pos + 4 <= len(sec) else 0
    return {
        "furniture": furniture,
        "npcs": npc_list,
        "warps": warp_list,
        "triggers": triggers,
        "triggers2": triggers2,
        "scriptBytes": script_len,
    }


def parse_encounters(sec: bytes) -> list[dict]:
    if len(sec) <= 0x10:
        return []

    slot_count = (len(sec) - 0x10) // 4
    if (len(sec) - 0x10) % 4 or slot_count != ENCOUNTER_SLOT_COUNT:
        raise ValueError(f"ZoneEncounters: esperado {ENCOUNTER_SLOT_COUNT} slots ORAS após o header de 16 bytes, recebido {slot_count}")

    out = []
    for off in range(0x10, len(sec), 4):
        lvl_min, lvl_max, spec_form = struct.unpack_from("<BBH", sec, off)
        out.append(
            {
                "species": spec_form & 0x7FF,
                "form": spec_form >> 11,
                "levelMin": lvl_min,
                "levelMax": lvl_max,
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai ZO (entities/warps/encounters) por zona.")
    parser.add_argument("--zo-dir", required=True, type=Path, help="rom/extracted/garc/a_0_1_3")
    parser.add_argument("--catalog", required=True, type=Path, help="src/data/zones.json")
    parser.add_argument("--out-dir", required=True, type=Path, help="src/data/zones")
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))["zones"]
    args.out_dir.mkdir(parents=True, exist_ok=True)

    total_warps = total_enc = 0
    for zone in catalog:
        zo_path = args.zo_dir / f"{zone['zone']:04d}.bin"
        sections = parse_zo_sections(zo_path)
        entities = parse_entities(sections[1]) if len(sections) > 1 else {}
        encounters = parse_encounters(sections[3]) if len(sections) > 3 else []

        total_warps += len(entities.get("warps", []))
        total_enc += len(encounters)

        slug = re.sub(r"[^a-z0-9]+", "_", zone["name"].lower()).strip("_") or f"zone_{zone['zone']}"
        payload = {
            "zone": zone["zone"],
            "name": zone["name"],
            "mapArea": zone["mapArea"],
            "mapMatrix": zone["mapMatrix"],
            "grIds": zone["grIds"],
            "textFile": zone["textFile"],
            **entities,
            "encounters": encounters,
        }
        if encounters:
            payload["encounterFormat"] = ENCOUNTER_FORMAT
        (args.out_dir / f"{zone['zone']:03d}_{slug}.json").write_text(
            json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    print(f"{len(catalog)} zonas extraídas: {total_warps} warps, {total_enc} slots de encontro")
    return 0


if __name__ == "__main__":
    sys.exit(main())
