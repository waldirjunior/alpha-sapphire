#!/usr/bin/env python3
"""Cataloga os arquivos GARC (CRAG v4) dentro de RomFS/a/ sem extrair binários proprietários para o Git.

Gera um catálogo JSON com contagem de subarquivos, tamanhos e assinaturas mágicas iniciais
para mapear onde estão mapas, textos, modelos 3D (BCH/CGFX) e tabelas da ROM.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def detect_magic(blob: bytes) -> str:
    if not blob:
        return "EMPTY"
    head = blob[:4]
    if head == b"BCH\x00":
        return "BCH"
    if head == b"CGFX":
        return "CGFX"
    if head[:2] in (b"GR", b"ZO", b"MM", b"AD", b"PC", b"PF", b"PT", b"GS", b"BS"):
        if head[:2].isalpha():
            return f"MINI:{head[:2].decode('ascii')}"
    if blob[0] == 0x11:
        return "LZ11"
    if blob[0] == 0x10:
        return "LZ10"
    if all(32 <= b < 127 for b in head):
        return f"ASCII:{head.decode('ascii')}"
    return f"HEX:{head.hex()}"


def inspect_garc(path: Path) -> dict[str, object]:
    size = path.stat().st_size
    if size == 0:
        return {"size": 0, "format": "EMPTY"}

    with path.open("rb") as f:
        hdr = f.read(28)
        if len(hdr) < 28 or hdr[:4] != b"CRAG":
            return {"size": size, "format": f"RAW:{detect_magic(hdr)}"}

        _magic, hdr_len, _endian, version, _chunks, data_offset, _file_size, _max_pad = struct.unpack(
            "<4sIHHIIII", hdr
        )
        f.seek(hdr_len)
        fato_hdr = f.read(12)
        if fato_hdr[:4] != b"OTAF":
            return {"size": size, "format": f"CRAG_UNKNOWN_FATO:{fato_hdr[:4].hex()}"}

        fato_size, fato_count, _pad = struct.unpack("<IHH", fato_hdr[4:])
        f.seek(hdr_len + fato_size)
        fatb_hdr = f.read(12)
        if fatb_hdr[:4] != b"BTAF":
            return {"size": size, "format": f"CRAG_UNKNOWN_FATB:{fatb_hdr[:4].hex()}"}

        _fatb_size, fatb_count = struct.unpack("<II", fatb_hdr[4:])
        # Cada entrada FATB padrão tem 4 bytes de bitmask + N * 12 bytes (start, end, length).
        # Para arquivos sem múltiplos idiomas no mesmo slot (bitmask == 1), são 16 bytes por entrada.
        sample_magics: list[str] = []
        fatb_pos = hdr_len + fato_size + 12
        f.seek(fatb_pos)
        # Lê até 8 primeiras entradas simples para amostragem rápida de magic bytes
        for _ in range(min(fatb_count, 8)):
            bitmask_raw = f.read(4)
            if len(bitmask_raw) < 4:
                break
            bitmask = struct.unpack("<I", bitmask_raw)[0]
            bits = bin(bitmask).count("1")
            if bits == 0:
                continue
            entries_raw = f.read(12 * bits)
            if len(entries_raw) < 12:
                break
            start, _end, length = struct.unpack_from("<III", entries_raw, 0)
            if length == 0:
                sample_magics.append("EMPTY")
                continue
            cur = f.tell()
            f.seek(data_offset + start)
            sample = f.read(min(16, length))
            f.seek(cur)
            sample_magics.append(detect_magic(sample))

        return {
            "size": size,
            "format": f"GARC_v{version >> 8}",
            "fato_count": fato_count,
            "fatb_count": fatb_count,
            "sample_magics": sample_magics,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Cataloga GARCs em RomFS/a/.")
    parser.add_argument("--romfs", required=True, type=Path, help="Caminho para RomFS extraída")
    parser.add_argument("--out", required=True, type=Path, help="Caminho do JSON de catálogo")
    args = parser.parse_args()

    a_dir = args.romfs / "a"
    if not a_dir.is_dir():
        raise FileNotFoundError(f"Diretório RomFS/a não encontrado em: {a_dir}")

    files = sorted(p for p in a_dir.rglob("*") if p.is_file())
    catalog: dict[str, dict[str, object]] = {}
    for file_path in files:
        rel = file_path.relative_to(args.romfs).as_posix()
        catalog[rel] = inspect_garc(file_path)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Catalogados {len(catalog)} arquivos em {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
