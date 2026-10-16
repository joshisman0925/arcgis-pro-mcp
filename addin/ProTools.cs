using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Windows;
using ArcGIS.Core.CIM;
using ArcGIS.Core.Data;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Framework;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using ArcGIS.Desktop.Mapping;
using ArcGIS.Desktop.Layouts;

namespace ProConnector;

internal static partial class ProTools
{
    internal static readonly string[] Actions = [
        "ping", "get_map", "get_fields", "get_selection", "set_visibility", "rename_layer",
        "query_features", "get_layer_source", "select_features", "clear_selection", "zoom_to",
        "get_renderer", "set_simple_renderer", "set_graduated_renderer", "restore_renderer", "set_transparency",
        "add_layer", "remove_layer", "create_group", "move_layer", "list_maps", "activate_map",
        "get_raster_info", "get_camera", "set_camera", "set_layer_elevation", "set_vertical_exaggeration",
        "list_layouts", "export_map", "export_layout", "list_geoprocessing_tools", "run_geoprocessing",
        "update_attributes", "create_feature", "get_project_state", "save_edits", "save_project"
    ];

    internal static async Task<object> ExecuteAsync(JsonElement r)
    {
        var action = S(r, "action");
        if (!Actions.Contains(action)) throw new ArgumentException("Unknown action");
        if (action == "ping") return new { connected = true, processId = Environment.ProcessId, version = "0.3.1", actions = Actions };
        if (action == "run_geoprocessing") return await RunGeoprocessing(r);
        if (action == "activate_map") {
            var map = await QueuedTask.Run(() => Project.Current.GetItems<MapProjectItem>().Select(i => i.GetMap()).SingleOrDefault(m => m.URI == S(r, "mapUri"))
                ?? throw new ArgumentException("Map URI not found"));
            var activated = await UI(async () => {
                var existing = FrameworkApplication.Panes.OfType<ArcGIS.Desktop.Framework.Contracts.Pane>().FirstOrDefault(p => p is IMapPane mp && mp.MapView?.Map?.URI == map.URI);
                if (existing != null) existing.Activate();
                else await FrameworkApplication.Panes.CreateMapPaneAsync(map);
                return new { mapUri = map.URI, name = map.Name };
            });
            for (var attempt = 0; attempt < 30; attempt++) {
                if (await QueuedTask.Run(() => MapView.Active?.Map?.URI == map.URI)) return activated;
                await Task.Delay(100);
            }
            throw new InvalidOperationException("Map pane was activated but is not ready yet; wait and call get_map before the next map operation.");
        }
        if (action == "save_edits") {
            Confirm(r, "confirmAllPendingEdits");
            return await UI(async () => {
                if (!await Project.Current.SaveEditsAsync()) throw new InvalidOperationException("Saving edits failed");
                return new { saved = true, scope = "all pending data edits", hasEdits = Project.Current.HasEdits };
            });
        }
        if (action == "save_project") {
            Confirm(r, "confirmEntireProject");
            return await UI(async () => {
                if (string.IsNullOrWhiteSpace(Project.Current.Path) || !File.Exists(Project.Current.Path)) throw new InvalidOperationException("Save the new project to an APRX in Pro first; this tool only saves an existing project.");
                if (!await Project.Current.SaveAsync()) throw new InvalidOperationException("Saving project failed");
                return new { saved = true, path = Project.Current.Path, dataEditsSaved = false };
            });
        }
        return await QueuedTask.Run(() => Dispatch(r, action));
    }

    private static async Task<object> UI(Func<Task<object>> action) => await Application.Current.Dispatcher.InvokeAsync(action).Task.Unwrap();
    internal static MapView View() => MapView.Active ?? throw new InvalidOperationException("Open and activate a map or scene first.");
    internal static Layer Layer(JsonElement r) => View().Map.GetLayersAsFlattenedList().SingleOrDefault(l => l.URI == S(r, "layerUri"))
        ?? throw new ArgumentException("Layer URI not found in active map; call get_map again.");
    internal static FeatureLayer Feature(JsonElement r) => Layer(r) as FeatureLayer ?? throw new ArgumentException("Requires a feature layer.");
    internal static string S(JsonElement r, string key) => r.GetProperty(key).GetString() is { Length: > 0 } s ? s : throw new ArgumentException($"{key} cannot be empty");
    internal static string? Optional(JsonElement r, string key) => r.TryGetProperty(key, out var p) && p.ValueKind != JsonValueKind.Null ? p.GetString() : null;
    internal static int I(JsonElement r, string key, int fallback = 0) => r.TryGetProperty(key, out var p) ? p.GetInt32() : fallback;
    internal static double D(JsonElement r, string key, double fallback = 0) {
        if (!r.TryGetProperty(key, out var p)) return fallback;
        var value = p.GetDouble();
        return double.IsFinite(value) ? value : throw new ArgumentException($"{key} must be finite");
    }
    internal static bool B(JsonElement r, string key) => r.TryGetProperty(key, out var p) && p.GetBoolean();
    internal static void Confirm(JsonElement r, string key = "confirm") { if (!B(r, key)) throw new ArgumentException($"{key}=true is required"); }
    internal static void Range(double value, double min, double max, string label) { if (!double.IsFinite(value) || value < min || value > max) throw new ArgumentOutOfRangeException(label); }
    internal static object? Value(object? value) => value is null or DBNull ? null : value switch {
        long n => n.ToString(CultureInfo.InvariantCulture), DateTime date => date.ToString("O"),
        byte[] bytes => new { byteCount = bytes.Length },
        double n when !double.IsFinite(n) => n.ToString(CultureInfo.InvariantCulture),
        float n when !float.IsFinite(n) => n.ToString(CultureInfo.InvariantCulture), _ => value
    };
    internal static object? Cell(JsonElement e) => e.ValueKind switch {
        JsonValueKind.Null => null, JsonValueKind.String => e.GetString(), JsonValueKind.True => true,
        JsonValueKind.False => false, JsonValueKind.Number => e.TryGetInt64(out var n) ? (object)n : e.GetDouble(),
        _ => throw new ArgumentException("Attribute values must be scalar")
    };
    internal static long[] Ids(JsonElement r, string key = "objectIds") {
        if (!r.TryGetProperty(key, out var p)) return [];
        return p.EnumerateArray().Select(e => long.Parse(e.GetString()!, CultureInfo.InvariantCulture)).Distinct().ToArray();
    }
    internal static string NewOutput(string path, string? extension = null) {
        if (!Path.IsPathFullyQualified(path) || path.StartsWith("\\\\")) throw new ArgumentException("Output must be an absolute local path.");
        path = Path.GetFullPath(path);
        if (File.Exists(path) || Directory.Exists(path)) throw new IOException("Output already exists; choose a new path.");
        if (extension != null && !Path.GetExtension(path).Equals(extension, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException($"Output extension must be {extension}");
        if (!Directory.Exists(Path.GetDirectoryName(path))) throw new DirectoryNotFoundException("Output parent folder must already exist.");
        return path;
    }
    internal static object LayerInfo(Layer l) => new { uri = l.URI, name = l.Name, type = l.GetType().Name, visible = l.IsVisible, transparency = l.Transparency,
        parentUri = l.Parent is GroupLayer group ? group.URI : null, selected = View().GetSelectedLayers().Any(s => s.URI == l.URI) };

    private static object Dispatch(JsonElement r, string action)
    {
        if (action == "list_maps") return new { maps = Project.Current.GetItems<MapProjectItem>().Select(i => { var m = i.GetMap(); return new { name = m.Name, uri = m.URI, type = m.MapType.ToString() }; }).ToArray() };
        if (action == "list_layouts") return new { layouts = Project.Current.GetItems<LayoutProjectItem>().Select(i => new { name = i.Name, uri = i.Path }).ToArray() };
        if (action == "list_geoprocessing_tools") return GpCatalog();
        if (action == "get_project_state") return new { path = Project.Current.Path, hasEdits = Project.Current.HasEdits, editingEnabled = Project.Current.IsEditingEnabled };
        if (action == "get_map") {
            var map = View().Map;
            return new { name = map.Name, uri = map.URI, type = map.MapType.ToString(), spatialReference = map.SpatialReference?.Wkid,
                layers = map.GetLayersAsFlattenedList().Select(LayerInfo).ToArray(),
                elevationSurfaces = map.GetElevationSurfaceLayers().Select(s => new { uri = s.URI, name = s.Name, verticalExaggeration = s.VerticalExaggeration }).ToArray() };
        }
        if (action is "get_camera" or "set_camera" or "zoom_to" or "set_vertical_exaggeration" or "export_map" or "export_layout") return ViewTool(r, action);
        if (action is "add_layer" or "remove_layer" or "create_group" or "move_layer" or "set_visibility" or "rename_layer" or "set_transparency" or "get_renderer" or "set_simple_renderer" or "set_graduated_renderer" or "restore_renderer" or "set_layer_elevation") return LayerTool(r, action);
        return DataTool(r, action);
    }
}
