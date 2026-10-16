import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

// Read-only live acceptance test: use the public MCP transport, never bridge().
const client = new Client({ name: 'live-pro-validation', version: '0.2.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url))], stderr: 'inherit' });
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
  return JSON.parse(result.content[0].text);
};
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 7);
  const { sessions } = await call('list_sessions');
  assert.ok(Array.isArray(sessions));
  assert.ok(sessions.length, 'Open ArcGIS Pro before running the live test');
  const results = [];
  for (const session of sessions) {
    const pid = session.processId;
    await call('ping', { processId: pid });
    const map = await call('get_map', { processId: pid });
    const feature = map.layers.find(layer => layer.type === 'FeatureLayer');
    const result = { processId: pid, map: map.name, layerCount: map.layers.length, ping: 'PASS', getMap: 'PASS' };
    if (feature) {
      const fields = await call('get_fields', { processId: pid, layerUri: feature.uri });
      const selection = await call('get_selection', { processId: pid, layerUri: feature.uri });
      result.featureLayer = feature.name;
      result.fieldCount = fields.fields.length;
      result.selectionCount = selection.count;
    }
    results.push(result);
  }
  const report = { checkedAt: new Date().toISOString(), suite: 'official-sdk-stdio-to-real-pro', protocol: client.getNegotiatedProtocolVersion(), serverVersion: client.getServerVersion().version, writesPerformed: false, results };
  await writeFile(new URL('./validation-live.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await client.close(); }
