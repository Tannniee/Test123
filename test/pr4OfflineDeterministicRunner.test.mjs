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
const poedbService = require('../services/poedbService.js');
const PoedbServiceClass = poedbService.PoedbService || poedbService.constructor;

test('PR 4 Suite: Offline Mock Ingestion & Deterministic Offline Test Runner (Phase 0.17)', async (t) => {
  const tempCacheDir = path.join(__dirname, '..', 'data', 'temp_test_cache_pr4');

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

  await t.test('1. Total Network Isolation: CacheManager functions 100% offline with mocked responses', async () => {
    // Poison fetch implementation that rejects any unexpected outbound call
    const offlineFetchImpl = async (url) => {
      if (url.includes('Currency')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            lines: [
              { id: 1, currencyTypeName: 'Chaos Orb', chaosEquivalent: 1 },
              { id: 2, currencyTypeName: 'Divine Orb', chaosEquivalent: 180 }
            ],
            items: [
              { id: 1, name: 'Chaos Orb', icon: 'chaos.png' },
              { id: 2, name: 'Divine Orb', icon: 'divine.png' }
            ]
          })
        };
      }
      throw new Error(`CRITICAL: Outbound network call attempted in offline test to: ${url}`);
    };

    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false,
      fetchImpl: offlineFetchImpl
    });

    const result = await cm.fetchCategorySingleFlight('poe1', 'Standard', 'Currency');
    assert.equal(result.res.httpCode, 200);
    assert.equal(result.res.error, null);
    assert.ok(result.res.data.lines.length >= 2);
    assert.equal(result.res.data.lines[1].currencyTypeName, 'Divine Orb');
  });

  await t.test('2. Offline Error Handling: Network failure does not crash or corrupt memory', async () => {
    const offlineFailingFetch = async () => {
      throw new Error('ENOTFOUND: Offline test mode - network unreachable');
    };

    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false,
      fetchImpl: offlineFailingFetch
    });

    // Directly test fetchJson with 0 retries so it returns immediately
    const res = await cm.fetchJson('https://example.com/test', 0);
    assert.ok(res.error !== null, 'Should return error object');
    assert.ok(res.error.includes('Offline test mode') || res.error.includes('ENOTFOUND'));
  });

  await t.test('3. PoedbService Offline Mocking: Functions without outbound network calls', async () => {
    const offlinePoedbFetch = async (url) => {
      if (url.includes('Test_Offline_Relic')) {
        return {
          ok: true,
          status: 200,
          text: async () => `
            <html>
              <body>
                <div class="item-card">
                  <h1>Test Offline Relic</h1>
                  <div class="property">Stack Size: 20</div>
                  <div class="explicit">Grants ancient powers to the bearer</div>
                  <div class="flavourText">Forged offline in total isolation.</div>
                </div>
              </body>
            </html>
          `
        };
      }
      throw new Error(`CRITICAL: Unexpected network call to ${url}`);
    };

    const customPoedb = new PoedbServiceClass(tempCacheDir, {
      fetchImpl: offlinePoedbFetch
    });

    const itemDesc = await customPoedb.getItemDescription('Test Offline Relic', 'poe1');
    assert.ok(itemDesc, 'Should parse mock description cleanly');
    assert.equal(itemDesc.title, 'Test Offline Relic');
    assert.equal(itemDesc.stackSize, 20);
    assert.equal(itemDesc.flavourText, 'Forged offline in total isolation.');
  });
});
