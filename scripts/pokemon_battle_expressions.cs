#nullable enable
using System.Text.Json;
using System.Text.Json.Serialization;
using SPICA.Formats.CtrH3D;
using SPICA.Formats.CtrH3D.Animation;
using SPICA.Formats.CtrH3D.Model.Material;

var inputs = JsonDocument.Parse(File.ReadAllText(args[0]));
var output = new ExportDocument();
foreach (var job in inputs.RootElement.EnumerateArray())
{
    var slug = job.GetProperty("slug").GetString() ?? throw new InvalidDataException("Model slug is empty");
    var model = H3D.Open(ModelSection(File.ReadAllBytes(job.GetProperty("model").GetString()!)));
    var eyeMaterial = model.Models[0].Materials.FirstOrDefault(material => material.Name == "Eye");
    var profile = new ExpressionProfile();
    if (eyeMaterial is not null && eyeMaterial.EnabledTextures[0] && !string.IsNullOrEmpty(eyeMaterial.Texture0Name))
    {
        var translation = eyeMaterial.MaterialParams.TextureCoords[0].Translation;
        profile.eyeBaseTranslation = [translation.X, translation.Y];
    }

    foreach (var actionInput in job.GetProperty("actions").EnumerateObject())
    {
        var action = ReadAction(actionInput.Value, profile.eyeBaseTranslation is not null);
        if (action.meshVisibility?.Count > 0 || action.eyeTranslations?.Length > 0)
            profile.actions[actionInput.Name] = action;
    }
    if (profile.actions.Count > 0) output.pokemon[slug] = profile;
}
File.WriteAllText(args[1], JsonSerializer.Serialize(output, new JsonSerializerOptions {
    WriteIndented = true,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
}) + "\n");

static ActionExpression ReadAction(JsonElement input, bool hasEyeMaterial)
{
    var output = new ActionExpression();
    if (input.TryGetProperty("visibility", out var visibilityPath))
    {
        var animations = H3D.Open(File.ReadAllBytes(visibilityPath.GetString()!)).VisibilityAnimations;
        var animation = animations.FirstOrDefault();
        if (animation is not null)
        {
            var frameCount = LastFrame(animation.FramesCount);
            foreach (var element in animation.Elements)
            {
                if (!element.Name.Contains("mouth", StringComparison.OrdinalIgnoreCase) || element.Content is not H3DAnimBoolean curve || curve.Values.Count == 0)
                    continue;
                output.meshVisibility ??= new Dictionary<string, VisibilityKey[]>();
                output.meshVisibility[element.Name] = visibilityKeys(curve, frameCount);
            }
        }
    }

    if (hasEyeMaterial && input.TryGetProperty("material", out var materialPath))
    {
        var animations = H3D.Open(File.ReadAllBytes(materialPath.GetString()!)).MaterialAnimations;
        var animation = animations.FirstOrDefault();
        var element = animation?.Elements.FirstOrDefault(candidate => candidate.Name == "Eye" &&
            candidate.TargetType == H3DTargetType.MaterialTexCoord0Trans);
        if (element?.Content is H3DAnimVector2D curve)
        {
            var frameCount = LastFrame(animation!.FramesCount);
            output.eyeTranslations = eyeTranslationKeys(curve, frameCount);
        }
    }
    return output;
}

static int LastFrame(float frameCount) => Math.Max(0, (int)Math.Ceiling(frameCount));

static VisibilityKey[] visibilityKeys(H3DAnimBoolean curve, int lastFrame)
{
    var keys = new List<VisibilityKey>();
    bool? previous = null;
    for (var frame = 0; frame <= lastFrame; frame++)
    {
        var visible = curve.GetFrameValue(frame);
        if (previous == visible) continue;
        keys.Add(new VisibilityKey { frame = frame, visible = visible });
        previous = visible;
    }
    return keys.ToArray();
}

static EyeTranslationKey[] eyeTranslationKeys(H3DAnimVector2D curve, int lastFrame)
{
    var keys = new List<EyeTranslationKey>();
    (float x, float y)? previous = null;
    for (var frame = 0; frame <= lastFrame; frame++)
    {
        var translation = (curve.X.GetFrameValue(frame), curve.Y.GetFrameValue(frame));
        if (previous == translation) continue;
        keys.Add(new EyeTranslationKey { frame = frame, x = translation.Item1, y = translation.Item2 });
        previous = translation;
    }
    return keys.ToArray();
}

static byte[] ModelSection(byte[] raw)
{
    var start = BitConverter.ToInt32(raw, 4);
    var end = BitConverter.ToInt32(raw, 8);
    if (start < 12 || end < start || end > raw.Length)
        throw new InvalidDataException($"Invalid Pokémon BCH section: {start}..{end} in {raw.Length} bytes");
    return raw.AsSpan(start, end - start).ToArray();
}

sealed class ExportDocument
{
    public int schemaVersion { get; set; } = 1;
    public Dictionary<string, ExpressionProfile> pokemon { get; set; } = new();
}

sealed class ExpressionProfile
{
    public int fps { get; set; } = 30;
    public float[]? eyeBaseTranslation { get; set; }
    public Dictionary<string, ActionExpression> actions { get; set; } = new();
}

sealed class ActionExpression
{
    public EyeTranslationKey[]? eyeTranslations { get; set; }
    public Dictionary<string, VisibilityKey[]>? meshVisibility { get; set; }
}

sealed class EyeTranslationKey
{
    public int frame { get; set; }
    public float x { get; set; }
    public float y { get; set; }
}

sealed class VisibilityKey
{
    public int frame { get; set; }
    public bool visible { get; set; }
}
