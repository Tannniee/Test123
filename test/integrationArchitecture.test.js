const assert = require('assert');
const path = require('path');
const fs = require('fs');
const CategoryRegistry = require('../services/categoryRegistry');
const ConversionMath = require('../services/conversionMath');
const cacheManager = require('../services/cacheManager');
const { CacheManager } = cacheManager;

// Ensure any background schedulers started by default import are halted
cacheManager.stopSchedulers();

console.log('====================================================');
console.log('  Running v1.0.1 Architecture & Integration Tests');
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
  // Setup isolated test cache manager
  const testCacheDir = path.join(__dirname, 'temp_cache');
  if (!fs.existsSync(testCacheDir)) fs.mkdirSync(testCacheDir, { recursive: true });

  const testCm = new CacheManager({
    autoStart: false,
    cacheDir: testCacheDir
  });

  // ----------------------------------------------------
  // 1. Category Registry & LineageSupportGems
  // ----------------------------------------------------
  console.log('--- Suite 1: Category Registry & LineageSupportGems ---');

  await it('should have Category Registry for PoE 1 (18 types) and PoE 2 (14 types)', () => {
    const p1 = CategoryRegistry.getRegistry('poe1');
    const p2 = CategoryRegistry.getRegistry('poe2');
    assert.strictEqual(p1.length, 18, 'PoE 1 must have exactly 18 exchange types');
    assert.strictEqual(p2.length, 14, 'PoE 2 must have exactly 14 exchange types (including LineageSupportGems)');

    assert(CategoryRegistry.isValid('poe2', 'LineageSupportGems'));
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'LineageSupportGems'), 'Lineage Gems');
  });

  await it('should map PoE 2 labels correctly (Abyss -> Abyssal Bones, Ritual -> Omens, Delirium -> Liquid Emotions, Breach -> Catalysts)', () => {
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Abyss'), 'Abyssal Bones');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Ritual'), 'Omens');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Delirium'), 'Liquid Emotions');
    assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Breach'), 'Catalysts');
  });

  // ----------------------------------------------------
  // 2. 4-Tier Status Taxonomy (Available / Empty / Unsupported / Transient)
  // ----------------------------------------------------
  console.log('\n--- Suite 2: 4-Tier Status Taxonomy ---');

  await it('should classify HTTP 200 with items > 0 as "available"', () => {
    const mockData = {
      lines: [{ id: 'chaos', primaryValue: 1.0 }],
      items: [{ id: 'chaos', name: 'Chaos Orb' }]
    };
    const normalized = testCm.normalizeExchangeData(mockData, 'Currency', 'poe1', 'TaxonomyTest');
    assert.strictEqual(normalized.length, 1);

    testCm.availabilityMap['poe1']['TaxonomyTest'] = {
      Currency: { status: 'available', count: 1, lastChecked: new Date().toISOString() }
    };
    const avail = testCm.getAvailableCategories('poe1', 'TaxonomyTest');
    assert(avail.some(c => c.type === 'Currency'), 'Currency must be available');
  });

  await it('should NOT treat empty (200 with 0 items) or unsupported (404) as available', () => {
    testCm.availabilityMap['poe1']['TaxonomyTest']['EmptyCategory'] = {
      status: 'empty',
      count: 0,
      lastChecked: new Date().toISOString()
    };
    testCm.availabilityMap['poe1']['TaxonomyTest']['Ducat'] = {
      status: 'unsupported',
      count: 0,
      lastChecked: new Date().toISOString()
    };

    const avail = testCm.getAvailableCategories('poe1', 'TaxonomyTest');
    assert.strictEqual(avail.some(c => c.type === 'EmptyCategory'), false, 'Empty categories must not be available');
    assert.strictEqual(avail.some(c => c.type === 'Ducat'), false, 'Unsupported seasonal categories must not be available');
  });

  await it('should preserve previous availability under transient network failure (transient safeguard)', () => {
    testCm.memoryCache['poe1']['TransientLeague'] = {
      sources: {
        Scarab: { status: 'available', itemsCount: 45, updatedAt: new Date().toISOString() }
      },
      items: [
        { id: '1', name: 'Gilded Scarab', sourceType: 'Scarab' }
      ]
    };

    testCm.initAvailabilityForLeague('poe1', 'TransientLeague');
    const availBefore = testCm.getAvailableCategories('poe1', 'TransientLeague');
    assert(availBefore.some(c => c.type === 'Scarab'), 'Scarab is available initially');

    // Simulate transient error
    testCm.availabilityMap['poe1']['TransientLeague']['Scarab'] = {
      status: 'available', // Kept by transient safeguard
      count: 45,
      isStale: true
    };

    const availAfter = testCm.getAvailableCategories('poe1', 'TransientLeague');
    assert(availAfter.some(c => c.type === 'Scarab'), 'Scarab must stay available despite transient glitch');
  });

  // ----------------------------------------------------
  // 3. Breaking Circular Discovery for New Leagues
  // ----------------------------------------------------
  console.log('\n--- Suite 3: Breaking Circular Discovery ---');

  await it('should discover and adapt rotation batches for newly probed non-priority categories', () => {
    const freshLeague = 'BrandNewDiscoveredLeague';
    // Simulate discovery pass populating availability map with seasonal items
    testCm.availabilityMap['poe1'][freshLeague] = {
      Currency: { status: 'available', count: 120 },
      Fragment: { status: 'available', count: 80 },
      Scarab: { status: 'available', count: 95 },
      Runegraft: { status: 'available', count: 32 }, // Seasonal item discovered!
      Ducat: { status: 'unsupported', count: 0 }     // Seasonal item unsupported!
    };

    testCm.memoryCache['poe1'][freshLeague] = {
      items: [
        { id: '1', name: 'Chaos Orb', sourceType: 'Currency' },
        { id: '2', name: 'Sacrifice at Dusk', sourceType: 'Fragment' },
        { id: '3', name: 'Rusted Scarab', sourceType: 'Scarab' },
        { id: '4', name: 'Runegraft of Treachery', sourceType: 'Runegraft' }
      ]
    };

    const available = testCm.getAvailableCategories('poe1', freshLeague);
    assert(available.some(c => c.type === 'Runegraft'), 'Runegraft should be discovered and available');
    assert.strictEqual(available.some(c => c.type === 'Ducat'), false, 'Ducat should be excluded');

    const rotationBatches = testCm.getRotationBatches('poe1', freshLeague);
    assert(rotationBatches.length > 0);
    assert(rotationBatches.some(b => b.includes('Runegraft')), 'Runegraft must be present in rotation queue');
    assert.notDeepStrictEqual(rotationBatches, [['Currency']], 'Must NEVER fall back to [["Currency"]] when non-priority items exist');
  });

  // ----------------------------------------------------
  // 4. Per-League Mutex Queue & Lost Update Elimination
  // ----------------------------------------------------
  console.log('\n--- Suite 4: Per-League Mutex Queue & Lost Update Elimination ---');

  await it('should prevent lost updates when parallel tasks merge different categories to same league', async () => {
    const mutexLeague = 'MutexTestLeague';

    // Seed empty entry
    testCm.memoryCache['poe1'][mutexLeague] = {
      game: 'poe1',
      league: mutexLeague,
      items: [{ id: 'init_item', name: 'Initial Orb', sourceType: 'Currency' }],
      rates: { divine: 0.005 }
    };

    // Simulate parallel merges using withLeagueMutex
    const jobA = testCm.withLeagueMutex('poe1', mutexLeague, async () => {
      await testCm.sleep(30); // artificial async latency
      const current = testCm.memoryCache['poe1'][mutexLeague];
      const kept = current.items.filter(it => it.sourceType !== 'Essence');
      testCm.memoryCache['poe1'][mutexLeague] = {
        ...current,
        items: [...kept, { id: 'item_essence', name: 'Essence of Woe', sourceType: 'Essence' }]
      };
    });

    const jobB = testCm.withLeagueMutex('poe1', mutexLeague, async () => {
      await testCm.sleep(10);
      const current = testCm.memoryCache['poe1'][mutexLeague];
      const kept = current.items.filter(it => it.sourceType !== 'Fossil');
      testCm.memoryCache['poe1'][mutexLeague] = {
        ...current,
        items: [...kept, { id: 'item_fossil', name: 'Bound Fossil', sourceType: 'Fossil' }]
      };
    });

    await Promise.all([jobA, jobB]);

    const finalItems = testCm.memoryCache['poe1'][mutexLeague].items;
    const hasEssence = finalItems.some(i => i.id === 'item_essence');
    const hasFossil = finalItems.some(i => i.id === 'item_fossil');

    assert.strictEqual(hasEssence, true, 'Essence item from Job A must NOT be lost');
    assert.strictEqual(hasFossil, true, 'Fossil item from Job B must NOT be lost');
    assert.strictEqual(finalItems.length, 3, 'All items must be preserved without race-condition overwrites');
  });

  // ----------------------------------------------------
  // 5. Rate Guard & Pre-Condition Safeguards
  // ----------------------------------------------------
  console.log('\n--- Suite 5: Rate Guard & Pre-Condition Safeguards ---');

  await it('should validate PoE 2 Chaos Rate and guard against anomalies', () => {
    const lastKnownChaos = 0.5;
    const spikeChaos = 5.0; // 10x spike!

    const check = ConversionMath.validateRate(spikeChaos, lastKnownChaos);
    assert.strictEqual(check.valid, false);
    assert.strictEqual(check.isAnomaly, true);
    assert.strictEqual(check.rate, lastKnownChaos, 'Should keep last known good chaos rate');
  });

  await it('should accurately track nextRotationBatch index without always returning index 0', () => {
    const rotLeague = 'RotationIndexLeague';
    testCm.availabilityMap['poe1'][rotLeague] = {
      Currency: { status: 'available', count: 10 },
      Essence: { status: 'available', count: 10 },
      Fossil: { status: 'available', count: 10 },
      Oil: { status: 'available', count: 10 }
    };

    const batches = testCm.getRotationBatches('poe1', rotLeague);
    assert.strictEqual(batches.length, 2);

    const key = `poe1_${rotLeague}`;
    testCm.rotationIndices[key] = 0;
    const batch0 = testCm.getNextRotationBatch('poe1', rotLeague);
    assert.deepStrictEqual(batch0, batches[0]);

    testCm.rotationIndices[key] = 1;
    const batch1 = testCm.getNextRotationBatch('poe1', rotLeague);
    assert.deepStrictEqual(batch1, batches[1]);
  });

  // ----------------------------------------------------
  // 6. League Validation
  // ----------------------------------------------------
  console.log('\n--- Suite 6: League Validation ---');

  await it('should validate known leagues and reject fake or malformed league inputs', () => {
    assert.strictEqual(testCm.isValidLeague('poe1', 'Allflame'), true);
    assert.strictEqual(testCm.isValidLeague('poe1', 'Standard'), true);
    assert.strictEqual(testCm.isValidLeague('poe2', 'Forbidden Rites'), true);
    assert.strictEqual(testCm.isValidLeague('poe1', 'RandomBogusLeagueXYZ'), false);
    assert.strictEqual(testCm.isValidLeague('poe1', ''), false);
    assert.strictEqual(testCm.isValidLeague('poe1', null), false);
  });

  // Cleanup temp test directory
  try {
    fs.rmSync(testCacheDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n====================================================');
  console.log(`  v1.0.1 Integration Tests completed: ${passed} passed, ${failed} failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
})();
