using System.Buffers.Binary;
using System.Numerics;
using SPICA.PICA.Commands;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using SPICA.Formats.CtrH3D;

byte[] ModelSection(byte[] blob)
{
    if (blob.AsSpan(0, 4).SequenceEqual("BCH\0"u8)) return blob;
    int index = blob.AsSpan(0, 2).SequenceEqual("GR"u8) ? 1 : 0;
    int start = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(4 + index * 4));
    int end = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(8 + index * 4));
    return blob.AsSpan(start, end - start).ToArray();
}

object Inspect(string file)
{
    byte[] blob = File.ReadAllBytes(file);
    var scenes = new List<H3D>();
    if (blob.AsSpan(0, 2).SequenceEqual("AD"u8))
    {
        int count = BinaryPrimitives.ReadUInt16LittleEndian(blob.AsSpan(2));
        for (int i = 0; i < count; i++)
        {
            int start = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(4 + i * 4));
            int end = BinaryPrimitives.ReadInt32LittleEndian(blob.AsSpan(8 + i * 4));
            if (end-start >= 4 && blob.AsSpan(start, 4).SequenceEqual("BCH\0"u8))
                scenes.Add(H3D.Open(blob.AsSpan(start, end-start).ToArray()));
        }
    }
    else scenes.Add(H3D.Open(ModelSection(blob)));
    return new {
        source = file, sha256 = Convert.ToHexString(SHA256.HashData(blob)).ToLowerInvariant(),
        resourceCounts = new {lights = scenes.Sum(s => s.Lights.Count), scenes = scenes.Sum(s => s.Scenes.Count),
            shaders = scenes.Sum(s => s.Shaders.Count), luts = scenes.Sum(s => s.LUTs.Count)},
        textures = scenes.SelectMany(scene => scene.Textures).Select(texture => new {texture.Name, texture.Width, texture.Height,
            rgba_sha256 = Convert.ToHexString(SHA256.HashData(texture.ToRGBA())).ToLowerInvariant()}),
        models = scenes.SelectMany(scene => scene.Models).Select(model => new {
            model.Name,
            materials = model.Materials.Select(material => {
                var p = material.MaterialParams;
                return new {
                    material.Name, material.EnabledTextures,
                    textureNames = new[] {material.Texture0Name, material.Texture1Name, material.Texture2Name},
                    material.TextureMappers, p.TextureCoords, p.TextureSources, p.TexCoordConfig,
                    p.Flags, p.FragmentFlags, p.LightSetIndex, p.FogIndex,
                    p.AmbientColor, p.DiffuseColor, p.EmissionColor,
                    p.Specular0Color, p.Specular1Color,
                    p.Constant0Color, p.Constant1Color, p.Constant2Color,
                    p.Constant3Color, p.Constant4Color, p.Constant5Color,
                    constantAssignments = Enumerable.Range(0, 6).Select(p.GetConstantIndex),
                    p.ColorScale, p.TexEnvStages, p.TexEnvBufferColor,
                    p.ColorOperation, p.BlendFunction, p.BlendColor, p.AlphaTest,
                    p.DepthColorMask, p.FaceCulling, p.BumpMode, p.BumpTexture,
                    p.ShaderReference, p.VtxShaderUniforms,
                    p.LUTDist0TableName, p.LUTDist1TableName, p.LUTFresnelTableName,
                    p.LUTReflecRTableName, p.LUTReflecGTableName, p.LUTReflecBTableName
                };
            }),
            meshes = model.Meshes.Select(mesh => {
                var vertices = mesh.GetVertices();
                var fixedColors = mesh.FixedAttributes.Where(a => a.Name == PICAAttributeName.Color)
                    .Select(a => new Vector4(a.Value.X, a.Value.Y, a.Value.Z, a.Value.W)).ToArray();
                var colors = fixedColors.Length != 0 ? fixedColors : mesh.Attributes.Any(a => a.Name == PICAAttributeName.Color)
                    ? vertices.Select(v => v.Color).ToArray() : Array.Empty<Vector4>();
                return new {mesh.MaterialIndex, vertices = vertices.Length,
                    colorSource = fixedColors.Length != 0 ? "fixed" : colors.Length != 0 ? "buffer" : "absent",
                    positionUv0 = vertices.Select(v => new[] {v.Position.X, v.Position.Y, v.Position.Z, v.TexCoord0.X, v.TexCoord0.Y}),
                    uv0Min = new[] {vertices.Min(v => v.TexCoord0.X), vertices.Min(v => v.TexCoord0.Y)},
                    uv0Max = new[] {vertices.Max(v => v.TexCoord0.X), vertices.Max(v => v.TexCoord0.Y)},
                    uv1Min = new[] {vertices.Min(v => v.TexCoord1.X), vertices.Min(v => v.TexCoord1.Y)},
                    uv1Max = new[] {vertices.Max(v => v.TexCoord1.X), vertices.Max(v => v.TexCoord1.Y)},
                    colorMin = colors.Length == 0 ? null : new[] {colors.Min(c => c.X), colors.Min(c => c.Y), colors.Min(c => c.Z), colors.Min(c => c.W)},
                    colorMax = colors.Length == 0 ? null : new[] {colors.Max(c => c.X), colors.Max(c => c.Y), colors.Max(c => c.Z), colors.Max(c => c.W)}};
            })
        })
    };
}

var options = new JsonSerializerOptions {IncludeFields = true};
options.Converters.Add(new JsonStringEnumConverter());
foreach (string file in args) Console.WriteLine(JsonSerializer.Serialize(Inspect(file), options));
