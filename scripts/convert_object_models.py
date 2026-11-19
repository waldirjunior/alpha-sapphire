#!/usr/bin/env python3
"""Converte BCH models from GARC a/0/2/3 into stageable object GLBs."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from scripts.convert_character_glb import _resolve_tool
from scripts.convert_gr_to_glb import (
    discover_texture_archive,
    patch_glb_materials,
    read_pica_alpha_states,
    run_spica,
)
from scripts.glb_uv_fix import fix_file
from scripts.object_models import BM_MODEL_COUNT, extract_bm_model_section, mm_model_index

ROOT = Path(__file__).resolve().parents[1]
SPICA_EXPORT = _resolve_tool(
    "SPICA_EXPORT", "_tools/SpicaExport/bin/Release/net8.0/SpicaExport",
    "/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport",
)


def bm_source(bm_dir: Path, index: int) -> Path:
    exact = bm_dir / f"{index:04d}.bin"
    if exact.is_file():
        return exact
    candidates = sorted(bm_dir.glob(f"{index:04d}_*.bin"))
    if len(candidates) == 1:
        return candidates[0]
    raise FileNotFoundError(f"Entrada BM {index:04d} não encontrada de forma única em {bm_dir}")


def object_model_indices(maps_dir: Path) -> list[int]:
    indices = set()
    for path in maps_dir.glob("[0-9][0-9][0-9][0-9].json"):
        map_data = json.loads(path.read_text(encoding="utf-8"))
        for actor in map_data.get("npcs", []):
            model_id = actor.get("model")
            if isinstance(model_id, int) and model_id >= 0x1000:
                index = mm_model_index(model_id)
                if index is not None:
                    indices.add(index)
    return sorted(indices)


def convert_object_model(
    source: Path,
    output: Path,
    ad_dir: Path | None,
    spica_export: Path,
    assimp: str,
) -> None:
    section = extract_bm_model_section(source.read_bytes())
    output.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", str(Path.home() / ".dotnet"))}
    with tempfile.TemporaryDirectory() as temporary:
        tmp = Path(temporary)
        bch = tmp / f"{output.stem}.bch"
        bch.write_bytes(section)
        textures = discover_texture_archive(bch, ad_dir, env, tmp, spica_export) if ad_dir else None
        dae = tmp / f"{output.stem}.dae"
        run_spica(bch, dae, textures, env, spica_export)
        subprocess.run([assimp, "export", str(dae), str(output)], check=True, cwd=tmp)
        states = read_pica_alpha_states(dae.read_text(encoding="utf-8"))
        output.write_bytes(patch_glb_materials(output.read_bytes(), states))
        fix_file(output)
        for png in tmp.glob("*.png"):
            shutil.copy2(png, output.parent / png.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte entradas BM para GLB no diretório local de modelos.")
    parser.add_argument("--bm-dir", required=True, type=Path, help="Entradas de a/0/2/3 após unpack_garc.py")
    parser.add_argument("--out-dir", required=True, type=Path, help="Diretório rom/extracted/models")
    parser.add_argument("--model-indices", type=int, nargs="+", help="Padrão: todos os IDs de ator em --maps-dir")
    parser.add_argument("--maps-dir", type=Path, default=ROOT / "src/data/maps_v2")
    parser.add_argument("--ad-dir", type=Path, help="Entradas descomprimidas de a/0/1/4 para texturas")
    parser.add_argument("--spica-export", type=Path, default=SPICA_EXPORT)
    parser.add_argument("--assimp", default=shutil.which("assimp") or "assimp")
    args = parser.parse_args()
    if not args.spica_export.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado em: {args.spica_export}")
    indices = sorted(set(args.model_indices if args.model_indices is not None else object_model_indices(args.maps_dir)))
    if any(index < 0 or index >= BM_MODEL_COUNT for index in indices):
        raise ValueError(f"Índices BM devem estar entre 0 e {BM_MODEL_COUNT - 1}")

    for index in indices:
        name = f"bm_{index:04d}"
        output = args.out_dir / "objects" / name / f"{name}.glb"
        convert_object_model(bm_source(args.bm_dir, index), output, args.ad_dir, args.spica_export, args.assimp)
        print(f"Gerado {output} ({output.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
