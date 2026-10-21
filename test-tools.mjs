import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { toolNames, definitions, outputPathProblem } from './tools.mjs';
import { listSessions } from './server.mjs';

const layerUri = 'test-layer';
const layer = { layerUri };
const geom = JSON.stringify({ x: 1, y: 2, spatialReference: { wkid: 4326 } });
const examples = {
  list_sessions: {}, ping: {}, get_map: {}, get_fields: layer, get_selection: layer,
  set_visibility: { ...layer, visible: true }, rename_layer: { ...layer, name: '中文圖層' },
  query_features: { ...layer, selectedOnly: true, fields: ['Name', 'Length'], filters: [{ field: 'Name', operator: 'eq', value: "O'Brien" }] },
  get_layer_source: layer, select_features: { ...layer, objectIds: ['9007199254740993'] }, clear_selection: {},
  zoom_to: { ...layer, target: 'selection' }, get_renderer: layer,
  set_simple_renderer: { ...layer, color: '#FFAA00' },
  set_graduated_renderer: { ...layer, field: 'Length' }, restore_renderer: { ...layer, token: 'snapshot-test' },
  set_transparency: { ...layer, transparency: 35 }, add_layer: { source: 'D:/data/example.tif' },
  remove_layer: { ...layer, confirm: true }, create_group: { name: '群組' }, move_layer: { ...layer, index: 0 },
  list_maps: {}, activate_map: { mapUri: 'map-test' }, get_raster_info: layer, get_camera: {},
  set_camera: { heading: 45, pitch: -30 }, set_layer_elevation: { ...layer, mode: 'on_ground' },
  set_vertical_exaggeration: { surfaceUri: 'ground-test', factor: 2 }, list_layouts: {},
  export_map: { outputPath: 'D:/exports/test.png', format: 'png' },
  export_layout: { layoutUri: 'layout-test', outputPath: 'D:/exports/test.pdf', format: 'pdf' },
  list_geoprocessing_tools: {}, run_geoprocessing: { tool: 'buffer', inputLayerUris: [layerUri], outputPath: 'D:/data/test.gdb/buffer', distance: 10, confirm: true },
  update_attributes: { ...layer, objectIds: ['9007199254740993'], values: { Name: '中文', Length: 5 }, expectedValues: { Length: 4 }, confirm: true },
  create_feature: { ...layer, geometryJson: geom, confirm: true }, get_project_state: {},
  save_edits: { confirmAllPendingEdits: true }, save_project: { confirmEntireProject: true },
};
assert.deepEqual(Object.keys(examples).sort(), [...toolNames].sort(), 'Every registered tool needs a transport test');
const code = await readFile(new URL('./addin/ProTools.cs', import.meta.url), 'utf8');
const actionsSection = code.split('internal static readonly string[] Actions = [')[1].split('];')[0];
const backendActions = [...actionsSection.matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
assert.deepEqual(backendActions.sort(), toolNames.filter(n => n !== 'list_sessions').sort(), 'Pro and MCP actions must match exactly');

async function connect(mode = 'legacy', old = false) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./tests/mock-server.mjs', import.meta.url))], env: { ...process.env, PRO_MOCK_OLD_ADDIN: old ? '1' : '' }, stderr: 'pipe' });
  const client = new Client({ name: 'tools-acceptance-test', version: '0.3.0' }, { versionNegotiation: { mode } });
  await client.connect(transport);
  return client;
}
const call = async (client, name, args) => {
  const result = await client.callTool({ name, arguments: name === 'list_sessions' ? args : { processId: 99, ...args } });
  assert.ok(!result.isError, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
};
const reports = [];
for (const mode of ['legacy', 'auto']) {
  const client = await connect(mode);
  try {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 38);
    assert.ok(listed.tools.every(t => t.title && t.inputSchema.additionalProperties === false));
    for (const [name, , , , readOnly, destructive] of definitions) {
      const discovered = listed.tools.find(t => t.name === name);
      assert.equal(discovered.annotations.readOnlyHint, readOnly);
      assert.equal(discovered.annotations.destructiveHint, destructive);
      // Remote layers can be queried, rendered, exported and edited through Pro.
      // Check discovery in both protocol modes, without contacting real services.
      const closedWorld = ['list_sessions', 'ping', 'list_geoprocessing_tools'];
      assert.equal(discovered.annotations.openWorldHint, !closedWorld.includes(name), `${name} trust boundary`);
      const result = await call(client, name, examples[name]);
      if (name === 'list_sessions') assert.equal(result.sessions[0].processId, 99);
      else if (name === 'ping') assert.equal(result.version, '0.3.0');
      else {
        assert.equal(result.backend, 'mock'); assert.equal(result.called, name);
        if (name === 'select_features') { assert.equal(result.request.mode, 'new'); assert.equal(result.request.objectIds[0], '9007199254740993'); }
        if (name === 'query_features') assert.equal(result.request.filters[0].value, "O'Brien");
        if (name === 'create_feature') assert.deepEqual(result.request.values, {});
      }
    }
    const invalid = [
      ['query_features', { ...layer, filters: [{ field: 'Name', operator: 'raw_sql', value: 'x' }] }],
      ['query_features', { ...layer, filters: [{ field: 'Length', operator: 'gt' }] }],
      ['query_features', { ...layer, limit: 1001 }],
      ['query_features', { ...layer, whereClause: '1=1' }],
      ['select_features', layer], ['select_features', { ...layer, objectIds: ['9223372036854775808'] }],
      ['zoom_to', { target: 'selection' }], ['set_camera', {}],
      ['set_simple_renderer', { ...layer, color: 'red' }], ['set_graduated_renderer', { ...layer, field: 'Length', classes: 100 }],
      ['remove_layer', layer], ['remove_layer', { ...layer, confirm: false }],
      ['set_layer_elevation', { ...layer, mode: 'other' }], ['set_vertical_exaggeration', { surfaceUri: 's', factor: 0 }],
      ['export_map', { outputPath: '../secret.png', format: 'png' }],
      ['export_map', { outputPath: 'D:/out.pdf', format: 'png' }],
      ['export_map', { outputPath: 'D:/../out.png', format: 'png' }],
      ['export_map', { outputPath: '//server/share/out.png', format: 'png' }],
      ['export_map', { outputPath: 'D:/exports/existing.txt:hidden.png', format: 'png' }],
      ['export_map', { outputPath: 'D:/exports/NUL.png', format: 'png' }],
      ['run_geoprocessing', { tool: 'copy_features', inputLayerUris: [layerUri], outputPath: 'D:/data/out.gdb/copy.', confirm: true }],
      ['run_geoprocessing', { tool: 'delete', inputLayerUris: [layerUri], outputPath: 'D:/out', confirm: true }],
      ['run_geoprocessing', { tool: 'buffer', inputLayerUris: [layerUri], outputPath: 'D:/out', confirm: true }],
      ['run_geoprocessing', { tool: 'clip', inputLayerUris: [layerUri], outputPath: 'D:/out', confirm: true }],
      ['run_geoprocessing', { tool: 'project', inputLayerUris: [layerUri], outputPath: 'D:/out', confirm: true }],
      ['update_attributes', { ...layer, objectIds: ['1'], values: { Count: 9007199254740992 }, confirm: true }],
      ['update_attributes', { ...layer, objectIds: ['1'], values: {}, confirm: true }],
      ['create_feature', { ...layer, geometryJson: 'invalid', confirm: true }],
      ['create_feature', { ...layer, geometryJson: '{"x":1,"y":2}', confirm: true }],
      ['save_edits', {}], ['save_project', { confirmEntireProject: false }],
    ];
    const before = await call(client, 'get_project_state', {});
    for (const [name, args] of invalid) {
      let rejected = false;
      try { rejected = (await client.callTool({ name, arguments: { processId: 99, ...args } })).isError === true; }
      catch { rejected = true; }
      assert.ok(rejected, `${name} accepted invalid input: ${JSON.stringify(args)}`);
    }
    const after = await call(client, 'get_project_state', {});
    assert.equal(after.calls - before.calls, 2, 'Invalid requests reached Pro (including version precheck)');
    reports.push({ protocol: client.getNegotiatedProtocolVersion(), toolsRouted: toolNames.length, invalidRequestsRejected: invalid.length, realProMutations: false });
  } finally { await client.close(); }
}
const old = await connect('legacy', true);
try {
  await call(old, 'get_map', {});
  const blocked = await old.callTool({ name: 'query_features', arguments: { processId: 99, layerUri } });
  assert.equal(blocked.isError, true); assert.match(blocked.content[0].text, /Add-in 0.3.0/);
} finally { await old.close(); }
// Session probe errors must be actionable without starting a real PowerShell process.
const timedOut = Object.assign(new Error('Command failed: powershell.exe ...'), { killed: true, signal: 'SIGTERM' });
await assert.rejects(listSessions({ exec: async () => { throw timedOut; } }), /timed out after 30 seconds.*Retry list_sessions/);
await assert.rejects(listSessions({ exec: async () => { throw Object.assign(new Error('Command failed'), { stderr: 'Access denied\r\n' }); } }), /^Error: Listing ArcGIS Pro sessions failed: Access denied$/);
// Titles arrive as UTF-8 Base64, so non-ASCII project names survive any console code page.
const b64 = text => Buffer.from(text, 'utf8').toString('base64');
let probeArgs;
assert.deepEqual(await listSessions({ exec: async (_file, args) => { probeArgs = args; return { stdout: `7:${b64('專案 - ArcGIS Pro')}\r\n12:\r\n` }; } }),
  { sessions: [{ processId: 7, title: '專案 - ArcGIS Pro' }, { processId: 12, title: '' }] });
// Cmdlets would trigger slow module autoloading under MCP client env allowlists.
assert.doesNotMatch(probeArgs.at(-1), /Get-Process|Select-Object|ConvertTo-Json/);
assert.deepEqual(await listSessions({ exec: async () => ({ stdout: '' }) }), { sessions: [] });
await assert.rejects(listSessions({ exec: async () => ({ stdout: 'WARNING: profile\r\n' }) }), /unexpected output/);
// Output paths: Win32 aliases (ADS, devices, trailing dots) must not slip past the "new local file" rule.
for (const ok of ['D:/exports/test.png', 'C:\\GIS\\專案\\out.gdb\\buffer_100m', 'E:/a b/c.d/e.pdf', 'D:/console/connect.png'])
  assert.equal(outputPathProblem(ok), null, ok);
for (const bad of ['//server/share/x.png', '\\\\server\\share\\x.png', '\\\\?\\C:\\x.png', 'x.png', 'D:x.png', 'D:/a.txt:s.png', 'D:/a/../b.png',
  'D:/a/./b.png', 'D:/a//b.png', 'D:/a/b.png.', 'D:/a /b.png', 'D:/con', 'D:/dir/aux.tif', 'D:/COM1.pdf', 'D:/lpt¹.png', 'D:/a|b.png', 'D:/a?.png', 'D:/a\u0001.png', 'D:/'])
  assert.notEqual(outputPathProblem(bad), null, bad);
const report = { checkedAt: new Date().toISOString(), suite: 'expanded-tools-contracts', backendActionParity: 'PASS', oldAddinGuard: 'PASS', sessionProbeErrors: 'PASS', outputPathRules: 'PASS', reports, scope: 'MCP transport/schema/routing only. Does not execute Pro SDK methods.' };
await writeFile(new URL('./validation-tools.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
