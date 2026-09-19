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

test('PR 2 Suite: Concurrency Single-Flight, Timeout & 429 Handling, Scheduler Overlap Lock', async (t) => {
  const tempCacheDir = path.join(__dirname, '..', 'data', 'temp_test_cache_pr2');

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

  await t.test('1. Single-Flight Category Fetches: Concurrent fetches for same category execute exactly 1 network call', async () => {
    let networkCallCount = 0;

    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false,
      fetchImpl: async (url) => {
        networkCallCount++;
        // Simulate network latency of 60ms
        await new Promise(r => setTimeout(r, 60));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            lines: [
              { id: 'divine', primaryValue: 210, sparkline: { data: [210], totalChange: 0 } },
              { id: 'chaos', primaryValue: 1, sparkline: { data: [1], totalChange: 0 } }
            ],
            items: [
              { id: 'divine', name: 'Divine Orb', category: 'Currency' },
              { id: 'chaos', name: 'Chaos Orb', category: 'Currency' }
            ],
            core: { rates: { divine: 0.00476 } }
          })
        };
      }
    });

    const game = 'poe1';
    const league = 'Allflame';

    // Seed empty entry
    cm.memoryCache[game][league] = {
      game,
      league,
      updatedAt: new Date().toISOString(),
      divinePriceInChaos: 200,
      mirrorPriceInChaos: 0,
      rates: { divine: 0.005 },
      sources: {},
      count: 0,
      items: []
    };

    // Trigger 3 concurrent syncCategoryBatch calls for the same 'Currency'
    const [res1, res2, res3] = await Promise.all([
      cm.syncCategoryBatch(game, league, ['Currency']),
      cm.syncCategoryBatch(game, league, ['Currency']),
      cm.syncCategoryBatch(game, league, ['Currency'])
    ]);

    // Network request must have occurred exactly ONCE!
    assert.equal(networkCallCount, 1, `Expected 1 network call but got ${networkCallCount}`);

    // All 3 callers must have received identical results with 2 items
    assert.equal(res1.items.length, 2);
    assert.equal(res2.items.length, 2);
    assert.equal(res3.items.length, 2);
    assert.equal(res1.items[0].name, 'Divine Orb');
  });

  await t.test('2. Request Timeout: Hanging network request aborts cleanly and returns timeout status', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false,
      timeoutMs: 80, // Very short timeout for testing
      fetchImpl: async (url, opts) => {
        return new Promise((resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'TimeoutError';
              reject(err);
            });
          }
          // Intentionally do not resolve to simulate hung network
        });
      }
    });

    const start = Date.now();
    const result = await cm.fetchJson('https://example.com/hang', 1, [20]);
    const elapsed = Date.now() - start;

    assert.equal(result.httpCode, 408, 'Should return HTTP 408 for timeout');
    assert.equal(result.error, 'Request Timeout');
    assert.ok(elapsed < 1000, `Expected elapsed < 1000ms but got ${elapsed}ms`);
  });

  await t.test('3. HTTP 429 Handling: Backs off and retries when encountering rate limit', async () => {
    let attempts = 0;

    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false,
      fetchImpl: async (url) => {
        attempts++;
        if (attempts === 1) {
          // Attempt 1: 429 Too Many Requests with retry-after header
          return {
            ok: false,
            status: 429,
            headers: {
              get: (header) => (header.toLowerCase() === 'retry-after' ? '0' : null)
            }
          };
        }
        // Attempt 2: 200 OK
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        };
      }
    });

    const result = await cm.fetchJson('https://example.com/ratelimit', 2, [50, 100]);

    assert.equal(attempts, 2, 'Should have retried after 429');
    assert.equal(result.httpCode, 200);
    assert.deepEqual(result.data, { success: true });
  });

  await t.test('4. Single-Flight Full Refresh: Concurrent refreshAllAvailable calls share the same job Promise', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    // Mock syncCategoryBatch to simulate work
    let syncCallCount = 0;
    cm.syncCategoryBatch = async () => {
      syncCallCount++;
      await new Promise(r => setTimeout(r, 80));
      return { count: 10 };
    };

    cm.trackedLeagues.poe1 = new Set(['Allflame']);
    cm.trackedLeagues.poe2 = new Set([]);
    cm.getAvailableCategories = () => [{ type: 'Currency' }];

    assert.equal(cm.isRefreshRunning('poe1', 'Allflame'), false);

    // Launch two parallel refreshes
    const promise1 = cm.refreshAllAvailable('poe1', 'Allflame');
    assert.equal(cm.isRefreshRunning('poe1', 'Allflame'), true, 'Should be running during execution');

    const promise2 = cm.refreshAllAvailable('poe1', 'Allflame');

    const [res1, res2] = await Promise.all([promise1, promise2]);

    assert.deepEqual(res1, res2);
    assert.equal(syncCallCount, 1, 'Only 1 batch sync should be initiated across both refresh callers');
    assert.equal(cm.isRefreshRunning('poe1', 'Allflame'), false, 'Should not be running after finish');
  });

  await t.test('5. Scheduler Overlap Lock: Does not start next iteration while previous is still running', async () => {
    const cm = new CacheManagerClass({
      cacheDir: tempCacheDir,
      autoStart: false
    });

    cm.schedulersActive = true;
    let concurrencyCount = 0;
    let maxConcurrency = 0;
    let runCount = 0;

    const task = cm.scheduleNonOverlappingTask('test-task', async () => {
      runCount++;
      concurrencyCount++;
      maxConcurrency = Math.max(maxConcurrency, concurrencyCount);
      // Simulate task taking 80ms
      await new Promise(r => setTimeout(r, 80));
      concurrencyCount--;
    }, 20); // Interval shorter than execution time (20ms vs 80ms)

    // Let it run for 200ms
    await new Promise(r => setTimeout(r, 220));
    task.stop();
    cm.schedulersActive = false;

    assert.equal(maxConcurrency, 1, 'Concurrency must never exceed 1!');
    assert.ok(runCount >= 2, `Expected at least 2 runs but got ${runCount}`);
  });
});
