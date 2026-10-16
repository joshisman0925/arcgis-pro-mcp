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
                    if (line.Length > 1048576) throw new IOException("Request too large");
                }
                object response;
                try
                {
                    using var request = JsonDocument.Parse(line.ToString());
                    var root = request.RootElement.Clone();
                    response = await ProTools.ExecuteAsync(root);
                }
                catch (Exception ex) { response = new { error = ex.Message }; }
                await writer.WriteLineAsync(JsonSerializer.Serialize(response));
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (Exception ex) { System.Diagnostics.Trace.WriteLine($"ProConnector: {ex.Message}"); }
        }
    }

}
