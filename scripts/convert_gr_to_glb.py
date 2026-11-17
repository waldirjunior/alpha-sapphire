#!/usr/bin/env python3
"""Converte arquivos GR (a/0/3/9) para .glb usando SpicaExport (.NET 8) + assimp.

Os .glb gerados vão para public/assets/maps/ (ignorado pelo .gitignore).
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SPICA_EXPORT = Path("/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport")


def convert_gr_to_glb(gr_path: Path, glb_path: Path, textures_path: Path | None = None) -> None:
    if not SPICA_EXPORT.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado em: {SPICA_EXPORT}")
    if not gr_path.is_file():
        raise FileNotFoundError(f"Arquivo GR não encontrado: {gr_path}")

    glb_path.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", "/root/.dotnet")}

    with tempfile.TemporaryDirectory() as tmp:
        dae_path = Path(tmp) / f"{glb_path.stem}.dae"
        cmd = [str(SPICA_EXPORT), str(gr_path), str(dae_path)]
        if textures_path is not None and textures_path.is_file():
            cmd.append(str(textures_path))
        subprocess.run(cmd, check=True, env=env)
        subprocess.run(["assimp", "export", str(dae_path), str(glb_path)], check=True)
        for png in Path(tmp).glob("*.png"):
            shutil.copy2(png, glb_path.parent / png.name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte GRs selecionados para .glb.")
    parser.add_argument("--gr-dir", required=True, type=Path)
    parser.add_argument("--textures", type=Path, default=None, help="Arquivo AD/BCH com texturas de área")
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    targets = {
        "littleroot_town": "0006.bin",
        "route_101": "0005.bin",
        "oldale_town": "0004.bin",
        "route_103": "0001.bin",
        "route_102": "0010.bin",
    }

    for map_id, gr_name in targets.items():
        out_glb = args.out_dir / map_id / f"{map_id}.glb"
        convert_gr_to_glb(args.gr_dir / gr_name, out_glb, args.textures)
        print(f"Gerado {out_glb} ({out_glb.stat().st_size} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
