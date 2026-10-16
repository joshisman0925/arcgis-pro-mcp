using System.Globalization;
using System.Text.Json;
using ArcGIS.Core.Geometry;
using ArcGIS.Desktop.Core.Geoprocessing;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using ArcGIS.Desktop.Mapping;

namespace ProConnector;

internal static partial class ProTools
{
    private static object GpCatalog() => new { tools = new object[] {
        new { name = "buffer", sdkTool = "analysis.Buffer", inputs = "exactly 1 feature layer", parameters = "distance > 0, distanceUnit, outputPath" },
        new { name = "clip", sdkTool = "analysis.Clip", inputs = "exactly 2: input then clip polygon", parameters = "outputPath" },
        new { name = "intersect", sdkTool = "analysis.Intersect", inputs = "2–10 feature layers; license may impose a lower limit", parameters = "outputPath" },
        new { name = "project", sdkTool = "management.Project", inputs = "exactly 1 feature layer", parameters = "targetWkid, outputPath; no custom datum transformation in this version" },
        new { name = "copy_features", sdkTool = "management.CopyFeatures", inputs = "exactly 1 feature layer", parameters = "outputPath" }
    }, notes = "Current input selections and definition queries may affect results. Outputs persist immediately; saving the APRX is separate. Existing outputs are never overwritten." };

    private static async Task<object> RunGeoprocessing(JsonElement r)
    {
        Confirm(r);
        var tool = S(r, "tool");
        if (!new[] { "buffer", "clip", "intersect", "project", "copy_features" }.Contains(tool)) throw new ArgumentException("Geoprocessing tool is not allowed");
        var prepared = await QueuedTask.Run(() => {
            var uris = r.GetProperty("inputLayerUris").EnumerateArray().Select(e => e.GetString()).ToArray();
            if (uris.Length is < 1 or > 10) throw new ArgumentException("Provide 1–10 input layers");
            var layers = uris.Select(uri => View().Map.GetLayersAsFlattenedList().SingleOrDefault(l => l.URI == uri) as FeatureLayer
                ?? throw new ArgumentException("Input feature layer URI not found")).ToArray();
            if (tool is "buffer" or "project" or "copy_features" && layers.Length != 1) throw new ArgumentException("This tool requires exactly one input");
            if (tool == "clip" && layers.Length != 2 || tool == "intersect" && layers.Length < 2) throw new ArgumentException("This tool requires at least two inputs (Clip: exactly two)");
            var output = NewOutput(S(r, "outputPath"));
            string sdkTool; IReadOnlyList<string> values;
            if (tool == "buffer") {
                var distance = D(r, "distance"); Range(distance, double.Epsilon, 10000000, "distance");
                var unit = S(r, "distanceUnit"); if (!new[] { "Meters", "Kilometers", "Feet" }.Contains(unit)) throw new ArgumentException("Unsupported distance unit");
                sdkTool = "analysis.Buffer";
                values = Geoprocessing.MakeValueArray(layers[0], output, distance.ToString("R", CultureInfo.InvariantCulture) + " " + unit);
            } else if (tool == "clip") {
                sdkTool = "analysis.Clip"; values = Geoprocessing.MakeValueArray(layers[0], layers[1], output);
            } else if (tool == "intersect") {
                sdkTool = "analysis.Intersect"; values = Geoprocessing.MakeValueArray(layers, output);
            } else if (tool == "project") {
                var wkid = I(r, "targetWkid"); Range(wkid, 1, int.MaxValue, "targetWkid");
                sdkTool = "management.Project"; values = Geoprocessing.MakeValueArray(layers[0], output, SpatialReferenceBuilder.CreateSpatialReference(wkid));
            } else { sdkTool = "management.CopyFeatures"; values = Geoprocessing.MakeValueArray(layers[0], output); }
            return (sdkTool, values, output);
        });
        var result = await Geoprocessing.ExecuteToolAsync(prepared.sdkTool, prepared.values,
            Geoprocessing.MakeEnvironmentArray(overwriteoutput: false), (CancellationToken?)null, null, GPExecuteToolFlags.AddToHistory | GPExecuteToolFlags.GPThread | GPExecuteToolFlags.RefreshProjectItems);
        if (result.IsFailed || result.IsCanceled) throw new InvalidOperationException($"Geoprocessing failed/canceled ({result.ErrorCode}): " + string.Join("; ", result.Messages.Select(m => m.Text)));
        return new { tool, outputPath = prepared.output, returnValue = result.ReturnValue, persisted = true, addedToMap = false,
            messages = result.Messages.Select(m => new { type = m.Type.ToString(), text = m.Text }).ToArray() };
    }
}
