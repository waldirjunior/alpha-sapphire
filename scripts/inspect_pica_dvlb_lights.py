#!/usr/bin/env python3
"""Catalog DVLB shader metadata and static PICA light-loader references."""

from __future__ import annotations

import argparse
import hashlib
import json
import mmap
import struct
import sys
from pathlib import Path
from typing import Any, Iterator

try:
    from .pica_dvlb_light_xrefs import inspect_codebin, inspect_lighting_callback
    from .townmap_probe_formats import MINI_MAGICS, iter_garc_entries, parse_darc, parse_mini_package
except ImportError:
    from pica_dvlb_light_xrefs import inspect_codebin, inspect_lighting_callback
    from townmap_probe_formats import MINI_MAGICS, iter_garc_entries, parse_darc, parse_mini_package


DVLB_HEADER_SIZE = 8
DVLP_HEADER_SIZE = 0x28
DVLE_HEADER_SIZE = 0x40
MAX_EXECUTABLES = 256


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def checked_range(blob: bytes, base: int, offset: int, size: int, label: str) -> tuple[int, int]:
    start, end = base + offset, base + offset + size
    if offset < 0 or size < 0 or start < base or end < start or end > len(blob):
        raise ValueError(f"{label} fora do payload: offset={offset:#x}, size={size:#x}")
    return start, end


def read_c_string(blob: bytes, start: int, end: int, label: str) -> str:
    if not start <= end <= len(blob):
        raise ValueError(f"{label} fora do payload")
    stop = blob.find(b"\0", start, end)
    if stop < 0:
        raise ValueError(f"{label} sem terminador NUL")
    return blob[start:stop].decode("utf-8", errors="replace")


def symbol_strings(blob: bytes, start: int, size: int) -> list[str]:
    _, end = checked_range(blob, start, 0, size, "Tabela de símbolos")
    if size == 0:
        return []
    return [part.decode("utf-8", errors="replace") for part in blob[start:end].split(b"\0") if part]


def uniform_register_class(register: int) -> str:
    if register <= 0x0F:
        return "input"
    if 0x10 <= register <= 0x6F:
        return "float-constant"
    if 0x70 <= register <= 0x73:
        return "integer-constant"
    if 0x78 <= register <= 0x87:
        return "boolean-constant"
    return "unknown"


def dvlb_executables(blob: bytes, start: int) -> tuple[list[int], int]:
    checked_range(blob, start, 0, DVLB_HEADER_SIZE, "DVLB header")
    if blob[start : start + 4] != b"DVLB":
        raise ValueError(f"Esperado DVLB em {start:#x}")
    count = struct.unpack_from("<I", blob, start + 4)[0]
    if not 1 <= count <= MAX_EXECUTABLES:
        raise ValueError(f"DVLB executable count inválido: {count}")
    table_size = count * 4
    checked_range(blob, start, DVLB_HEADER_SIZE, table_size, "DVLB offset table")
    offsets = list(struct.unpack_from(f"<{count}I", blob, start + DVLB_HEADER_SIZE))
    for offset in offsets:
        checked_range(blob, start, offset, DVLE_HEADER_SIZE, "DVLE offset/header")
        if blob[start + offset : start + offset + 4] != b"DVLE":
            raise ValueError(f"DVLE offset {offset:#x} aponta para magic inválido")
    return offsets, start + DVLB_HEADER_SIZE + table_size


def parse_executable(blob: bytes, start: int, offset: int, code_words: int) -> dict[str, Any]:
    dvle = start + offset
    values = struct.unpack_from("<4sHBBIIHHBBBB10I", blob, dvle)
    (
        _, version, shader_type, merge_outmaps, main_offset, endmain_offset,
        input_mask, output_mask, geometry_type, fixed_constant_start,
        variable_vertices, fixed_vertices, constant_offset, constant_count,
        label_offset, label_count, output_offset, output_count,
        uniform_offset, uniform_count, symbol_offset, symbol_size,
    ) = values
    if shader_type not in (0, 1, 2, 3):
        raise ValueError(f"DVLE shader type inválido em {dvle:#x}: {shader_type}")
    if main_offset > endmain_offset or endmain_offset > code_words:
        raise ValueError(f"DVLE main range excede o programa em {dvle:#x}")

    tables = (
        (constant_offset, constant_count, 0x14, "DVLE constant table"),
        (label_offset, label_count, 0x10, "DVLE label table"),
        (output_offset, output_count, 0x08, "DVLE output table"),
        (uniform_offset, uniform_count, 0x08, "DVLE uniform table"),
    )
    table_ends = [checked_range(blob, dvle, table_offset, count * stride, label)[1]
                  for table_offset, count, stride, label in tables]
    symbols_start, symbols_end = checked_range(blob, dvle, symbol_offset, symbol_size, "DVLE symbol table")
    table_ends.append(symbols_end)
    symbols_blob = blob[symbols_start:symbols_end]

    uniforms = []
    for index in range(uniform_count):
        entry = dvle + uniform_offset + index * 8
        name_offset, register_start, register_end = struct.unpack_from("<IHH", blob, entry)
        if register_end < register_start:
            raise ValueError(f"DVLE uniform range invertido em {entry:#x}")
        name = read_c_string(symbols_blob, name_offset, len(symbols_blob), "DVLE uniform symbol")
        uniforms.append({
            "name": name,
            "register_start": register_start,
            "register_end": register_end,
            "register_class": uniform_register_class(register_start),
            "register_count": register_end - register_start + 1,
        })

    labels = []
    for index in range(label_count):
        entry = dvle + label_offset + index * 0x10
        label_id, _reserved, location, size_words, name_offset = struct.unpack_from("<HHIII", blob, entry)
        name = read_c_string(symbols_blob, name_offset, len(symbols_blob), "DVLE label symbol")
        labels.append({"id": label_id, "name": name, "location_words": location, "size_words": size_words})

    outputs = []
    for index in range(output_count):
        entry = dvle + output_offset + index * 8
        output_type, register, component_mask, reserved = struct.unpack_from("<HHHH", blob, entry)
        outputs.append({"type": output_type, "register": register, "component_mask": component_mask,
                        "reserved": reserved})

    names = symbol_strings(symbols_blob, 0, len(symbols_blob))
    type_name = {0: "vertex", 1: "geometry"}.get(shader_type, f"unknown-{shader_type}")
    return {
        "offset": offset,
        "version": version,
        "type": type_name,
        "shader_type_code": shader_type,
        "merge_outmaps": bool(merge_outmaps),
        "main_offset_words": main_offset,
        "endmain_offset_words": endmain_offset,
        "input_register_mask": input_mask,
        "output_register_mask": output_mask,
        "geometry": {"type": geometry_type, "fixed_constant_start": fixed_constant_start,
                     "variable_vertices": variable_vertices, "fixed_vertices": fixed_vertices},
        "uniforms": uniforms,
        "labels": labels,
        "outputs": outputs,
        "symbols": names,
        "table_end_offsets": table_ends,
    }


def inspect_dvlb(blob: bytes, start: int, source: str) -> dict[str, Any]:
    executable_offsets, header_end = dvlb_executables(blob, start)
    dvlp = header_end
    checked_range(blob, dvlp, 0, DVLP_HEADER_SIZE, "DVLP header")
    (
        _, version, code_offset, code_words, operand_offset, operand_count,
        _unknown_a, _unknown_b, filename_offset, filename_size,
    ) = struct.unpack_from("<4s9I", blob, dvlp)
    if blob[dvlp : dvlp + 4] != b"DVLP":
        raise ValueError(f"Esperado DVLP em {dvlp:#x}, encontrado {blob[dvlp:dvlp + 4]!r}")
    code_start, code_end = checked_range(blob, dvlp, code_offset, code_words * 4, "DVLP program")
    _, operand_end = checked_range(blob, dvlp, operand_offset, operand_count * 8, "DVLP operand table")
    filename_start, filename_end = checked_range(blob, dvlp, filename_offset, filename_size, "DVLP filename symbols")
    filename_symbols = symbol_strings(blob, filename_start, filename_size)

    executables = [parse_executable(blob, start, offset, code_words) for offset in executable_offsets]
    record_end = max([header_end, code_end, operand_end, filename_end,
                      *(end for executable in executables for end in executable["table_end_offsets"])])
    record = blob[start:record_end]
    names = sorted({name for executable in executables for name in executable["symbols"]})
    name_candidates = sorted({name for name in filename_symbols + names
                              if name.lower().endswith((".vsh", ".gsh", ".shbin")) or name.startswith("0@")})
    return {
        "source": source,
        "dvlb_offset": start,
        "record_size": len(record),
        "record_sha256": sha256(record),
        "executable_count": len(executable_offsets),
        "program": {
            "offset": dvlp - start,
            "version": version,
            "instruction_words": code_words,
            "code_sha256": sha256(blob[code_start:code_end]),
            "operand_descriptor_count": operand_count,
            "filename_symbols": filename_symbols,
        },
        "shader_name_candidates": name_candidates,
        "executables": executables,
    }


def iter_dvlb_offsets(blob: bytes, source: str, depth: int = 0, base: int = 0) -> Iterator[tuple[int, str]]:
    offset = 0
    while (offset := blob.find(b"DVLB", offset)) >= 0:
        yield base + offset, source
        offset += 1
    if depth >= 4:
        return
    offset = 0
    while (offset := blob.find(b"darc", offset)) >= 0:
        try:
            entries = parse_darc(blob, offset)
        except ValueError:
            offset += 1
            continue
        for entry in entries:
            label = f"{source} / darc@{offset:#x} / {entry.name}"
            yield from iter_dvlb_offsets(entry.data, label, depth + 1, base + entry.offset)
        offset += 4
    if blob[:2] not in MINI_MAGICS:
        return
    try:
        sections = parse_mini_package(blob)
    except (ValueError, struct.error):
        return
    for index, section in enumerate(sections):
        section_offset = struct.unpack_from("<I", blob, 4 + index * 4)[0]
        label = f"{source} / {blob[:2].decode('ascii')}[section {index}]"
        yield from iter_dvlb_offsets(section, label, depth + 1, base + section_offset)


def inspect_romfs_shaders(romfs: Path) -> dict[str, Any]:
    a_dir = romfs / "a"
    shader_dir = romfs / "shader"
    valid: list[dict[str, Any]] = []
    invalid: list[dict[str, Any]] = []
    scan_errors: list[dict[str, Any]] = []
    file_hashes: dict[str, dict[str, Any]] = {}

    for path in sorted(item for item in a_dir.rglob("*") if item.is_file()) if a_dir.is_dir() else []:
        source = path.relative_to(romfs).as_posix()
        with path.open("rb") as stream:
            if path.stat().st_size:
                with mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as archive_blob:
                    inspect_archive_shaders(archive_blob, source, valid, invalid, scan_errors)
                    file_hashes[source] = {"size": len(archive_blob), "sha256": sha256(archive_blob)}
            else:
                file_hashes[source] = {"size": 0, "sha256": sha256(b"")}

    if shader_dir.is_dir():
        for path in sorted(item for item in shader_dir.rglob("*") if item.is_file()):
            source = path.relative_to(romfs).as_posix()
            blob = path.read_bytes()
            file_hashes[source] = {"size": len(blob), "sha256": sha256(blob)}
            for offset, container in iter_dvlb_offsets(blob, source):
                try:
                    record = inspect_dvlb(blob, offset, container)
                except ValueError as error:
                    invalid.append({"archive": source, "offset": offset,
                                    "container": container, "reason": str(error)})
                    continue
                valid.append({"archive": source, "slot": -1,
                              "subslot": 0, "source_kind": "loose",
                              "container": container, **record})

    unique: dict[tuple[str, int, int, int], dict[str, Any]] = {}
    for row in valid:
        key = (row["archive"], row["slot"], row["subslot"], row["dvlb_offset"])
        previous = unique.get(key)
        if previous is None or len(row["container"]) > len(previous["container"]):
            unique[key] = row
    shaders = sorted(unique.values(), key=lambda row: (row["archive"], row["slot"], row["subslot"], row["dvlb_offset"]))
    unique_invalid: dict[tuple[str, int, int, int], dict[str, Any]] = {}
    for row in invalid:
        if "offset" not in row:
            scan_errors.append(row)
            continue
        key = (row["archive"], row.get("slot", -1), row.get("subslot", 0), row["offset"])
        previous = unique_invalid.get(key)
        if previous is None or len(row["container"]) > len(previous["container"]):
            unique_invalid[key] = row
    invalid_candidates = sorted(unique_invalid.values(), key=lambda row: (row["archive"], row.get("slot", -1),
                                                                          row.get("subslot", 0), row["offset"]))
    return {
        "input_files": file_hashes,
        "signature_count": len(shaders) + len(invalid_candidates),
        "valid_count": len(shaders),
        "invalid_count": len(invalid_candidates),
        "shaders": shaders,
        "invalid_candidates": invalid_candidates,
        "scan_errors": sorted(scan_errors, key=lambda row: (row["archive"], row["reason"])),
    }


def inspect_archive_shaders(blob: Any, source: str, valid: list[dict[str, Any]],
                            invalid: list[dict[str, Any]], scan_errors: list[dict[str, Any]]) -> None:
    if blob[:4] == b"CRAG":
        inspect_garc_shaders(blob, source, valid, invalid, scan_errors)
        return
    for offset, container in iter_dvlb_offsets(blob, source):
        try:
            record = inspect_dvlb(blob, offset, container)
        except ValueError as error:
            invalid.append({"archive": source[2:], "offset": offset,
                            "container": container, "reason": str(error)})
            continue
        valid.append({"archive": source[2:], "slot": -1,
                      "subslot": 0, "source_kind": "loose",
                      "container": container, **record})


def inspect_garc_shaders(blob: Any, source: str, valid: list[dict[str, Any]],
                         invalid: list[dict[str, Any]], scan_errors: list[dict[str, Any]]) -> None:
    try:
        for entry in iter_garc_entries(blob):
            for offset, container in iter_dvlb_offsets(entry.data, source):
                try:
                    record = inspect_dvlb(entry.data, offset, container)
                except ValueError as error:
                    invalid.append({"archive": source, "slot": entry.slot,
                                    "subslot": entry.subslot, "offset": offset,
                                    "container": container, "reason": str(error)})
                    continue
                record["compressed"] = entry.compressed
                valid.append({"archive": source, "slot": entry.slot,
                              "subslot": entry.subslot, "source_kind": "garc",
                              "container": container, **record})
    except ValueError as error:
        scan_errors.append({"archive": source, "reason": str(error), "source_kind": "garc"})


def inspect(extracted: Path) -> dict[str, Any]:
    romfs = extracted / "RomFS" if (extracted / "RomFS").is_dir() else extracted
    exefs_dir = extracted / "ExeFS"
    code_path = exefs_dir / "code.bin"
    field_path = romfs / "DllField.cro"
    if not code_path.is_file() or not field_path.is_file():
        raise FileNotFoundError(f"Esperado code.bin e DllField.cro em {extracted}")
    code = code_path.read_bytes()
    field = field_path.read_bytes()
    return {
        "schema": "pica-dvlb-light-xref/v1",
        "romfs_shaders": inspect_romfs_shaders(romfs),
        "exefs": inspect_codebin(code),
        "dll_field": inspect_lighting_callback(field),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extracted", type=Path, required=True,
                        help="Pasta extraída contendo RomFS/ e ExeFS/")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    rendered = json.dumps(inspect(args.extracted), indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
