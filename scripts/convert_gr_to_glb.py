#!/usr/bin/env python3
"""Converte arquivos GR (a/0/3/9) para .glb usando SpicaExport (.NET 8) + assimp.

Os .glb gerados vão para public/assets/maps/ (ignorado pelo .gitignore).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

SPICA_EXPORT = Path(
    os.environ.get(
        "SPICA_EXPORT",
        "/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport",
    )
)


MISSING_TEXTURE_RE = re.compile(r"references missing texture '([^']+)'")
PICA_MATERIAL_RE = re.compile(r"<pica_material[^>]*>(\{.*?\})</pica_material>", re.DOTALL)
# Texturas que o jogo usa como máscara/projeção e que nunca existem em AD (P-007).
UNPACKED_TEXTURE_NAMES = {"projection_dummy"}


def parse_missing_textures(warnings_text: str) -> set[str]:
    return set(MISSING_TEXTURE_RE.findall(warnings_text)) - UNPACKED_TEXTURE_NAMES


def _contains_whole_name(blob: bytes, name: str) -> bool:
    # Nomes em BCH são strings terminadas em NUL; "chip_wind" não pode casar com "chip_wind2".
    pattern = rb"(?<![A-Za-z0-9_])" + re.escape(name.encode()) + rb"(?![A-Za-z0-9_])"
    return re.search(pattern, blob) is not None


def select_texture_archive(needed: set[str], archives: dict[str, bytes]) -> str | None:
    """Escolhe o AD (a/0/1/4) que cobre mais texturas exigidas pelos materiais do GR.

    Sem o AD correto o SPICA deixa os materiais sem imagem e o glTF renderiza placas
    brancas (P-007).
    """
    best_name: str | None = None
    best_score = 0
    for archive_name, blob in sorted(archives.items()):
        score = sum(1 for name in needed if _contains_whole_name(blob, name))
        if score > best_score:
            best_name, best_score = archive_name, score
    return best_name


def pica_alpha_state(pica: dict[str, object]) -> tuple[str, float | None]:
    """Traduz BlendFunction/AlphaTest do PICA200 para alphaMode do glTF."""
    blend = pica.get("BlendFunction")
    color_src = blend.get("ColorSrcFunc") if isinstance(blend, dict) else None
    if color_src == "SourceAlpha":
        return "BLEND", None
    alpha_test = pica.get("AlphaTest")
    if isinstance(alpha_test, dict) and alpha_test.get("Enabled"):
        reference = alpha_test.get("Reference")
        ref = reference if isinstance(reference, int) else 0
        # Function "Greater": passa apenas alpha > ref/255.
        return "MASK", (ref + 1) / 255
    return "OPAQUE", None


def read_pica_alpha_states(dae_text: str) -> dict[str, tuple[str, float | None]]:
    states: dict[str, tuple[str, float | None]] = {}
    for raw in PICA_MATERIAL_RE.findall(dae_text):
        pica = json.loads(raw)
        name = pica.get("Name")
        if isinstance(name, str):
            states[name] = pica_alpha_state(pica)
    return states


def patch_glb_materials(glb: bytes, states: dict[str, tuple[str, float | None]]) -> bytes:
    """Grava alphaMode/alphaCutoff do PICA no JSON do .glb e marca `extras.pica`.

    O marcador permite que fixOrasMaterials não sobrescreva o estado correto (P-007).
    """
    json_len = struct.unpack_from("<I", glb, 12)[0]
    doc = json.loads(glb[20 : 20 + json_len])
    for material in doc.get("materials", []):
        state = states.get(material.get("name"))
        if state is None:
            continue
        mode, cutoff = state
        material["alphaMode"] = mode
        if cutoff is not None:
            material["alphaCutoff"] = cutoff
        material["extras"] = {**material.get("extras", {}), "pica": True}
    payload = json.dumps(doc, separators=(",", ":")).encode()
    payload += b" " * (-len(payload) % 4)
    rest = glb[20 + json_len :]
    total = 12 + 8 + len(payload) + len(rest)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(payload), b"JSON") + payload + rest


def run_spica(gr_path: Path, dae_path: Path, textures_path: Path | None, env: dict[str, str]) -> None:
    cmd = [str(SPICA_EXPORT), str(gr_path), str(dae_path)]
    if textures_path is not None and textures_path.is_file():
        cmd.append(str(textures_path))
    subprocess.run(cmd, check=True, env=env)


def discover_texture_archive(gr_path: Path, ad_dir: Path, env: dict[str, str], tmp: Path) -> Path | None:
    probe = tmp / "probe.dae"
    run_spica(gr_path, probe, None, env)
    warnings_file = Path(f"{probe}.warnings.txt")
    if not warnings_file.is_file():
        return None
    needed = parse_missing_textures(warnings_file.read_text(encoding="utf-8"))
    archives = {p.name: p.read_bytes() for p in sorted(ad_dir.glob("*.bin"))}
    chosen = select_texture_archive(needed, archives)
    return ad_dir / chosen if chosen else None


def convert_gr_to_glb(
    gr_path: Path,
    glb_path: Path,
    textures_path: Path | None = None,
    ad_dir: Path | None = None,
) -> None:
    if not SPICA_EXPORT.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado em: {SPICA_EXPORT}")
    if not gr_path.is_file():
        raise FileNotFoundError(f"Arquivo GR não encontrado: {gr_path}")

    glb_path.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", "/root/.dotnet")}

    with tempfile.TemporaryDirectory() as tmp:
        if textures_path is None and ad_dir is not None:
            textures_path = discover_texture_archive(gr_path, ad_dir, env, Path(tmp))
            if textures_path is None:
                print(f"AVISO: nenhum AD em {ad_dir} cobre as texturas de {gr_path.name}", file=sys.stderr)
        dae_path = Path(tmp) / f"{glb_path.stem}.dae"
        run_spica(gr_path, dae_path, textures_path, env)
        subprocess.run(["assimp", "export", str(dae_path), str(glb_path)], check=True)
        states = read_pica_alpha_states(dae_path.read_text(encoding="utf-8"))
        glb_path.write_bytes(patch_glb_materials(glb_path.read_bytes(), states))
        for png in Path(tmp).glob("*.png"):
            shutil.copy2(png, glb_path.parent / png.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte GRs selecionados para .glb.")
    parser.add_argument("--gr-dir", required=True, type=Path)
    parser.add_argument("--textures", type=Path, default=None, help="Arquivo AD/BCH com texturas de área")
    parser.add_argument("--ad-dir", type=Path, default=None, help="Diretório com ADs (a_0_1_4); escolhe o AD por cobertura de texturas")
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    targets = {
        "littleroot_town": "0006.bin",
        "route_101": "0005.bin",
        "oldale_town": "0004.bin",
        "route_103": "0001.bin",
        "route_102": "0010.bin",
        "route_102_west": "0009.bin",
        "petalburg_city": "0008.bin",
    }

    for map_id, gr_name in targets.items():
        out_glb = args.out_dir / map_id / f"{map_id}.glb"
        convert_gr_to_glb(args.gr_dir / gr_name, out_glb, args.textures, args.ad_dir)
        print(f"Gerado {out_glb} ({out_glb.stat().st_size} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
