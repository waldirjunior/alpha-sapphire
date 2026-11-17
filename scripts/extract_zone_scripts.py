#!/usr/bin/env python3
"""Extrai o envelope AMX v10 de ZO sem interpretar chamadas nativas (A-010)."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path


HEADER_FIELDS = ('cod', 'dat', 'hea', 'stp', 'cip', 'publics', 'natives',
                 'libraries', 'pubvars', 'tags', 'nametable', 'overlays')
TABLE_NAMES = ('publics', 'natives', 'libraries', 'pubvars', 'tags')


def decode_compact_cells(payload: bytes, count: int) -> list[int]:
    cells = []
    value = groups = 0
    for byte in payload:
        if len(cells) == count:
            raise ValueError('AMX: bytes excedentes após as células esperadas')
        part = byte & 0x7F
        value = (part - 128 if part & 64 else part) if groups == 0 else (value << 7) | part
        groups += 1
        if groups > 5:
            raise ValueError('AMX: célula compactada excede 32 bits')
        if byte & 0x80:
            continue
        cells.append(value & 0xFFFFFFFF)
        value = groups = 0
    if groups or len(cells) != count:
        raise ValueError(f'AMX: payload truncado; esperado {count}, lido {len(cells)}')
    return cells


def validate_header(raw: bytes) -> dict[str, int]:
    if len(raw) < 60:
        raise ValueError(f'AMX: cabeçalho truncado ({len(raw)} bytes; esperado >= 60)')
    size, magic, file_version, vm_version, flags, defsize = struct.unpack_from('<IHBBHH', raw)
    if (magic, file_version, vm_version, flags, defsize) != (0xF1E0, 10, 10, 28, 8):
        raise ValueError('AMX: esperado magic F1E0, versões 10/10, flags 001C e defsize 8')
    header = dict(zip(HEADER_FIELDS, struct.unpack_from('<12I', raw, 12)))
    cod, dat, hea, stp = (header[name] for name in ('cod', 'dat', 'hea', 'stp'))
    if not 60 <= cod <= size <= len(raw) or not cod <= dat <= hea <= stp:
        raise ValueError('AMX: limites inválidos de arquivo/código/dados/heap/stack')
    if any(value % 4 for value in (cod, dat, hea, stp)):
        raise ValueError('AMX: offsets descompactados devem ser alinhados em 4 bytes')
    offsets = [header[name] for name in (*TABLE_NAMES, 'nametable', 'overlays')]
    if offsets[0] != 60 or offsets != sorted(offsets) or offsets[-1] > cod:
        raise ValueError('AMX: limites inválidos das tabelas de definições')
    if any((end - start) % 8 for start, end in zip(offsets[:5], offsets[1:6])):
        raise ValueError('AMX: tabelas de definições devem conter registros de 8 bytes')
    if len(raw) - size > 3 or any(raw[size:]):
        raise ValueError('AMX: padding esperado de 0 a 3 bytes zero')
    return {'size': size, 'magic': magic, 'fileVersion': file_version,
            'vmVersion': vm_version, 'flags': flags, 'defsize': defsize, **header}


def parse_amx(raw: bytes) -> dict:
    header = validate_header(raw)
    size, cod, dat, hea = (header[name] for name in ('size', 'cod', 'dat', 'hea'))
    cells = decode_compact_cells(raw[cod:size], (hea - cod) // 4)
    tables = {}
    for name, following in zip(TABLE_NAMES, (*TABLE_NAMES[1:], 'nametable')):
        tables[name] = [
            {'address': address, 'identifier': identifier}
            for address, identifier in struct.iter_unpack('<II', raw[header[name]:header[following]])
        ]
    return {'header': header, 'sha256': hashlib.sha256(raw[:size]).hexdigest(),
            'tables': tables, 'metadataHex': raw[header['nametable']:cod].hex(),
            'codeCells': cells[:(dat - cod) // 4], 'dataCells': cells[(dat - cod) // 4:]}


def parse_zone_scripts(raw: bytes) -> dict:
    if len(raw) < 28 or raw[:4] != b'ZO\x05\x00':
        raise ValueError('ZO: esperado container com 5 seções e tabela de 6 offsets')
    offsets = struct.unpack_from('<6I', raw, 4)
    if offsets[0] != 28 or list(offsets) != sorted(offsets) or offsets[-1] != len(raw):
        raise ValueError('ZO: offsets de seção inválidos')
    entities = raw[offsets[1]:offsets[2]]
    if len(entities) < 12:
        raise ValueError('ZO: cabeçalho de entidades truncado')
    length, furniture, npcs, warps, triggers1, triggers2 = struct.unpack_from('<IBBBBI', entities)
    start = 12 + furniture * 20 + npcs * 48 + (warps + triggers1 + triggers2) * 24
    if start != length + 4 or start + 60 > len(entities):
        raise ValueError('ZO: contagens de entidades inconsistentes com o início do AMX')
    return {'entities': parse_amx(entities[start:]),
            'map': parse_amx(raw[offsets[2]:offsets[3]])}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zones', required=True, type=Path, help='Diretório a_0_1_3 desempacotado')
    parser.add_argument('--out', type=Path, default=Path('src/data/zones_scripts'))
    args = parser.parse_args()
    paths = sorted(args.zones.glob('[0-9][0-9][0-9][0-9].bin'))
    paths = [path for path in paths if int(path.stem) < 536]
    if not paths:
        parser.error(f'Nenhuma zona ZO encontrada em {args.zones}')
    args.out.mkdir(parents=True, exist_ok=True)
    for path in paths:
        try:
            result = {'zoneId': int(path.stem), **parse_zone_scripts(path.read_bytes())}
        except ValueError as error:
            raise ValueError(f'{path}: {error}') from error
        (args.out / f'{path.stem}.json').write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Extraídas {len(paths)} zonas ({len(paths) * 2} programas AMX) em {args.out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
