import net from 'node:net';

const queues = new Map();

export function bridge(processId, request) {
  const previous = queues.get(processId) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(() => connectWithRetry(processId, request));
  queues.set(processId, current);
  const cleanup = () => { if (queues.get(processId) === current) queues.delete(processId); };
  current.then(cleanup, cleanup);
  return current;
}

async function connectWithRetry(processId, request) {
  // The add-in recreates its single pipe listener after each response.
  // Retry only failures before connection; never replay a sent mutation.
  for (let attempt = 0; ; attempt++) {
    try { return await bridgeOnce(processId, request); }
    catch (error) {
      if (attempt >= 20 || !['ENOENT', 'EBUSY'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

function bridgeOnce(processId, request) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(`\\\\.\\pipe\\CodexArcGISPro-${processId}`);
    let buffer = '';
    const timer = setTimeout(() => socket.destroy(new Error('Pro connector timed out; check whether Pro is busy. A timed-out change may still complete; read current state before retrying.')), 15000);
    socket.setEncoding('utf8');
    let connected = false;
    socket.once('connect', () => { connected = true; socket.write(JSON.stringify(request) + '\n'); });
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 8 * 1024 * 1024) return socket.destroy(new Error('Response too large'));
      const end = buffer.indexOf('\n');
      if (end >= 0) {
        try {
          const value = JSON.parse(buffer.slice(0, end));
          if (value.error) reject(new Error(value.error)); else resolve(value);
        } catch (error) { reject(error); }
        socket.destroy();
      }
    });
    socket.once('error', error => {
      const failure = new Error(`Cannot connect to Pro ${processId}: ${error.message}. Check that ArcGIS Pro is open and the add-in is loaded.`);
      if (!connected) failure.code = error.code;
      reject(failure);
    });
    socket.once('close', () => { clearTimeout(timer); reject(new Error('Pro connection closed before a complete response')); });
  });
}
