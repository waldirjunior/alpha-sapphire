import argparse
import json
from pathlib import Path

from scripts.amx_global_scripts import parse_global_scripts
from scripts.extract_opening_memory import memory_image
from scripts.extract_zone_scripts import parse_zone_scripts


def asset_manifest(images):
    return {'images': {key: {'sha256': image['sha256'], 'file': key.replace(':', '_') + '.json'}
                       for key, image in sorted(images.items())}}


def selected_images(root, zones, globals_selected, programs):
    images = {}
    for zone in sorted(set(zones)):
        parsed = parse_zone_scripts((root / f'garc/a_0_1_3/{zone:04}.bin').read_bytes())
        decoded = json.loads((programs / f'{zone:04}.json').read_text())['programs']
        for name, program in parsed.items():
            images[f'zone:{zone:04}:{name}'] = memory_image(program, decoded[name]['sha256'])
    if globals_selected:
        parsed = parse_global_scripts((root / 'RomFS/a/0/2/9').read_bytes())
        for index in sorted(set(globals_selected)):
            key = f'global:{index:04}'
            decoded = json.loads((programs / f'global_{index:04}.json').read_text())
            images[key] = memory_image(parsed[key], decoded['sha256'])
    return images


def main():
    parser = argparse.ArgumentParser(description='Extrai imagens AMX locais adicionais, conferindo SHA do disassembly')
    parser.add_argument('--rom-root', type=Path, required=True)
    parser.add_argument('--zone', type=int, action='append', default=[])
    parser.add_argument('--global-script', type=int, action='append', default=[])
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    if not args.zone and not args.global_script:
        parser.error('selecione --zone ou --global-script')
    images = selected_images(args.rom_root, args.zone, args.global_script, Path('src/data/zone_scripts'))
    manifest = asset_manifest(images)
    args.out.mkdir(parents=True, exist_ok=True)
    for key, image in images.items():
        (args.out / manifest['images'][key]['file']).write_text(json.dumps(image, separators=(',', ':')) + '\n')
    args.manifest.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(images)} imagens AMX locais; manifesto contém apenas nomes/SHA, sem memória proprietária')


if __name__ == '__main__':
    main()
