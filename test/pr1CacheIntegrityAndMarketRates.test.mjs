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
import { Render } from '../public/js/modules/render.js';

test('PR 1 Suite: Cache Integrity, Mirror Protection & Removal of Fake Market Rates', async (t) => {
  const tempCacheDir = path.join(__dirname, '..', 'data', 'temp_test_cache_pr1');

  // Ensure clean test directory
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

  await t.test('1. Stale-Cache Preservation: Transient 500 error does NOT destroy cached items', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    const game = 'poe1';
    const league = 'Allflame';

    // Seed initial cache with Currency and Oils
    const initialEntry = {
      game,
      league,
      updatedAt: new Date().toISOString(),
      divinePriceInChaos: 200,
      mirrorPriceInChaos: 50000,
      rates: { divine: 0.005 },
      sources: {
        Currency: { status: 'available', itemsCount: 2, updatedAt: new Date().toISOString() },
        Oils: { status: 'available', itemsCount: 3, updatedAt: new Date().toISOString() }
      },
      count: 5,
      items: [
        { id: 'curr-divine', name: 'Divine Orb', category: 'Currency', sourceType: 'Currency', chaosValue: 200, divineValue: 1 },
        { id: 'curr-chaos', name: 'Chaos Orb', category: 'Currency', sourceType: 'Currency', chaosValue: 1, divineValue: 0.005 },
        { id: 'oil-golden', name: 'Golden Oil', category: 'Oils', sourceType: 'Oils', chaosValue: 45, divineValue: 0.225 },
        { id: 'oil-silver', name: 'Silver Oil', category: 'Oils', sourceType: 'Oils', chaosValue: 20, divineValue: 0.1 },
        { id: 'oil-opalescent', name: 'Opalescent Oil', category: 'Oils', sourceType: 'Oils', chaosValue: 10, divineValue: 0.05 }
      ]
    };

    cm.memoryCache[game][league] = initialEntry;
    cm.saveToDisk(game, league, initialEntry);

    // Mock fetchJson to return HTTP 500 for Oils
    cm.fetchJson = async (url) => {
      return {
        data: null,
        httpCode: 500,
        latencyMs: 42,
        error: 'HTTP 500: Internal Server Error'
      };
    };

    // Execute sync for Oils only
    const result = await cm.syncCategoryBatch(game, league, ['Oils']);

    // Assert: Oils items MUST still exist!
    const oilItems = result.items.filter(it => it.sourceType === 'Oils');
    assert.equal(oilItems.length, 3, 'Must preserve all 3 previous Oils items');
    assert.equal(result.items.length, 5, 'Total items in cache must remain 5');

    // Assert: Freshness status marks stale preservation
    assert.equal(result.sources.Oils.status, 'available');
    assert.equal(result.sources.Oils.isStale, true, 'Oils must be marked isStale');
    assert.equal(result.sources.Oils.itemsCount, 3);

    // Assert disk cache also retained all items
    const diskContent = JSON.parse(fs.readFileSync(cm.getCacheFilePath(game, league), 'utf-8'));
    assert.equal(diskContent.items.length, 5, 'Disk cache must retain 5 items');
  });

  await t.test('2. Stale-Cache Replacement: Succeeded fetch replaces items and clears isStale', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    const game = 'poe1';
    const league = 'Allflame';

    // Mock fetchJson to return successful data for Oils with 2 items
    cm.fetchJson = async (url) => {
      return {
        data: {
          lines: [
            { id: 'golden-oil', primaryValue: 50, sparkline: { data: [50], totalChange: 0 } },
            { id: 'tainted-oil', primaryValue: 120, sparkline: { data: [120], totalChange: 0 } }
          ],
          items: [
            { id: 'golden-oil', name: 'Golden Oil', category: 'Oils' },
            { id: 'tainted-oil', name: 'Tainted Oil', category: 'Oils' }
          ],
          core: { rates: { divine: 0.005 } }
        },
        httpCode: 200,
        latencyMs: 25
      };
    };

    const result = await cm.syncCategoryBatch(game, league, ['Oils']);
    const oilItems = result.items.filter(it => it.sourceType === 'Oils');

    assert.equal(oilItems.length, 2, 'Oils must now contain exactly the 2 new items');
    assert.equal(result.sources.Oils.isStale, false, 'isStale must be false after success');
    assert.equal(result.sources.Oils.status, 'available');
    assert.equal(oilItems.some(it => it.name === 'Tainted Oil'), true);
  });

  await t.test('3. Mirror Protection: Divination cards like House of Mirrors do NOT overwrite Mirror rate', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    const game = 'poe1';
    const league = 'Allflame';

    // Set existing mirror rate to 50,000c
    cm.memoryCache[game][league] = {
      game,
      league,
      updatedAt: new Date().toISOString(),
      divinePriceInChaos: 200,
      mirrorPriceInChaos: 50000,
      rates: { divine: 0.005 },
      sources: {},
      count: 0,
      items: []
    };

    // Mock DivinationCard response containing "House of Mirrors" (22,000c)
    cm.fetchJson = async (url) => {
      return {
        data: {
          lines: [
            { id: 'house-of-mirrors', primaryValue: 22000, sparkline: { data: [22000], totalChange: 0 } },
            { id: 'the-doctor', primaryValue: 3500, sparkline: { data: [3500], totalChange: 0 } }
          ],
          items: [
            { id: 'house-of-mirrors', name: 'House of Mirrors', category: 'Cards' },
            { id: 'the-doctor', name: 'The Doctor', category: 'Cards' }
          ],
          core: { rates: {} }
        },
        httpCode: 200,
        latencyMs: 30
      };
    };

    const result = await cm.syncCategoryBatch(game, league, ['DivinationCard']);

    // Critical assertion: mirrorPriceInChaos must remain 50,000 and NOT be 22,000!
    assert.equal(result.mirrorPriceInChaos, 50000, 'Mirror rate must NOT be overwritten by House of Mirrors');

    // Now mock Currency response containing actual Mirror of Kalandra (65,000c)
    cm.fetchJson = async (url) => {
      return {
        data: {
          lines: [
            { id: 'mirror', primaryValue: 65000, sparkline: { data: [65000], totalChange: 0 } },
            { id: 'divine', primaryValue: 200, sparkline: { data: [200], totalChange: 0 } }
          ],
          items: [
            { id: 'mirror', name: 'Mirror of Kalandra', category: 'Currency' },
            { id: 'divine', name: 'Divine Orb', category: 'Currency' }
          ],
          core: { rates: { divine: 0.005 } }
        },
        httpCode: 200,
        latencyMs: 20
      };
    };

    const currencyResult = await cm.syncCategoryBatch(game, league, ['Currency']);
    assert.equal(currencyResult.mirrorPriceInChaos, 65000, 'Mirror rate MUST update when genuine Mirror of Kalandra arrives from Currency');
  });

  await t.test('4. Removal of Fake Market Rates: Static scan ensures 366/120 constants are removed', () => {
    const filesToCheck = [
      path.join(__dirname, '..', 'public', 'js', 'app.js'),
      path.join(__dirname, '..', 'public', 'js', 'modules', 'render.js'),
      path.join(__dirname, '..', 'public', 'js', 'modules', 'modals.js'),
      path.join(__dirname, '..', 'services', 'cacheManager.js')
    ];

    for (const f of filesToCheck) {
      const content = fs.readFileSync(f, 'utf-8');
      assert.doesNotMatch(content, /\|\|\s*366\b/, `File ${path.basename(f)} must not contain fallback || 366`);
      assert.doesNotMatch(content, /\|\|\s*120\b/, `File ${path.basename(f)} must not contain fallback || 120`);
    }
  });

  await t.test('5. Render Format: Popular pair formats cleanly without fake rates when rate is 0 or unavailable', () => {
    const item = {
      name: 'Test Expensive Item',
      divineValue: 2,
      chaosValue: 0,
      icon: ''
    };

    // When rates are unavailable (0)
    const emptyRates = { divinePriceInChaos: 0, rawRates: {} };
    const html = Render.formatMostPopularHtml(item, 'poe1', emptyRates);

    // Must show the primary 2 Div, but must NOT show fake "≈ 732 C" (which would come from 2 * 366)
    assert.match(html, /2(\.0)?/);
    assert.doesNotMatch(html, /732/, 'Must not compute fake 732 C from hardcoded 366 rate');
    assert.doesNotMatch(html, /val-sub/, 'Must omit secondary conversion line when rate is 0');
  });
});
