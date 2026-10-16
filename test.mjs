import assert from 'node:assert/strict';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const pid = process.pid;
let count = 0;
let visible = false;
let layerName = '測試圖層';
const pipe = net.createServer(socket => {
  socket.setEncoding('utf8');
  let input = '';
  socket.on('error', () => {});
  socket.on('data', chunk => {
    input += chunk;
    if (!input.includes('\n')) return;
    count++;
    const request = JSON.parse(input);
    let result;
    switch (request.action) {
      case 'ping': result = { connected: true, processId: pid }; break;
      case 'get_map': result = { name: '測試地圖', layers: [{ uri: 'test-layer', name: layerName, visible }] }; break;
      case 'get_fields': result = { error: 'Fixture: data source unavailable' }; break;
      case 'get_selection': result = { count: 1, objectIds: ['9007199254740993'], limit: 1000 }; break;
      case 'set_visibility': visible = request.visible; result = { visible }; break;
      case 'rename_layer': layerName = request.name; result = { name: layerName }; break;
      default: throw new Error('Unexpected fixture action');
    }
    const output = JSON.stringify(result) + '\n';
    socket.write(output.slice(0, 3));
    setTimeout(() => socket.end(output.slice(3)), 5);
  });
});
await new Promise((resolve, reject) => {
  pipe.once('error', reject);
  pipe.listen(`\\\\.\\pipe\\CodexArcGISPro-${pid}`, resolve);
});
const reports = [];
try {
  for (const mode of ['legacy', 'auto']) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url))], stderr: 'pipe' });
    let stderr = '';
    transport.stderr.on('data', chunk => stderr += chunk);
    const client = new Client({ name: 'connector-validation', version: '0.2.0' }, { versionNegotiation: { mode } });
    try {
      await client.connect(transport);
      assert.equal(client.getServerVersion().version, '0.2.0');
      if (client.getProtocolEra() === 'legacy') await client.ping();
      const { tools } = await client.listTools();
      assert.equal(tools.length, 7);
      assert.equal(tools.find(t => t.name === 'rename_layer').inputSchema.additionalProperties, false);
      assert.equal(tools.find(t => t.name === 'set_visibility').annotations.readOnlyHint, false);
      const call = async (name, args) => {
        const value = await client.callTool({ name, arguments: args });
        assert.ok(!value.isError, JSON.stringify(value));
        return JSON.parse(value.content[0].text);
      };
      assert.equal((await call('ping', { processId: pid })).connected, true);
      assert.equal((await call('get_map', { processId: pid })).name, '測試地圖');
      const selection = await call('get_selection', { processId: pid, layerUri: 'test-layer' });
      assert.equal(selection.objectIds[0], '9007199254740993');
      await call('set_visibility', { processId: pid, layerUri: 'test-layer', visible: true });
      await call('rename_layer', { processId: pid, layerUri: 'test-layer', name: '中文名稱' });
      const changed = await call('get_map', { processId: pid });
      assert.equal(changed.layers[0].visible, true);
      assert.equal(changed.layers[0].name, '中文名稱');
      const parallel = await Promise.all(Array.from({ length: 5 }, () => call('ping', { processId: pid })));
      assert.ok(parallel.every(result => result.connected));
      const failed = await client.callTool({ name: 'get_fields', arguments: { processId: pid, layerUri: 'test-layer' } });
      assert.equal(failed.isError, true);
      assert.match(failed.content[0].text, /data source unavailable/);
      const before = count;
      for (const [name, args] of [
        ['ping', { processId: -1 }],
        ['set_visibility', { processId: pid, layerUri: 'test-layer', visible: 'false' }],
        ['rename_layer', { processId: pid, layerUri: 'test-layer', name: '   ' }],
        ['ping', { processId: pid, unexpected: 1 }],
        ['get_map', {}],
      ]) {
        let rejected = false;
        try { rejected = (await client.callTool({ name, arguments: args })).isError === true; }
        catch { rejected = true; }
        assert.ok(rejected, `Invalid input accepted: ${name}`);
      }
      assert.equal(count, before, 'Invalid calls must never reach Pro');
      let unknownRejected = false;
      try { unknownRejected = (await client.callTool({ name: 'unknown_tool', arguments: {} })).isError === true; }
      catch { unknownRejected = true; }
      assert.ok(unknownRejected);
      reports.push({ mode, protocol: client.getNegotiatedProtocolVersion(), era: client.getProtocolEra(), result: 'PASS' });
    } finally { await client.close(); }
    assert.equal(stderr, '', 'Server must not emit unexpected errors');
  }
} finally { await new Promise(resolve => pipe.close(resolve)); }
const report = { checkedAt: new Date().toISOString(), suite: 'official-sdk-stdio-with-mock-pro', reports, checks: ['handshake/discovery', '7 tools', 'Unicode and 64-bit IDs', 'mock writes and readback', 'concurrent calls', 'input rejection before Pro', 'operational and unknown-tool errors', 'clean stdio shutdown'] };
await writeFile(new URL('./validation-protocol.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
