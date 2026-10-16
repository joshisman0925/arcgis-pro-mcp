import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const run = promisify(execFile);
const cwd = fileURLToPath(new URL('.', import.meta.url));
const inspector = fileURLToPath(new URL('./node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js', import.meta.url));
async function inspect(args) {
  const { stdout, stderr } = await run(process.execPath, [inspector, '--cli', process.execPath, 'server.mjs', ...args, '--format', 'json'], { cwd, windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(stderr, '', 'Inspector reported warnings/errors');
  return JSON.parse(stdout).result;
}
const listed = await inspect(['--method', 'tools/list', '--strict']);
assert.equal(listed.tools.length, 7);
const sessionResult = await inspect(['--method', 'tools/call', '--tool-name', 'list_sessions']);
assert.ok(!sessionResult.isError, JSON.stringify(sessionResult));
const { sessions } = JSON.parse(sessionResult.content[0].text);
assert.ok(Array.isArray(sessions));
assert.ok(sessions.length, 'Open Pro before running Inspector live verification');
const maps = [];
for (const session of sessions) {
  const result = await inspect(['--method', 'tools/call', '--tool-name', 'get_map', '--tool-arg', `processId=${session.processId}`]);
  assert.ok(!result.isError, JSON.stringify(result));
  const map = JSON.parse(result.content[0].text);
  maps.push({ processId: session.processId, name: map.name, layerCount: map.layers.length });
}
const report = { checkedAt: new Date().toISOString(), inspectorVersion: '2.11.0', schemaStrictCheck: 'PASS', toolCount: listed.tools.length, liveSessionDiscovery: 'PASS', liveMaps: maps, writesPerformed: false };
await writeFile(new URL('./validation-inspector.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
