import assert from 'node:assert/strict';
import { readFile, cp, mkdtemp, access } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
const root = fileURLToPath(new URL('.', import.meta.url));
const source = process.env.PLUGIN_TEST_ROOT || path.join(root, 'plugins/arcgis-pro-mcp');
const isolated = await mkdtemp(path.join(tmpdir(), 'arcgis-plugin-isolated-'));
await cp(source, isolated, { recursive: true });
const json = async p => JSON.parse(await readFile(path.join(isolated, p), 'utf8'));
const manifest = await json('plugin.json');
assert.equal(manifest.version, '0.3.2');
assert.equal(manifest.license, 'MIT');
assert.equal(manifest.extensions['com.openai'].requires_local_executor, true);
const legacy = await json('.codex-plugin/plugin.json');
assert.equal(legacy.version, manifest.version);
const config = await json('mcp.json');
assert.deepEqual((await json('.mcp.json')).mcpServers, config.mcpServers);
for (const f of ['skills/setup/SKILL.md', 'scripts/install-addin.ps1', 'INSTALL-PROMPT.md', 'UPDATE-PROMPT.md', 'LICENSE', 'PRIVACY.md', 'SECURITY.md']) await access(path.join(isolated, f));
if (!process.env.PLUGIN_TEST_ROOT) {
  // Policy documents users read in the plugin must match the reviewed repository copies.
  for (const f of ['LICENSE', 'PRIVACY.md', 'SECURITY.md', 'TOOLS.md', 'COMPATIBILITY.md', 'INSTALL-PROMPT.md', 'UPDATE-PROMPT.md']) {
    assert.equal(await readFile(path.join(isolated, f), 'utf8'), await readFile(path.join(root, f), 'utf8'), `${f} bundle copy is stale; rebuild the plugin`);
  }
}
const checksums = await json('native/checksums.json');
const native = await readFile(path.join(isolated, 'native/LocalProConnector.esriAddinX'));
assert.equal(createHash('sha256').update(native).digest('hex').toUpperCase(), checksums.sha256);
const server = config.mcpServers.arcgis_pro_local;
assert.equal(server.type, 'stdio');
assert.equal(server.command, 'node');
const args = server.args.map(a => a.replaceAll('${PLUGIN_ROOT}', isolated));
assert.ok(args.every(a => path.resolve(a).startsWith(isolated + path.sep)));
const c = new Client({ name: 'isolated-plugin-validation', version: '1.0.0' });
try {
  // Step timings make slow hosted-runner phases visible without changing assertions.
  let mark = Date.now(); const lap = step => { const now = Date.now(); console.log(`timing ${step}: ${now - mark} ms`); mark = now; };
  await c.connect(new StdioClientTransport({ command: process.execPath, args, cwd: isolated, stderr: 'inherit' }));
  lap('connect');
  assert.equal(c.getServerVersion().version, '0.3.1');
  const { tools } = await c.listTools(); assert.equal(tools.length, 38);
  lap('listTools');
  assert.ok(tools.every(t => typeof t.title === 'string' && t.title.length));
  // A stale bundle would ship old trust-boundary hints even when server.mjs is fixed.
  const closedWorld = ['list_sessions', 'ping', 'list_geoprocessing_tools'];
  for (const t of tools) assert.equal(t.annotations?.openWorldHint, !closedWorld.includes(t.name), `${t.name} bundled trust boundary`);
  const sessions = await c.callTool({ name: 'list_sessions', arguments: {} });
  lap('list_sessions');
  assert.ok(!sessions.isError, JSON.stringify(sessions)); assert.ok(Array.isArray(JSON.parse(sessions.content[0].text).sessions));
  console.log('PASS: isolated plugin runs without node_modules; 38 MCP tools, manifests and native hash verified.');
} finally { await c.close(); }
