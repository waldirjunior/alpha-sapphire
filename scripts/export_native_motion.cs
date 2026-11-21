using System.Buffers.Binary;
using SPICA.Formats.CtrH3D;
using SPICA.Formats.CtrH3D.Animation;
using SPICA.Formats.CtrH3D.Model;
using SPICA.Formats.GFL;
using SPICA.Formats.Generic.COLLADA;

static byte[] ModelSection(byte[] raw)
{
    var start = BinaryPrimitives.ReadInt32LittleEndian(raw.AsSpan(4, 4));
    var end = BinaryPrimitives.ReadInt32LittleEndian(raw.AsSpan(8, 4));
    if (start < 12 || end < start || end > raw.Length)
        throw new InvalidDataException($"Invalid model section offsets: {start}..{end}");
    return raw.AsSpan(start, end - start).ToArray();
}

var scene = H3D.Open(ModelSection(File.ReadAllBytes(args[0])));
using var stream = File.OpenRead(args[1]);
var pack = new GF1MotionPack(stream);
var index = int.Parse(args[2]);
var motion = pack.Single(motion => motion.Index == index);
var animation = motion.ToH3DSkeletalAnimation(scene.Models[0].Skeleton);
animation.Name = $"motion_{index}";
restoreZeroScaleTracks(scene.Models[0], animation);
scene.SkeletalAnimations.Add(animation);
var dae = new DAE(scene, 0, scene.SkeletalAnimations.Count - 1,
    new DAEExportOptions { ExportSkinning = true });
dae.Save(args[3]);
Console.WriteLine($"GF1 clip={index} frames={motion.FramesCount} bones={motion.Bones.Count}");

static void restoreZeroScaleTracks(H3DModel model, H3DAnimation animation)
{
    foreach (var track in animation.Elements)
    {
        if (track.Content is not H3DAnimTransform transform || !model.Skeleton.Contains(track.Name)) continue;
        var bone = model.Skeleton[track.Name];
        var changed = restoreZeroScale(transform.ScaleX, bone.Scale.X) |
            restoreZeroScale(transform.ScaleY, bone.Scale.Y) |
            restoreZeroScale(transform.ScaleZ, bone.Scale.Z);
        if (changed) Console.WriteLine($"GF1 zero scale channels use BCH rest scale for bone {bone.Name}: {bone.Scale}");
    }
}

static bool restoreZeroScale(H3DFloatKeyFrameGroup group, float restScale)
{
    if (restScale == 0 || !group.Exists || !group.KeyFrames.All(key => key.Value == 0 && key.InSlope == 0 && key.OutSlope == 0))
        return false;
    group.KeyFrames.Clear();
    return true;
}
