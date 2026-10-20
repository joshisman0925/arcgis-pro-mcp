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

// MCP clients often pass only a small env allowlist. Without PSModulePath, Windows
// PowerShell rescans for Get-Process/ConvertTo-Json and can take 20-30 seconds.
export function powershellEnv(env = process.env) {
  // Windows env names are case-insensitive, but copied env objects are not.
  const get = name => Object.entries(env).find(([key]) => key.toUpperCase() === name.toUpperCase())?.[1];
  if (get('PSModulePath')) return env;
  const programFiles = get('ProgramFiles') || 'C:\\Program Files';
  const systemRoot = get('SystemRoot') || 'C:\\Windows';
  return { ...env, PSModulePath: [path.win32.join(programFiles, 'WindowsPowerShell', 'Modules'), path.win32.join(systemRoot, 'system32', 'WindowsPowerShell', 'v1.0', 'Modules')].join(';') };
}

export async function listSessions({ exec = run, env = process.env } = {}) {
  let stdout;
  try {
    ({ stdout } = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference='Stop'; [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); $items = @(Get-Process -Name ArcGISPro -ErrorAction SilentlyContinue | Select-Object @{Name='processId';Expression={$_.Id}},@{Name='title';Expression={$_.MainWindowTitle}}); ConvertTo-Json -InputObject $items -Compress"],
    { windowsHide: true, timeout: 30000, encoding: 'utf8', env: powershellEnv(env) }));
  } catch (error) {
    // execFile kills the child on timeout; its raw message only echoes the command line.
    if (error?.killed || error?.code === 'ETIMEDOUT') {
      throw new Error('Listing ArcGIS Pro sessions timed out after 30 seconds while Windows PowerShell started. Retry list_sessions; if it keeps failing, check system load, security software or the PSModulePath environment variable.');
    }
    throw new Error(`Listing ArcGIS Pro sessions failed: ${String(error?.stderr || error?.message || error).trim().slice(0, 300)}`);
  }
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
