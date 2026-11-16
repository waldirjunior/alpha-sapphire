#!/usr/bin/env python3
"""Extrai a partição RomFS de uma ROM .3ds descriptografada (NCSD -> NCCH0 -> IVFC -> RomFS).

Motivo da existência deste script (A-003): ctrtool v1.3.0 aborta com
`VirtualFileSystem::openFile() ERROR` ao encontrar arquivos de 0 byte na RomFS
(como `a/0/8/7` em Pokémon Alpha Sapphire). Este extrator lê os headers NCSD/NCCH/RomFS
dinamicamente e extrai todos os arquivos, incluindo os vazios.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
from pathlib import Path

MEDIA_UNIT = 0x200
ROMFS_MAGIC_HEADER_SIZE = 0x28
INVALID_OFFSET = 0xFFFFFFFF


def read_u32(buf: bytes, offset: int) -> int:
    return struct.unpack_from("<I", buf, offset)[0]


def find_romfs_base(rom_file) -> int:
    rom_file.seek(0)
    ncsd_header = rom_file.read(0x200)
    if ncsd_header[0x100:0x104] != b"NCSD":
        raise ValueError("Arquivo não é um container NCSD (.3ds) válido.")

    part0_offset_units = read_u32(ncsd_header, 0x120)
    ncch_offset = part0_offset_units * MEDIA_UNIT

    rom_file.seek(ncch_offset)
    ncch_header = rom_file.read(0x200)
    if ncch_header[0x100:0x104] != b"NCCH":
        raise ValueError("Partição 0 não possui header NCCH válido.")

    romfs_offset_units = read_u32(ncch_header, 0x1B0)
    if romfs_offset_units == 0:
        raise ValueError("Partição 0 não contém RomFS.")

    romfs_region_offset = ncch_offset + romfs_offset_units * MEDIA_UNIT
    rom_file.seek(romfs_region_offset)
    ivfc_header = rom_file.read(0x60)
    if ivfc_header[0x00:0x04] != b"IVFC":
        raise ValueError("Header IVFC esperado no início da região RomFS.")

    # Em imagens 3DS, o Level 2 real do RomFS fica alinhado após os headers IVFC (0x1000 bytes).
    romfs_base = romfs_region_offset + 0x1000
    rom_file.seek(romfs_base)
    hdr_size = struct.unpack("<I", rom_file.read(4))[0]
    if hdr_size != ROMFS_MAGIC_HEADER_SIZE:
        raise ValueError(
            f"Header RomFS inesperado em 0x{romfs_base:x}: esperado 0x{ROMFS_MAGIC_HEADER_SIZE:x}, obtido 0x{hdr_size:x}."
        )
    return romfs_base


def parse_dir_table(det: bytes) -> dict[int, tuple[int, str]]:
    """Retorna mapa offset_dir -> (parent_offset, nome)."""
    dirs: dict[int, tuple[int, str]] = {}
    off = 0
    while off < len(det):
        parent, _sibling, _child_dir, _first_file, _hash_next, name_len = struct.unpack_from(
            "<IIIIII", det, off
        )
        name = det[off + 24 : off + 24 + name_len].decode("utf-16-le") if name_len else ""
        dirs[off] = (parent, name)
        off += 24 + ((name_len + 3) // 4) * 4
    return dirs


def build_dir_paths(dirs: dict[int, tuple[int, str]]) -> dict[int, Path]:
    paths: dict[int, Path] = {0: Path(".")}

    def resolve(dir_off: int) -> Path:
        if dir_off in paths:
            return paths[dir_off]
        parent_off, name = dirs[dir_off]
        if parent_off == dir_off or parent_off == INVALID_OFFSET:
            paths[dir_off] = Path(name)
        else:
            paths[dir_off] = resolve(parent_off) / name
        return paths[dir_off]

    for d_off in dirs:
        resolve(d_off)
    return paths


def extract_romfs(rom_path: Path, out_dir: Path, manifest_path: Path | None) -> dict[str, object]:
    if not rom_path.is_file():
        raise FileNotFoundError(f"Arquivo .3ds não encontrado: {rom_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    with rom_path.open("rb") as f:
        romfs_base = find_romfs_base(f)
        f.seek(romfs_base)
        (
            _hdr_size,
            _dhb_off,
            _dhb_sz,
            det_off,
            det_sz,
            _fhb_off,
            _fhb_sz,
            fet_off,
            fet_sz,
            data_off,
        ) = struct.unpack("<10I", f.read(40))

        f.seek(romfs_base + det_off)
        dirs = parse_dir_table(f.read(det_sz))
        dir_paths = build_dir_paths(dirs)

        for rel_dir in dir_paths.values():
            (out_dir / rel_dir).mkdir(parents=True, exist_ok=True)

        f.seek(romfs_base + fet_off)
        fet = f.read(fet_sz)

        off = 0
        total_files = 0
        total_bytes = 0
        zero_byte_files: list[str] = []
        top_level_counts: dict[str, int] = {}

        while off < len(fet):
            parent_dir, _sibling, data_pos, data_len, _hash_next, name_len = struct.unpack_from(
                "<IIQQII", fet, off
            )
            name = fet[off + 32 : off + 32 + name_len].decode("utf-16-le")
            rel_path = dir_paths[parent_dir] / name
            target_path = out_dir / rel_path

            target_path.parent.mkdir(parents=True, exist_ok=True)
            if data_len == 0:
                target_path.write_bytes(b"")
                zero_byte_files.append(rel_path.as_posix())
            else:
                f.seek(romfs_base + data_off + data_pos)
                remaining = data_len
                with target_path.open("wb") as out_f:
                    while remaining > 0:
                        chunk = f.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise EOFError(f"EOF inesperado ao ler {rel_path}")
                        out_f.write(chunk)
                        remaining -= len(chunk)

            top_key = rel_path.parts[0] if len(rel_path.parts) > 1 else "(root)"
            top_level_counts[top_key] = top_level_counts.get(top_key, 0) + 1
            total_files += 1
            total_bytes += data_len
            off += 32 + ((name_len + 3) // 4) * 4

    summary: dict[str, object] = {
        "romfs_base_hex": f"0x{romfs_base:x}",
        "total_directories": len(dir_paths),
        "total_files": total_files,
        "total_bytes": total_bytes,
        "zero_byte_files": zero_byte_files,
        "top_level_counts": dict(sorted(top_level_counts.items())),
    }

    if manifest_path is not None:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai RomFS de arquivo .3ds descriptografado.")
    parser.add_argument("--rom", required=True, type=Path, help="Caminho para o arquivo .3ds")
    parser.add_argument("--out", required=True, type=Path, help="Diretório de destino da RomFS")
    parser.add_argument("--manifest", type=Path, default=None, help="Arquivo JSON de resumo opcional")
    args = parser.parse_args()

    summary = extract_romfs(args.rom, args.out, args.manifest)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
