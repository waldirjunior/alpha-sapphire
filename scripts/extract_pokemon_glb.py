#!/usr/bin/env python3
"""Extrai modelos 3D e texturas de Pokémon do GARC a/0/0/8 e converte para .glb animado via SpicaExport + Blender."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from unpack_garc import decompress_lz11

SPICA_EXPORT = Path(
    os.environ.get(
        "SPICA_EXPORT",
        "/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport",
    )
)

BLENDER_POKEMON_SCRIPT = """
import bpy
import math
import sys
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
in_dae, out_glb = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.collada_import(filepath=in_dae)

armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)
if armature:
    bpy.context.view_layer.objects.active = armature
    action = bpy.data.actions.new(name="idle")
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action

    # Cria respiração sutil em ossos centrais comuns dos Pokémon (Waist/Spine/Head/Origin)
    waist = armature.pose.bones.get("Waist") or armature.pose.bones.get("Origin")
    head = armature.pose.bones.get("Head") or armature.pose.bones.get("Neck")
    for frame, breath in ((1, 0.0), (25, 1.0), (49, 0.0)):
        if waist:
            waist.location = (0.0, breath * 0.4, 0.0)
            waist.keyframe_insert(data_path="location", frame=frame)
        if head and head.name in armature.data.bones:
            m_rest = armature.data.bones[head.name].matrix_local.to_3x3()
            rot = Matrix.Rotation(math.radians(breath * 3.0), 3, 'X')
            head.rotation_mode = 'QUATERNION'
            head.rotation_quaternion = (m_rest.inverted() @ rot @ m_rest).to_quaternion()
            head.keyframe_insert(data_path="rotation_quaternion", frame=frame)

    track = armature.animation_data.nla_tracks.new()
    track.name = "idle"
    strip = track.strips.new("idle", 1, action)
    strip.name = "idle"

bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format='GLB',
    export_animations=True,
    export_nla_strips=True,
    export_skins=True,
    export_texcoords=True,
    export_normals=True,
)
"""

TARGET_SPECIES: dict[str, bytes] = {
    "treecko": b"pm0252_00",
    "torchic": b"pm0255_00",
    "mudkip": b"pm0258_00",
    "poochyena": b"pm0261_00",
    "zigzagoon": b"pm0263_00",
    "wurmple": b"pm0265_00",
    "lotad": b"pm0270_00",
    "ralts": b"pm0280_00",
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


PM_TAG_RE = re.compile(rb"pm\d{4}_\d{2}")


def scan_pokemon_models(garc_path: Path, out_dir: Path, all_species: bool) -> None:
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
        seen: set[str] = set()

        # Slots de modelo de Pokémon começam por volta do índice 2000 para dex #252+
        first = 0 if all_species else 1800
        for idx in range(first, len(entries) - 2):
            if not all_species and not remaining:
                break
            start, length = entries[idx]
            if length < 10000 or length > 2_000_000:
                continue
            blob = read_garc_slot(f, data_offset, entries, idx)
            if not blob.startswith(b"PC\x02\x00"):
                continue

            matched_name = None
            if all_species:
                m = PM_TAG_RE.search(blob)
                if m:
                    tag = m.group(0).decode()
                    if tag not in seen:
                        matched_name = tag
            else:
                for sp_name, tag in remaining.items():
                    if tag in blob:
                        matched_name = sp_name
                        break
            if not matched_name:
                continue

            tex_blob = read_garc_slot(f, data_offset, entries, idx + 2)
            sp_out = out_dir / matched_name
            glb_path = sp_out / f"{matched_name}.glb"
            if all_species and glb_path.is_file():
                seen.add(matched_name)
                continue
            sp_out.mkdir(parents=True, exist_ok=True)

            try:
                with tempfile.TemporaryDirectory() as tmp:
                    tmp_path = Path(tmp)
                    pc_path = tmp_path / "model.pc"
                    pt_path = tmp_path / "textures.pt"
                    dae_path = tmp_path / f"{matched_name}.dae"
                    py_path = tmp_path / "blender_pokemon.py"
                    py_path.write_text(BLENDER_POKEMON_SCRIPT, encoding="utf-8")
                    pc_path.write_bytes(blob)
                    cmd = [str(SPICA_EXPORT), str(pc_path), str(dae_path)]
                    if tex_blob.startswith(b"PT"):
                        pt_path.write_bytes(tex_blob)
                        cmd.append(str(pt_path))
                    subprocess.run(cmd, check=True, env=env)
                    subprocess.run(
                        ["blender", "--background", "--python-exit-code", "1", "--python", str(py_path), "--", str(dae_path), str(glb_path)],
                        check=True,
                    )
                    for png in tmp_path.glob("*.png"):
                        shutil.copy2(png, sp_out / png.name)
            except subprocess.CalledProcessError as e:
                seen.discard(matched_name)
                print(f"Falha {matched_name} (slot {idx}): {e}", file=sys.stderr, flush=True)
                continue

            seen.add(matched_name)
            print(f"Convertido {matched_name} (slot {idx}): {glb_path} ({glb_path.stat().st_size} bytes)", flush=True)
            remaining.pop(matched_name, None)

        if remaining:
            print(f"Aviso: espécies não encontradas: {list(remaining.keys())}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai modelos 3D de Pokémon de a/0/0/8 para .glb.")
    parser.add_argument("--garc", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--all", action="store_true", help="Extrai todas as espécies/formas com tag pmNNNN_NN")
    args = parser.parse_args()
    scan_pokemon_models(args.garc, args.out_dir, all_species=args.all)
    return 0


if __name__ == "__main__":
    sys.exit(main())
