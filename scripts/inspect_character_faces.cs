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

object FaceInfo(H3D scene, string name, int slot,
    H3DAnimation animation = null, H3DAnimationElement element = null)
{
    var model = scene.Models[0];
    var material = model.Materials.Single(m => m.Name == name);
    int materialIndex = model.Materials.ToList().IndexOf(material);
    var vertices = model.Meshes.Where(m => m.MaterialIndex == materialIndex)
        .SelectMany(m => m.GetVertices()).ToArray();
    var coord = material.MaterialParams.TextureCoords[slot];
    var textures = new[] {material.Texture0Name, material.Texture1Name, material.Texture2Name};
    var texture = scene.Textures.Single(t => t.Name == textures[slot]);
    var vector = element?.Content as H3DAnimVector2D;
    return new {
        material = material.Name, animation = animation?.Name,
        frames = animation?.FramesCount, target = element?.TargetType.ToString() ?? "BaseColorUV",
        native_slot = slot, uv_source = material.MaterialParams.TextureSources[slot],
        uv_bounds = new[] {vertices.Min(v => v.TexCoord0.X), vertices.Max(v => v.TexCoord0.X),
            vertices.Min(v => v.TexCoord0.Y), vertices.Max(v => v.TexCoord0.Y)},
        scale = new[] {coord.Scale.X, coord.Scale.Y}, rotation = coord.Rotation,
        translation = new[] {coord.Translation.X, coord.Translation.Y},
        transform = coord.TransformType.ToString(), mapping = coord.MappingType.ToString(),
        texture = texture.Name, width = texture.Width, height = texture.Height,
        rgba_sha256 = Convert.ToHexString(SHA256.HashData(texture.ToRGBA())).ToLowerInvariant(),
        palette = Enumerable.Range(0, animation == null ? 0 : Math.Min(8, (int)animation.FramesCount / 10 + 1))
            .Select(i => new {id = i, frame = i * 10,
                translation = new[] {vector.X.GetFrameValue(i * 10), vector.Y.GetFrameValue(i * 10)}})
    };
}

List<object> InspectFaces(byte[] blob)
{
    var scene = H3D.Open(Section(blob, 0));
    var rows = new List<object>();
    var animated = new HashSet<string>();
    int count = BinaryPrimitives.ReadUInt16LittleEndian(blob.AsSpan(2));
    if (count >= 3 && Section(blob, 2).AsSpan().StartsWith("BCH\0"u8))
    {
        var expressions = H3D.Open(Section(blob, 2));
        foreach (var animation in expressions.MaterialAnimations)
        foreach (var element in animation.Elements.Where(e =>
            e.TargetType == H3DTargetType.MaterialTexCoord1Trans && e.Content is H3DAnimVector2D))
        {
            rows.Add(FaceInfo(scene, element.Name, 1, animation, element));
            animated.Add(element.Name);
        }
    }
    foreach (var material in scene.Models[0].Materials.Where(m => !animated.Contains(m.Name) &&
        (m.Name.Contains("face", StringComparison.OrdinalIgnoreCase) ||
         m.Name.Contains("head", StringComparison.OrdinalIgnoreCase))))
    {
        var textures = new[] {material.Texture0Name, material.Texture1Name, material.Texture2Name};
        for (int slot = 0; slot < textures.Length; slot++)
            if (scene.Textures.Any(t => t.Name == textures[slot]))
                rows.Add(FaceInfo(scene, material.Name, slot));
    }
    return rows;
}

foreach (string file in args)
{
    byte[] blob = File.ReadAllBytes(file);
    Console.WriteLine(JsonSerializer.Serialize(new {model = Path.GetFileNameWithoutExtension(file),
        mm_sha256 = Convert.ToHexString(SHA256.HashData(blob)).ToLowerInvariant(), faces = InspectFaces(blob)}));
}
