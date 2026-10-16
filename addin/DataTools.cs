using System.Globalization;
using System.Text.Json;
using ArcGIS.Core.Data;
using ArcGIS.Core.Geometry;
using ArcGIS.Desktop.Core;
using ArcGIS.Desktop.Editing;
using ArcGIS.Desktop.Mapping;

namespace ProConnector;

internal static partial class ProTools
{
    internal static Field FindField(TableDefinition definition, string field) => definition.GetFields().SingleOrDefault(f => f.Name.Equals(field, StringComparison.OrdinalIgnoreCase))
        ?? throw new ArgumentException($"Unknown field: {field}");
    internal static string Where(JsonElement r, TableDefinition definition) {
        if (!r.TryGetProperty("filters", out var list)) return "";
        var filters = list.EnumerateArray().ToArray();
        if (filters.Length > 20) throw new ArgumentException("At most 20 filters");
        return string.Join(" AND ", filters.Select(f => {
            var field = FindField(definition, S(f, "field"));
            var identifier = "\"" + field.Name.Replace("\"", "\"\"") + "\"";
            var op = S(f, "operator");
            if (op == "is_null") return identifier + " IS NULL";
            if (op == "not_null") return identifier + " IS NOT NULL";
            var value = f.GetProperty("value");
            string literal;
            if (field.FieldType == FieldType.String && value.ValueKind == JsonValueKind.String)
                literal = "'" + value.GetString()!.Replace("'", "''") + "'";
            else if (field.FieldType is FieldType.OID or FieldType.Integer or FieldType.SmallInteger or FieldType.BigInteger && value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var integer))
                literal = integer.ToString(CultureInfo.InvariantCulture);
            else if (field.FieldType is FieldType.OID or FieldType.Integer or FieldType.SmallInteger or FieldType.BigInteger or FieldType.Double or FieldType.Single && value.ValueKind == JsonValueKind.Number)
                literal = double.IsFinite(value.GetDouble()) ? value.GetRawText() : throw new ArgumentException("Numeric filter must be finite");
            else throw new ArgumentException("Filters currently support numeric and string comparisons; use null operators for other field types.");
            var sqlOp = op switch { "eq" => "=", "ne" => "<>", "gt" => ">", "ge" => ">=", "lt" => "<", "le" => "<=", _ => throw new ArgumentException("Unknown filter operator") };
            return $"{identifier} {sqlOp} {literal}";
        }));
    }

    private static object DataTool(JsonElement r, string action)
    {
        if (action == "clear_selection") {
            if (Optional(r, "layerUri") != null) Feature(r).ClearSelection();
            else View().Map.ClearSelection();
            return new { cleared = true };
        }
        if (action == "get_layer_source") return SourceInfo(Layer(r));
        if (action == "get_raster_info") {
            var layer = Layer(r) as BasicRasterLayer ?? throw new ArgumentException("Requires a raster layer");
            using var raster = layer.GetRaster() ?? throw new InvalidOperationException("Raster source unavailable");
            var size = raster.GetMeanCellSize();
            var extent = raster.GetExtent();
            var noData = raster.GetNoDataValue();
            return new { source = SourceInfo(layer), width = raster.GetWidth(), height = raster.GetHeight(), bandCount = raster.GetBandCount(),
                cellSize = new { x = size.Item1, y = size.Item2 }, spatialReference = raster.GetSpatialReference()?.Wkid,
                extent = new { xmin = extent.XMin, ymin = extent.YMin, xmax = extent.XMax, ymax = extent.YMax },
                pixelType = raster.GetPixelType().ToString(), noData = noData is Array array ? array.Cast<object?>().Select(Value).ToArray() : Value(noData) };
        }
        var fl = Feature(r);
        using var table = fl.GetTable() ?? throw new InvalidOperationException("Layer data source unavailable");
        using var definition = table.GetDefinition();
        if (action == "get_fields") return new { fields = definition.GetFields().Select(f => new { name = f.Name, alias = f.AliasName, type = f.FieldType.ToString(), editable = f.IsEditable, nullable = f.IsNullable, length = f.Length }).ToArray() };
        if (action == "get_selection") {
            using var selection = fl.GetSelection();
            return new { count = selection.GetCount(), objectIds = selection.GetObjectIDs().Take(1000).Select(id => id.ToString(CultureInfo.InvariantCulture)).ToArray(), limit = 1000 };
        }
        if (action == "query_features") {
            var limit = I(r, "limit", 100); var offset = I(r, "offset");
            Range(limit, 1, 1000, "limit"); Range(offset, 0, 100000, "offset");
            var requested = r.TryGetProperty("fields", out var list) ? list.EnumerateArray().Select(e => FindField(definition, e.GetString()!)).ToArray()
                : definition.GetFields().Where(f => f.FieldType is not (FieldType.Geometry or FieldType.Blob or FieldType.Raster)).Take(50).ToArray();
            if (requested.Length > 50 || requested.Any(f => f.FieldType is FieldType.Geometry or FieldType.Blob or FieldType.Raster)) throw new ArgumentException("Choose up to 50 scalar fields");
            var oidField = definition.GetObjectIDField();
            var q = new QueryFilter { WhereClause = Where(r, definition), SubFields = string.Join(",", requested.Select(f => f.Name).Append(oidField).Distinct()) };
            using var selection = B(r, "selectedOnly") ? fl.GetSelection() : null;
            using var cursor = selection != null ? selection.Search(q, false) : fl.Search(q);
            var rows = new List<object>(); var skipped = 0; var hasMore = false; var responseCharacters = 0;
            while (cursor.MoveNext()) {
                using var row = cursor.Current;
                if (skipped++ < offset) continue;
                if (rows.Count == limit) { hasMore = true; break; }
                var item = new { objectId = row.GetObjectID().ToString(CultureInfo.InvariantCulture), attributes = requested.ToDictionary(f => f.Name, f => Value(row[f.Name])) };
                var length = JsonSerializer.Serialize(item).Length;
                if (responseCharacters + length > 4 * 1024 * 1024) {
                    if (rows.Count == 0) throw new InvalidOperationException("One row exceeds response budget; request fewer fields");
                    hasMore = true; break;
                }
                responseCharacters += length; rows.Add(item);
            }
            return new { layerUri = fl.URI, rows, returned = rows.Count, offset, limit, hasMore, nextOffset = hasMore ? (int?)(offset + rows.Count) : null, note = "Pagination follows source cursor order; keep the source unchanged between pages." };
        }
        if (action == "select_features") {
            var where = Where(r, definition); var ids = Ids(r);
            if (string.IsNullOrEmpty(where) && ids.Length == 0) throw new ArgumentException("Provide filters or explicit Object IDs");
            if (ids.Length > 1000) throw new ArgumentException("At most 1000 Object IDs");
            var q = new QueryFilter { WhereClause = where };
            if (ids.Length > 0) q.ObjectIDs = ids;
            var mode = S(r, "mode") switch { "new" => SelectionCombinationMethod.New, "add" => SelectionCombinationMethod.Add,
                "remove" => SelectionCombinationMethod.Subtract, "intersect" => SelectionCombinationMethod.And, _ => throw new ArgumentException("Unknown selection mode") };
            using var selected = fl.Select(q, mode);
            return new { layerUri = fl.URI, count = selected.GetCount(), objectIds = selected.GetObjectIDs().Take(1000).Select(i => i.ToString()).ToArray(), limit = 1000 };
        }
        if (action is "update_attributes" or "create_feature") return Edit(r, action, fl, table, definition);
        throw new ArgumentException("Unknown data action");
    }

    private static object SourceInfo(Layer layer) {
        string? path = null; string? sourceError = null; bool? available = null;
        try {
            var uri = layer.GetPath();
            if (uri?.IsFile == true) path = uri.LocalPath;
            else if (uri != null) path = new UriBuilder(uri) { UserName = "", Password = "", Query = "", Fragment = "" }.Uri.GetLeftPart(UriPartial.Path);
            if (layer is FeatureLayer feature) { using var table = feature.GetTable(); using var def = table.GetDefinition(); available = true; }
            else if (layer is BasicRasterLayer image) { using var raster = image.GetRaster(); available = raster != null; }
        } catch (Exception ex) { available = false; sourceError = ex.GetType().Name + ": source could not be opened"; }
        ArcGIS.Core.CIM.CIMStandardDataConnection? connection = null;
        try { connection = layer.GetDataConnection() as ArcGIS.Core.CIM.CIMStandardDataConnection; }
        catch { sourceError ??= "Data connection metadata is not available for this layer type"; }
        return new { layerUri = layer.URI, name = layer.Name, sourcePath = path, dataset = connection?.Dataset,
            workspaceFactory = connection?.WorkspaceFactory.ToString(), available, error = sourceError,
            isTiff = path != null && (System.IO.Path.GetExtension(path).Equals(".tif", StringComparison.OrdinalIgnoreCase) || System.IO.Path.GetExtension(path).Equals(".tiff", StringComparison.OrdinalIgnoreCase)) };
    }

    private static Dictionary<string, object> EditValues(JsonElement values, TableDefinition definition, bool allowEmpty = false) {
        var changes = new Dictionary<string, object>();
        foreach (var prop in values.EnumerateObject()) {
            var field = FindField(definition, prop.Name);
            if (!field.IsEditable || field.FieldType is FieldType.OID or FieldType.Geometry or FieldType.Blob or FieldType.Raster or FieldType.GlobalID)
                throw new ArgumentException($"Field cannot be edited through this tool: {field.Name}");
            var value = Cell(prop.Value);
            if (value == null) { if (!field.IsNullable) throw new ArgumentException($"Field is not nullable: {field.Name}"); changes[field.Name] = DBNull.Value; continue; }
            changes[field.Name] = field.FieldType switch {
                FieldType.String when value is string s && s.Length <= field.Length => s,
                FieldType.SmallInteger => checked((short)StrictInteger(value)),
                FieldType.Integer => checked((int)StrictInteger(value)),
                FieldType.BigInteger => StrictInteger(value),
                FieldType.Single when value is long or double => Convert.ToSingle(value, CultureInfo.InvariantCulture),
                FieldType.Double when value is long or double => Convert.ToDouble(value, CultureInfo.InvariantCulture),
                FieldType.Date when value is string s => DateTime.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
                FieldType.GUID when value is string s => Guid.Parse(s),
                _ => throw new ArgumentException($"Value type is incompatible with field {field.Name} ({field.FieldType})")
            };
        }
        if (changes.Count > 50 || !allowEmpty && changes.Count == 0) throw new ArgumentException("Provide 1–50 editable fields");
        return changes;
    }
    private static long StrictInteger(object value) => value switch { long n => n, string s => long.Parse(s, CultureInfo.InvariantCulture), _ => throw new ArgumentException("Integer fields require an integer or Int64 string") };

    private static object Edit(JsonElement r, string action, FeatureLayer fl, Table table, TableDefinition definition) {
        Confirm(r);
        if (!Project.Current.IsEditingEnabled) throw new InvalidOperationException("Enable editing in Pro first");
        var changes = EditValues(r.GetProperty("values"), definition, action == "create_feature");
        var operation = new EditOperation { Name = "MCP: " + action, SelectNewFeatures = false, SelectModifiedFeatures = false };
        if (action == "create_feature") {
            var geometry = GeometryEngine.Instance.ImportFromJson(JsonImportFlags.JsonImportDefaults, S(r, "geometryJson"));
            using var fc = fl.GetFeatureClass(); using var fd = fc.GetDefinition();
            if (geometry == null || geometry.IsEmpty || geometry.SpatialReference == null) throw new ArgumentException("Provide nonempty Esri JSON geometry with spatialReference");
            if (geometry.GeometryType != fd.GetShapeType()) throw new ArgumentException("Geometry type does not match feature class");
            if (!geometry.SpatialReference.IsEqual(fd.GetSpatialReference())) throw new ArgumentException("Geometry spatial reference must match the feature class; project explicitly first");
            operation.Create(fl, geometry, changes);
            if (!operation.Execute()) throw new InvalidOperationException(operation.ErrorMessage);
            return new { created = true, saved = false, operation = operation.Name, note = "Use Pro Undo to revert this edit; query the layer to find the new Object ID." };
        }
        var ids = Ids(r); if (ids.Length is < 1 or > 100) throw new ArgumentException("Provide 1–100 Object IDs");
        var oldRows = new List<object>();
        // Validate every row and optimistic expectation before executing a single atomic edit.
        foreach (var oid in ids) {
            using var cursor = fl.Search(new QueryFilter { ObjectIDs = [oid] });
            if (!cursor.MoveNext()) throw new ArgumentException($"Object ID not found in layer: {oid}");
            using var row = cursor.Current;
            if (r.TryGetProperty("expectedValues", out var expected)) foreach (var prop in expected.EnumerateObject()) {
                var field = FindField(definition, prop.Name);
                if (!Matches(row[field.Name], prop.Value)) throw new InvalidOperationException($"Concurrent change or expected value mismatch: {oid}/{field.Name}");
            }
            oldRows.Add(new { objectId = oid.ToString(), before = changes.Keys.ToDictionary(k => k, k => Value(row[k])), after = changes.ToDictionary(p => p.Key, p => Value(p.Value)) });
            operation.Modify(fl, oid, changes);
        }
        if (JsonSerializer.Serialize(oldRows).Length > 4 * 1024 * 1024) throw new ArgumentException("Edit report exceeds response budget; reduce the batch or field count");
        if (!operation.Execute()) throw new InvalidOperationException(operation.ErrorMessage);
        return new { modified = ids.Length, saved = false, operation = operation.Name, rows = oldRows, note = "Use Pro Undo to revert this edit before saving." };
    }

    private static bool Matches(object? actual, JsonElement expected) {
        if (actual is null or DBNull) return expected.ValueKind == JsonValueKind.Null;
        if (actual is short or int or long or float or double or decimal) {
            var text = expected.ValueKind == JsonValueKind.String ? expected.GetString() : expected.GetRawText();
            return decimal.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value) && Convert.ToDecimal(actual, CultureInfo.InvariantCulture) == value;
        }
        if (actual is DateTime date && expected.ValueKind == JsonValueKind.String) return DateTime.TryParse(expected.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var value) && date == value;
        if (actual is Guid guid && expected.ValueKind == JsonValueKind.String) return Guid.TryParse(expected.GetString(), out var value) && guid == value;
        return JsonSerializer.Serialize(Value(actual)) == JsonSerializer.Serialize(Cell(expected));
    }
}
