using System.Text.Json;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Layouts;
using ArcGIS.Desktop.Mapping;

namespace ProConnector;

internal static partial class ProTools
{
    private static object CameraInfo(Camera c) => new { x = c.X, y = c.Y, z = c.Z, heading = c.Heading, pitch = c.Pitch, roll = c.Roll, scale = c.Scale, spatialReference = c.SpatialReference?.Wkid };
    private static object ViewTool(JsonElement r, string action)
    {
        if (action is "export_map" or "export_layout") return Export(r, action);
        var view = View();
        if (action == "get_camera") return new { viewingMode = view.ViewingMode.ToString(), camera = CameraInfo(view.Camera) };
        if (action == "set_camera") {
            var camera = view.Camera; var before = CameraInfo(camera);
            if (r.TryGetProperty("x", out _)) camera.X = D(r, "x");
            if (r.TryGetProperty("y", out _)) camera.Y = D(r, "y");
            if (r.TryGetProperty("z", out _)) camera.Z = D(r, "z");
            if (r.TryGetProperty("heading", out _)) { var value = D(r, "heading"); Range(value, -360, 360, "heading"); camera.Heading = value; }
            if (r.TryGetProperty("pitch", out _)) { var value = D(r, "pitch"); Range(value, -90, 90, "pitch"); camera.Pitch = value; }
            if (r.TryGetProperty("roll", out _)) { var value = D(r, "roll"); Range(value, -180, 180, "roll"); camera.Roll = value; }
            if (r.TryGetProperty("scale", out _)) { var value = D(r, "scale"); Range(value, double.Epsilon, double.MaxValue, "scale"); camera.Scale = value; }
            if (!view.ZoomTo(camera, TimeSpan.Zero)) throw new InvalidOperationException("Camera change failed");
            return new { before, after = CameraInfo(view.Camera) };
        }
        if (action == "zoom_to") {
            var target = S(r, "target");
            if (target == "selection" && Feature(r).SelectionCount == 0) throw new InvalidOperationException("No selected features in specified layer");
            var result = target switch {
                "full" => view.ZoomToFullExtent(TimeSpan.Zero),
                "layer" => view.ZoomTo(Layer(r), false, TimeSpan.Zero),
                "selection" => view.ZoomTo(Feature(r), true, TimeSpan.Zero),
                _ => throw new ArgumentException("Unknown zoom target")
            };
            if (!result) throw new InvalidOperationException("Zoom failed; check selection, data source, and extent");
            return new { zoomed = true, target, camera = CameraInfo(view.Camera) };
        }
        if (action == "set_vertical_exaggeration") {
            if (view.Map.MapType == ArcGIS.Core.CIM.MapType.Map) throw new ArgumentException("Requires a scene");
            var surface = view.Map.GetElevationSurfaceLayers().SingleOrDefault(s => s.URI == S(r, "surfaceUri")) ?? throw new ArgumentException("Surface URI not found");
            var factor = D(r, "factor"); Range(factor, double.Epsilon, 100, "factor");
            var before = surface.VerticalExaggeration; surface.SetVerticalExaggeration(factor);
            return new { uri = surface.URI, before, factor = surface.VerticalExaggeration };
        }
        throw new ArgumentException("Unknown view action");
    }

    private static object Export(JsonElement r, string action) {
            var format = S(r, "format"); if (format is not ("png" or "pdf")) throw new ArgumentException("Format must be png or pdf");
            var path = NewOutput(S(r, "outputPath"), "." + format);
            var dpi = I(r, "dpi", 150); Range(dpi, 72, 600, "dpi");
            ExportFormat output = format == "png" ? new PNGFormat() : new PDFFormat();
            output.OutputFileName = path; output.Resolution = dpi;
            if (action == "export_map") {
                var width = I(r, "width", 1920); var height = I(r, "height", 1080);
                Range(width, 100, 10000, "width"); Range(height, 100, 10000, "height");
                output.Width = width; output.Height = height;
                View().Export(output);
            } else {
                var item = Project.Current.GetItems<LayoutProjectItem>().SingleOrDefault(i => i.Path == S(r, "layoutUri")) ?? throw new ArgumentException("Layout URI not found");
                item.GetLayout().Export(output);
            }
            if (!System.IO.File.Exists(path)) throw new InvalidOperationException("Export did not create the requested output");
            return new { outputPath = path, format, dpi, bytes = new System.IO.FileInfo(path).Length };
    }
}
