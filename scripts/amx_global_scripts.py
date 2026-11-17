"""Leitura em memória do GARC de scripts globais ORAS a/0/2/9."""

import struct

from .extract_zone_scripts import parse_amx


def parse_global_scripts(raw: bytes) -> dict[str, dict]:
    if len(raw) < 40 or raw[:4] != b'CRAG':
        raise ValueError('GARC global: esperado cabeçalho CRAG completo')
    header_size, = struct.unpack_from('<I', raw, 4)
    data_offset, = struct.unpack_from('<I', raw, 16)
    if header_size + 12 > len(raw) or raw[header_size:header_size + 4] != b'OTAF':
        raise ValueError('GARC global: FATO inválida')
    fato_size, = struct.unpack_from('<I', raw, header_size + 4)
    fatb = header_size + fato_size
    if fatb + 12 > len(raw) or raw[fatb:fatb + 4] != b'BTAF':
        raise ValueError('GARC global: FATB inválida')
    count, = struct.unpack_from('<I', raw, fatb + 8)
    position = fatb + 12
    programs = {}
    for index in range(count):
        if position + 16 > data_offset or position + 16 > len(raw):
            raise ValueError('GARC global: FATB truncada')
        mask, start, end, length = struct.unpack_from('<4I', raw, position)
        if mask != 1 or start > end or length > end - start or data_offset + end > len(raw):
            raise ValueError(f'GARC global: entrada {index} inválida; esperado um AMX por entrada')
        programs[f'global:{index:04d}'] = parse_amx(raw[data_offset + start:data_offset + start + length])
        position += 16
    return programs
