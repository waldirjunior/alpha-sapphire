"""Capstone helpers for inspecting ARM audio wrappers and their callees."""

from __future__ import annotations

from typing import Any


def disassemble_arm_details(blob: bytes, file_offset: int, size: int, base_va: int = 0) -> list[dict[str, Any]]:
    try:
        from capstone import CS_ARCH_ARM, CS_MODE_ARM, Cs
    except ImportError as exc:
        raise RuntimeError("Capstone é necessário para disassemblar ARM") from exc
    if file_offset < 0 or file_offset >= len(blob):
        return []
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    disassembler.skipdata = True
    end = min(file_offset + size, len(blob))
    rows = []
    for instruction in disassembler.disasm(blob[file_offset:end], base_va + file_offset):
        rows.append({
            "address": instruction.address,
            "mnemonic": instruction.mnemonic,
            "operands": instruction.op_str,
            "text": f"{instruction.address:08x}: {instruction.mnemonic} {instruction.op_str}".rstrip(),
        })
    return rows


def disassemble_arm_range(blob: bytes, file_offset: int, size: int, base_va: int = 0) -> list[str]:
    return [row["text"] for row in disassemble_arm_details(blob, file_offset, size, base_va)]


def disassemble_arm_function(blob: bytes, file_offset: int, base_va: int, max_bytes: int = 0x240) -> list[dict[str, Any]]:
    rows = disassemble_arm_details(blob, file_offset, max_bytes, base_va)
    for index, row in enumerate(rows):
        if row["mnemonic"] == "bx" and row["operands"] == "lr":
            return rows[: index + 1]
        if row["mnemonic"].startswith("pop") and "pc" in row["operands"]:
            return rows[: index + 1]
    return rows


def direct_call_targets(rows: list[dict[str, Any]]) -> list[int]:
    targets = []
    for row in rows:
        if row["mnemonic"] not in {"bl", "blx"} or not row["operands"].startswith("#"):
            continue
        try:
            targets.append(int(row["operands"][1:], 0))
        except ValueError:
            continue
    return targets
