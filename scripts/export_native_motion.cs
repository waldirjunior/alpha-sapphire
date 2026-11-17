using System.Buffers.Binary;
using SPICA.Formats.CtrH3D;
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
scene.SkeletalAnimations.Add(animation);
var dae = new DAE(scene, 0, scene.SkeletalAnimations.Count - 1,
    new DAEExportOptions { ExportSkinning = true });
dae.Save(args[3]);
Console.WriteLine($"GF1 clip={index} frames={motion.FramesCount} bones={motion.Bones.Count}");
