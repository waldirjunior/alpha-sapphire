from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

from native_motions import package_sections


def inspect_faces(root: Path, catalog: dict, spica: Path, dotnet: Path) -> list[dict]:
    models = [model for model in catalog['models'] if model['id'].startswith('character/')]
    sources = [root / f"rom/extracted/garc/a_0_2_1/{model['id'][-4:]}.bin" for model in models]
    for source in sources:
        sections = package_sections(source.read_bytes())
        if not sections[0].startswith(b'BCH\0'):
            raise ValueError(f'Character model {source}: expected BCH model section')
    with tempfile.TemporaryDirectory(prefix='oras-face-') as directory:
        project = Path(directory) / 'Inspect.csproj'
        source = Path(__file__).with_suffix('.cs').resolve()
        project.write_text(
            '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType>'
            '<TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings>'
            '<NoWarn>CA1416</NoWarn></PropertyGroup><ItemGroup>'
            f'<Reference Include="SPICA"><HintPath>{escape(str(spica))}</HintPath></Reference>'
            f'<Compile Include="{escape(str(source))}" /></ItemGroup></Project>')
        result = subprocess.run([str(dotnet), 'run', '--project', str(project), '--',
                                 *map(str, sources)], check=True, capture_output=True, text=True)
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    if len(rows) != len(models):
        raise ValueError(f'Expected {len(models)} face records, got {len(rows)}')
    return [{**row, 'id': model['id'],
             'glb_sha256': hashlib.sha256((root / model['source']).read_bytes()).hexdigest(),
             'source_glb': model['source']} for row, model in zip(rows, models)]


def main() -> None:
    parser = argparse.ArgumentParser(description='Inspect original character UVs and BCH expression palettes.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--spica-dll', required=True, type=Path)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    rows = inspect_faces(args.root.resolve(), json.loads(args.catalog.read_text()),
                         args.spica_dll.resolve(), args.dotnet)
    args.output.write_text(json.dumps(rows, indent=2) + '\n')
    print(json.dumps({'models': len(rows), 'faces': sum(len(row['faces']) for row in rows)}))


if __name__ == '__main__':
    main()
