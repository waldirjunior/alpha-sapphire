"""Static code references for PICA shaders and pseudo-light listeners."""

from __future__ import annotations

import struct
from typing import Any

try:
    from .cro_native_abi import CroImage
    from .inspect_pica_lightset import (
        EXEFS_BASE_VA,
        disassemble_pointer_loads,
        disassemble_range,
        find_substring_offsets,
        inspect_dll_field,
        inspect_exefs,
        pointer_references,
        read_vtable,
    )
except ImportError:
    from cro_native_abi import CroImage
    from inspect_pica_lightset import (
        EXEFS_BASE_VA,
        disassemble_pointer_loads,
        disassemble_range,
        find_substring_offsets,
        inspect_dll_field,
        inspect_exefs,
        pointer_references,
        read_vtable,
    )


CODEBIN_STATIC_SCAN_END = 0x4C0000
CLASS_TERMS = (
    "H3dLightSet", "LightSet", "H3dModel", "H3dResShader", "H3dEnvironment",
    "SceneSystem", "H3dMaterial", "Material",
)


def scan_thumb_literal_loads(blob: bytes, base_va: int, targets: set[int]) -> list[dict[str, Any]]:
    references = []
    for offset in range(0, len(blob) - 1, 2):
        instruction = struct.unpack_from("<H", blob, offset)[0]
        if instruction & 0xF800 != 0x4800:
            continue
        address = base_va + offset
        pool_va = ((address + 4) & ~3) + ((instruction & 0xFF) * 4)
        pool_offset = pool_va - base_va
        if not 0 <= pool_offset <= len(blob) - 4:
            continue
        value = struct.unpack_from("<I", blob, pool_offset)[0]
        if pool_va not in targets and value not in targets:
            continue
        references.append({"instruction_offset": offset, "reference_kind": "thumb-literal-load",
                           "instruction": instruction, "pool_offset": pool_offset,
                           "pool_va": pool_va, "value": value})
    return references


def direct_callers(blob: bytes, targets: set[int], base_va: int,
                   start: int = 0, end: int | None = None) -> dict[int, list[dict[str, Any]]]:
    try:
        from capstone import CS_ARCH_ARM, CS_MODE_ARM, CS_MODE_THUMB, Cs
    except ImportError as exc:
        raise RuntimeError("Capstone é necessário para rastrear callers ARM/Thumb") from exc
    limit = min(end if end is not None else len(blob), len(blob))
    callers = {target: [] for target in targets}
    for mode, decoder_mode in (("ARM", CS_MODE_ARM), ("Thumb", CS_MODE_THUMB)):
        decoder = Cs(CS_ARCH_ARM, decoder_mode)
        for instruction in decoder.disasm(blob[start:limit], base_va + start):
            append_direct_call(callers, targets, instruction, base_va, mode)
    return callers


def append_direct_call(callers: dict[int, list[dict[str, Any]]], targets: set[int],
                       instruction: Any, base_va: int, mode: str) -> None:
    if instruction.mnemonic not in ("bl", "blx") or not instruction.op_str.startswith("#"):
        return
    try:
        target = int(instruction.op_str[1:], 0)
    except ValueError:
        return
    if target not in targets:
        return
    callers[target].append({"address": instruction.address - base_va,
                            "mode": mode, "mnemonic": instruction.mnemonic,
                            "operands": instruction.op_str})


def class_vtable_groups(blob: bytes, base_va: int = EXEFS_BASE_VA) -> list[dict[str, Any]]:
    rows = []
    strings = set()
    for term in CLASS_TERMS:
        for offset in find_substring_offsets(blob, term):
            start = blob.rfind(b"\0", 0, offset) + 1
            end = blob.find(b"\0", offset)
            if end >= 0:
                name = blob[start:end].decode("ascii", errors="replace")
                if name.startswith("N") and name not in strings:
                    strings.add(name)
                    rows.append((name, start))
    result = []
    for name, string_offset in sorted(rows):
        name_va = base_va + string_offset
        for name_pointer in pointer_references(blob, name_va):
            typeinfo_offset = name_pointer - 4
            typeinfo_va = base_va + typeinfo_offset
            for vtable_offset in pointer_references(blob, typeinfo_va):
                entries = read_vtable(blob, vtable_offset, 25)
                methods = []
                for entry in entries[1:]:
                    target = entry["value"] & ~1
                    if entry["value"] == 0 or target >= len(blob):
                        break
                    methods.append({"file_offset": entry["file_offset"], "value": entry["value"],
                                    "code_file_offset": target})
                if methods:
                    result.append({"class_rtti": name, "class_name_offset": string_offset,
                                   "typeinfo_file_offset": typeinfo_offset,
                                   "vtable_typeinfo_pointer_offset": vtable_offset,
                                   "method_entries": methods})
    return result


def inspect_codebin(blob: bytes, base_va: int = EXEFS_BASE_VA) -> dict[str, Any]:
    report = inspect_exefs(blob, base_va)
    table_offset = report["shader_pointer_table"]["file_offset"]
    table_targets = {base_va + table_offset + offset for offset in range(0, 0x40, 4)}
    table_targets.update(base_va + offsets[0] for offsets in report["shader_path_offsets"].values() if offsets)
    thumb_xrefs = scan_thumb_literal_loads(blob, base_va, table_targets)
    thumb_table = [row for row in thumb_xrefs if base_va + table_offset <= row["value"] < base_va + table_offset + 0x40]
    methods = class_vtable_groups(blob, base_va)
    method_targets = {base_va + method["code_file_offset"] for group in methods
                      for method in group["method_entries"]}
    method_callers = direct_callers(blob, method_targets, base_va, end=CODEBIN_STATIC_SCAN_END)
    caller_report = {f"{target:#x}": rows for target, rows in method_callers.items() if rows}
    report["additional_static_scan"] = {
        "function_4ddf40": disassemble_range(blob, 0x4DDF40 - base_va, 0xA0, base_va),
        "function_4ddf40_direct_callers": direct_callers(
            blob, {0x4DDF40}, base_va, end=CODEBIN_STATIC_SCAN_END
        )[0x4DDF40],
        "class_vtable_groups": methods,
        "class_method_direct_callers": caller_report,
        "light_set_index_string_offsets": find_substring_offsets(blob, "LightSetIndex"),
        "h3d_material_string_offsets": find_substring_offsets(blob, "H3dMaterial"),
        "thumb_literal_xrefs": thumb_xrefs,
        "thumb_shader_table_candidates": thumb_table,
    }
    return report


def inspect_lighting_callback(blob: bytes) -> dict[str, Any]:
    image = CroImage(blob)
    existing = inspect_dll_field(blob)
    callback = 0x2EE38
    vtable = 0x1077E8
    callback_refs = [{"patch_address": address, "target_address": target}
                     for address, target in image.references.items() if target == callback]
    vtable_refs = [{"patch_address": address, "target_address": target}
                   for address, target in image.references.items() if vtable - 0x10 <= target < vtable + 0x40]
    callback_disassembly = existing["pseudo_lighting_listener"]["callback_disassembly"]
    indirect_calls = [line for line in callback_disassembly if ": blx " in line]
    code_start, code_size, _ = image.segments[0]
    calls = direct_callers(image.relocated(), {callback, 0x2F460}, 0,
                           start=code_start, end=code_start + code_size)
    literal_loads = disassemble_pointer_loads(image.relocated(), 0, {0x1077EC})
    vtable_entries = [
        {"file_offset": offset, "value": struct.unpack_from("<I", image.relocated(), offset)[0]}
        for offset in range(vtable, vtable + 0x14, 4)
    ]
    return {
        "sha256": existing["sha256"],
        "size": existing["size"],
        "segments": existing["segments"],
        "pseudo_lighting_listener": existing["pseudo_lighting_listener"],
        "listener_constructor_candidate": {
            "file_offset": 0x2F460,
            "instructions": disassemble_range(image.relocated(), 0x2F460, 0x20, 0),
        },
        "vtable_entries": vtable_entries,
        "callback_pointer_relocations": callback_refs,
        "vtable_pointer_relocations": vtable_refs,
        "callback_or_constructor_direct_callers": {
            f"{target:#x}": rows for target, rows in calls.items() if rows
        },
        "vtable_literal_pointer_loads": literal_loads,
        "indirect_call_instructions": indirect_calls,
    }
