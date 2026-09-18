process.env.NODE_ENV = 'test';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const CategoryRegistry = require('../services/categoryRegistry');
const ConversionMath = require('../services/conversionMath');
const cacheManager = require('../services/cacheManager');
const { CacheManager } = cacheManager;

// Ensure any background schedulers are halted
cacheManager.stopSchedulers();

console.log('====================================================');
console.log('  Running v1.0.1+ Architecture & Integration Tests');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

(async () => {
  const testCacheDir = path.join(__dirname, 'temp_cache');
  if (!fs.existsSync(testCacheDir)) fs.mkdirSync(testCacheDir, { recursive: true });

  // ----------------------------------------------------
  // 1. Category Registry & LineageSupportGems
  // ----------------------------------------------------
  console.log('--- Suite 1: Category Registry & LineageSupportGems ---');

  await it('should have Category Registry for PoE 1 (44 types) and PoE 2 (23 types)', () => {
    const p1 = CategoryRegistry.getRegistry('poe1');
    const p2 = CategoryRegistry.getRegistry('poe2');
    assert.strictEqual(p1.length, 44, 'PoE 1 must have 44 types matching all poe.ninja tabs (Incubator & DjinnCoin removed)');
    assert.strictEqual(p2.length, 23, 'PoE 2 must have exactly 23 types matching user screenshot');

    assert(CategoryRegistry.isValid('poe1', 'Map'));
    assert.strictEqual(CategoryRegistry.getGroup('poe1', 'Map'), 'atlas');
    assert(CategoryRegistry.isValid('poe2', 'LineageSupportGems'));
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'LineageSupportGems'), 'Lineage Gems');
    assert(CategoryRegistry.isValid('poe2', 'UniqueWeapons'));
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'UniqueWeapons'), 'Unique Weapons');
    assert(CategoryRegistry.isValid('poe2', 'UniqueTablets'));
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'UniqueTablets'), 'Unique Tablets');
  });

  await it('should map PoE 2 labels correctly (Abyss -> Abyssal Bones, Ritual -> Omens, Delirium -> Liquid Emotions, Breach -> Catalysts)', () => {
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Abyss'), 'Abyssal Bones');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Ritual'), 'Omens');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Delirium'), 'Liquid Emotions');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Breach'), 'Catalysts');
  });

  // ----------------------------------------------------
  // 2. Direct Discovery Execution & Single-Flight Deduplication
  // ----------------------------------------------------
  console.log('\n--- Suite 2: Direct Discovery & Single-Flight Deduplication ---');

  const mockFetchImpl = async (url) => {
    if (url.includes('type=Currency')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          core: { primary: 'chaos', rates: { divine: 0.0028 } },
          items: [{ id: 'chaos', name: 'Chaos Orb' }, { id: 'divine', name: 'Divine Orb' }],
          lines: [{ id: 'chaos', primaryValue: 1.0 }, { id: 'divine', primaryValue: 360.0 }]
        })
      };
    }
    if (url.includes('type=Runegraft')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          core: { primary: 'chaos' },
          items: [{ id: 'runegraft_1', name: 'Runegraft of Treachery' }],
          lines: [{ id: 'runegraft_1', primaryValue: 15.0 }]
        })
      };
    }
    if (url.includes('type=Ducat')) {
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    }
    // Default empty for other types
    return {
      ok: true,
      status: 200,
      json: async () => ({
        core: { primary: 'chaos' },
        items: [],
        lines: []
      })
    };
  };

  const discoveryCm = new CacheManager({
    autoStart: false,
    cacheDir: testCacheDir,
    fetchImpl: mockFetchImpl
  });

  await it('should run direct discoverLeagueAvailability and discover Runegraft while marking Ducat unsupported', async () => {
    const league = 'DiscoveryRealTestLeague';
    const available = await discoveryCm.discoverLeagueAvailability('poe1', league);

    const hasRunegraft = available.some(c => c.type === 'Runegraft');
    const hasDucat = available.some(c => c.type === 'Ducat');

    assert.strictEqual(hasRunegraft, true, 'Runegraft must be discovered with count > 0');
    assert.strictEqual(hasDucat, false, 'Ducat must be excluded since HTTP 404 returned');

    const batches = discoveryCm.getRotationBatches('poe1', league);
    assert(batches.some(b => b.includes('Runegraft')), 'Runegraft must be in rotation queue');
  });

  await it('should deduplicate parallel discovery calls to the same league (single-flight)', async () => {
    const league = 'DedupeTestLeague';
    const p1 = discoveryCm.discoverLeagueAvailability('poe1', league);
    const p2 = discoveryCm.discoverLeagueAvailability('poe1', league);

    assert(discoveryCm.discoveryJobs.has(`poe1:${league}`), 'Discovery job must be registered in map');
    const [res1, res2] = await Promise.all([p1, p2]);

    assert.deepStrictEqual(res1, res2);
    assert.strictEqual(discoveryCm.discoveryJobs.has(`poe1:${league}`), false, 'Discovery job must be cleaned up on completion');
  });

  // ----------------------------------------------------
  // 3. Lifecycle States: warming -> discovering -> ready
  // ----------------------------------------------------
  console.log('\n--- Suite 3: Lifecycle States (warming / discovering / ready) ---');

  await it('should return discovering status while discovery job is actively in progress', async () => {
    const league = 'LifecycleTestLeague';
    const discoveryPromise = discoveryCm.discoverLeagueAvailability('poe1', league);

    // Immediate check during in-flight discovery
    const dataDuring = discoveryCm.getData('poe1', league);
    assert.strictEqual(dataDuring.status, 'discovering', 'Must report status discovering while pass is running');

    await discoveryPromise;

    // After completion
    const dataAfter = discoveryCm.getData('poe1', league);
    assert.strictEqual(dataAfter.status, 'ready', 'Must report status ready once pass finishes');
    assert(dataAfter.items.length > 0, 'Must have items');
  });

  // ----------------------------------------------------
  // 4. Per-League Mutex Queue & Lost Update Elimination
  // ----------------------------------------------------
  console.log('\n--- Suite 4: Per-League Mutex Queue & Lost Update Elimination ---');

  await it('should serialize concurrent merges and prevent lost updates', async () => {
    const mutexLeague = 'MutexTestLeague';
    discoveryCm.memoryCache['poe1'][mutexLeague] = {
      game: 'poe1',
      league: mutexLeague,
      items: [{ id: 'init_item', name: 'Initial Orb', sourceType: 'Currency' }],
      rates: { divine: 0.005 }
    };

    const jobA = discoveryCm.withLeagueMutex('poe1', mutexLeague, async () => {
      await discoveryCm.sleep(25);
      const current = discoveryCm.memoryCache['poe1'][mutexLeague];
      const kept = current.items.filter(it => it.sourceType !== 'Essence');
      discoveryCm.memoryCache['poe1'][mutexLeague] = {
        ...current,
        items: [...kept, { id: 'item_essence', name: 'Essence of Woe', sourceType: 'Essence' }]
      };
    });

    const jobB = discoveryCm.withLeagueMutex('poe1', mutexLeague, async () => {
      await discoveryCm.sleep(10);
      const current = discoveryCm.memoryCache['poe1'][mutexLeague];
      const kept = current.items.filter(it => it.sourceType !== 'Fossil');
      discoveryCm.memoryCache['poe1'][mutexLeague] = {
        ...current,
        items: [...kept, { id: 'item_fossil', name: 'Bound Fossil', sourceType: 'Fossil' }]
      };
    });

    await Promise.all([jobA, jobB]);

    const finalItems = discoveryCm.memoryCache['poe1'][mutexLeague].items;
    assert(finalItems.some(i => i.id === 'item_essence'), 'Essence must be present');
    assert(finalItems.some(i => i.id === 'item_fossil'), 'Fossil must be present');
    assert.strictEqual(finalItems.length, 3);
  });

  // ----------------------------------------------------
  // 5. Operation Tracking & isRefreshing Accuracy
  // ----------------------------------------------------
  console.log('\n--- Suite 5: Operation Tracking & isRefreshing Accuracy ---');

  await it('should report isRefreshing true during fetch, merge, discovery or refreshAll', () => {
    assert.strictEqual(discoveryCm.isRefreshing, false);

    discoveryCm.activeMerges.add('poe1:TestMerge');
    assert.strictEqual(discoveryCm.isRefreshing, true, 'Must report true when merge is active');

    discoveryCm.activeMerges.clear();
    discoveryCm.activeDiscoveries.add('poe1:TestDisc');
    assert.strictEqual(discoveryCm.isRefreshing, true, 'Must report true when discovery is active');

    discoveryCm.activeDiscoveries.clear();
    assert.strictEqual(discoveryCm.isRefreshing, false);
  });

  // ----------------------------------------------------
  // 6. Tracked Leagues & Auto-Pruning
  // ----------------------------------------------------
  console.log('\n--- Suite 6: Tracked Leagues & Auto-Pruning ---');

  await it('should not track all historical files on disk into scheduler', () => {
    // Disk contains historical files, but trackedLeagues must only contain active/standard
    assert.strictEqual(discoveryCm.trackedLeagues['poe1'].has('Allflame'), true);
    assert.strictEqual(discoveryCm.trackedLeagues['poe1'].has('Standard'), true);
    assert.strictEqual(discoveryCm.trackedLeagues['poe1'].has('AncientOldLeague2024'), false);
  });

  await it('should prune retired leagues on league refresh', () => {
    discoveryCm.trackedLeagues['poe1'].add('DeadLeague2023');
    discoveryCm.leaguesList['poe1'] = [
      { id: 'Allflame', name: 'Allflame' },
      { id: 'Standard', name: 'Standard' }
    ];

    discoveryCm.syncTrackedLeagues('poe1');
    assert.strictEqual(discoveryCm.trackedLeagues['poe1'].has('DeadLeague2023'), false, 'Retired league must be pruned');
  });

  // ----------------------------------------------------
  // 7. Rate Guard & PoE 2 Chaos Rate Stale Tracking
  // ----------------------------------------------------
  console.log('\n--- Suite 7: Rate Guard & Rate Anomalies ---');

  await it('should validate PoE 2 Chaos Rate and flag stale when either Exalted or Chaos is abnormal', () => {
    const checkNormal = ConversionMath.validateRate(0.5, 0.5);
    assert.strictEqual(checkNormal.valid, true);

    const checkSpike = ConversionMath.validateRate(5.0, 0.5);
    assert.strictEqual(checkSpike.isAnomaly, true);
    assert.strictEqual(checkSpike.isStale, true);
  });

  // ----------------------------------------------------
  // 8. CSS .hidden Utility Verification
  // ----------------------------------------------------
  console.log('\n--- Suite 8: CSS Utility Rule Verification ---');

  await it('should have .hidden { display: none !important; } in style.css for proper modal dismissals', () => {
    const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    assert(css.includes('.hidden'), 'style.css must contain .hidden');
    assert(css.includes('display: none !important;'), 'style.css must set display: none !important for .hidden');
  });

  // Cleanup
  try {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n====================================================');
  console.log(`  v1.0.1+ Integration Tests completed: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
})();
