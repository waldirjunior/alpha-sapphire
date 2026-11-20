from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).parent))
from native_motions import package_sections, read_garc_entry

ACTION_INDICES = {'idle': 0, 'physical': 8, 'special': 12, 'damage': 16, 'faint': 17}
FPS = 30


def battle_expression_sections(action_index: int) -> tuple[int, int]:
    if action_index < 0:
        raise ValueError(f'Pokémon battle action index {action_index}: expected a nonnegative GF1 slot')
    return 2 + action_index, 20 + action_index


def write_export_project(directory: Path, spica_dll: Path) -> Path:
    project = directory / 'PokemonExpressions.csproj'
    assembly = escape(str(spica_dll.resolve()))
    source = escape(str(Path(__file__).with_name('pokemon_battle_expressions.cs').resolve()))
    project.write_text(
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>'
        '<OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework>'
        '<NoWarn>$(NoWarn);CA1416</NoWarn>'
        '<ImplicitUsings>enable</ImplicitUsings></PropertyGroup><ItemGroup>'
        f'<Reference Include="SPICA"><HintPath>{assembly}</HintPath></Reference>'
        f'<Compile Include="{source}" /></ItemGroup></Project>', encoding='utf-8')
    return project


def catalog_keys(catalog: dict) -> dict[str, str]:
    slug_by_url = {url: slug for slug, url in catalog['pokemon'].items()}
    return {model['id']: slug_by_url[model['url']] for model in catalog['models']
            if model['id'].startswith('pokemon/') and model['url'] in slug_by_url}


def read_expression_jobs(root: Path, manifest: dict, catalog: dict, directory: Path) -> list[dict]:
    slug_by_id = catalog_keys(catalog)
    jobs = []
    for model in manifest['models']:
        if model.get('kind') != 'pokemon' or model['id'] not in slug_by_id:
            continue
        slug = slug_by_id[model['id']]
        source = root / model['source']
        pc = read_garc_entry(source, model['model_slot'])
        pb = read_garc_entry(source, model['model_slot'] + 5)
        if pc[:2] != b'PC' or pb[:2] != b'PB':
            raise ValueError(f"Pokémon {model['id']} expected PC/PB entries at {model['model_slot']}/{model['model_slot'] + 5}")
        model_path = directory / slug / 'model.bin'
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model_path.write_bytes(pc)
        pb_sections = package_sections(pb)
        actions = {}
        for name, index in ACTION_INDICES.items():
            visibility_index, material_index = battle_expression_sections(index)
            action = {}
            save_bch_section(pb_sections, visibility_index, directory / slug / f'{name}-visibility.bin', 'visibility', action)
            save_bch_section(pb_sections, material_index, directory / slug / f'{name}-material.bin', 'material', action)
            if action:
                actions[name] = action
        if actions:
            jobs.append({'slug': slug, 'model': str(model_path), 'actions': actions})
    return jobs


def save_bch_section(sections: list[bytes], index: int, path: Path, key: str, action: dict) -> None:
    if index >= len(sections):
        return
    section = sections[index]
    if section[:4] != b'BCH\0':
        return
    path.write_bytes(section)
    action[key] = str(path)


def main() -> None:
    parser = argparse.ArgumentParser(description='Extract ROM Pokémon battle visibility and eye material curves into JSON.')
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--manifest', type=Path, default=Path('docs/features/pipeline-rom/native-models-manifest.json'))
    parser.add_argument('--catalog', type=Path, default=Path('src/data/nativeAssets.json'))
    parser.add_argument('--spica-dll', type=Path, required=True)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--output', type=Path, default=Path('src/data/pokemon_battle_expressions.json'))
    args = parser.parse_args()
    root = args.root.resolve()
    manifest = json.loads((root / args.manifest).read_text())
    catalog = json.loads((root / args.catalog).read_text())
    output = root / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pokemon-battle-expressions-') as temporary:
        directory = Path(temporary)
        jobs_path = directory / 'jobs.json'
        result_path = directory / 'expressions.json'
        jobs_path.write_text(json.dumps(read_expression_jobs(root, manifest, catalog, directory)))
        project = write_export_project(directory, args.spica_dll)
        subprocess.run([str(args.dotnet), 'run', '--project', str(project), '--',
                        str(jobs_path), str(result_path)], check=True,
                       env={**os.environ, 'DOTNET_CLI_TELEMETRY_OPTOUT': '1'})
        result = json.loads(result_path.read_text())
    output.write_text(f'{json.dumps(result, indent=2)}\n')
    print(json.dumps({'output': str(output), 'pokemon': len(result['pokemon']), 'fps': FPS}))


if __name__ == '__main__':
    main()
