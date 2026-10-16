using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using ArcGIS.Desktop.Framework.Contracts;
using ArcGIS.Desktop.Framework.Threading.Tasks;
using ArcGIS.Desktop.Mapping;

namespace ProConnector;

internal class ConnectorModule : Module
{
    private readonly CancellationTokenSource stop = new();
    protected override bool Initialize()
    {
        _ = Task.Run(Serve);
        return true;
    }
    protected override void Uninitialize() => stop.Cancel();

    private async Task Serve()
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                using var pipe = new NamedPipeServerStream($"CodexArcGISPro-{Environment.ProcessId}",
                    PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                await pipe.WaitForConnectionAsync(stop.Token);
                using var reader = new StreamReader(pipe, new UTF8Encoding(false), false, 4096, true);
                using var writer = new StreamWriter(pipe, new UTF8Encoding(false), 4096, true) { AutoFlush = true };
                using var deadline = CancellationTokenSource.CreateLinkedTokenSource(stop.Token);
                deadline.CancelAfter(TimeSpan.FromSeconds(10));
                // One bounded request per connection; no arbitrary script execution.
                var line = new StringBuilder();
                var character = new char[1];
                while (true)
                {
                    if (await reader.ReadAsync(character.AsMemory(), deadline.Token) == 0) throw new IOException("Incomplete request");
                    if (character[0] == '\n') break;
                    line.Append(character[0]);
                    if (line.Length > 65536) throw new IOException("Request too large");
                }
                object response;
                try
                {
                    using var request = JsonDocument.Parse(line.ToString());
                    var root = request.RootElement.Clone();
                    response = await QueuedTask.Run(() => Dispatch(root));
                }
                catch (Exception ex) { response = new { error = ex.Message }; }
                await writer.WriteLineAsync(JsonSerializer.Serialize(response));
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (Exception ex) { System.Diagnostics.Trace.WriteLine($"ProConnector: {ex.Message}"); }
        }
    }

    private static object Dispatch(JsonElement request)
    {
        var action = request.GetProperty("action").GetString();
        if (action == "ping") return new { connected = true, processId = Environment.ProcessId, version = "0.1.0" };
        var view = MapView.Active ?? throw new InvalidOperationException("Open and activate a map view in ArcGIS Pro first.");
        var map = view.Map;
        var layers = map.GetLayersAsFlattenedList();
        if (action == "get_map") return new {
            name = map.Name, spatialReference = map.SpatialReference?.Wkid,
            layers = layers.Select(l => new { uri = l.URI, name = l.Name, visible = l.IsVisible,
                type = l.GetType().Name, selected = view.GetSelectedLayers().Any(s => s.URI == l.URI) }).ToArray()
        };
        var uri = request.GetProperty("layerUri").GetString();
        var layer = layers.SingleOrDefault(l => l.URI == uri) ?? throw new ArgumentException("Layer URI not found in active map. Call get_map again.");
        if (action == "set_visibility") {
            layer.SetVisibility(request.GetProperty("visible").GetBoolean());
            return new { uri = layer.URI, visible = layer.IsVisible };
        }
        if (action == "rename_layer") {
            var name = request.GetProperty("name").GetString();
            if (string.IsNullOrWhiteSpace(name) || name.Length > 255) throw new ArgumentException("Name must contain 1–255 characters.");
            layer.SetName(name);
            return new { uri = layer.URI, name = layer.Name };
        }
        var featureLayer = layer as FeatureLayer ?? throw new ArgumentException("Tool requires a feature layer.");
        if (action == "get_fields") {
            using var table = featureLayer.GetTable();
            using var definition = table.GetDefinition();
            return new { fields = definition.GetFields().Select(f => new { name = f.Name, alias = f.AliasName, type = f.FieldType.ToString() }).ToArray() };
        }
        if (action == "get_selection") {
            using var selection = featureLayer.GetSelection();
            return new { count = selection.GetCount(), objectIds = selection.GetObjectIDs().Take(1000).Select(id => id.ToString()).ToArray(), limit = 1000 };
        }
        throw new ArgumentException("Unknown action");
    }
}
