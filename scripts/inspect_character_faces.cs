using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text.Json;
using SPICA.Formats.CtrH3D;
using SPICA.Formats.CtrH3D.Animation;

byte[] Section(byte[] blob, int index)
{
    int start = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(4 + index * 4));
    int end = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(8 + index * 4));
    return blob.AsSpan(start, end - start).ToArray();
}

object FaceInfo(H3D scene, H3DAnimation animation, H3DAnimationElement element)
{
    var model = scene.Models[0];
    var material = model.Materials.Single(m => m.Name == element.Name);
    int materialIndex = model.Materials.ToList().IndexOf(material);
    var vertices = model.Meshes.Where(m => m.MaterialIndex == materialIndex)
        .SelectMany(m => m.GetVertices()).ToArray();
    var coord = material.MaterialParams.TextureCoords[1];
    var texture = scene.Textures.Single(t => t.Name == material.Texture1Name);
    var vector = (H3DAnimVector2D)element.Content;
    return new {
        material = material.Name, animation = animation.Name,
        frames = animation.FramesCount, target = element.TargetType.ToString(),
        uv_source = material.MaterialParams.TextureSources[1],
        uv_bounds = new[] {vertices.Min(v => v.TexCoord0.X), vertices.Max(v => v.TexCoord0.X),
            vertices.Min(v => v.TexCoord0.Y), vertices.Max(v => v.TexCoord0.Y)},
        scale = new[] {coord.Scale.X, coord.Scale.Y}, rotation = coord.Rotation,
        translation = new[] {coord.Translation.X, coord.Translation.Y},
        transform = coord.TransformType.ToString(), mapping = coord.MappingType.ToString(),
        texture = texture.Name, width = texture.Width, height = texture.Height,
        rgba_sha256 = Convert.ToHexString(SHA256.HashData(texture.ToRGBA())).ToLowerInvariant(),
        palette = Enumerable.Range(0, Math.Min(8, (int)animation.FramesCount / 10 + 1))
            .Select(i => new {id = i, frame = i * 10,
                translation = new[] {vector.X.GetFrameValue(i * 10), vector.Y.GetFrameValue(i * 10)}})
    };
}

List<object> InspectFaces(byte[] blob)
{
    int count = BinaryPrimitives.ReadUInt16LittleEndian(blob.AsSpan(2));
    if (count < 3 || !Section(blob, 2).AsSpan().StartsWith("BCH\0"u8))
        return new List<object>();
    var scene = H3D.Open(Section(blob, 0));
    var expressions = H3D.Open(Section(blob, 2));
    return expressions.MaterialAnimations.SelectMany(animation => animation.Elements
        .Where(element => element.TargetType == H3DTargetType.MaterialTexCoord1Trans &&
            element.Content is H3DAnimVector2D)
        .Select(element => FaceInfo(scene, animation, element))).ToList();
}

foreach (string file in args)
{
    byte[] blob = File.ReadAllBytes(file);
    Console.WriteLine(JsonSerializer.Serialize(new {model = Path.GetFileNameWithoutExtension(file),
        mm_sha256 = Convert.ToHexString(SHA256.HashData(blob)).ToLowerInvariant(), faces = InspectFaces(blob)}));
}
