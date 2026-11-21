#!/usr/bin/env python3
"""Converte os campos de batalha BCH de ORAS em GLB texturizado."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.convert_character_glb import _resolve_tool
from scripts.convert_gr_to_glb import patch_glb_materials, read_pica_alpha_states, run_spica
from scripts.glb_uv_fix import fix_file
from scripts.unpack_garc import unpack_garc

SPICA_EXPORT = _resolve_tool(
    "SPICA_EXPORT", "_tools/SpicaExport/bin/Release/net8.0/SpicaExport",
    "/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport",
)


@dataclass(frozen=True)
class BattleArenaSource:
    slot: int
    tag: str
    container_magic: bytes = b"BCH\x00"
    package_entry: int | None = None


BATTLE_ARENA_SOURCES = {
    "grass": BattleArenaSource(slot=11, tag="btl_F_kusa"),
    "water": BattleArenaSource(slot=12, tag="btl_F_mizu"),
    "cave": BattleArenaSource(slot=70, tag="btl_G_do_0", container_magic=b"BG", package_entry=0),
    "gym": BattleArenaSource(slot=78, tag="btl_G_gym1", container_magic=b"BG", package_entry=0),
    "indoor": BattleArenaSource(slot=136, tag="btl_O_heya_m", container_magic=b"BG", package_entry=0),
}
BATTLE_ARENA_STAGE_SOURCES = {
    "grass": BattleArenaSource(slot=150, tag="btl_O_kusa_m", container_magic=b"BG", package_entry=0),
    "water": BattleArenaSource(slot=139, tag="btl_O_mizu_m", container_magic=b"BG", package_entry=0),
    "cave": BattleArenaSource(slot=118, tag="btl_O_do_0_m", container_magic=b"BG", package_entry=0),
    "gym": BattleArenaSource(slot=125, tag="btl_O_gym1_m", container_magic=b"BG", package_entry=0),
}


def load_battle_arena_sources(unpacked_dir: Path) -> dict[str, Path]:
    sources: dict[str, Path] = {}
    for biome, source in BATTLE_ARENA_SOURCES.items():
        path = unpacked_dir / f"{source.slot:04d}.bin"
        if not path.is_file():
            raise FileNotFoundError(f"Campo ORAS {source.tag} não encontrado no slot {source.slot:04d} de a/1/3/6")
        sources[biome] = load_battle_arena_model(path, biome, source)
    return sources


def load_battle_arena_stage_sources(unpacked_dir: Path) -> dict[str, Path]:
    sources: dict[str, Path] = {}
    for biome, source in BATTLE_ARENA_STAGE_SOURCES.items():
        path = unpacked_dir / f"{source.slot:04d}.bin"
        if not path.is_file():
            raise FileNotFoundError(f"Camada ROM da arena {source.tag} não encontrada no slot {source.slot:04d} de a/1/3/6")
        sources[biome] = load_battle_arena_model(path, biome, source)
    return sources


def load_battle_arena_model(path: Path, biome: str, source: BattleArenaSource) -> Path:
    blob = path.read_bytes()
    if source.container_magic == b"BG":
        return extract_bg_model(blob, path, biome, source)
    validate_battle_arena_model(blob, source, path)
    return path


def extract_bg_model(blob: bytes, path: Path, biome: str, source: BattleArenaSource) -> Path:
    if blob[:2] != source.container_magic or len(blob) < 4 or source.package_entry is None:
        raise ValueError(f"{path}: esperado pacote BG de a/1/3/6 para {source.tag}")

    count = struct.unpack_from("<H", blob, 2)[0]
    table_end = 4 + count * 8
    if table_end > len(blob):
        raise ValueError(f"{path}: tabela BG truncada para {source.tag}; esperado até {table_end} bytes, recebido {len(blob)}")
    if source.package_entry >= count:
        raise ValueError(f"{path}: entrada BG {source.package_entry} ausente para {source.tag}; pacote tem {count}")

    start, end = struct.unpack_from("<II", blob, 4 + source.package_entry * 8)
    if start < table_end or end < start or end > len(blob):
        raise ValueError(f"{path}: offset BG inválido na entrada {source.package_entry} para {source.tag}")

    model = blob[start:end]
    validate_battle_arena_model(model, source, path)
    output = path.parent / f"{biome}-{source.slot:04d}-arena.bch"
    output.write_bytes(model)
    return output


def validate_battle_arena_model(blob: bytes, source: BattleArenaSource, path: Path) -> None:
    if blob[:4] != b"BCH\x00":
        raise ValueError(f"{path}: esperado modelo BCH no slot {source.slot:04d} de a/1/3/6")
    tag = re.escape(source.tag.encode("ascii"))
    if re.search(rb"(?<![A-Za-z0-9_])" + tag + rb"(?![A-Za-z0-9_])", blob) is None:
        raise ValueError(f"{path}: tag {source.tag} ausente no slot {source.slot:04d} de a/1/3/6")


def convert_battle_arena(
    source: Path,
    output: Path,
    spica_export: Path,
    assimp: str,
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", str(Path.home() / ".dotnet"))}
    with tempfile.TemporaryDirectory() as temporary:
        temp_dir = Path(temporary)
        dae_path = temp_dir / f"{output.stem}.dae"
        run_spica(source, dae_path, None, env, spica_export)
        subprocess.run([assimp, "export", str(dae_path), str(output)], check=True, cwd=temp_dir)
        states = read_pica_alpha_states(dae_path.read_text(encoding="utf-8"))
        output.write_bytes(patch_glb_materials(output.read_bytes(), states))
        fix_file(output)
        for png in temp_dir.glob("*.png"):
            shutil.copy2(png, output.parent / png.name)


def extract_battle_arenas(
    romfs_dir: Path,
    output_dir: Path,
    spica_export: Path = SPICA_EXPORT,
    assimp: str | None = None,
) -> None:
    garc_path = romfs_dir / "a" / "1" / "3" / "6"
    if not garc_path.is_file():
        raise FileNotFoundError(f"GARC de campos de batalha ORAS não encontrado em RomFS/a/1/3/6: {garc_path}")
    if not spica_export.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado em: {spica_export}")

    assimp_path = assimp or shutil.which("assimp") or "assimp"
    with tempfile.TemporaryDirectory() as temporary:
        unpacked_dir = Path(temporary) / "a_1_3_6"
        unpack_garc(garc_path, unpacked_dir, decompress=True)
        sources = load_battle_arena_sources(unpacked_dir)
        stage_sources = load_battle_arena_stage_sources(unpacked_dir)
        for biome, source in sources.items():
            output = output_dir / biome / f"{biome}.glb"
            convert_battle_arena(source, output, spica_export, assimp_path)
            print(f"Gerado {output} ({output.stat().st_size} bytes)")
        for biome, source in stage_sources.items():
            output = output_dir / biome / "stage" / "stage.glb"
            convert_battle_arena(source, output, spica_export, assimp_path)
            print(f"Gerada camada ROM {output} ({output.stat().st_size} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai arenas reais de batalha ORAS para GLB.")
    parser.add_argument("--romfs", required=True, type=Path, help="Raiz da RomFS extraída")
    parser.add_argument("--out-dir", type=Path, default=ROOT / "public/assets/battle-arenas")
    parser.add_argument("--spica-export", type=Path, default=SPICA_EXPORT)
    parser.add_argument("--assimp", default=shutil.which("assimp") or "assimp")
    args = parser.parse_args()
    extract_battle_arenas(args.romfs, args.out_dir, args.spica_export, args.assimp)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
