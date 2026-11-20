#!/usr/bin/env python3
"""Lists and extracts CSEQ, CBNK, CWAR and nested CWAV data from an ORAS BCSAR."""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path
from typing import Any

SECTION_STRG = 0x2000
SECTION_INFO = 0x2001
SECTION_FILE = 0x2002
INFO_SOUND_TABLE = 0x2100
INFO_FILE_TABLE = 0x2106
REF_SOUND = 0x2200
REF_FILE = 0x220A
REF_INTERNAL_FILE = 0x220C
REF_EXTERNAL_FILE = 0x220D
INTERNAL_FILE_DATA = 0x1F00
SOUND_HAS_LABEL = 1
EXTRACTABLE_SIGNATURES = {b"CSEQ", b"CBNK", b"CWAR", b"CWAV"}


def require_range(data: bytes, offset: int, size: int, context: str) -> None:
    if offset < 0 or size < 0 or offset + size > len(data):
        raise ValueError(f"{context} fora do arquivo: offset={offset:#x}, size={size:#x}, arquivo={len(data):#x}")


def read_ref(data: bytes, offset: int, context: str) -> tuple[int, int]:
    require_range(data, offset, 8, context)
    type_id, _pad, relative = struct.unpack_from("<HHi", data, offset)
    target = offset + relative
    if target < 0 or target > len(data):
        raise ValueError(f"Referência {context} aponta fora do arquivo: {target:#x}")
    return type_id, target


def read_sections(data: bytes) -> dict[int, tuple[int, int]]:
    if data[:4] != b"CSAR":
        raise ValueError(f"Arquivo não é BCSAR: magic {data[:4]!r}")
    require_range(data, 0, 0x14, "header BCSAR")
    count = struct.unpack_from("<H", data, 0x10)[0]
    require_range(data, 0x14, count * 12, "tabela de seções BCSAR")
    sections = {}
    for index in range(count):
        section_id, _pad, offset, size = struct.unpack_from("<HHII", data, 0x14 + index * 12)
        require_range(data, offset, size, f"seção {section_id:#06x}")
        sections[section_id] = (offset, size)
    for section_id in (SECTION_STRG, SECTION_INFO, SECTION_FILE):
        if section_id not in sections:
            raise ValueError(f"BCSAR sem seção obrigatória {section_id:#06x}")
    return sections


def read_ref_table(data: bytes, offset: int, context: str) -> list[tuple[int, int]]:
    require_range(data, offset, 4, f"{context} count")
    count = struct.unpack_from("<I", data, offset)[0]
    require_range(data, offset + 4, count * 8, f"{context} entries")
    entries = []
    for index in range(count):
        source = offset + 4 + index * 8
        type_id, _pad, relative = struct.unpack_from("<HHi", data, source)
        target = offset + relative
        if target < 0 or target > len(data):
            raise ValueError(f"Referência {context}[{index}] aponta fora do arquivo: {target:#x}")
        entries.append((type_id, target))
    return entries


def read_strings(data: bytes, section_offset: int) -> list[str]:
    section_base = section_offset + 8
    ref_type, table = read_ref(data, section_base, "STRG string table")
    if ref_type != 0x2400:
        raise ValueError(f"Referência STRG esperava 0x2400, recebeu {ref_type:#06x}")
    require_range(data, table, 4, "STRG count")
    count = struct.unpack_from("<I", data, table)[0]
    require_range(data, table + 4, count * 12, "STRG entries")
    strings = []
    for index in range(count):
        entry = table + 4 + index * 12
        _type, _pad, relative, size = struct.unpack_from("<HHiI", data, entry)
        start = table + relative
        require_range(data, start, size, f"STRG string[{index}]")
        raw = data[start:start + size]
        if not raw.endswith(b"\0"):
            raise ValueError(f"String STRG {index} não termina em NUL")
        strings.append(raw[:-1].decode("ascii"))
    return strings


def read_info_tables(data: bytes, section_offset: int) -> dict[int, int]:
    refs = {}
    base = section_offset + 8
    for index in range(8):
        source = base + index * 8
        require_range(data, source, 8, f"INFO[{index}]")
        type_id, _pad, relative = struct.unpack_from("<HHi", data, source)
        target = base + relative
        if target < 0 or target > len(data):
            raise ValueError(f"Referência INFO[{index}] aponta fora do arquivo: {target:#x}")
        if type_id:
            refs[type_id] = target
    return refs


def read_files(data: bytes, file_table: int, file_section: tuple[int, int]) -> list[dict[str, Any]]:
    entries = read_ref_table(data, file_table, "BCSAR file table")
    files = []
    section_offset, section_size = file_section
    for index, (type_id, entry) in enumerate(entries):
        if type_id != REF_FILE:
            raise ValueError(f"Arquivo BCSAR {index} esperava 0x220A, recebeu {type_id:#06x}")
        ref_type, target = read_ref(data, entry, f"arquivo BCSAR {index}")
        file = {"fileId": index, "referenceType": ref_type, "name": None, "signature": None, "size": 0, "payload": None}
        if ref_type == REF_EXTERNAL_FILE:
            file["name"] = read_c_string(data, target, f"nome externo {index}")
        elif ref_type == REF_INTERNAL_FILE:
            file.update(read_internal_payload(data, target, section_offset, section_size, index))
        files.append(file)
    return files


def read_c_string(data: bytes, offset: int, context: str) -> str:
    require_range(data, offset, 1, context)
    end = data.find(b"\0", offset)
    if end < 0:
        raise ValueError(f"String {context} sem terminador NUL")
    return data[offset:end].decode("ascii")


def read_internal_payload(
    data: bytes, descriptor: int, section_offset: int, section_size: int, file_id: int,
) -> dict[str, Any]:
    require_range(data, descriptor, 12, f"descriptor interno {file_id}")
    data_type, _pad, relative = struct.unpack_from("<HHi", data, descriptor)
    size = struct.unpack_from("<I", data, descriptor + 8)[0]
    file_base = section_offset + 8
    start = file_base + relative
    if relative < 0 or start + size > section_offset + section_size:
        raise ValueError(f"Payload interno {file_id} fora da seção FILE: offset={relative:#x}, size={size:#x}")
    payload = data[start:start + size]
    signature = payload[:4].decode("ascii", errors="replace") if len(payload) >= 4 else None
    return {"payload": payload, "signature": signature, "size": size, "dataType": data_type}


def read_sounds(data: bytes, sound_table: int, strings: list[str]) -> list[dict[str, Any]]:
    entries = read_ref_table(data, sound_table, "BCSAR sound table")
    sounds = []
    for index, (type_id, entry) in enumerate(entries):
        if type_id != REF_SOUND:
            raise ValueError(f"Som BCSAR {index} esperava 0x2200, recebeu {type_id:#06x}")
        require_range(data, entry, 28, f"som BCSAR {index}")
        file_id, player_id = struct.unpack_from("<II", data, entry)
        detail_type, _detail = read_ref(data, entry + 12, f"detalhe do som {index}")
        flags, string_id = struct.unpack_from("<II", data, entry + 20)
        label = strings[string_id] if flags & SOUND_HAS_LABEL and string_id < len(strings) else None
        sounds.append({
            "index": index,
            "kind": sound_kind(detail_type),
            "detailType": detail_type,
            "fileId": file_id,
            "playerId": player_id,
            "label": label,
        })
    return sounds


def sound_kind(detail_type: int) -> str:
    return {0x2201: "stream", 0x2202: "wave", 0x2203: "sequence"}.get(detail_type, "unknown")


def parse_bcsar(data: bytes) -> dict[str, Any]:
    sections = read_sections(data)
    strings = read_strings(data, sections[SECTION_STRG][0])
    info = read_info_tables(data, sections[SECTION_INFO][0])
    sound_table = info.get(INFO_SOUND_TABLE)
    file_table = info.get(INFO_FILE_TABLE)
    if sound_table is None or file_table is None:
        raise ValueError("INFO do BCSAR precisa conter as tabelas 0x2100 (sons) e 0x2106 (arquivos)")
    files = read_files(data, file_table, sections[SECTION_FILE])
    sounds = read_sounds(data, sound_table, strings)
    for sound in sounds:
        if sound["fileId"] >= len(files):
            raise ValueError(f"Som BCSAR {sound['index']} referencia fileId inválido {sound['fileId']}")
    return {"sounds": sounds, "files": files}


def extract_bcsar_assets(data: bytes, output_dir: Path) -> dict[str, Any]:
    archive = parse_bcsar(data)
    output_dir.mkdir(parents=True, exist_ok=True)
    assets = []
    for file in archive["files"]:
        payload = file["payload"]
        signature = payload[:4] if isinstance(payload, bytes) else b""
        if signature not in EXTRACTABLE_SIGNATURES:
            continue
        assets.append(write_asset(output_dir, file["fileId"], signature, payload))
        if signature == b"CWAR":
            assets.extend(extract_cwav_members(output_dir, file["fileId"], payload))
    manifest = {
        "soundCount": len(archive["sounds"]),
        "fileCount": len(archive["files"]),
        "sequenceSounds": [sound for sound in archive["sounds"] if sound["kind"] == "sequence"],
        "assets": assets,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_asset(output_dir: Path, file_id: int, signature: bytes, payload: bytes, wave_index: int | None = None) -> dict[str, Any]:
    extension = signature.decode("ascii").lower()
    if wave_index is None:
        name = f"file_{file_id:04d}.{extension}"
    else:
        name = f"file_{file_id:04d}_wave_{wave_index:03d}.{extension}"
    (output_dir / name).write_bytes(payload)
    return {"fileId": file_id, "signature": signature.decode("ascii"), "extension": extension, "size": len(payload), "path": name}


def extract_cwav_members(output_dir: Path, file_id: int, cwar: bytes) -> list[dict[str, Any]]:
    assets = []
    cursor = 0
    while True:
        start = cwar.find(b"CWAV", cursor)
        if start < 0:
            return assets
        if start + 0x10 > len(cwar):
            raise ValueError(f"CWAV truncado no arquivo BCSAR {file_id} @0x{start:X}")
        header_size = struct.unpack_from("<H", cwar, start + 6)[0]
        size = struct.unpack_from("<I", cwar, start + 0x0C)[0]
        if header_size < 0x40 or size < header_size or start + size > len(cwar):
            raise ValueError(f"CWAV inválido no arquivo BCSAR {file_id} @0x{start:X}: header=0x{header_size:X}, size=0x{size:X}")
        payload = cwar[start:start + size]
        assets.append(write_asset(output_dir, file_id, b"CWAV", payload, len(assets)))
        cursor = start + size


def scan_seplay_ids(scripts_dir: Path) -> list[dict[str, Any]]:
    counts: dict[int, int] = {}
    sources: dict[int, set[str]] = {}
    zones: dict[int, set[int]] = {}
    for path in sorted(scripts_dir.glob("*.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        for program in document.get("programs", {}).values():
            instructions = program.get("instructions", [])
            for index, instruction in enumerate(instructions):
                if instruction.get("native", {}).get("name") != "SEPlay":
                    continue
                sound_id = preceding_literal(instructions, index)
                if sound_id is None:
                    continue
                counts[sound_id] = counts.get(sound_id, 0) + 1
                sources.setdefault(sound_id, set()).add(path.stem)
                zone_id = document.get("zoneId")
                if isinstance(zone_id, int):
                    zones.setdefault(sound_id, set()).add(zone_id)
    return [
        {"id": sound_id, "hex": f"0x{sound_id:08X}", "count": counts[sound_id],
         "sources": sorted(sources[sound_id]), "zones": sorted(zones.get(sound_id, set()))}
        for sound_id in sorted(counts)
    ]


def preceding_literal(instructions: list[dict[str, Any]], index: int) -> int | None:
    for instruction in reversed(instructions[max(0, index - 4):index]):
        if instruction.get("mnemonic") == "push.c":
            operands = instruction.get("operands", [])
            return operands[0] if operands and isinstance(operands[0], int) else None
        if instruction.get("native") or instruction.get("mnemonic") in {"call", "retn", "jump"}:
            return None
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Lista e extrai sequências, bancos e waves internos do BCSAR.")
    parser.add_argument("--bcsar", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--zone-scripts", type=Path, help="diretório dos JSONs AMX para catalogar argumentos literais de SEPlay")
    args = parser.parse_args()

    manifest = extract_bcsar_assets(args.bcsar.read_bytes(), args.out_dir)
    if args.zone_scripts:
        manifest["seplayIds"] = scan_seplay_ids(args.zone_scripts)
        (args.out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for asset in manifest["assets"]:
        extension = asset["extension"]
        counts[extension] = counts.get(extension, 0) + 1
    print(f"sons={manifest['soundCount']} arquivos={manifest['fileCount']} assets={counts} -> {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
