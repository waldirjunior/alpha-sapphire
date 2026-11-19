import argparse
import base64
import json
import mimetypes
from pathlib import Path
from urllib.parse import unquote

from scripts.glb_native_clips import decode_glb, encode_glb
from scripts.glb_uv_fix import fix_file
from scripts.object_models import mm_model_index

SLICE = (6, 7, 13, 23, 24, 25, *range(223, 232))


def select_slice(maps: dict, roots: tuple = SLICE, neighbors: dict | None = None) -> list[int]:
    destinations = {int(warp['targetMapId'][5:]) for zone in roots for warp in maps[zone]['warps']}
    adjacent = {int(edge['targetMapId'][5:]) for zone in roots
                for edge in (neighbors or {}).get(f'zone_{zone:04d}', {}).get('neighbors', [])}
    return sorted(set(roots) | destinations | adjacent)


def write_new(path: Path, content: bytes) -> None:
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f'Asset já existe com conteúdo diferente: {path}')
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def image_file(model: Path, uri: str) -> Path:
    image = (model.parent / unquote(uri)).resolve()
    image.relative_to(model.parent.resolve())
    return image


def copy_gr(source: Path, target: Path) -> None:
    fix_file(source)
    if target.exists():
        fix_file(target)
    blob = source.read_bytes()
    scene, _ = decode_glb(blob)
    for image in scene.get('images', []):
        uri = image.get('uri', '')
        if not uri or uri.startswith('data:'):
            continue
        write_new(target.parent / unquote(uri), image_file(source, uri).read_bytes())
    write_new(target, blob)


def copy_character(source: Path, target: Path) -> None:
    blob = source.read_bytes()
    scene, binary = decode_glb(blob)
    external = [image for image in scene.get('images', []) if image.get('uri', '') and not image['uri'].startswith('data:')]
    for image in external:
        path = image_file(source, image['uri'])
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        image['uri'] = f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')
    write_new(target, encode_glb(scene, binary) if external else blob)


def stage_characters(models: Path, public: Path, ids: set[int]) -> list[int]:
    missing = []
    for index in sorted(ids):
        name = f'mm_{index:04d}'
        candidates = [models / directory / name / f'{name}.glb'
                      for directory in ('clips_merged/characters', 'characters')]
        source = next((path for path in candidates if path.is_file()), None)
        if source is None:
            missing.append(index)
            continue
        copy_character(source, public / f'assets/characters/{name}.glb')
    return missing


def stage_object_models(models: Path, public: Path, ids: set[int]) -> list[int]:
    missing = []
    for index in sorted(ids):
        name = f'bm_{index:04d}'
        source = models / 'objects' / name / f'{name}.glb'
        if not source.is_file():
            missing.append(index)
            continue
        copy_gr(source, public / f'assets/objects/{name}/{name}.glb')
    return missing


def stage_audio(source: Path, public: Path, entries: list[dict], roots: tuple) -> list[str]:
    tracks = sorted({entry['bgmName'] for entry in entries
                     if entry['zone'] in roots and entry['hasMp3'] and entry['bgmName']})
    for name in tracks:
        write_new(public / f'assets/audio/{name}.mp3', (source / f'{name}.mp3').read_bytes())
    return tracks


def main() -> None:
    parser = argparse.ArgumentParser(description='Copia apenas assets convertidos do slice e destinos diretos; não converte ROM.')
    parser.add_argument('--models-dir', type=Path, required=True)
    parser.add_argument('--public-dir', type=Path, required=True)
    parser.add_argument('--maps-dir', type=Path, default=Path('src/data/maps_v2'))
    parser.add_argument('--zones', type=int, nargs='+', default=SLICE)
    parser.add_argument('--include-neighbors', action='store_true')
    parser.add_argument('--audio-dir', type=Path)
    parser.add_argument('--objects-only', action='store_true', help='Copia os modelos BM de todos os mapas, sem GR/personagens')
    args = parser.parse_args()
    maps = {int(path.stem): json.loads(path.read_text()) for path in args.maps_dir.glob('[0-9][0-9][0-9][0-9].json')}
    if args.objects_only:
        object_ids = {index for map_data in maps.values() for npc in map_data['npcs']
                      if npc['model'] >= 0x1000 and (index := mm_model_index(npc['model'])) is not None}
        missing = stage_characters(args.models_dir, args.public_dir, object_ids)
        print(json.dumps({'objects': len(object_ids) - len(missing), 'missingObjects': missing}))
        return
    neighbors = json.loads((args.maps_dir / '_neighbors.json').read_text())['zones'] if args.include_neighbors else None
    selected = select_slice(maps, tuple(args.zones), neighbors)
    grs = {chunk['grId'] for zone in selected for chunk in maps[zone]['source']['chunks']}
    for index in sorted(grs):
        name = f'gr_{index:04d}'
        copy_gr(args.models_dir / name / f'{name}.glb', args.public_dir / f'assets/maps/{name}/{name}.glb')
    actor_ids = {npc['model'] for zone in selected for npc in maps[zone]['npcs']}
    character_ids = {mm_model_index(model_id) or model_id for model_id in actor_ids}
    missing_characters = stage_characters(args.models_dir, args.public_dir, character_ids)
    missing_objects: list[int] = []
    object_ids: set[int] = set()
    tracks = stage_audio(args.audio_dir, args.public_dir,
                         json.loads((args.maps_dir.parent / 'zone_audio.json').read_text()), tuple(args.zones)) if args.audio_dir else []
    print(json.dumps({'zones': selected, 'grs': sorted(grs), 'characters': len(character_ids) - len(missing_characters),
                      'missingCharacters': missing_characters, 'objects': len(object_ids) - len(missing_objects),
                      'missingObjects': missing_objects, 'audio': tracks}))


if __name__ == '__main__':
    main()
