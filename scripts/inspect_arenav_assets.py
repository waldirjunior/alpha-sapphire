#!/usr/bin/env python3
"""Scan RomFS GARCs for native UI resource headers and extract a selected entry."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Any

try:
    from .unpack_garc import decompress_lz11
except ImportError:
    from unpack_garc import decompress_lz11


SIGNATURES = {
    "BCH": (b"BCH\0",),
    "BCLYT": (b"BCLYT",),
    "BCFLY": (b"BCFLY",),
    "BFLYT": (b"BFLYT",),
    "BFLIM": (b"BFLIM",),
    "CGFX": (b"CGFX",),
    "CLYT": (b"CLYT",),
    "FLIM": (b"FLIM",),
    "FLYT": (b"FLYT",),
    "CLIM": (b"CLIM",),
    "ARC": (b"ARC\0", b"ARC "),
}
AREA_NAV_TERMS = (b"areanav", b"area_nav", b"pokenav", b"hoenn")
AREA_NAV_RESOURCE_TERMS = AREA_NAV_TERMS + (
    b"area_map",
    b"map_area",
    b"hoenn_map",
    b"map_hoenn",
    b"icon_area",
    b"icon_nav",
)
PREFIX_LIMIT = 64
DEEP_PREFIX_LIMIT = 0x10000


@dataclass(frozen=True)
class GarcEntry:
    slot: int
    subfile: int
    offset: int
    length: int


def lz11_prefix(blob: bytes, limit: int) -> bytes:
    if limit <= 0:
        return b""
    if not blob or blob[0] != 0x11:
        return blob[:limit]
    if len(blob) < 4:
        raise ValueError("Cabeçalho LZ11 truncado: esperado ao menos 4 bytes")

    output_size = blob[1] | (blob[2] << 8) | (blob[3] << 16)
    cursor = 4
    if output_size == 0:
        if len(blob) < 8:
            raise ValueError("Cabeçalho LZ11 estendido truncado: esperado 8 bytes")
        output_size = struct.unpack_from("<I", blob, 4)[0]
        cursor = 8
    target_size = min(limit, output_size)
    output = bytearray()
    while len(output) < target_size:
        if cursor >= len(blob):
            raise ValueError("Dados LZ11 truncados antes do prefixo solicitado")
        flags = blob[cursor]
        cursor += 1
        for bit in range(7, -1, -1):
            if len(output) >= target_size:
                break
            if flags & (1 << bit):
                length, distance, cursor = read_lz11_backreference(blob, cursor)
                if distance > len(output):
                    raise ValueError(f"Referência LZ11 inválida: distância {distance}")
                for _ in range(min(length, target_size - len(output))):
                    output.append(output[-distance])
            else:
                if cursor >= len(blob):
                    raise ValueError("Literal LZ11 truncado antes do prefixo solicitado")
                output.append(blob[cursor])
                cursor += 1
    return bytes(output)


def read_lz11_backreference(blob: bytes, cursor: int) -> tuple[int, int, int]:
    if cursor >= len(blob):
        raise ValueError("Referência LZ11 truncada")
    first = blob[cursor]
    cursor += 1
    indicator = first >> 4
    if indicator == 0:
        if cursor + 1 >= len(blob):
            raise ValueError("Referência LZ11 curta truncada")
        second, third = blob[cursor], blob[cursor + 1]
        length = (((first & 0x0F) << 4) | (second >> 4)) + 0x11
        distance = (((second & 0x0F) << 8) | third) + 1
        return length, distance, cursor + 2
    if indicator == 1:
        if cursor + 2 >= len(blob):
            raise ValueError("Referência LZ11 longa truncada")
        second, third, fourth = blob[cursor], blob[cursor + 1], blob[cursor + 2]
        length = (((first & 0x0F) << 12) | (second << 4) | (third >> 4)) + 0x111
        distance = (((third & 0x0F) << 8) | fourth) + 1
        return length, distance, cursor + 3
    if cursor >= len(blob):
        raise ValueError("Referência LZ11 média truncada")
    second = blob[cursor]
    return indicator + 1, (((first & 0x0F) << 8) | second) + 1, cursor + 1


def read_garc_index(stream: BinaryIO, archive_size: int) -> tuple[int, list[GarcEntry]]:
    header = stream.read(28)
    if len(header) < 28 or header[:4] != b"CRAG":
        raise ValueError("Arquivo não é GARC CRAG v4")
    _, header_length, _, _, _, data_offset, file_size, _ = struct.unpack("<4sIHHIIII", header)
    checked_size = file_size if file_size else archive_size
    if header_length < 28 or header_length > archive_size or checked_size > archive_size:
        raise ValueError("Cabeçalho GARC com limites fora do arquivo")

    stream.seek(header_length)
    fato = stream.read(12)
    if len(fato) != 12 or fato[:4] != b"OTAF":
        raise ValueError("Chunk FATO/OTAF ausente ou truncado")
    fato_size, fato_count = struct.unpack_from("<IH", fato, 4)
    if fato_size < 12 or header_length + fato_size > archive_size:
        raise ValueError("Tamanho FATO/OTAF fora dos limites")

    fatb_offset = header_length + fato_size
    stream.seek(fatb_offset)
    fatb = stream.read(12)
    if len(fatb) != 12 or fatb[:4] != b"BTAF":
        raise ValueError("Chunk FATB/BTAF ausente ou truncado")
    fatb_size, subfile_count = struct.unpack_from("<II", fatb, 4)
    fatb_end = fatb_offset + fatb_size
    if fatb_size < 12 or fatb_end > archive_size or data_offset < fatb_end:
        raise ValueError("Tamanho FATB/BTAF ou data offset fora dos limites")

    entries = read_fatb_entries(
        stream, fatb_offset + 12, fato_count, subfile_count, fatb_end, data_offset, checked_size
    )
    return data_offset, entries


def read_fatb_entries(
    stream: BinaryIO,
    cursor: int,
    slot_count: int,
    expected_subfile_count: int,
    fatb_end: int,
    data_offset: int,
    archive_size: int,
) -> list[GarcEntry]:
    entries: list[GarcEntry] = []
    observed_subfiles = 0
    for slot in range(slot_count):
        stream.seek(cursor)
        raw_mask = stream.read(4)
        if len(raw_mask) != 4:
            raise ValueError(f"Tabela FATB truncada na entrada {slot}")
        mask = struct.unpack("<I", raw_mask)[0]
        count = mask.bit_count()
        observed_subfiles += count
        records_size = count * 12
        cursor += 4 + records_size
        if cursor > fatb_end:
            raise ValueError(f"Tabela FATB excede limites na entrada {slot}")
        records = stream.read(records_size)
        if len(records) != records_size:
            raise ValueError(f"Registros FATB truncados na entrada {slot}")
        for subfile in range(count):
            start, end, length = struct.unpack_from("<III", records, subfile * 12)
            absolute_start = data_offset + start
            absolute_end = absolute_start + length
            if start > end or absolute_end > archive_size:
                raise ValueError(f"Entrada GARC {slot}:{subfile} fora dos limites")
            if length:
                entries.append(GarcEntry(slot, subfile, absolute_start, length))
    if observed_subfiles != expected_subfile_count:
        raise ValueError(
            f"Contagem FATB divergente: {observed_subfiles} subarquivos, esperado {expected_subfile_count}"
        )
    return entries


def signature_name(prefix: bytes) -> str | None:
    for name, signatures in SIGNATURES.items():
        if any(prefix.startswith(signature) for signature in signatures):
            return name
    return None


def decode_entry(raw: bytes) -> bytes:
    if raw[:1] != b"\x11":
        return raw
    try:
        return decompress_lz11(raw)
    except (IndexError, struct.error) as exc:
        raise ValueError("Entrada GARC contém LZ11 truncado ou inválido") from exc


def inspect_stream(
    stream: BinaryIO,
    archive_size: int,
    archive_label: str,
    deep: bool = False,
) -> dict[str, Any]:
    data_offset, entries = read_garc_index(stream, archive_size)
    matches: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for entry in entries:
        stream.seek(entry.offset)
        raw = stream.read(entry.length)
        try:
            prefix = lz11_prefix(raw, PREFIX_LIMIT)
        except ValueError as exc:
            warnings.append({"slot": entry.slot, "subfile": entry.subfile, "error": str(exc)})
            continue
        magic = signature_name(prefix)
        if magic is None:
            continue
        item: dict[str, Any] = {
            "archive": archive_label,
            "slot": entry.slot,
            "subfile": entry.subfile,
            "magic": magic,
            "stored_size": entry.length,
            "compressed_lz11": raw[:1] == b"\x11",
        }
        if deep:
            try:
                decoded = decode_entry(raw)
            except ValueError as exc:
                warnings.append({"slot": entry.slot, "subfile": entry.subfile, "error": str(exc)})
                continue
            item["decoded_size"] = len(decoded)
            item["sha256"] = hashlib.sha256(decoded).hexdigest()
            item["area_nav_terms"] = [term.decode("ascii") for term in AREA_NAV_TERMS if term in decoded.lower()]
            item["resource_names"] = find_area_nav_resource_names(decoded)
        matches.append(item)
    return {
        "archive": archive_label,
        "entry_count": len(entries),
        "data_offset": data_offset,
        "matches": matches,
        "warnings": warnings,
    }


def find_area_nav_resource_names(blob: bytes) -> list[str]:
    strings: list[str] = []
    for value in blob.split(b"\0"):
        if len(value) < 4 or any(byte < 0x20 or byte >= 0x7F for byte in value):
            continue
        lowered = value.lower()
        if any(term in lowered for term in AREA_NAV_RESOURCE_TERMS):
            name = value.decode("ascii", errors="replace")
            if "TextureMapper" not in name and "Material" not in name:
                strings.append(name[:120])
    return strings[:40]


def inspect_garc_headers(blob: bytes, archive_label: str, deep: bool = False) -> dict[str, Any]:
    return inspect_stream(io.BytesIO(blob), len(blob), archive_label, deep)


def scan_romfs_a(romfs: Path, deep: bool = False) -> dict[str, Any]:
    a_dir = romfs / "a"
    if not a_dir.is_dir():
        raise FileNotFoundError(f"Diretório RomFS/a não encontrado em: {a_dir}")
    archive_paths = sorted(path for path in a_dir.rglob("*") if path.is_file())
    total_entries = 0
    magic_counts: dict[str, int] = {}
    keyword_hits: list[dict[str, Any]] = []
    resource_entries: list[dict[str, Any]] = []
    malformed: list[dict[str, str]] = []
    decode_warnings: list[dict[str, Any]] = []
    scanned_archives = 0
    non_garc = 0
    non_garc_files: list[str] = []
    for path in archive_paths:
        with path.open("rb") as stream:
            if stream.read(4) != b"CRAG":
                non_garc += 1
                non_garc_files.append(path.relative_to(romfs).as_posix())
                continue
            stream.seek(0)
            relative = path.relative_to(romfs).as_posix()
            try:
                result = inspect_stream(stream, path.stat().st_size, relative, deep)
            except ValueError as exc:
                malformed.append({"archive": relative, "error": str(exc)})
                continue
        scanned_archives += 1
        total_entries += result["entry_count"]
        decode_warnings.extend({"archive": relative, **warning} for warning in result["warnings"])
        for match in result["matches"]:
            magic = match["magic"]
            magic_counts[magic] = magic_counts.get(magic, 0) + 1
            resource_entries.append(match)
            if match.get("area_nav_terms") or match.get("resource_names"):
                keyword_hits.append(match)
    return {
        "romfs_a_file_count": len(archive_paths),
        "garc_count": scanned_archives,
        "non_garc_count": non_garc,
        "non_garc_files": non_garc_files,
        "entry_count": total_entries,
        "signature_counts": dict(sorted(magic_counts.items())),
        "resource_entries": resource_entries,
        "area_nav_keyword_hits": keyword_hits,
        "malformed_garcs": malformed,
        "entry_decode_warnings": decode_warnings,
        "deep_scan": deep,
        "deep_scan_scope": "full decoded contents of entries with a recognized top-level signature" if deep else "first 64 decoded bytes of each entry",
    }


def extract_garc_entry(
    archive_blob: bytes,
    slot: int,
    subfile: int = 0,
    expected_magic: str | None = None,
) -> bytes:
    stream = io.BytesIO(archive_blob)
    return extract_entry_from_stream(stream, len(archive_blob), slot, subfile, expected_magic)


def extract_garc_entry_path(
    archive_path: Path,
    slot: int,
    subfile: int = 0,
    expected_magic: str | None = None,
) -> bytes:
    with archive_path.open("rb") as stream:
        return extract_entry_from_stream(stream, archive_path.stat().st_size, slot, subfile, expected_magic)


def extract_entry_from_stream(
    stream: BinaryIO,
    archive_size: int,
    slot: int,
    subfile: int,
    expected_magic: str | None,
) -> bytes:
    _, entries = read_garc_index(stream, archive_size)
    entry = next((item for item in entries if item.slot == slot and item.subfile == subfile), None)
    if entry is None:
        raise ValueError(f"GARC sem entrada {slot}:{subfile}")
    stream.seek(entry.offset)
    decoded = decode_entry(stream.read(entry.length))
    if expected_magic:
        signatures = SIGNATURES.get(expected_magic)
        if signatures is None:
            raise ValueError(f"Magic esperado desconhecido: {expected_magic}")
        if not any(decoded.startswith(signature) for signature in signatures):
            raise ValueError(f"Entrada {slot}:{subfile} não começa com o magic esperado {expected_magic}")
    return decoded


def write_local_asset(root: Path, filename: str, blob: bytes) -> Path:
    root = root.resolve()
    allowed_root = ("rom", "extracted") in tuple(zip(root.parts, root.parts[1:])) or (
        "public", "assets"
    ) in tuple(zip(root.parts, root.parts[1:]))
    if not allowed_root:
        raise ValueError("A extração precisa ficar sob rom/extracted/ ou public/assets/")
    target = (root / filename).resolve()
    if not target.is_relative_to(root) or Path(filename).name != filename:
        raise ValueError(f"Nome de saída inseguro: {filename}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(blob)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--romfs", type=Path, required=True, help="Diretório RomFS extraído")
    parser.add_argument("--deep", action="store_true", help="Descomprime entradas reconhecidas e busca nomes AreaNav")
    parser.add_argument("--output", type=Path, help="Grava o relatório JSON neste caminho")
    parser.add_argument("--extract-archive", help="Caminho relativo ao RomFS, por exemplo a/1/2/9")
    parser.add_argument("--slot", type=int)
    parser.add_argument("--subfile", type=int, default=0)
    parser.add_argument("--expect-magic", choices=tuple(SIGNATURES))
    parser.add_argument("--extract-root", type=Path)
    parser.add_argument("--filename", help="Nome simples do arquivo extraído")
    args = parser.parse_args()

    if args.extract_archive:
        if args.slot is None or args.extract_root is None or args.filename is None:
            parser.error("--extract-archive exige --slot, --extract-root e --filename")
        archive = args.romfs / args.extract_archive
        extracted = extract_garc_entry_path(archive, args.slot, args.subfile, args.expect_magic)
        target = write_local_asset(args.extract_root, args.filename, extracted)
        print(f"Extraído {args.extract_archive}:{args.slot}:{args.subfile} para {target}")
        return 0

    report = scan_romfs_a(args.romfs, args.deep)
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
        print(f"Relatório: {args.output}")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
