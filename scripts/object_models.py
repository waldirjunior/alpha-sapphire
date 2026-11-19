"""Resolve field object actor IDs and model sections from the BM archive."""

from __future__ import annotations

import struct

BM_MODEL_COUNT = 380


def bm_model_index(model_id: int) -> int | None:
    """Return the a/0/2/3 entry for an object actor ID, if it is in the BM bank."""
    if type(model_id) is not int or not 0 <= model_id <= 0xFFFF:
        return None
    bank = model_id & 0xF000
    index = model_id & 0x0FFF
    return index if bank in (0x1000, 0x2000) and index < BM_MODEL_COUNT else None


def extract_bm_model_section(blob: bytes) -> bytes:
    """Extract the first BCH section, which contains the actor model."""
    if len(blob) < 4 or blob[:2] != b"BM":
        raise ValueError("Esperado arquivo BM com cabeçalho BM e tabela de seções")
    section_count = struct.unpack_from("<H", blob, 2)[0]
    table_end = 4 + section_count * 4
    if section_count < 1 or table_end > len(blob):
        raise ValueError(f"BM inválido: quantidade de seções {section_count} não cabe no arquivo")
    offsets = list(struct.unpack_from(f"<{section_count}I", blob, 4))
    if offsets[0] < table_end or any(offset >= len(blob) for offset in offsets):
        raise ValueError("BM inválido: offsets de seção fora dos limites do arquivo")
    if any(left >= right for left, right in zip(offsets, offsets[1:])):
        raise ValueError("BM inválido: offsets de seção não estão em ordem crescente")
    section = blob[offsets[0] : offsets[1] if len(offsets) > 1 else len(blob)]
    if not section.startswith(b"BCH\0"):
        raise ValueError("BM inválido: primeira seção deveria conter um modelo BCH")
    return section
