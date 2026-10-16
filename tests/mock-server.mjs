import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from '../server.mjs';
import { toolNames } from '../tools.mjs';

let calls = 0;
serveStdio(() => createServer({
  sessions: async () => ({ sessions: [{ processId: 99, title: 'Mock Pro; no real GIS changes' }] }),
  invoke: async (pid, request) => {
    calls++;
    if (request.action === 'ping') return { connected: true, version: process.env.PRO_MOCK_OLD_ADDIN ? '0.1.0' : '0.3.0', actions: process.env.PRO_MOCK_OLD_ADDIN ? undefined : toolNames.filter(n => n !== 'list_sessions') };
    return { backend: 'mock', processId: pid, called: request.action, request, calls };
  },
}));
