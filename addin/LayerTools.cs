using System.Globalization;
using System.Text.Json;
using ArcGIS.Core.CIM;
using ArcGIS.Core.Data;
using ArcGIS.Core.Geometry;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Mapping;

namespace ProConnector;

internal static partial class ProTools
{
    private sealed record RendererSnapshot(string Project, string Map, string Layer, CIMRenderer Renderer);
    private static readonly Dictionary<string, RendererSnapshot> Renderers = new();
    private static string Snapshot(FeatureLayer layer) {
        if (Renderers.Count >= 100) Renderers.Remove(Renderers.Keys.First());
        var token = Guid.NewGuid().ToString("N");
        Renderers.Add(token, new(Project.Current.Path, View().Map.URI, layer.URI, (CIMRenderer)CIMObject.Clone(layer.GetRenderer())));
        return token;
    }
    private static CIMColor Color(string hex) {
        if (!System.Text.RegularExpressions.Regex.IsMatch(hex, "^#[0-9a-fA-F]{6}$")) throw new ArgumentException("Color must be #RRGGBB");
        return ColorFactory.Instance.CreateRGBColor(Convert.ToByte(hex[1..3], 16), Convert.ToByte(hex[3..5], 16), Convert.ToByte(hex[5..7], 16));
    }
    private static CIMSymbol Symbol(FeatureLayer layer, CIMColor color, double size) {
        using var fc = layer.GetFeatureClass(); using var definition = fc.GetDefinition();
        return definition.GetShapeType() switch {
            GeometryType.Point or GeometryType.Multipoint => SymbolFactory.Instance.ConstructPointSymbol(color, size, SimpleMarkerStyle.Circle),
            GeometryType.Polyline => SymbolFactory.Instance.ConstructLineSymbol(color, size),
            GeometryType.Polygon => SymbolFactory.Instance.ConstructPolygonSymbol(color, SimpleFillStyle.Solid),
            GeometryType.Multipatch => SymbolFactory.Instance.ConstructMeshSymbol(color),
            _ => throw new ArgumentException("Unsupported geometry for simple symbol")
        };
    }
    private static GroupLayer Group(string uri) => View().Map.GetLayersAsFlattenedList().OfType<GroupLayer>().SingleOrDefault(g => g.URI == uri)
        ?? throw new ArgumentException("Group URI not found");

    private static object LayerTool(JsonElement r, string action)
    {
        if (action == "create_group") {
            var parent = Optional(r, "parentGroupUri"); var name = S(r, "name");
            if (name.Length > 255 || string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Invalid name");
            ILayerContainerEdit container = parent == null ? View().Map : Group(parent);
            return LayerInfo(LayerFactory.Instance.CreateGroupLayer(container, -1, name));
        }
        if (action == "add_layer") {
            var source = S(r, "source");
            if (!Uri.TryCreate(source, UriKind.Absolute, out var uri) || (!uri.IsFile && (uri.Scheme != "https" || !string.IsNullOrEmpty(uri.UserInfo))))
                throw new ArgumentException("Source must be an absolute local dataset path or HTTPS service URI without embedded credentials");
            var parent = Optional(r, "groupUri");
            ILayerContainerEdit container = parent == null ? View().Map : Group(parent);
            return LayerInfo(LayerFactory.Instance.CreateLayer(uri, container, -1, Optional(r, "name")));
        }
        var layer = Layer(r);
        if (action == "set_visibility") {
            var before = layer.IsVisible; layer.SetVisibility(B(r, "visible"));
            return new { uri = layer.URI, before, visible = layer.IsVisible };
        }
        if (action == "rename_layer") {
            var name = S(r, "name"); if (name.Length > 255 || string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Invalid name");
            var before = layer.Name; layer.SetName(name);
            return new { uri = layer.URI, before, name = layer.Name };
        }
        if (action == "set_transparency") {
            var value = D(r, "transparency"); Range(value, 0, 100, "transparency");
            var before = layer.Transparency; layer.SetTransparency(value);
            return new { uri = layer.URI, before, transparency = layer.Transparency };
        }
        if (action == "remove_layer") {
            Confirm(r); var before = LayerInfo(layer); View().Map.RemoveLayer(layer);
            return new { removed = before, sourceDataDeleted = false };
        }
        if (action == "move_layer") {
            var groupUri = Optional(r, "groupUri"); var group = groupUri == null ? null : Group(groupUri);
            if (group == layer || (layer is GroupLayer moving && group != null && moving.GetLayersAsFlattenedList().Any(l => l.URI == group.URI))) throw new ArgumentException("Cannot move a group into itself or a descendant");
            var index = I(r, "index"); Range(index, 0, (group == null ? View().Map.Layers.Count : group.Layers.Count), "index");
            var before = LayerInfo(layer);
            if (group == null) View().Map.MoveLayer(layer, index); else View().Map.MoveLayer(layer, group, index);
            return new { before, after = LayerInfo(layer), index };
        }
        var fl = layer as FeatureLayer ?? throw new ArgumentException("Requires feature layer");
        if (action == "get_renderer") {
            var token = Snapshot(fl);
            return new { layerUri = fl.URI, token, rendererJson = fl.GetRenderer().ToJson() };
        }
        if (action == "restore_renderer") {
            var token = S(r, "token");
            if (!Renderers.TryGetValue(token, out var snapshot) || snapshot.Project != Project.Current.Path || snapshot.Map != View().Map.URI || snapshot.Layer != fl.URI)
                throw new ArgumentException("Snapshot does not belong to this project/map/layer, expired, or Pro was restarted");
            fl.SetRenderer((CIMRenderer)CIMObject.Clone(snapshot.Renderer));
            return new { layerUri = fl.URI, restored = true, token };
        }
        if (action is "set_simple_renderer" or "set_graduated_renderer") {
            CIMRenderer renderer;
            if (action == "set_simple_renderer") {
                var size = D(r, "size", 3); Range(size, 0.1, 100, "size");
                renderer = new CIMSimpleRenderer { Symbol = Symbol(fl, Color(S(r, "color")), size).MakeSymbolReference() };
            } else {
                using var table = fl.GetTable(); using var td = table.GetDefinition();
                var field = FindField(td, S(r, "field"));
                if (field.FieldType is not (FieldType.Integer or FieldType.SmallInteger or FieldType.BigInteger or FieldType.Single or FieldType.Double)) throw new ArgumentException("Graduated colors requires a numeric field");
                var classes = I(r, "classes", 5); Range(classes, 2, 20, "classes");
                var method = S(r, "method") switch { "NaturalBreaks" => ClassificationMethod.NaturalBreaks, "EqualInterval" => ClassificationMethod.EqualInterval, "Quantile" => ClassificationMethod.Quantile, _ => throw new ArgumentException("Unknown classification method") };
                var definition = new GraduatedColorsRendererDefinition {
                    ClassificationField = field.Name, BreakCount = classes, ClassificationMethod = method,
                    ColorRamp = ColorFactory.Instance.ConstructColorRamp(ColorRampAlgorithm.LinearContinuous, Color(S(r, "startColor")), Color(S(r, "endColor"))),
                    SymbolTemplate = Symbol(fl, Color(S(r, "startColor")), 3).MakeSymbolReference()
                };
                renderer = fl.CreateRenderer(definition);
            }
            if (!fl.CanSetRenderer(renderer, FeatureRendererTarget.Default)) throw new ArgumentException("Renderer not supported by layer");
            var token = Snapshot(fl); fl.SetRenderer(renderer);
            return new { layerUri = fl.URI, restoreToken = token, rendererJson = fl.GetRenderer().ToJson(), saved = false };
        }
        if (action == "set_layer_elevation") {
            if (View().Map.MapType == MapType.Map) throw new ArgumentException("Elevation settings require a 3D scene");
            var definition = (CIMFeatureLayer)fl.GetDefinition();
            var before = new { elevationJson = definition.LayerElevation?.ToJson(), expression = definition.FeatureElevationExpression };
            var mode = S(r, "mode"); var offset = D(r, "offset"); Range(offset, -100000, 100000, "offset");
            if (mode == "absolute") {
                definition.LayerElevation = null;
                definition.FeatureElevationExpression = offset == 0 ? "Shape.Z" : "Shape.Z + " + offset.ToString("R", CultureInfo.InvariantCulture);
            } else if (mode is "on_ground" or "relative_to_ground") {
                var surface = View().Map.GetGroundElevationSurfaceLayer() ?? throw new InvalidOperationException("Scene has no ground surface");
                definition.LayerElevation = new CIMLayerElevationSurface { ElevationSurfaceLayerURI = surface.URI, OffsetZ = offset, IsRelativeToScene = false };
                definition.FeatureElevationExpression = mode == "on_ground" ? "" : "Shape.Z";
            } else throw new ArgumentException("Unknown elevation mode");
            fl.SetDefinition(definition);
            return new { layerUri = fl.URI, before, mode, offset, saved = false };
        }
        throw new ArgumentException("Unknown layer action");
    }
}
