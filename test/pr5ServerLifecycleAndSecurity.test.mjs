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

  await t.test('5. Strict Loopback Enforcement: Rejects non-loopback hosts with SecurityError', async () => {
    const nonLoopbackHosts = ['0.0.0.0', '192.168.1.100', '::', 'example.com'];
    for (const badHost of nonLoopbackHosts) {
      await assert.rejects(
        async () => {
          await startServer({
            port: 0,
            host: badHost,
            skipSignalHandlers: true
          });
        },
        /SecurityError.*non-loopback host/i,
        `Should reject non-loopback host "${badHost}"`
      );
    }
  });

  await t.test('6. Loopback CORS Protection: Permits local origins, forbids external web origins', async () => {
    const instance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      // Allowed local origin
      const allowedRes = await fetch(`${instance.url}/api/health`, {
        headers: { Origin: 'http://localhost:3000' }
      });
      assert.equal(allowedRes.status, 200);
      assert.equal(allowedRes.headers.get('access-control-allow-origin'), 'http://localhost:3000');

      // Disallowed external origin (preflight OPTIONS)
      const blockedPreflight = await fetch(`${instance.url}/api/health`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil-site.com',
          'Access-Control-Request-Method': 'POST'
        }
      });
      assert.equal(blockedPreflight.status, 403, 'External origin preflight must be rejected with 403');
    } finally {
      await instance.close();
    }
  });

  await t.test('7. SSE Graceful Shutdown: close() cleanly terminates active SSE streams without hanging', async () => {
    const instance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      // Connect an SSE client to /api/bridge/events
      const controller = new AbortController();
      const sseRes = await fetch(`${instance.url}/api/bridge/events`, {
        signal: controller.signal
      });

      assert.equal(sseRes.status, 200);
      assert.equal(sseRes.headers.get('content-type'), 'text/event-stream');

      // Consume reader to confirm connection is active
      const reader = sseRes.body.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      assert.ok(text.includes('event: connected'), 'Must receive connected event');

      // Now call instance.close() - it must terminate all SSE connections and resolve
      const closePromise = instance.close();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('instance.close() timed out hanging on SSE connection')), 3000)
      );

      await Promise.race([closePromise, timeoutPromise]);

      // Assert reader finishes
      const nextRead = await reader.read();
      assert.ok(nextRead.done, 'SSE stream reader must be done after close()');
      controller.abort();
    } finally {
      try { await instance.close(); } catch (e) {}
    }
  });
});
