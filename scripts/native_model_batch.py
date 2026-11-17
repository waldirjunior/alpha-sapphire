from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


def manifest_summary(models: list[dict]) -> dict:
    return {'models': len(models), 'status': dict(sorted(Counter(model['status'] for model in models).items())),
            'by_kind': {kind: dict(sorted(Counter(model['status'] for model in models if model['kind'] == kind).items()))
                        for kind in sorted({model['kind'] for model in models})},
            'native_clips_merged': sum(len(model.get('clips', {})) for model in models if model['status'] == 'merged')}


def write_manifest(path: Path, manifest: dict) -> None:
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def conversion_error(log: str, root: Path, tools: argparse.Namespace) -> str:
    lines = [line for line in log.splitlines() if line.strip()]
    causes = ('ValueError:', 'RuntimeError:', 'FileNotFoundError:', 'IndexError:', 'Unhandled exception.')
    error = next((line for line in reversed(lines) if line.startswith(causes)),
                 lines[-1] if lines else 'No converter error output')
    for source, replacement in ((root, '$ROOT'), (Path(__file__).resolve().parents[1], '$WORKTREE'),
                                (tools.blender, '$BLENDER'), (tools.dotnet, '$DOTNET'),
                                (tools.spica_dll, '$SPICA_DLL')):
        error = error.replace(str(source), replacement)
    return re.sub(r"/(?:private/)?var/folders/[^\s'\"]+", '$TEMP', error)


def run_model(root: Path, model: dict, tools: argparse.Namespace) -> dict:
    output = root / model['output']
    log_path = output.with_suffix('.log')
    if output.exists() or log_path.exists():
        return {'status': 'failed', 'error': 'Output or log already exists; not overwritten'}
    output.parent.mkdir(parents=True, exist_ok=True)
    job = {key: str(root / model[key]) for key in ('source', 'base_glb', 'output')}
    job['clips'] = model['clips']
    if 'model_slot' in model:
        job['model_slot'] = model['model_slot']
    with tempfile.TemporaryDirectory(prefix='oras-native-job-') as directory:
        manifest = Path(directory) / 'job.json'
        manifest.write_text(json.dumps([job]), encoding='utf-8')
        command = [sys.executable, '-B', str(Path(__file__).with_name('attach_native_motions.py')),
                   '--manifest', str(manifest), '--spica-dll', str(tools.spica_dll),
                   '--blender', str(tools.blender), '--dotnet', str(tools.dotnet)]
        with log_path.open('x') as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, check=False)
    report = {'status': 'merged' if result.returncode == 0 else 'failed',
              'log': str(log_path.relative_to(root)), 'returncode': result.returncode}
    if result.returncode:
        report['error'] = conversion_error(log_path.read_text(errors='replace'), root, tools)
    return report


def run_batch(manifest: dict, root: Path, tools: argparse.Namespace, report_path: Path) -> dict:
    ready = [model for model in manifest['models'] if model['status'] == 'ready']
    with ThreadPoolExecutor(max_workers=tools.jobs) as pool:
        futures = {pool.submit(run_model, root, model, tools): model for model in ready}
        for future in as_completed(futures):
            model = futures[future]
            try:
                model.update(future.result())
            except OSError as error:
                model.update(status='failed', error=f'{type(error).__name__}: {error}'.replace(str(root), '$ROOT'))
            manifest['summary'] = manifest_summary(manifest['models'])
            write_manifest(report_path, manifest)
            print(json.dumps({'id': model['id'], 'status': model['status'],
                              'error': model.get('error'), 'summary': manifest['summary']}), flush=True)
    for model in manifest['models']:
        if model['status'] == 'failed' and 'log' in model:
            model['error'] = conversion_error((root / model['log']).read_text(errors='replace'), root, tools)
    manifest['summary'] = manifest_summary(manifest['models'])
    write_manifest(report_path, manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description='Execute ready native model manifest jobs with per-model failure reporting.')
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--spica-dll', required=True, type=Path)
    parser.add_argument('--blender', required=True, type=Path)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--jobs', type=int, choices=(1, 2), default=1)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    result = run_batch(manifest, args.root.resolve(), args, args.manifest)
    print(json.dumps(result['summary']), flush=True)
    if result['summary']['status'].get('failed', 0):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
