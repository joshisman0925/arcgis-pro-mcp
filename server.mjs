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

// Use only .NET and language features: autoloading Get-Process/ConvertTo-Json modules
// can stall 20-30 seconds when MCP clients pass a small env allowlist (seen on CI).
// Base64 titles keep output ASCII, so no console encoding or JSON escaping is needed.
const sessionProbe = "$ErrorActionPreference='Stop'; foreach ($p in [Diagnostics.Process]::GetProcessesByName('ArcGISPro')) { '{0}:{1}' -f $p.Id, [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$p.MainWindowTitle)) }";

export async function listSessions({ exec = run } = {}) {
  let stdout;
  try {
    ({ stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', sessionProbe],
      { windowsHide: true, timeout: 30000, encoding: 'utf8' }));
  } catch (error) {
    // execFile kills the child on timeout; its raw message only echoes the command line.
    if (error?.killed || error?.code === 'ETIMEDOUT') {
      throw new Error('Listing ArcGIS Pro sessions timed out after 30 seconds while Windows PowerShell started. Retry list_sessions; if it keeps failing, check system load or security software.');
    }
    throw new Error(`Listing ArcGIS Pro sessions failed: ${String(error?.stderr || error?.message || error).trim().slice(0, 300)}`);
  }
  const sessions = stdout.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const match = /^(\d+):([A-Za-z0-9+/=]*)$/.exec(line.trim());
    if (!match) throw new Error('Listing ArcGIS Pro sessions returned unexpected output.');
    return { processId: Number(match[1]), title: Buffer.from(match[2], 'base64').toString('utf8') };
  });
  return { sessions };
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
        // Map data may come from remote services, even over a local pipe.
        // Only process/capability discovery is guaranteed to stay closed-world.
        openWorldHint: !['list_sessions', 'ping', 'list_geoprocessing_tools'].includes(name),
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
