"""Completa fixtures reais de abertura com dados iniciais AMX e inventário de nativas."""

import argparse
import json
from pathlib import Path

from .extract_zone_scripts import parse_zone_scripts
from .amx_global_scripts import parse_global_scripts

ZONES = (6, 23, 223, 224, 225, 226, 227)
GLOBALS = (15, 47, 57, 69, 78)
NORMALIZED = {'CommandNOP', 'MdlSetGPos', 'MdlSetDirDisp', 'MdlSetVisible', 'TalkMdlMsg_Seq',
              'MsgWinAllClose', '_ABKeyWait', '_Suspend', 'WarpSetID'}


def memory_image(program: dict, expected_sha256: str) -> dict:
    if program['sha256'] != expected_sha256:
        raise ValueError('SHA-256 da memória difere do disassembly versionado')
    return {'sha256': program['sha256'], 'data': program['dataCells'],
            'stackTop': program['header']['stp'] - program['header']['dat']}


def native_inventory(program: dict) -> list[dict]:
    names = {}
    for instruction in program['instructions']:
        if 'native' not in instruction:
            continue
        name = instruction['native']['name']
        entry = names.setdefault(name, {'name': name, 'hash': instruction['native']['hash'],
                                       'arity': instruction['argumentBytes'] // 4, 'offsets': []})
        if entry['arity'] != instruction['argumentBytes'] // 4:
            raise ValueError(f'aridades diferentes para {name}')
        entry['offsets'].append(instruction['offset'])
    return [names[name] for name in sorted(names)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom-root', type=Path, required=True)
    args = parser.parse_args()
    out = Path('src/data/zone_scripts')
    images, inventory = {}, {}
    for zone in ZONES:
        raw = (args.rom_root / f'garc/a_0_1_3/{zone:04d}.bin').read_bytes()
        parsed = parse_zone_scripts(raw)
        decoded = json.loads((out / f'{zone:04d}.json').read_text())['programs']
        for name, program in parsed.items():
            key = f'zone:{zone:04d}:{name}'
            images[key] = memory_image(program, decoded[name]['sha256'])
            inventory[key] = native_inventory(decoded[name])
    globals_parsed = parse_global_scripts((args.rom_root / 'RomFS/a/0/2/9').read_bytes())
    for index in GLOBALS:
        key = f'global:{index:04d}'
        decoded = json.loads((out / f'global_{index:04d}.json').read_text())
        images[key] = memory_image(globals_parsed[key], decoded['sha256'])
        inventory[key] = native_inventory(decoded)
    document = {'images': images, 'inventory': inventory, 'normalizedNativeNames': sorted(NORMALIZED),
                'additionalDirectNatives': sorted({entry['name'] for key, entries in inventory.items()
                    if key.startswith(('zone:0006:', 'zone:0223:', 'zone:0225:', 'zone:0227:'))
                    for entry in entries} - NORMALIZED)}
    (out / 'opening-memory.json').write_text(json.dumps(document, indent=1) + '\n', encoding='utf-8')
    print(f'{len(images)} imagens AMX, {len(document["additionalDirectNatives"])} nativas diretas adicionais')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
