import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

// Real Pro tests touch temporary copies and temporary map members only.
// Deliberately excludes data edits, global saves and the user's original layer settings.
const output = await mkdtemp(path.join(tmpdir(), 'arcgis-pro-mcp-test-'));
const client = new Client({ name: 'pro-reversible-acceptance', version: '0.3.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url))], stderr: 'inherit' });
const passed = []; const cleanup = []; let pid; let group; let originalCamera; let originalMap;
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: name === 'list_sessions' ? args : { processId: pid, ...args } }, undefined, { timeout: 180000 });
  assert.ok(!result.isError, `${name}: ${JSON.stringify(result)}`);
  const value = JSON.parse(result.content[0].text); passed.push(name); return value;
};
let failure;
try {
  await client.connect(transport);
  const { sessions } = await call('list_sessions'); assert.equal(sessions.length, 1, 'Test requires exactly one Pro session'); pid = sessions[0].processId;
  const status = await call('ping'); assert.ok(['0.3.0', '0.3.1'].includes(status.version));
  originalMap = await call('get_map'); originalCamera = (await call('get_camera')).camera;
  const source = originalMap.layers.find(l => l.type === 'FeatureLayer'); assert.ok(source, 'Need a feature layer');
  group = await call('create_group', { name: '__MCP_ACCEPTANCE_' + Date.now() });
  await call('set_visibility', { layerUri: group.uri, visible: false });
  await call('run_geoprocessing', { tool: 'copy_features', inputLayerUris: [source.uri], outputPath: path.join(output, 'copy.shp'), confirm: true });
  const copy = await call('add_layer', { source: path.join(output, 'copy.shp'), groupUri: group.uri, name: 'MCP copy' });
  await call('run_geoprocessing', { tool: 'project', inputLayerUris: [copy.uri], outputPath: path.join(output, 'projected.shp'), targetWkid: 3857, confirm: true });
  const projected = await call('add_layer', { source: path.join(output, 'projected.shp'), groupUri: group.uri, name: 'MCP projected' });
  const layerUri = projected.uri;
  await call('rename_layer', { layerUri, name: 'MCP renamed' });
  const transparency = await call('set_transparency', { layerUri, transparency: 42 }); assert.equal(transparency.transparency, 42);
  const child = await call('create_group', { name: 'MCP nested', parentGroupUri: group.uri });
  await call('move_layer', { layerUri, groupUri: child.uri, index: 0 });
  await call('move_layer', { layerUri, groupUri: group.uri, index: 0 });
  const { fields } = await call('get_fields', { layerUri });
  const numeric = fields.find(f => ['Double', 'Single', 'Integer'].includes(f.type) && !f.name.toLowerCase().startsWith('shape'));
  assert.ok(numeric);
  const row = await call('query_features', { layerUri, fields: [numeric.name], limit: 1 }); assert.ok(row.rows.length);
  await call('select_features', { layerUri, objectIds: [row.rows[0].objectId], mode: 'new' });
  assert.equal((await call('get_selection', { layerUri })).count, 1);
  assert.equal((await call('query_features', { layerUri, selectedOnly: true, limit: 2 })).returned, 1);
  await call('zoom_to', { target: 'selection', layerUri });
  await call('zoom_to', { target: 'layer', layerUri });
  await call('clear_selection', { layerUri });
  const snapshot = await call('get_renderer', { layerUri });
  await call('set_simple_renderer', { layerUri, color: '#FF8800', size: 2 });
  await call('restore_renderer', { layerUri, token: snapshot.token });
  const restored = await call('get_renderer', { layerUri }); assert.deepEqual(JSON.parse(restored.rendererJson), JSON.parse(snapshot.rendererJson));
  await call('set_graduated_renderer', { layerUri, field: numeric.name, classes: 3, method: 'NaturalBreaks' });
  await call('restore_renderer', { layerUri, token: snapshot.token });
  if (originalMap.type !== 'Map') {
    for (const mode of ['on_ground', 'relative_to_ground', 'absolute']) await call('set_layer_elevation', { layerUri, mode, offset: 0 });
  }
  await call('run_geoprocessing', { tool: 'buffer', inputLayerUris: [layerUri], outputPath: path.join(output, 'buffer.shp'), distance: 1, confirm: true });
  const polygon = await call('add_layer', { source: path.join(output, 'buffer.shp'), groupUri: group.uri, name: 'MCP buffer' });
  await call('run_geoprocessing', { tool: 'clip', inputLayerUris: [layerUri, polygon.uri], outputPath: path.join(output, 'clip.shp'), confirm: true });
  await call('run_geoprocessing', { tool: 'intersect', inputLayerUris: [layerUri, polygon.uri], outputPath: path.join(output, 'intersect.shp'), confirm: true });
  for (const format of ['png', 'pdf']) {
    const target = path.join(output, `map.${format}`);
    await call('export_map', { outputPath: target, format, width: 640, height: 480, dpi: 96 });
    const bytes = await readFile(target);
    if (format === 'pdf') assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    else assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  }
  const maps = (await call('list_maps')).maps;
  const other = maps.find(m => m.uri !== originalMap.uri);
  if (other) await call('activate_map', { mapUri: other.uri });
  await call('activate_map', { mapUri: originalMap.uri });
  if (originalMap.elevationSurfaces?.length && originalMap.type !== 'Map') {
    const surface = originalMap.elevationSurfaces[0];
    try { await call('set_vertical_exaggeration', { surfaceUri: surface.uri, factor: 1.1 }); }
    finally { await call('set_vertical_exaggeration', { surfaceUri: surface.uri, factor: surface.verticalExaggeration }); }
  }
} catch (error) { failure = error.message; }
finally {
  if (pid && originalMap) {
    try { await call('activate_map', { mapUri: originalMap.uri }); cleanup.push('Original map activated'); } catch (e) { cleanup.push('FAILED: ' + e.message); }
    if (group) try { await call('remove_layer', { layerUri: group.uri, confirm: true }); cleanup.push('Temporary group and children removed'); } catch (e) { cleanup.push('FAILED: ' + e.message); }
    if (originalCamera) try {
      const { x, y, z, heading, pitch, roll, scale } = originalCamera;
      await call('set_camera', { x, y, z, heading, pitch, roll, scale }); cleanup.push('Original camera restored');
    } catch (e) { cleanup.push('FAILED: ' + e.message); }
  }
  await client.close();
}
const report = { checkedAt: new Date().toISOString(), output, status: failure ? 'FAIL' : 'PASS', failure, toolsExercised: [...new Set(passed)], cleanup, savedProject: false, dataEditsPerformed: false, note: 'Temporary data files retained. Temporary map operations can leave the APRX dirty; no project save is performed.' };
await writeFile(new URL('./validation-live-safe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failure || cleanup.some(s => s.startsWith('FAILED'))) process.exitCode = 1;
