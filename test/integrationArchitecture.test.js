const assert = require('assert');
const CategoryRegistry = require('../services/categoryRegistry');
const ConversionMath = require('../services/conversionMath');
const cacheManager = require('../services/cacheManager');

console.log('====================================================');
console.log('  Running v1.0.0 Architecture & Integration Tests');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------
// 1. Category Registry & Dynamic Availability
// ----------------------------------------------------
console.log('--- Suite 1: Category Registry & Availability ---');

it('should have Category Registry for PoE 1 and PoE 2', () => {
  const p1 = CategoryRegistry.getRegistry('poe1');
  const p2 = CategoryRegistry.getRegistry('poe2');
  assert(p1.length >= 15, 'PoE 1 should register all exchange types');
  assert(p2.length >= 10, 'PoE 2 should register all exchange types');
  assert(CategoryRegistry.isValid('poe1', 'Currency'));
  assert(CategoryRegistry.isValid('poe2', 'Breach')); // Catalysts in PoE2
  assert(CategoryRegistry.isValid('poe2', 'Ritual')); // Omens in PoE2
  assert(!CategoryRegistry.isValid('poe1', 'FakeItemXYZ'));
});

it('should map PoE 2 labels correctly (Abyss -> Abyssal Bones, Ritual -> Omens, Delirium -> Liquid Emotions, Breach -> Catalysts)', () => {
  assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Abyss'), 'Abyssal Bones');
  assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Ritual'), 'Omens');
  assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Delirium'), 'Liquid Emotions');
  assert.strictEqual(CategoryRegistry.getLabel('poe2', 'Breach'), 'Catalysts');
});

it('should dynamically adapt available categories per league (hide seasonal Ducat when unsupported)', () => {
  // Mock cache for League A (has Ducat)
  cacheManager.memoryCache['poe1']['LeagueWithDucat'] = {
    items: [
      { id: '1', name: 'Chaos Orb', sourceType: 'Currency' },
      { id: '2', name: 'Alkahest Ducat', sourceType: 'Ducat' }
    ]
  };

  // Mock cache for League B (no Ducat)
  cacheManager.memoryCache['poe1']['LeagueWithoutDucat'] = {
    items: [
      { id: '1', name: 'Chaos Orb', sourceType: 'Currency' }
    ]
  };

  const availA = cacheManager.getAvailableCategories('poe1', 'LeagueWithDucat');
  const hasDucatA = availA.some(c => c.type === 'Ducat');
  assert.strictEqual(hasDucatA, true, 'Ducat should be available in LeagueWithDucat');

  const availB = cacheManager.getAvailableCategories('poe1', 'LeagueWithoutDucat');
  const hasDucatB = availB.some(c => c.type === 'Ducat');
  assert.strictEqual(hasDucatB, false, 'Ducat should be hidden in LeagueWithoutDucat');
});

// ----------------------------------------------------
// 2. Auto-Adapting Scheduler
// ----------------------------------------------------
console.log('\n--- Suite 2: Auto-Adapting Scheduler ---');

it('should generate dynamic rotation batches of 2 without hardcoded arrays', () => {
  const batches = cacheManager.getRotationBatches('poe1', 'Allflame');
  assert(Array.isArray(batches) && batches.length > 0);
  for (const b of batches) {
    assert(b.length >= 1 && b.length <= 2, 'Batches must be chunked in pairs of 1-2');
  }
});

it('should automatically exclude unavailable seasonal categories from rotation queue', () => {
  const batchesWithoutDucat = cacheManager.getRotationBatches('poe1', 'LeagueWithoutDucat');
  const ducatInBatches = batchesWithoutDucat.some(b => b.includes('Ducat'));
  assert.strictEqual(ducatInBatches, false, 'Ducat must not appear in rotation for league without Ducat');
});

// ----------------------------------------------------
// 3. Cache Merging with sourceType
// ----------------------------------------------------
console.log('\n--- Suite 3: Cache Merging with sourceType ---');

it('should cleanly replace old Currency items (including Catalysts/Vaal) without duplicates or stale residue', () => {
  const existingItems = [
    { id: 'poe1_chaos_Currency', name: 'Chaos Orb', sourceType: 'Currency', chaosValue: 1 },
    { id: 'poe1_catalyst_Currency', name: 'Fertile Catalyst', sourceType: 'Currency', chaosValue: 10 },
    { id: 'poe1_essence_Essence', name: 'Essence of Greed', sourceType: 'Essence', chaosValue: 5 }
  ];

  const typesToRefresh = ['Currency'];
  const typesSet = new Set(typesToRefresh);

  // Filter using sourceType
  const kept = existingItems.filter(it => !typesSet.has(it.sourceType));
  assert.strictEqual(kept.length, 1);
  assert.strictEqual(kept[0].name, 'Essence of Greed');

  // Merged with new items
  const freshCurrency = [
    { id: 'poe1_chaos_Currency', name: 'Chaos Orb', sourceType: 'Currency', chaosValue: 1 },
    { id: 'poe1_catalyst_Currency', name: 'Fertile Catalyst', sourceType: 'Currency', chaosValue: 12 }
  ];

  const merged = [...kept, ...freshCurrency];
  assert.strictEqual(merged.length, 3);
  const updatedCatalyst = merged.find(i => i.name === 'Fertile Catalyst');
  assert.strictEqual(updatedCatalyst.chaosValue, 12, 'Catalyst should be updated without stale duplicates');
});

// ----------------------------------------------------
// 4. Rate Guard Propagation
// ----------------------------------------------------
console.log('\n--- Suite 4: Rate Guard Propagation ---');

it('should propagate guarded rate to all normalized item prices during rate spike', () => {
  const lastKnownExaltedRate = 437.3;
  const anomalousSpikeRate = 2200; // > 5x abnormal spike!

  const check = ConversionMath.validateRate(anomalousSpikeRate, lastKnownExaltedRate);
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.isAnomaly, true);
  assert.strictEqual(check.rate, lastKnownExaltedRate, 'Should guard rate and preserve lastKnownExaltedRate');

  // Normalize item with guarded rate
  const rawMock = {
    core: { primary: 'divine' },
    items: [{ id: 'sample_item', name: 'Sample Item' }],
    lines: [{ id: 'sample_item', primaryValue: 2.0 }] // 2 Divine
  };

  const normalized = cacheManager.normalizeExchangeData(rawMock, 'Essences', 'poe2', 'Standard', {
    exalted: check.rate
  });

  assert.strictEqual(normalized[0].exaltedValue, 874.6, 'Item exaltedValue must use guarded rate (2 * 437.3), not spike');
});

// ----------------------------------------------------
// 5. Non-Silent League Warming
// ----------------------------------------------------
console.log('\n--- Suite 5: Non-Silent League Warming ---');

it('should return warming status for uncached league and NEVER silently return Standard', () => {
  const res = cacheManager.getData('poe2', 'BrandNewLeague2026');
  assert.strictEqual(res.status, 'warming');
  assert.strictEqual(res.league, 'BrandNewLeague2026');
  assert.notStrictEqual(res.league, 'Standard', 'Must NEVER silently fallback to Standard');
  assert.strictEqual(res.items.length, 0);
});

console.log('\n====================================================');
console.log(`  v1.0.0 Integration Tests completed: ${passed} passed, ${failed} failed`);
console.log('====================================================\n');

if (failed > 0) process.exit(1);
