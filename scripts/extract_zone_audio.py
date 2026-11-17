#!/usr/bin/env python3
"""Mapeia cada zona ORAS para a faixa BGM (bcstm/mp3) e grava src/data/zone_audio.json.

Cadeia (ver docs/features/pipeline-rom/audio-format.md):
  ZoneData (a/0/1/3/0536.bin, 0x38 por zona) u16 @0x08 = índice BGM da zona
  code.bin: tabela u32 logo após a string "sound/sango_sound.bcsar"; entrada = 0x01000000 | índice de som no BCSAR
  sango_sound.bcsar: INFO → tabela de sons (STRG = rótulo STRM_BGM_*) → tabela de arquivos (externo = nome do .bcstm)

Uso:
  python3 scripts/extract_zone_audio.py --zone-data rom/extracted/garc/a_0_1_3/0536.bin \\
      --code rom/extracted/ExeFS/code.bin --bcsar rom/extracted/RomFS/sound/sango_sound.bcsar \\
      --zones-json src/data/zones.json --mp3-dir rom/extracted/audio/mp3 --out src/data/zone_audio.json
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

ZONE_RECORD_SIZE = 0x38
ZONE_BGM_OFFSET = 0x08
SOUND_ITEM_TYPE = 0x01
BCSAR_TABLE_SIGNATURE = b"sango_sound.bcsar"
MAX_TABLE_PADDING_WORDS = 4
SECTION_STRG = 0x2000
SECTION_INFO = 0x2001
REF_SOUND_TABLE = 0x2100
REF_FILE_TABLE = 0x2106
REF_EXTERNAL_FILE = 0x220D
SOUND_FLAG_STRING_ID = 0x1
STREAM_SUFFIX = ".dspadpcm.bcstm"


def read_ref(data: bytes, offset: int) -> tuple[int, int]:
    type_id, _pad, rel = struct.unpack_from("<HHi", data, offset)
    return type_id, rel


def read_ref_table(data: bytes, offset: int) -> list[tuple[int, int]]:
    """Tabela de referências BCSAR: u32 count + count × (u16 tipo, u16 pad, s32 offset relativo à tabela)."""
    count = struct.unpack_from("<I", data, offset)[0]
    return [(type_id, offset + rel) for type_id, rel in (read_ref(data, offset + 4 + i * 8) for i in range(count))]


def find_sections(data: bytes) -> dict[int, int]:
    if data[:4] != b"CSAR":
        raise ValueError(f"Arquivo não é BCSAR: magic {data[:4]!r}")
    count = struct.unpack_from("<H", data, 0x10)[0]
    sections = {}
    for i in range(count):
        section_id, _pad, offset, _size = struct.unpack_from("<HHII", data, 0x14 + i * 12)
        sections[section_id] = offset
    return sections


def read_strings(data: bytes, strg_offset: int) -> list[str]:
    base = strg_offset + 8
    _type, table_rel = read_ref(data, base)
    table = base + table_rel
    count = struct.unpack_from("<I", data, table)[0]
    strings = []
    for i in range(count):
        _type, _pad, rel, size = struct.unpack_from("<HHiI", data, table + 4 + i * 12)
        strings.append(data[table + rel:table + rel + size - 1].decode("ascii"))
    return strings


def info_tables(data: bytes, info_offset: int) -> dict[int, int]:
    base = info_offset + 8
    return {type_id: base + rel for type_id, rel in (read_ref(data, base + i * 8) for i in range(8))}


def external_file_name(data: bytes, entry: int) -> str | None:
    type_id, rel = read_ref(data, entry)
    if type_id != REF_EXTERNAL_FILE:
        return None
    start = entry + rel
    return data[start:data.index(b"\0", start)].decode("ascii")


def parse_bcsar_sounds(data: bytes) -> list[dict[str, object]]:
    """Índice de som → rótulo (STRG) e arquivo externo (.bcstm), na ordem da tabela de sons."""
    sections = find_sections(data)
    strings = read_strings(data, sections[SECTION_STRG])
    tables = info_tables(data, sections[SECTION_INFO])
    files = [entry for _type, entry in read_ref_table(data, tables[REF_FILE_TABLE])]
    sounds = []
    for index, (_type, entry) in enumerate(read_ref_table(data, tables[REF_SOUND_TABLE])):
        file_id = struct.unpack_from("<I", data, entry)[0]
        flags, string_id = struct.unpack_from("<II", data, entry + 20)
        label = strings[string_id] if flags & SOUND_FLAG_STRING_ID else None
        file_name = external_file_name(data, files[file_id]) if file_id < len(files) else None
        sounds.append({"index": index, "label": label, "file": file_name})
    return sounds


def read_zone_bgm_table(code: bytes) -> list[int]:
    """Tabela de índices BGM → id de som BCSAR, logo após o caminho do BCSAR no code.bin."""
    anchor = code.find(BCSAR_TABLE_SIGNATURE)
    if anchor < 0:
        raise ValueError("Caminho sango_sound.bcsar não encontrado no code.bin (está descomprimido?)")
    offset = (anchor + len(BCSAR_TABLE_SIGNATURE) + 4) & ~3
    for _ in range(MAX_TABLE_PADDING_WORDS):
        if struct.unpack_from("<I", code, offset)[0] >> 24 == SOUND_ITEM_TYPE:
            break
        offset += 4
    table = []
    while offset + 4 <= len(code):
        value = struct.unpack_from("<I", code, offset)[0]
        if value >> 24 != SOUND_ITEM_TYPE:
            break
        table.append(value & 0xFFFFFF)
        offset += 4
    if not table:
        raise ValueError("Tabela de BGM por zona vazia após sango_sound.bcsar")
    return table


def read_zone_bgm_indexes(zone_data: bytes) -> list[int]:
    if len(zone_data) % ZONE_RECORD_SIZE:
        raise ValueError(f"ZoneData com {len(zone_data)} bytes não é múltiplo de 0x{ZONE_RECORD_SIZE:X}")
    return [struct.unpack_from("<H", zone_data, i + ZONE_BGM_OFFSET)[0] for i in range(0, len(zone_data), ZONE_RECORD_SIZE)]


def bgm_name(file_name: str | None) -> str | None:
    if not file_name or not file_name.endswith(STREAM_SUFFIX):
        return None
    return file_name[: -len(STREAM_SUFFIX)]


def build_zone_audio(
    bgm_indexes: list[int],
    bgm_table: list[int],
    sounds: list[dict[str, object]],
    zone_names: dict[int, str],
    available_mp3: set[str],
) -> list[dict[str, object]]:
    entries = []
    for zone, bgm_index in enumerate(bgm_indexes):
        sound_index = bgm_table[bgm_index] if bgm_index < len(bgm_table) else None
        sound = sounds[sound_index] if sound_index is not None and sound_index < len(sounds) else {}
        file_name = sound.get("file")
        name = bgm_name(file_name if isinstance(file_name, str) else None)
        entries.append({
            "zone": zone,
            "name": zone_names.get(zone, ""),
            "bgmIndex": bgm_index,
            "soundIndex": sound_index,
            "soundLabel": sound.get("label"),
            "bgmName": name,
            "hasMp3": name in available_mp3 if name else False,
        })
    return entries


def write_json(path: Path, entries: list[dict[str, object]]) -> None:
    body = "[\n" + ",\n".join(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) for entry in entries) + "\n]\n"
    path.write_text(body, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera src/data/zone_audio.json (zona → BGM).")
    parser.add_argument("--zone-data", required=True, type=Path)
    parser.add_argument("--code", required=True, type=Path)
    parser.add_argument("--bcsar", required=True, type=Path)
    parser.add_argument("--zones-json", required=True, type=Path)
    parser.add_argument("--mp3-dir", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    zones = json.loads(args.zones_json.read_text(encoding="utf-8"))["zones"]
    zone_names = {int(zone["zone"]): str(zone["name"]) for zone in zones}
    available_mp3 = {path.stem for path in args.mp3_dir.glob("*.mp3")}
    entries = build_zone_audio(
        read_zone_bgm_indexes(args.zone_data.read_bytes()),
        read_zone_bgm_table(args.code.read_bytes()),
        parse_bcsar_sounds(args.bcsar.read_bytes()),
        zone_names,
        available_mp3,
    )
    write_json(args.out, entries)
    mapped = sum(1 for entry in entries if entry["hasMp3"])
    print(f"zonas={len(entries)} com_mp3={mapped} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
