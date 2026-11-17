from __future__ import annotations

import argparse
import json
import os
import struct
import subprocess
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from unpack_garc import decompress_lz11


def package_sections(blob: bytes) -> list[bytes]:
    if len(blob) < 8 or blob[:2] not in (b'MM', b'PC', b'PT', b'PB', b'PK'):
        raise ValueError('Expected MM, PC, PT, PB or PK mini package')
    count = struct.unpack_from('<H', blob, 2)[0]
    header_end = 8 + count * 4
    if header_end > len(blob):
        raise ValueError('Mini package offset table exceeds file size')
    offsets = struct.unpack_from(f'<{count + 1}I', blob, 4)
    if offsets[0] < header_end or offsets[-1] > len(blob) or any(
        left > right for left, right in zip(offsets, offsets[1:])
    ):
        raise ValueError(f'Invalid mini package offsets: {offsets}')
    return [blob[left:right] for left, right in zip(offsets, offsets[1:])]


def motion_slots(blob: bytes) -> list[dict[str, int]]:
    if len(blob) < 8:
        raise ValueError('GF1 motion offset table requires at least 8 bytes')
    count = struct.unpack_from('<I', blob)[0]
    if count < 1 or 4 + count * 4 > len(blob):
        raise ValueError(f'GF1 motion offset count {count} exceeds pack size {len(blob)}')
    pointers = struct.unpack_from(f'<{count}I', blob, 4)
    if not 4 + count * 4 <= pointers[0] < len(blob):
        raise ValueError(f'Invalid GF1 skeleton offset {pointers[0]}')
    slots = []
    for index, offset in enumerate(pointers[1:]):
        if offset == 0:
            continue
        if offset < 4 + count * 4 or offset + 4 > len(blob):
            raise ValueError(f'Invalid GF1 motion {index} offset {offset}')
        octals, frames = struct.unpack_from('<HH', blob, offset)
        slots.append(dict(index=index, offset=offset, octals=octals, frames=frames))
    return slots


def read_garc_entry(path: Path, slot: int) -> bytes:
    with path.open('rb') as stream:
        header = stream.read(28)
        if header[:4] != b'CRAG':
            raise ValueError(f'Expected GARC CRAG: {path}')
        header_length = struct.unpack_from('<I', header, 4)[0]
        data_offset = struct.unpack_from('<I', header, 16)[0]
        stream.seek(header_length)
        fato_size = struct.unpack_from('<I', stream.read(12), 4)[0]
        stream.seek(header_length + fato_size)
        count = struct.unpack_from('<I', stream.read(12), 8)[0]
        if not 0 <= slot < count:
            raise ValueError(f'GARC slot {slot} outside 0..{count - 1}')
        for index in range(slot + 1):
            mask = struct.unpack('<I', stream.read(4))[0]
            records = stream.read(mask.bit_count() * 12)
            if index != slot:
                continue
            if mask.bit_count() != 1:
                raise ValueError(f'GARC slot {slot} requires one subfile, got mask {mask:#x}')
            start, _, length = struct.unpack_from('<III', records)
        stream.seek(data_offset + start)
        blob = stream.read(length)
    return decompress_lz11(blob) if blob[:1] == b'\x11' else blob


def write_export_project(temp: Path, spica_dll: Path) -> None:
    assembly = escape(str(spica_dll.resolve()))
    source = escape(str(Path(__file__).with_name('export_native_motion.cs').resolve()))
    (temp / 'Export.csproj').write_text(
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
        '<OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework>'
        '<ImplicitUsings>enable</ImplicitUsings></PropertyGroup><ItemGroup>'
        f'<Reference Include="SPICA"><HintPath>{assembly}</HintPath></Reference>'
        f'<Compile Include="{source}" /></ItemGroup></Project>', encoding='utf-8')


def export_clip(args: argparse.Namespace, model: bytes, motion: bytes) -> None:
    if args.spica_dll is None or args.blender is None:
        raise ValueError('--output requires --spica-dll and --blender')
    if args.clip is None:
        raise ValueError('--output requires a sparse --clip index from --list')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='oras-motion-') as directory:
        temp = Path(directory)
        (temp / 'model.bin').write_bytes(model)
        (temp / 'motion.bin').write_bytes(motion)
        write_export_project(temp, args.spica_dll)
        subprocess.run([
            str(args.dotnet), 'run', '--project', str(temp / 'Export.csproj'), '--',
            str(temp / 'model.bin'), str(temp / 'motion.bin'), str(args.clip),
            str(temp / 'clip.dae'),
        ], check=True, env={**os.environ, 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'})
        subprocess.run([
            str(args.blender), '--background', '--python-exit-code', '1', '--python',
            str(Path(__file__).with_name('native_motion_blender.py')), '--',
            str(temp / 'clip.dae'), str(args.output.resolve()), f'motion_{args.clip}',
        ], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description='Inspect GF1 motions and export one native skeletal clip to GLB.')
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--garc-slot', type=int)
    parser.add_argument('--model', type=Path)
    parser.add_argument('--model-slot', type=int)
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--clip', type=int)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--spica-dll', type=Path)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--blender', type=Path)
    args = parser.parse_args()
    if not args.list and args.output is None:
        parser.error('Select --list or --output')
    blob = read_garc_entry(args.input, args.garc_slot) if args.garc_slot is not None else args.input.read_bytes()
    if blob[:2] not in (b'MM', b'PB', b'PK'):
        raise ValueError(f'Expected MM, PB or PK motion input, got {blob[:4]!r}')
    sections = package_sections(blob)
    section_index = 1 if blob[:2] == b'MM' else 0
    if len(sections) <= section_index:
        raise ValueError(f'Package {args.input} has no motion section {section_index}')
    motion = sections[section_index]
    slots = motion_slots(motion)
    if args.list:
        print(json.dumps(slots, indent=2))
    if args.output is None:
        return
    if args.output.suffix != '.glb':
        raise ValueError(f'Expected .glb output, got {args.output}')
    if args.clip not in [slot['index'] for slot in slots]:
        raise ValueError(f'Clip {args.clip} is absent; select an index from --list')
    model = blob
    if args.model is not None:
        model = read_garc_entry(args.model, args.model_slot) if args.model_slot is not None else args.model.read_bytes()
    if model[:2] not in (b'MM', b'PC'):
        raise ValueError('PB/PK motion export requires --model with MM/PC model package')
    export_clip(args, model, motion)


if __name__ == '__main__':
    main()
