import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bridge } from './bridge.mjs';

export { bridge } from './bridge.mjs';
const run = promisify(execFile);
const processId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).describe('ArcGIS Pro process ID from list_sessions');
const layerUri = z.string().min(1).max(4096).describe('Exact layer URI returned by get_map');
const definitions = [
  ['list_sessions', 'List running ArcGIS Pro processes. Use ping to check whether their connector is loaded.', {}],
  ['ping', 'Check the connector in one Pro process.', { processId }],
  ['get_map', 'Read active map, layer URIs, visibility and selected layers.', { processId }],
  ['get_fields', 'Read field names, aliases and types of a feature layer.', { processId, layerUri }],
  ['get_selection', 'Read selected feature count and up to 1000 object IDs (strings preserve 64-bit IDs).', { processId, layerUri }],
  ['set_visibility', 'Change visibility in the active map. Does not save the project.', { processId, layerUri, visible: z.boolean() }],
  ['rename_layer', 'Rename a layer in the active map. Does not save the project.', { processId, layerUri, name: z.string().min(1).max(255).refine(value => value.trim().length > 0, 'Name cannot be blank') }],
];

export async function listSessions() {
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $items = @(Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue | Select-Object @{Name='processId';Expression={$_.Id}},@{Name='title';Expression={$_.MainWindowTitle}}); ConvertTo-Json -InputObject $items -Compress"],
  { windowsHide: true, timeout: 10000, encoding: 'utf8' });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  return { sessions: Array.isArray(parsed) ? parsed : [parsed] };
}

// Fixed, strict schemas define discovery and validation in one place.
export function createServer({ invoke = bridge, sessions = listSessions } = {}) {
  const server = new McpServer({ name: 'arcgis-pro-local', version: '0.2.0' });
  for (const [name, description, shape] of definitions) {
    server.registerTool(name, {
      description,
      inputSchema: z.strictObject(shape),
      annotations: {
        readOnlyHint: !['set_visibility', 'rename_layer'].includes(name),
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    }, async args => {
      try {
        const { processId: pid, ...parameters } = args;
        const value = name === 'list_sessions' ? await sessions() : await invoke(pid, { action: name, ...parameters });
        return { content: [{ type: 'text', text: JSON.stringify(value) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error.message ?? String(error) }] };
      }
    });
  }
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const handle = serveStdio(() => createServer(), { onerror: error => console.error(error.message) });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    handle.close().finally(() => process.exit(0));
  });
}
