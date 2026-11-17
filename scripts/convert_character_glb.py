#!/usr/bin/env python3
"""Converte personagens MM (a/0/2/1) para .glb com esqueleto e animações (idle/walk) via SpicaExport + Blender."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SPICA_EXPORT = Path("/opt/tools/SpicaExport/bin/Release/net8.0/SpicaExport")

BLENDER_SCRIPT = """
import bpy
import math
import sys
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
idle_dae, walk_dae, out_glb = argv[0], argv[1], argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.collada_import(filepath=idle_dae)

armature = next((obj for obj in bpy.data.objects if obj.type == 'ARMATURE'), None)


def set_arm_pose(arm, bone_name, rot_armature, frame=None):
    pb = arm.pose.bones.get(bone_name)
    bone = arm.data.bones.get(bone_name)
    if not pb or not bone:
        return
    m_rest = bone.matrix_local.to_3x3()
    q = (m_rest.inverted() @ rot_armature @ m_rest).to_quaternion()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = q
    if frame is not None:
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)


def clear_pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)


def build_idle_action(arm):
    action = bpy.data.actions.new(name="idle")
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    clear_pose(arm)

    for frame, breath_deg in ((1, 0.0), (25, 2.0), (49, 0.0)):
        set_arm_pose(arm, "LArmA", Matrix.Rotation(math.radians(-68.0 - breath_deg), 3, 'Z'), frame)
        set_arm_pose(arm, "RArmA", Matrix.Rotation(math.radians(68.0 + breath_deg), 3, 'Z'), frame)
        set_arm_pose(arm, "LForeArm", Matrix.Rotation(math.radians(-12.0), 3, 'Y'), frame)
        set_arm_pose(arm, "RForeArm", Matrix.Rotation(math.radians(12.0), 3, 'Y'), frame)
        set_arm_pose(arm, "Spine2", Matrix.Rotation(math.radians(breath_deg * 0.75), 3, 'X'), frame)
        set_arm_pose(arm, "LThigh", Matrix.Rotation(math.radians(-2.0), 3, 'Z'), frame)
        set_arm_pose(arm, "RThigh", Matrix.Rotation(math.radians(2.0), 3, 'Z'), frame)

    return action


def build_walk_action(arm):
    action = bpy.data.actions.new(name="walk")
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    clear_pose(arm)

    # Ciclo de 24 frames (1s @ 24fps): pernas e braços em oposição
    keyframes = [
        (1,  -24.0,  24.0,  6.0, 18.0,  22.0, -22.0, 0.0),
        (7,    0.0,   0.0, 26.0,  4.0,   0.0,   0.0, 0.35),
        (13,  24.0, -24.0, 18.0,  6.0, -22.0,  22.0, 0.0),
        (19,   0.0,   0.0,  4.0, 26.0,   0.0,   0.0, 0.35),
        (25, -24.0,  24.0,  6.0, 18.0,  22.0, -22.0, 0.0),
    ]
    for frame, l_thigh, r_thigh, l_knee, r_knee, l_arm_x, r_arm_x, bob in keyframes:
        r_l_arm = Matrix.Rotation(math.radians(l_arm_x), 3, 'X') @ Matrix.Rotation(math.radians(-68.0), 3, 'Z')
        r_r_arm = Matrix.Rotation(math.radians(r_arm_x), 3, 'X') @ Matrix.Rotation(math.radians(68.0), 3, 'Z')
        set_arm_pose(arm, "LArmA", r_l_arm, frame)
        set_arm_pose(arm, "RArmA", r_r_arm, frame)
        set_arm_pose(arm, "LForeArm", Matrix.Rotation(math.radians(-16.0), 3, 'Y'), frame)
        set_arm_pose(arm, "RForeArm", Matrix.Rotation(math.radians(16.0), 3, 'Y'), frame)
        set_arm_pose(arm, "LThigh", Matrix.Rotation(math.radians(l_thigh), 3, 'X'), frame)
        set_arm_pose(arm, "RThigh", Matrix.Rotation(math.radians(r_thigh), 3, 'X'), frame)
        set_arm_pose(arm, "LLeg", Matrix.Rotation(math.radians(l_knee), 3, 'X'), frame)
        set_arm_pose(arm, "RLeg", Matrix.Rotation(math.radians(r_knee), 3, 'X'), frame)
        waist = arm.pose.bones.get("Waist")
        if waist:
            waist.location = (0.0, bob, 0.0)
            waist.keyframe_insert(data_path="location", frame=frame)

    return action


if armature:
    bpy.context.view_layer.objects.active = armature
    idle_action = build_idle_action(armature)
    walk_action = build_walk_action(armature)

    for act in (idle_action, walk_action):
        track = armature.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.name = act.name

    armature.animation_data.action = idle_action

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


def convert_character(mm_path: Path, out_glb: Path, walk_slot: int = 1) -> None:
    if not SPICA_EXPORT.is_file():
        raise FileNotFoundError(f"SpicaExport não encontrado: {SPICA_EXPORT}")
    if not mm_path.is_file():
        raise FileNotFoundError(f"Arquivo de personagem não encontrado: {mm_path}")

    out_glb.parent.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, "DOTNET_ROOT": os.environ.get("DOTNET_ROOT", "/root/.dotnet")}

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        idle_dae = tmp_path / "idle.dae"
        walk_dae = tmp_path / "walk.dae"
        py_path = tmp_path / "blender_convert.py"
        py_path.write_text(BLENDER_SCRIPT, encoding="utf-8")

        subprocess.run([str(SPICA_EXPORT), str(mm_path), str(idle_dae), "", "0", "0"], check=True, env=env)
        walk_arg = "NONE"
        try:
            subprocess.run([str(SPICA_EXPORT), str(mm_path), str(walk_dae), "", "0", str(walk_slot)], check=True, env=env)
            if walk_dae.is_file() and "<animation " in walk_dae.read_text(encoding="utf-8", errors="ignore"):
                walk_arg = str(walk_dae)
        except subprocess.CalledProcessError:
            pass

        subprocess.run(
            ["blender", "--background", "--python", str(py_path), "--", str(idle_dae), walk_arg, str(out_glb)],
            check=True,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte personagens MM para .glb animado via SpicaExport + Blender.")
    parser.add_argument("--char-dir", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    targets = {
        "brendan": "0314.bin",
        "may": "0315.bin",
        "npc": "0045.bin",
    }

    for name, bin_name in targets.items():
        out_glb = args.out_dir / name / f"{name}.glb"
        convert_character(args.char_dir / bin_name, out_glb)
        print(f"Gerado {out_glb} ({out_glb.stat().st_size} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
