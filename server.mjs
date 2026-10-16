import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { definitions, inputSchema, legacyActions } from './tools.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { bridge } from './bridge.mjs';

export { bridge } from './bridge.mjs';
const run = promisify(execFile);

export async function listSessions() {
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $items = @(Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue | Select-Object @{Name='processId';Expression={$_.Id}},@{Name='title';Expression={$_.MainWindowTitle}}); ConvertTo-Json -InputObject $items -Compress"],
  { windowsHide: true, timeout: 10000, encoding: 'utf8' });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  return { sessions: Array.isArray(parsed) ? parsed : [parsed] };
}

// Fixed, strict schemas define discovery and validation in one place.
export function createServer({ invoke = bridge, sessions = listSessions } = {}) {
  const server = new McpServer({ name: 'arcgis-pro-local', version: '0.3.1' });
  for (const [name, title, description, shape, readOnlyHint, destructiveHint, idempotentHint] of definitions) {
    server.registerTool(name, {
      title, description,
      inputSchema: inputSchema(name, shape),
      annotations: {
        readOnlyHint, destructiveHint, idempotentHint,
        openWorldHint: false,
      },
    }, async args => {
      try {
        const { processId: pid, ...parameters } = args;
        if (name !== 'list_sessions' && !legacyActions.has(name)) {
          const status = await invoke(pid, { action: 'ping' });
          if (!status.actions?.includes(name)) throw new Error('This tool requires Pro Add-in 0.3.0 or newer. Install the new .esriAddinX and reopen Pro after saving your work.');
        }
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
