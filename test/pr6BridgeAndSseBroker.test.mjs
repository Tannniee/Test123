process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const createApp = require('../server/createApp.js');
const { startServer } = require('../server/lifecycle.js');
const bridgeState = require('../services/bridge/bridgeState.js');
const quickInspectBroker = require('../services/bridge/quickInspectBroker.js');

test('PR 6 Suite: Desktop <-> Web Bridge & Real-Time SSE Broker (Phase 4)', async (t) => {
  t.after(() => {
    cacheManagerInstance.stopSchedulers();
    quickInspectBroker.closeAll();
    bridgeState.clear();
  });

  await t.test('1. BridgeState: Sets latest, maintains ring buffer, and handles clearing', () => {
    bridgeState.clear();
    assert.equal(bridgeState.getLatest(), null);

    const rawItem1 = `
Item Class: Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 10/20
--------
Randomises the numeric values of the random modifiers on an item
`;
    const stored1 = bridgeState.setLatest({
      game: 'poe1',
      source: 'clipboard',
      rawText: rawItem1
    });

    assert.ok(stored1.requestId.startsWith('req_'));
    assert.equal(stored1.game, 'poe1');
    assert.equal(stored1.source, 'clipboard');
    assert.equal(bridgeState.getLatest().requestId, stored1.requestId);
    assert.equal(bridgeState.history.length, 1);

    // Add multiple to test ring buffer
    for (let i = 0; i < 15; i++) {
      bridgeState.setLatest({
        game: 'poe1',
        rawText: `Item ${i}`
      });
    }

    assert.equal(bridgeState.history.length, bridgeState.maxHistorySize, 'History buffer must be capped at maxHistorySize');
    bridgeState.clear();
    assert.equal(bridgeState.getLatest(), null);
    assert.equal(bridgeState.history.length, 0);
  });

  await t.test('2. QuickInspectBroker: Manages SSE client set, broadcasts inspect events, and handles disconnect', () => {
    const writtenChunks = [];
    let isEnded = false;

    const mockRes = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      flushHeaders() {},
      write(chunk) { writtenChunks.push(chunk); },
      end() { isEnded = true; }
    };

    let closeHandler = null;
    const mockReq = {
      on(evt, handler) {
        if (evt === 'close') closeHandler = handler;
      }
    };

    quickInspectBroker.addClient(mockReq, mockRes);
    assert.equal(quickInspectBroker.clientCount, 1);
    assert.equal(mockRes.headers['Content-Type'], 'text/event-stream');
    assert.ok(writtenChunks[0].includes('event: connected'));

    // Broadcast an inspected item
    const sampleItem = {
      game: 'poe1',
      rawText: 'Item Class: Currency\nRarity: Currency\nChaos Orb\n--------'
    };
    quickInspectBroker.broadcastInspect(sampleItem);

    const inspectChunk = writtenChunks.find(c => c.includes('event: inspect'));
    assert.ok(inspectChunk, 'Client must receive event: inspect');
    assert.ok(inspectChunk.includes('Chaos Orb'));

    // Simulate client disconnect
    assert.ok(typeof closeHandler === 'function');
    closeHandler();
    assert.equal(quickInspectBroker.clientCount, 0, 'Client should be removed from set on close');
  });

  await t.test('3. HTTP Endpoints: /api/bridge/inspect validation, /latest, and /status', async () => {
    const serverInstance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      const baseUrl = serverInstance.url;

      // 3a. Rejects empty rawText
      const resBad = await fetch(`${baseUrl}/api/bridge/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: '' })
      });
      assert.equal(resBad.status, 400);
      const jsonBad = await resBad.json();
      assert.equal(jsonBad.success, false);

      // 3b. Rejects gibberish non-PoE text
      const resGibberish = await fetch(`${baseUrl}/api/bridge/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: 'hi' })
      });
      assert.equal(resGibberish.status, 400);

      // 3c. Accepts valid PoE item clipboard text
      const validPoEItem = `
Item Class: Belts
Rarity: Unique
Mageblood
Heavy Belt
--------
Requirements:
Level: 44
--------
Item Level: 86
--------
+35 to Strength
--------
Magic Utility Flask Effects cannot be removed
Leftmost 4 Utility Flasks constantly apply their Flask Effects to you
Magic Utility Flask Effects cannot be gained from Flasks
`;

      const resValid = await fetch(`${baseUrl}/api/bridge/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: validPoEItem,
          game: 'poe1',
          source: 'desktop_hotkey'
        })
      });
      assert.equal(resValid.status, 200);
      const jsonValid = await resValid.json();
      assert.equal(jsonValid.success, true);
      assert.ok(jsonValid.requestId);
      assert.equal(jsonValid.item.game, 'poe1');
      assert.ok(jsonValid.item.rawText.includes('Mageblood'));

      // 3d. Cold-start recovery endpoint (/api/bridge/latest)
      const resLatest = await fetch(`${baseUrl}/api/bridge/latest`);
      assert.equal(resLatest.status, 200);
      const jsonLatest = await resLatest.json();
      assert.equal(jsonLatest.success, true);
      assert.ok(jsonLatest.item.rawText.includes('Mageblood'));

      // 3e. Bridge status endpoint (/api/bridge/status)
      const resStatus = await fetch(`${baseUrl}/api/bridge/status`);
      assert.equal(resStatus.status, 200);
      const jsonStatus = await resStatus.json();
      assert.equal(jsonStatus.status, 'active');
      assert.equal(jsonStatus.hasLatest, true);
    } finally {
      await serverInstance.close();
    }
  });

  await t.test('4. End-to-End Client & Cold-Start Synchronization (Phase 4 / 19)', async () => {
    const serverInstance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      const baseUrl = serverInstance.url;

      // Seed an inspected PoE 2 item into the bridge
      const poe2Item = `
Item Class: Boots
Rarity: Unique
Atziri's Step
Slink Boots
--------
Quality: +20%
Evasion Rating: 720
--------
Requirements:
Level: 69
Dex: 120
--------
+180% to Evasion Rating
+75 to maximum Life
30% increased Movement Speed
`;

      const postRes = await fetch(`${baseUrl}/api/bridge/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: poe2Item,
          game: 'poe2',
          source: 'clipboard'
        })
      });
      assert.equal(postRes.status, 200);
      const postJson = await postRes.json();
      assert.equal(postJson.success, true);
      assert.equal(postJson.item.game, 'poe2');

      // Test BridgeClient module methods
      const { BridgeClient } = await import('../public/js/modules/bridgeClient.js');
      const client = new BridgeClient({
        eventsUrl: `${baseUrl}/api/bridge/events`,
        latestUrl: `${baseUrl}/api/bridge/latest`,
        inspectUrl: `${baseUrl}/api/bridge/inspect`
      });

      // Cold start synchronization: client queries latest item
      const latestItem = await client.fetchLatest();
      assert.ok(latestItem, 'Must recover latest item on cold-start');
      assert.equal(latestItem.game, 'poe2');
      assert.ok(latestItem.rawText.includes("Atziri's Step"));

      // Status listener test
      let statusReceived = null;
      const unsubStatus = client.onStatusChange((status) => {
        statusReceived = status;
      });
      assert.equal(statusReceived, false, 'Initial state should be offline');

      client.notifyStatus(true);
      assert.equal(statusReceived, true, 'Status notification must propagate to subscriber');
      unsubStatus();

      // Inspect listener test
      let inspectedReceived = null;
      let coldStartFlag = null;
      const unsubInspect = client.onInspect((item, isCold) => {
        inspectedReceived = item;
        coldStartFlag = isCold;
      });

      client.notifyInspect(latestItem, true);
      assert.ok(inspectedReceived);
      assert.equal(inspectedReceived.game, 'poe2');
      assert.equal(coldStartFlag, true);
      unsubInspect();
    } finally {
      await serverInstance.close();
    }
  });
});
