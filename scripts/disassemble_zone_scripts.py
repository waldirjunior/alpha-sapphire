#!/usr/bin/env python3
"""Gera disassembly AMX e vínculos de entidades: python3 -m scripts.disassemble_zone_scripts."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from .amx_disassembly import disassemble
from .amx_global_scripts import parse_global_scripts
from .amx_native_names import resolve_native_names
from .amx_opcodes import NAMES, OPERAND_COUNTS
from .extract_zone_scripts import parse_zone_scripts
from .zone_script_bindings import bind_entities, find_dispatch, validate_entity_scripts
from .zone_script_entities import parse_zone_entities, warp_bindings


SLICE_ZONES = (6, 7, 23, *range(223, 232))


def load_zone(zone_id: int, zones: Path, zone_data: Path) -> dict:
    if not 0 <= zone_id < 536:
        raise ValueError(f'Zona inválida {zone_id}: esperado 0–535')
    path = zones / f'{zone_id:04d}.bin'
    matches = sorted(zone_data.glob(f'{zone_id:03d}_*.json'))
    if len(matches) != 1:
        raise ValueError(f'Zona {zone_id}: esperado um JSON em {zone_data}; encontrados {len(matches)}')
    raw = path.read_bytes()
    programs = parse_zone_scripts(raw)
    entities_raw = matches[0].read_bytes()
    entities = json.loads(entities_raw)
    if entities['zone'] != zone_id:
        raise ValueError(f'Zona {zone_id}: JSON identifica zona {entities["zone"]}')
    validate_entity_scripts(raw, entities)
    return {'zoneId': zone_id, 'zoneName': entities['name'], 'entitySource': matches[0].name,
            'entitySourceSha256': hashlib.sha256(entities_raw).hexdigest(),
            'programs': programs, 'entities': parse_zone_entities(raw)}


def decode_program(program: dict, names: dict) -> dict:
    instructions = disassemble(program['codeCells'], program['tables']['natives'], names)
    decoded = {'header': program['header'], 'tables': program['tables'], 'instructions': instructions}
    dispatch = find_dispatch(decoded)
    return {'sha256': program['sha256'], 'entryPoint': program['header']['cip'],
            'dataByteLength': len(program['dataCells']) * 4,
            'functions': [row['offset'] for row in instructions if row['opcode'] == 46],
            'nativeHashes': [f'{row["identifier"]:08x}' for row in program['tables']['natives']],
            'dispatch': dispatch, 'instructions': instructions}


def select_globals(zones: list[dict], global_programs: dict) -> dict:
    unresolved = set()
    for zone in zones:
        dispatches = {name: decode_program(program, {})['dispatch'] for name, program in zone['programs'].items()}
        unresolved.update(row['scriptId'] for row in bind_entities(zone['entities'], dispatches)
                          if row['status'] == 'unresolved')
    selected = {}
    for name, program in global_programs.items():
        dispatch = decode_program(program, {})['dispatch']
        if dispatch and any(case['value'] in unresolved for case in dispatch['cases']):
            selected[name] = program
    return selected


def decode_zone(zone: dict, names: dict, globals_decoded: dict | None = None) -> dict:
    programs = {name: decode_program(program, names) for name, program in zone['programs'].items()}
    dispatches = {name: program['dispatch'] for name, program in {**programs, **(globals_decoded or {})}.items()}
    return {'zoneId': zone['zoneId'], 'zoneName': zone['zoneName'],
            'entitySource': zone['entitySource'], 'entitySourceSha256': zone['entitySourceSha256'],
            'bindings': bind_entities(zone['entities'], dispatches),
            'warpBindings': warp_bindings(zone['entities']), 'bindingSource': 'ZO-sec1', 'programs': programs}


def global_bindings(name: str, zones: list[dict]) -> list[dict]:
    return [{'zoneId': zone['zoneId'], 'kind': binding['kind'], 'index': binding['index'],
             'entityId': binding['entityId'], 'scriptId': binding['scriptId'],
             'status': binding['status'], 'target': match['target'], 'functions': match['functions']}
            for zone in zones for binding in zone['bindings'] for match in binding['matches']
            if match['program'] == name]


def write_json(path: Path, document: dict) -> None:
    path.write_text(json.dumps(document, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def write_catalogs(out: Path, programs: list[dict], identifiers: set[int], names: dict) -> None:
    natives = [{'hash': f'{identifier:08x}', **names.get(identifier, {'name': None, 'evidence': 'unresolved'})}
               for identifier in sorted(identifiers)]
    write_json(out / 'native-catalog.json', {'hashAlgorithm': 'h=((h*131)^byte)&0xffffffff', 'natives': natives})
    counts = Counter(row['opcode'] for program in programs for row in program['instructions'])
    opcodes = [{'opcode': opcode, 'hex': f'{opcode:02x}', 'mnemonic': NAMES[opcode],
                'trailingCells': 'variable' if opcode == 130 else OPERAND_COUNTS.get(opcode, 0),
                'packed': 162 <= opcode <= 212, 'occurrences': count}
               for opcode, count in sorted(counts.items())]
    write_json(out / 'opcode-catalog.json', {'version': 'Pawn/AMX 10, 32-bit', 'opcodes': opcodes})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zones', type=Path, required=True)
    parser.add_argument('--zone-data', type=Path, required=True)
    parser.add_argument('--romfs', type=Path, required=True)
    parser.add_argument('--out', type=Path, default=Path('src/data/zone_scripts'))
    parser.add_argument('--zone-ids', type=int, nargs='+', default=SLICE_ZONES)
    parser.add_argument('--all', action='store_true')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    zone_ids = range(536) if args.all else sorted(set(args.zone_ids))
    zones = [load_zone(zone_id, args.zones, args.zone_data) for zone_id in zone_ids]
    globals_raw = parse_global_scripts((args.romfs / 'a/0/2/9').read_bytes())
    if not args.all:
        globals_raw = select_globals(zones, globals_raw)
    raw_programs = [program for zone in zones for program in zone['programs'].values()] + list(globals_raw.values())
    identifiers = {row['identifier'] for program in raw_programs for row in program['tables']['natives']}
    source_paths = [*sorted(args.romfs.glob('*.cro')), args.romfs.parent / 'ExeFS/code.bin']
    names = resolve_native_names(identifiers, ((path.name, path.read_bytes()) for path in source_paths))
    globals_decoded = {name: decode_program(program, names) for name, program in globals_raw.items()}
    decoded = [decode_zone(zone, names, globals_decoded) for zone in zones]
    args.out.mkdir(parents=True, exist_ok=True)
    for zone in decoded:
        write_json(args.out / f'{zone["zoneId"]:04d}.json', zone)
    for name, program in globals_decoded.items():
        write_json(args.out / f'{name.replace(":", "_")}.json',
                   {**program, 'bindingSource': 'ZO-sec1', 'bindings': global_bindings(name, decoded)})
    programs = [program for zone in decoded for program in zone['programs'].values()] + list(globals_decoded.values())
    write_catalogs(args.out, programs, identifiers, names)
    print(f'{len(decoded)} zonas + {len(globals_decoded)} globais; {len(names)}/{len(identifiers)} hashes nativos resolvidos')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
