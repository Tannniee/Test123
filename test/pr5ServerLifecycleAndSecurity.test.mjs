process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const createApp = require('../server/createApp.js');
const { startServer, parseArgs } = require('../server/lifecycle.js');

test('PR 5 Suite: Server Lifecycle, /api/health Probe & Loopback Security (Phase 1)', async (t) => {
  t.after(() => {
    cacheManagerInstance.stopSchedulers();
  });

  await t.test('1. createApp Factory: Constructs Express app without binding network socket', async () => {
    const app = createApp();
    assert.equal(typeof app, 'function', 'createApp must return Express function');
    assert.equal(typeof app.listen, 'function', 'App must expose listen method');
  });

  await t.test('2. CLI Argument Parsing: --port and --host flags parsed correctly', async () => {
    const parsed = parseArgs(['--port', '4321', '--host', '127.0.0.1']);
    assert.equal(parsed.port, 4321);
    assert.equal(parsed.host, '127.0.0.1');

    const empty = parseArgs([]);
    assert.deepEqual(empty, {});
  });

  await t.test('3. Loopback Security & Ephemeral Port: Binds strictly to 127.0.0.1', async () => {
    // Use port 0 to test OS-assigned ephemeral loopback port safely
    const instance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      assert.equal(instance.host, '127.0.0.1', 'Server must bind strictly to 127.0.0.1');
      assert.ok(instance.port > 0, 'OS must assign valid port');
      assert.ok(instance.url.startsWith('http://127.0.0.1:'), 'URL must target 127.0.0.1 loopback');

      // Test /api/health probe
      const res = await fetch(`${instance.url}/api/health`);
      assert.equal(res.status, 200, '/api/health must respond with HTTP 200');

      const health = await res.json();
      assert.equal(health.status, 'ok');
      assert.equal(health.service, 'poestash-server');
      assert.equal(typeof health.uptime, 'number');
      assert.ok(health.timestamp);
    } finally {
      await instance.close();
    }
  });

  await t.test('4. Graceful Shutdown: close() cleanly stops HTTP listener', async () => {
    const instance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    const testUrl = `${instance.url}/api/health`;

    // Verify it is responding
    const res1 = await fetch(testUrl);
    assert.equal(res1.status, 200);

    // Call close
    await instance.close();

    // Verify socket is closed
    await assert.rejects(
      async () => {
        await fetch(testUrl, { signal: AbortSignal.timeout(500) });
      },
      /fetch failed|ECONNREFUSED|TimeoutError/,
      'Server should not accept connections after close'
    );
  });
});
