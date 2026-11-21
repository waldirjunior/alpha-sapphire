#!/usr/bin/env python3
"""Inspect PICA shader path tables and candidate LightSet references offline."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any


EXEFS_BASE_VA = 0x100000
SHADER_PATHS = (
    "rom:/g3d_common/gfl_DefaultShader.bcsdr",
    "rom:/g3d_common/nwgfx_DefaultShader.bcsdr",
    "rom:/g3d_common/gfl_DefaultShader.bchsdr",
)
SHADER_TABLE_OFFSET = 0x517460
VTABLES = {
    "H3dModel": (0x4DDE08, 24),
    "H3dLightSet": (0x4DDF14, 5),
}
RTTI_TERMS = ("SceneSystem", "H3dEnvironment", "H3dResShader", "H3dModel", "LightSet")
PSEUDO_LIGHTING_LISTENER = {
    "typeinfo_file_offset": 0xFDEE8,
    "vtable_file_offset": 0x1077E8,
    "callback_file_offset": 0x2EE38,
}


def find_string_offsets(blob: bytes, value: str) -> list[int]:
    needle = value.encode("ascii") + b"\0"
    matches: list[int] = []
    start = 0
    while (offset := blob.find(needle, start)) >= 0:
        matches.append(offset)
        start = offset + 1
    return matches


def find_substring_offsets(blob: bytes, value: str) -> list[int]:
    needle = value.encode("ascii")
    matches: list[int] = []
    start = 0
    while (offset := blob.find(needle, start)) >= 0:
        matches.append(offset)
        start = offset + 1
    return matches


def find_rom_path_literals(blob: bytes) -> dict[str, list[int]]:
    paths: dict[str, list[int]] = {}
    prefix = b"rom:/"
    start = 0
    while (offset := blob.find(prefix, start)) >= 0:
        end = blob.find(b"\0", offset)
        if end < 0:
            break
        path = blob[offset:end].decode("ascii", errors="replace")
        paths[path] = [offset]
        start = end + 1
    return paths


def find_pointer_table_runs(blob: bytes, pointer_values: set[int]) -> list[dict[str, Any]]:
    hits = [
        (offset, struct.unpack_from("<I", blob, offset)[0])
        for offset in range(0, len(blob) - 3, 4)
        if struct.unpack_from("<I", blob, offset)[0] in pointer_values
    ]
    runs: list[dict[str, Any]] = []
    current: list[tuple[int, int]] = []
    for hit in hits:
        if current and hit[0] != current[-1][0] + 4:
            append_pointer_run(runs, current)
            current = []
        current.append(hit)
    append_pointer_run(runs, current)
    return runs


def append_pointer_run(runs: list[dict[str, Any]], entries: list[tuple[int, int]]) -> None:
    if len(entries) < 2:
        return
    runs.append({"file_offset": entries[0][0], "values": [value for _, value in entries]})


def read_runtime_string(blob: bytes, pointer: int, base_va: int = EXEFS_BASE_VA) -> str:
    offset = pointer - base_va
    if offset < 0 or offset >= len(blob):
        raise ValueError(f"Ponteiro {pointer:#x} fora do ExeFS com base {base_va:#x}")
    end = blob.find(b"\0", offset)
    if end < 0:
        raise ValueError(f"String em {offset:#x} sem terminador NUL")
    return blob[offset:end].decode("ascii", errors="replace")


def read_vtable(blob: bytes, file_offset: int, count: int) -> list[dict[str, int]]:
    end = file_offset + count * 4
    if file_offset < 0 or end > len(blob):
        raise ValueError(f"Vtable fora do ExeFS: {file_offset:#x} + {count} entradas")
    return [
        {"file_offset": file_offset + index * 4, "value": struct.unpack_from("<I", blob, file_offset + index * 4)[0]}
        for index in range(count)
    ]


def disassemble_pointer_loads(
    blob: bytes,
    base_va: int,
    target_addresses: set[int],
    code_end: int | None = None,
) -> list[dict[str, Any]]:
    try:
        from capstone import CS_ARCH_ARM, CS_MODE_ARM, Cs
        from capstone.arm import ARM_OP_IMM, ARM_OP_MEM, ARM_OP_REG, ARM_REG_PC
    except ImportError as exc:
        raise RuntimeError("Capstone é necessário para a busca de XREFs ARM") from exc

    end = min(code_end if code_end is not None else len(blob), len(blob))
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    disassembler.detail = True
    disassembler.skipdata = True
    references: list[dict[str, Any]] = []
    for instruction in disassembler.disasm(blob[:end], base_va):
        if instruction.mnemonic.startswith("ldr"):
            append_literal_load_reference(
                references, blob, base_va, instruction, target_addresses, ARM_OP_MEM, ARM_REG_PC
            )
        if instruction.mnemonic in ("add", "sub") and len(instruction.operands) >= 3:
            append_pc_arithmetic_reference(
                references, instruction, base_va, target_addresses, ARM_OP_REG, ARM_OP_IMM, ARM_REG_PC
            )
    return references


def append_literal_load_reference(
    references: list[dict[str, Any]],
    blob: bytes,
    base_va: int,
    instruction: Any,
    targets: set[int],
    memory_operand: int,
    pc_register: int,
) -> None:
    for operand in instruction.operands:
        if operand.type != memory_operand or operand.mem.base != pc_register:
            continue
        pool_va = instruction.address + 8 + operand.mem.disp
        pool_offset = pool_va - base_va
        if not 0 <= pool_offset <= len(blob) - 4:
            continue
        value = struct.unpack_from("<I", blob, pool_offset)[0]
        if pool_va not in targets and value not in targets:
            continue
        references.append(
            {
                "instruction_offset": instruction.address - base_va,
                "reference_kind": "arm-literal-load",
                "mnemonic": instruction.mnemonic,
                "operands": instruction.op_str,
                "pool_offset": pool_offset,
                "pool_va": pool_va,
                "value": value,
                "target_offset": value - base_va if value >= base_va else None,
            }
        )


def append_pc_arithmetic_reference(
    references: list[dict[str, Any]],
    instruction: Any,
    base_va: int,
    targets: set[int],
    register_operand: int,
    immediate_operand: int,
    pc_register: int,
) -> None:
    destination, source, immediate = instruction.operands[:3]
    if source.type != register_operand or source.reg != pc_register or immediate.type != immediate_operand:
        return
    pc = instruction.address + 8
    delta = abs(immediate.imm)
    target = pc + delta if instruction.mnemonic == "add" else pc - delta
    if target not in targets:
        return
    references.append(
        {
            "instruction_offset": instruction.address - base_va,
            "reference_kind": "arm-pc-arithmetic",
            "mnemonic": instruction.mnemonic,
            "operands": instruction.op_str,
            "pool_offset": None,
            "pool_va": None,
            "value": target,
            "target_offset": target - base_va,
        }
    )


def disassemble_range(blob: bytes, file_offset: int, size: int, base_va: int) -> list[str]:
    try:
        from capstone import CS_ARCH_ARM, CS_MODE_ARM, Cs
    except ImportError as exc:
        raise RuntimeError("Capstone é necessário para disassemblar métodos ARM") from exc
    if file_offset < 0 or file_offset >= len(blob):
        return []
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    disassembler.skipdata = True
    chunk = blob[file_offset : min(file_offset + size, len(blob))]
    return [
        f"{instruction.address - base_va:08x}: {instruction.mnemonic} {instruction.op_str}".rstrip()
        for instruction in disassembler.disasm(chunk, base_va + file_offset)
        if not instruction.mnemonic.startswith(".")
    ]


def pointer_references(blob: bytes, value: int) -> list[int]:
    needle = struct.pack("<I", value)
    offsets: list[int] = []
    start = 0
    while (offset := blob.find(needle, start)) >= 0:
        offsets.append(offset)
        start = offset + 1
    return offsets


def enclosing_c_string_offset(blob: bytes, offset: int) -> int:
    return blob.rfind(b"\0", 0, offset) + 1


def inspect_exefs(blob: bytes, base_va: int = EXEFS_BASE_VA) -> dict[str, Any]:
    path_offsets = {path: find_string_offsets(blob, path) for path in SHADER_PATHS}
    rom_paths = find_rom_path_literals(blob)
    path_addresses = {base_va + offsets[0] for offsets in rom_paths.values() if offsets}
    pointer_runs = find_pointer_table_runs(blob, path_addresses)
    required_addresses = {base_va + offsets[0] for offsets in path_offsets.values() if offsets}
    relevant_runs = [run for run in pointer_runs if required_addresses.issubset(run["values"])]
    shader_table_offset = relevant_runs[0]["file_offset"] if relevant_runs else SHADER_TABLE_OFFSET
    table_entries = []
    if shader_table_offset + 4 <= len(blob):
        for index in range(16):
            offset = shader_table_offset + index * 4
            if offset + 4 > len(blob):
                break
            pointer = struct.unpack_from("<I", blob, offset)[0]
            if pointer == 0:
                break
            table_entries.append(
                {
                    "file_offset": offset,
                    "pointer": pointer,
                    "path": read_runtime_string(blob, pointer, base_va),
                }
            )

    xref_targets = {base_va + shader_table_offset + offset for offset in range(0, 0x40, 4)}
    xref_targets.update(path_addresses)
    for vtable_offset, count in VTABLES.values():
        xref_targets.update(base_va + vtable_offset + index * 4 for index in range(count * 4))
    xrefs = disassemble_pointer_loads(blob, base_va, xref_targets)
    table_start = base_va + shader_table_offset
    table_end = table_start + len(table_entries) * 4
    adjacent_end = table_start + 0x40
    for reference in xrefs:
        target_va = reference["value"]
        reference["target_group"] = (
            "shader-path-table"
            if table_start <= target_va < table_end
            else "adjacent-table-storage"
            if table_start <= target_va < adjacent_end
            else "rom-path-literal"
            if target_va in path_addresses
            else "class-vtable-region"
            if base_va + 0x4DDE08 <= target_va < base_va + 0x4DE00C
            else "class-vtable-or-path"
        )

    vtables = {}
    for name, (offset, count) in VTABLES.items():
        entries = read_vtable(blob, offset, count)
        for entry in entries[1:]:
            method_offset = entry["value"] & ~1
            entry["disassembly"] = disassemble_range(blob, method_offset, 0x20, base_va)
        vtables[name] = {"file_offset": offset, "entries": entries}

    rtti = {
        term: [
            {
                "file_offset": offset,
                "string_start": enclosing_c_string_offset(blob, offset),
                "pointer_references": pointer_references(
                    blob, base_va + enclosing_c_string_offset(blob, offset)
                ),
            }
            for offset in find_substring_offsets(blob, term)
        ]
        for term in RTTI_TERMS
    }
    raw_address_references = {
        "shader_table_runtime_va": pointer_references(blob, base_va + shader_table_offset),
        "shader_path_runtime_va": {
            path: pointer_references(blob, base_va + offsets[0])
            for path, offsets in path_offsets.items()
            if offsets
        },
    }
    return {
        "sha256": hashlib.sha256(blob).hexdigest(),
        "size": len(blob),
        "base_va": base_va,
        "shader_path_offsets": path_offsets,
        "rom_path_literals": rom_paths,
        "raw_address_references": raw_address_references,
        "shader_pointer_table": {
            "file_offset": shader_table_offset,
            "entries": table_entries,
            "pointer_runs": pointer_runs,
        },
        "capstone_arm_literal_xrefs": xrefs,
        "capstone_scan": {
            "mode": "ARM",
            "bytes_scanned": len(blob),
            "skipdata": True,
            "candidate_count": len(xrefs),
            "shader_path_table_candidates": sum(
                reference["target_group"] == "shader-path-table" for reference in xrefs
            ),
            "shader_path_literal_candidates": sum(
                reference["target_group"] == "rom-path-literal" for reference in xrefs
            ),
        },
        "rtti_name_candidates": rtti,
        "vtables": vtables,
    }


def inspect_dll_field(blob: bytes, callback_size: int = 0x628) -> dict[str, Any]:
    try:
        from .cro_native_abi import CroImage
    except ImportError:
        from cro_native_abi import CroImage

    image = CroImage(blob)
    callback = PSEUDO_LIGHTING_LISTENER["callback_file_offset"]
    disassembly = disassemble_range(image.relocated(), callback, callback_size, 0)
    name_offsets = find_substring_offsets(blob, "PseudoLightingListener")
    names = [
        {
            "substring_offset": offset,
            "string_start": enclosing_c_string_offset(blob, offset),
        }
        for offset in name_offsets
    ]
    return {
        "sha256": hashlib.sha256(blob).hexdigest(),
        "size": len(blob),
        "segments": image.segments,
        "pseudo_lighting_listener": {
            "name_offsets": names,
            **PSEUDO_LIGHTING_LISTENER,
            "callback_disassembly": disassembly,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--code-bin", type=Path, required=True)
    parser.add_argument("--dll-field", type=Path)
    parser.add_argument("--base-va", type=lambda value: int(value, 0), default=EXEFS_BASE_VA)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = {"exefs": inspect_exefs(args.code_bin.read_bytes(), args.base_va)}
    if args.dll_field:
        report["dll_field"] = inspect_dll_field(args.dll_field.read_bytes())
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0


if __name__ == "__main__":
    sys.exit(main())
