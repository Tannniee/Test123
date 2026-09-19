process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const CacheManagerClass = cacheManagerInstance.CacheManager || cacheManagerInstance.constructor;
const PoeItemDescriptions = require('../public/js/itemDescriptions.js');
const poedbService = require('../services/poedbService.js');

import { state } from '../public/js/modules/state.js';
import { Modals } from '../public/js/modules/modals.js';
import { Clipboard } from '../public/js/modules/clipboard.js';

test('PR 3 Suite: PoEDB Callbacks, Compare Isolation, Price Alerts & Disk Resilience', async (t) => {
  const tempCacheDir = path.join(__dirname, '..', 'data', 'temp_test_cache_pr3');

  if (fs.existsSync(tempCacheDir)) {
    fs.rmSync(tempCacheDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempCacheDir, { recursive: true });

  t.after(() => {
    cacheManagerInstance.stopSchedulers();
    if (fs.existsSync(tempCacheDir)) {
      fs.rmSync(tempCacheDir, { recursive: true, force: true });
    }
  });

  await t.test('1. Resilient Disk Loading: Corrupt JSON file does not halt loading valid cache files', async () => {
    // Write 1 valid cache file and 1 corrupted cache file
    const validFile = path.join(tempCacheDir, 'poe1_Standard.json');
    const corruptFile = path.join(tempCacheDir, 'poe1_Hardcore.json');

    const validContent = {
      game: 'poe1',
      league: 'Standard',
      updatedAt: new Date().toISOString(),
      items: [{ id: '1', name: 'Exalted Orb', chaosValue: 15 }]
    };

    fs.writeFileSync(validFile, JSON.stringify(validContent), 'utf8');
    fs.writeFileSync(corruptFile, '<<<CORRUPT_JSON_DATA{{NOT_VALID', 'utf8');

    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    // Should load the valid one without throwing an exception
    cm.loadAllFromDisk();

    const loaded = cm.memoryCache.poe1?.Standard;
    assert.ok(loaded, 'Valid cache file should be loaded successfully into memoryCache');
    assert.equal(loaded.items[0].name, 'Exalted Orb');

    const corruptLoaded = cm.memoryCache.poe1?.Hardcore;
    assert.equal(corruptLoaded, undefined, 'Corrupted cache file should safely be skipped without crashing');
  });

  await t.test('2. Non-blocking Async Disk Writes: saveToDisk writes valid atomic cache file', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    const entry = {
      game: 'poe2',
      league: 'Standard',
      updatedAt: new Date().toISOString(),
      items: [{ id: 'orb_regal', name: 'Regal Orb', exaltedValue: 2 }]
    };

    cm.memoryCache.poe2 = { Standard: entry };
    await cm.saveToDisk('poe2', 'Standard', entry);

    const expectedFile = path.join(tempCacheDir, 'poe2_Standard.json');
    assert.ok(fs.existsSync(expectedFile), 'Cache file should exist on disk');

    const fileRaw = fs.readFileSync(expectedFile, 'utf8');
    const parsed = JSON.parse(fileRaw);
    assert.equal(parsed.game, 'poe2');
    assert.equal(parsed.items[0].name, 'Regal Orb');
  });

  await t.test('3. PoEDB Service Cache Path and Async Save', async () => {
    assert.ok(
      poedbService.cacheFilePath.includes(path.join('data', 'cache', 'poedb_descriptions.json')),
      `PoEDB cache file must point to data/cache/poedb_descriptions.json (actual: ${poedbService.cacheFilePath})`
    );

    // Test debounced async save without throwing
    poedbService.memoryCache.set('poe1:test_gem', { description: 'A test gem description' });
    poedbService.saveCacheToDisk();

    // Give debounced async save a moment to write to disk
    await new Promise(r => setTimeout(r, 600));

    assert.ok(fs.existsSync(poedbService.cacheFilePath), 'PoEDB cache file should be created/updated on disk');
    const content = JSON.parse(fs.readFileSync(poedbService.cacheFilePath, 'utf8'));
    assert.ok(content['poe1:test_gem'], 'Cached item should be serialized into JSON');
  });

  await t.test('4. PoeItemDescriptions: Set-based callbacks, unsubscription, and event payloads', async () => {
    assert.ok(PoeItemDescriptions.callbacks instanceof Set, 'callbacks must be an instance of Set');

    let callCount = 0;
    let receivedPayload = null;

    const listener = (event, desc) => {
      callCount++;
      receivedPayload = event;
    };

    const unsubscribe = PoeItemDescriptions.onPoedbLoaded(listener);
    assert.equal(typeof unsubscribe, 'function', 'onPoedbLoaded must return an unsubscribe function');
    assert.ok(PoeItemDescriptions.callbacks.has(listener), 'Listener should be registered in Set');

    // Simulate mock fetchPoedbDescription notification
    const mockData = { description: 'Increases spell damage' };
    const cleanKey = 'poe1:controlled_destruction';
    const eventPayload = {
      game: 'poe1',
      itemName: 'Controlled Destruction Support',
      description: mockData.description,
      key: cleanKey,
      toString() { return this.itemName; }
    };

    PoeItemDescriptions.callbacks.forEach(fn => fn(eventPayload, mockData.description));

    assert.equal(callCount, 1, 'Listener should have been called once');
    assert.equal(receivedPayload.itemName, 'Controlled Destruction Support');
    assert.equal(receivedPayload.game, 'poe1');
    assert.equal(String(receivedPayload), 'Controlled Destruction Support', 'toString() allows backward-compatible string coercion');

    // Test unsubscribe
    unsubscribe();
    assert.ok(!PoeItemDescriptions.callbacks.has(listener), 'Listener must be removed after unsubscribe');

    PoeItemDescriptions.callbacks.forEach(fn => fn(eventPayload, mockData.description));
    assert.equal(callCount, 1, 'Listener must NOT be called after unsubscribe');
  });

  await t.test('5. Compare Mode: Context isolation across games and leagues', async () => {
    state.clearCompare();
    assert.equal(state.compareList.size, 0);

    state.currentGame = 'poe1';
    state.currentLeague = 'Standard';

    const itemPoe1 = { id: 'divine_orb', name: 'Divine Orb', chaosValue: 150 };
    state.toggleCompare(itemPoe1);

    const savedPoe1 = state.compareList.get('divine_orb');
    assert.equal(savedPoe1.game, 'poe1', 'Item in compare must carry current game context');
    assert.equal(savedPoe1.league, 'Standard', 'Item in compare must carry current league context');

    // Clear compare
    state.clearCompare();
    assert.equal(state.compareList.size, 0, 'clearCompare must reset compare list');
  });

  await t.test('6. Price Alerts: Stateful toast deduplication prevents spam on re-renders', async () => {
    // Setup state alerts
    state.alerts = [
      {
        id: 'alert_mirror',
        itemName: 'Mirror of Kalandra',
        condition: 'above',
        threshold: 1000,
        currency: 'div',
        isTriggered: false,
        lastTriggeredAt: null
      }
    ];

    const toasts = [];
    const originalToast = Clipboard.showToast;
    Clipboard.showToast = (msg, type) => {
      toasts.push({ msg, type });
    };

    try {
      const itemsAbove = [
        { name: 'Mirror of Kalandra', divineValue: 1200, chaosValue: 600000 }
      ];

      // First check: condition is met -> Toast should fire
      Modals.checkPriceAlerts(itemsAbove, state);
      assert.equal(toasts.length, 1, 'First trigger should fire exactly 1 toast');
      assert.ok(toasts[0].msg.includes('Mirror of Kalandra'));
      assert.equal(state.alerts[0].isTriggered, true, 'Alert should be flagged as isTriggered: true');

      // Second check: condition still met -> NO duplicate toast should fire!
      Modals.checkPriceAlerts(itemsAbove, state);
      assert.equal(toasts.length, 1, 'Second check with same met condition must NOT fire a duplicate toast');

      // Third check: price drops below threshold -> reset isTriggered to false
      const itemsBelow = [
        { name: 'Mirror of Kalandra', divineValue: 800, chaosValue: 400000 }
      ];
      Modals.checkPriceAlerts(itemsBelow, state);
      assert.equal(toasts.length, 1, 'No new toast when below threshold');
      assert.equal(state.alerts[0].isTriggered, false, 'Alert should reset isTriggered: false when falling below threshold');

      // Fourth check: price goes above threshold again -> New toast fires!
      Modals.checkPriceAlerts(itemsAbove, state);
      assert.equal(toasts.length, 2, 'New toast should fire when threshold crossed again from false to true');
    } finally {
      Clipboard.showToast = originalToast;
    }
  });
});
