import sys

import bpy

source, output, name = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.wm.collada_import(filepath=source)
armatures = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
if not armatures or not bpy.data.actions:
    raise ValueError(f'Native animation missing after COLLADA import: {source}')
for armature in armatures:
    if armature.animation_data and armature.animation_data.action:
        action = armature.animation_data.action
        action.name = name
        for curve in action.fcurves:
            for keyframe in curve.keyframe_points:
                keyframe.co.x = round(keyframe.co.x)
            curve.update()
        bpy.context.scene.frame_start = round(action.frame_range[0])
        bpy.context.scene.frame_end = round(action.frame_range[1])
        track = armature.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, round(action.frame_range[0]), action)
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format='GLB',
    export_skins=True,
    export_animations=True,
    export_force_sampling=True,
    export_nla_strips=True,
)
