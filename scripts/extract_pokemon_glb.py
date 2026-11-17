#!/usr/bin/env python3
"""Extrai modelos 3D e texturas de Pokémon do GARC a/0/0/8 e converte para .glb via SpicaExport + assimp."""

from __future__ import annotations

import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from unpack_garc import decompress_lz11

SPICA_EXPORT = Path("/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport")

TARGET_SPECIES: dict[str, bytes] = {
    "treecko": b"pm0252_00",
    "torchic": b"pm0255_00",
    "mudkip": b"pm0258_00",
    "poochyena": b"pm0261_00",
    "zigzagoon": b"pm0263_00",
    "wurmple": b"pm0265_00",
}


def read_garc_slot(f, data_offset: int, entries: list[tuple[int, int]], idx: int) -> bytes:
    start, length = entries[idx]
    if length == 0:
        return b""
    f.seek(data_offset + start)
    blob = f.read(length)
    if blob and blob[0] == 0x11:
        try:
            blob = decompress_lz11(blob)
        except Exception:
            pass
    return blob


def extract_pokemon_models(garc_path: Path, out_dir: Path) -> None:
    if not SPICA_EXPORT.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado: {SPICA_EXPORT}")
    if not garc_path.is_file():
        raise FileNotFoundError(f"GARC não encontrado: {garc_path}")

    with garc_path.open("rb") as f:
        hdr = f.read(28)
        _magic, hdr_len, _endian, _ver, _chunks, data_offset, _fsz, _mp = struct.unpack("<4sIHHIIII", hdr)
        f.seek(hdr_len)
        fato_size, _, _ = struct.unpack("<IHH", f.read(12)[4:])
        f.seek(hdr_len + fato_size)
        _fatb_sz, fatb_count = struct.unpack("<II", f.read(12)[4:])

        entries: list[tuple[int, int]] = []
        for _ in range(fatb_count):
            bm = struct.unpack("<I", f.read(4))[0]
            bits = bin(bm).count("1")
            er = f.read(12 * bits)
            if bits == 0:
                entries.append((0, 0))
            else:
                start, _end, length = struct.unpack_from("<III", er, 0)
                entries.append((start, length))

        remaining = dict(TARGET_SPECIES)
        env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", "/root/.dotnet")}

        # Slots de modelo de Pokémon começam por volta do índice 2000 para dex #252+
        for idx in range(1800, len(entries) - 2):
            if not remaining:
                break
            start, length = entries[idx]
            if length < 10000 or length > 2_000_000:
                continue
            blob = read_garc_slot(f, data_offset, entries, idx)
            if not blob.startswith(b"PC\x02\x00"):
                continue

            matched_name = None
            for sp_name, tag in remaining.items():
                if tag in blob:
                    matched_name = sp_name
                    break
            if not matched_name:
                continue

            tex_blob = read_garc_slot(f, data_offset, entries, idx + 2)
            sp_out = out_dir / matched_name
            sp_out.mkdir(parents=True, exist_ok=True)
            glb_path = sp_out / f"{matched_name}.glb"

            with tempfile.TemporaryDirectory() as tmp:
                tmp_path = Path(tmp)
                pc_path = tmp_path / "model.pc"
                pt_path = tmp_path / "textures.pt"
                dae_path = tmp_path / f"{matched_name}.dae"
                pc_path.write_bytes(blob)
                cmd = [str(SPICA_EXPORT), str(pc_path), str(dae_path)]
                if tex_blob.startswith(b"PT"):
                    pt_path.write_bytes(tex_blob)
                    cmd.append(str(pt_path))
                subprocess.run(cmd, check=True, env=env)
                subprocess.run(["assimp", "export", str(dae_path), str(glb_path)], check=True)
                for png in tmp_path.glob("*.png"):
                    shutil.copy2(png, sp_out / png.name)

            print(f"Convertido {matched_name} (slot {idx}): {glb_path} ({glb_path.stat().st_size} bytes)")
            del remaining[matched_name]

        if remaining:
            print(f"Aviso: espécies não encontradas: {list(remaining.keys())}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai modelos 3D de Pokémon de a/0/0/8 para .glb.")
    parser.add_argument("--garc", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    extract_pokemon_models(args.garc, args.out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
