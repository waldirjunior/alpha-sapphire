from __future__ import annotations

import argparse
import json
import re
import tempfile
from pathlib import Path
from types import SimpleNamespace

from glb_native_clips import append_native_clip, decode_glb, encode_glb
from native_motions import export_clip, motion_slots, package_sections, read_garc_entry

BATTLE_CLIPS = {'idle': 0, 'physical': 8, 'special': 12, 'damage': 16, 'faint': 17}


def select_clips(family: str, slots: list[dict[str, int]], requested: dict | None = None) -> tuple[dict[str, int], list[str]]:
    if family not in ('PB', 'MM'):
        raise ValueError(f'Expected PB battle or MM overworld motions, got {family}')
    present = {slot['index'] for slot in slots}
    defaults = BATTLE_CLIPS if family == 'PB' else {f'overworld_{index:03d}': index for index in sorted(present)}
    selection = defaults if requested is None else requested
    if not isinstance(selection, dict) or not selection:
        raise ValueError('clips must be a nonempty mapping of clip name to sparse GF1 index')
    for name, index in selection.items():
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*', name):
            raise ValueError(f'Invalid clip name {name!r}')
        if type(index) is not int or index < 0:
            raise ValueError(f'Invalid sparse GF1 index {index!r} for {name}')
    missing = [name for name, index in selection.items() if index not in present]
    if requested is not None and missing:
        raise ValueError(f'Requested GF1 clips are absent: {missing}')
    available = {name: index for name, index in selection.items() if index in present}
    if not available:
        raise ValueError(f'No native clips available for {family}')
    return available, missing


def read_model_job(job: dict, manifest_dir: Path) -> dict:
    paths = {key: (manifest_dir / job[key]).resolve() for key in ('source', 'base_glb', 'output')}
    if paths['output'].suffix != '.glb':
        raise ValueError(f"Expected .glb output: {paths['output']}")
    if 'model_slot' in job:
        slot = job['model_slot']
        if type(slot) is not int or slot < 0:
            raise ValueError(f'Invalid model_slot {slot!r}')
        model = read_garc_entry(paths['source'], slot)
        pack = read_garc_entry(paths['source'], slot + 5)
        if model[:2] != b'PC' or pack[:2] != b'PB':
            raise ValueError(f'Expected PC model at {slot} and PB at {slot + 5}')
        motion = package_sections(pack)[0]
        family = 'PB'
    else:
        model = paths['source'].read_bytes()
        sections = package_sections(model)
        if model[:2] != b'MM' or len(sections) < 2:
            raise ValueError(f"Expected MM with a GF1 section: {paths['source']}")
        motion, family = sections[1], 'MM'
    slots = motion_slots(motion)
    clips, unavailable = select_clips(family, slots, job.get('clips'))
    return {**paths, 'model': model, 'motion': motion, 'family': family, 'clips': clips,
            'unavailable': unavailable, 'frames': {slot['index']: slot['frames'] for slot in slots}}


def integrate_model(plan: dict, tools: argparse.Namespace) -> dict:
    output = plan['output']
    if output.exists():
        raise FileExistsError(f'Native output already exists; choose a new path: {output}')
    scene, binary = decode_glb(plan['base_glb'].read_bytes())
    reports = []
    with tempfile.TemporaryDirectory(prefix='oras-native-clips-') as directory:
        for name, index in plan['clips'].items():
            path = Path(directory) / f'{name}.glb'
            args = SimpleNamespace(spica_dll=tools.spica_dll, blender=tools.blender,
                                   dotnet=tools.dotnet, clip=index, output=path)
            export_clip(args, plan['model'], plan['motion'])
            source, clip_binary = decode_glb(path.read_bytes())
            metadata = {'sourceFamily': plan['family'], 'sourceIndex': index,
                        'sourceFrames': plan['frames'][index], 'sourceFps': 30}
            scene, binary = append_native_clip(scene, binary, source, clip_binary, name, metadata)
            reports.append({'name': name, **metadata})
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as stream:
        stream.write(encode_glb(scene, binary))
    return {'output': str(output), 'nativeClips': reports, 'unavailable': plan['unavailable']}


def main() -> None:
    parser = argparse.ArgumentParser(description='Attach native GF1 clips to existing textured GLBs, serially from an explicit manifest.')
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--spica-dll', type=Path)
    parser.add_argument('--blender', type=Path)
    parser.add_argument('--dotnet', type=Path, default=Path.home() / '.dotnet/dotnet')
    parser.add_argument('--plan', action='store_true')
    args = parser.parse_args()
    jobs = json.loads(args.manifest.read_text())
    if not isinstance(jobs, list) or not jobs:
        parser.error('manifest must be a nonempty JSON array of model jobs')
    if not args.plan and (args.spica_dll is None or args.blender is None):
        parser.error('conversion requires --spica-dll and --blender')
    for index, job in enumerate(jobs):
        plan = read_model_job(job, args.manifest.resolve().parent)
        summary = {'job': index, 'output': str(plan['output']), 'clips': plan['clips'],
                   'frames': plan['frames'], 'unavailable': plan['unavailable']}
        print(json.dumps(summary), flush=True)
        if not args.plan:
            print(json.dumps(integrate_model(plan, args)), flush=True)


if __name__ == '__main__':
    main()
