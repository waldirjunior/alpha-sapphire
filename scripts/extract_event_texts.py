import argparse
import hashlib
import json
from pathlib import Path

from scripts.cro_native_abi import CroImage
from scripts.extract_texts import decode_gen6_text


def event_text_manifest(cro):
    image = CroImage(cro)
    return {'schemaVersion': 1, 'croSha256': hashlib.sha256(cro).hexdigest(),
            'messageFiles': image.message_files(),
            'natives': {name: dict(zip(('table', 'wrapper'), image.native(name))) for name in
                        ('BuildMdlGetHandleByGPos', 'MsgLoad', 'MsgSwap', 'MsgIsLoaded', 'MsgRelease', '_MapChangeCore')}}


def main():
    parser = argparse.ArgumentParser(description='Extrai bancos StoryText auxiliares pelos seletores reais de MsgLoad')
    parser.add_argument('--cro', type=Path, required=True)
    parser.add_argument('--story-root', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    args = parser.parse_args()
    manifest = event_text_manifest(args.cro.read_bytes())
    banks = {file: decode_gen6_text((args.story_root / f'{file:04}.bin').read_bytes())
             for file in sorted(set(manifest['messageFiles']) - {None})}
    args.out.mkdir(parents=True, exist_ok=True)
    for file, lines in banks.items():
        (args.out / f'{file:04}.json').write_text(json.dumps(lines, ensure_ascii=False, indent=1) + '\n')
    args.manifest.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(banks)} bancos StoryText auxiliares; SHA CRO {manifest["croSha256"]}')


if __name__ == '__main__':
    main()
