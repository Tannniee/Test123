const assert = require('assert');
const ConversionMath = require('../services/conversionMath');

console.log('====================================================');
console.log('  Running PoE Currency Conversion Math Unit Tests');
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
// 1. PoE 1 Conversions (Chaos Primary)
// ----------------------------------------------------
console.log('--- Suite 1: PoE 1 Conversions (Chaos Primary) ---');

it('should convert Chaos to Divine using divine rate (1/360 ≈ 0.002778)', () => {
  const rates = { divine: 0.002778 };
  const res = ConversionMath.poe1ChaosToDivine(180, rates);
  assert.strictEqual(res, 0.5);
});

it('should convert Chaos to Divine using divinePriceInChaos fallback', () => {
  const res = ConversionMath.poe1ChaosToDivine(360, {}, 360);
  assert.strictEqual(res, 1.0);
});

it('should convert Divine to Chaos accurately', () => {
  const res = ConversionMath.poe1DivineToChaos(2.5, {}, 200);
  assert.strictEqual(res, 500);
});

it('should convert Mirror price in Chaos to Divine count', () => {
  const mirrorChaos = 240000;
  const divChaos = 300;
  const res = ConversionMath.poe1MirrorToDivine(mirrorChaos, divChaos);
  assert.strictEqual(res, 800);
});

it('should safely return 0 on 0, null, or negative PoE 1 values', () => {
  assert.strictEqual(ConversionMath.poe1ChaosToDivine(0, { divine: 0.005 }), 0);
  assert.strictEqual(ConversionMath.poe1ChaosToDivine(-50, { divine: 0.005 }), 0);
  assert.strictEqual(ConversionMath.poe1DivineToChaos(null, {}, 200), 0);
  assert.strictEqual(ConversionMath.poe1MirrorToDivine(10000, 0), 0);
});

// ----------------------------------------------------
// 2. PoE 2 Conversions (Divine Primary)
// ----------------------------------------------------
console.log('\n--- Suite 2: PoE 2 Conversions (Divine Primary) ---');

it('should convert Divine to Exalted using live rate (e.g. 437.3 Ex/Div)', () => {
  const res = ConversionMath.poe2DivineToExalted(2, 437.3);
  assert.strictEqual(res, 874.6);
});

it('should convert Exalted to Divine accurately', () => {
  const res = ConversionMath.poe2ExaltedToDivine(437.3, 437.3);
  assert.strictEqual(res, 1.0);
});

it('should convert Divine to Chaos in PoE 2', () => {
  const res = ConversionMath.poe2DivineToChaos(5, 9.25);
  assert.strictEqual(res, 46.25);
});

it('should derive Exalted rate from core.rates.exalted when available', () => {
  const rate = ConversionMath.derivePoE2ExaltedRate({ exalted: 437.3 });
  assert.strictEqual(rate, 437.3);
});

it('should derive Exalted rate from exalted line primaryValue (1 / 0.002287 ≈ 437.3)', () => {
  const rate = ConversionMath.derivePoE2ExaltedRate({}, { primaryValue: 0.002287 });
  assert.strictEqual(rate, 437.3);
});

it('should handle missing or 0 rate gracefully without crashing or returning NaN', () => {
  assert.strictEqual(ConversionMath.poe2DivineToExalted(5, 0), 0);
  assert.strictEqual(ConversionMath.poe2ExaltedToDivine(500, 0), 0);
  assert.strictEqual(ConversionMath.derivePoE2ExaltedRate({}, null), 0);
});

// ----------------------------------------------------
// 3. Rate Validation & Anomaly Guard
// ----------------------------------------------------
console.log('\n--- Suite 3: Rate Validation & Anomaly Guard ---');

it('should accept valid normal rate', () => {
  const check = ConversionMath.validateRate(437.3, 435.0);
  assert.strictEqual(check.valid, true);
  assert.strictEqual(check.isAnomaly, false);
  assert.strictEqual(check.rate, 437.3);
  assert.strictEqual(check.isStale, false);
});

it('should reject 0 or negative rate and keep last-known-good rate', () => {
  const check = ConversionMath.validateRate(0, 435.0);
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.rate, 435.0);
  assert.strictEqual(check.isStale, true);
});

it('should reject null or NaN rate and keep last-known-good rate', () => {
  const check = ConversionMath.validateRate(NaN, 360.0);
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.rate, 360.0);
  assert.strictEqual(check.isStale, true);
});

it('should detect abnormal price spike (> 3x) as anomaly and keep last-known-good', () => {
  const check = ConversionMath.validateRate(1500, 300); // 5x spike!
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.isAnomaly, true);
  assert.strictEqual(check.rate, 300);
  assert.strictEqual(check.isStale, true);
  assert(check.reason.includes('Abnormal rate deviation'));
});

it('should detect abnormal price crash (< 0.3x) as anomaly and keep last-known-good', () => {
  const check = ConversionMath.validateRate(50, 300); // < 0.17x crash!
  assert.strictEqual(check.valid, false);
  assert.strictEqual(check.isAnomaly, true);
  assert.strictEqual(check.rate, 300);
  assert.strictEqual(check.isStale, true);
});

console.log('\n====================================================');
console.log(`  Tests completed: ${passed} passed, ${failed} failed`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
