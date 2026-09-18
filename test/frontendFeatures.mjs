process.env.NODE_ENV = 'test';
import { Search } from '../public/js/modules/search.js';
import { Render } from '../public/js/modules/render.js';
import assert from 'assert';

console.log('====================================================');
console.log('  Testing Frontend Search & Rendering Modules');
console.log('====================================================\n');

const mockItems = [
  { id: '1', name: 'Divine Orb', category: 'Currency', chaosValue: 360, divineValue: 1, volume: 15000 },
  { id: '2', name: 'Exalted Orb', category: 'Currency', chaosValue: 20, divineValue: 0.05, volume: 4500 },
  { id: '3', name: 'Chaos Orb', category: 'Currency', chaosValue: 1, divineValue: 0.0028, volume: 500 },
  { id: '4', name: 'The Apothecary', category: 'Divination Cards', chaosValue: 18000, divineValue: 50, volume: 120 },
  { id: '5', name: 'The Doctor', category: 'Divination Cards', chaosValue: 2800, divineValue: 7.8, volume: 80 }
];

console.log('--- Test 1: Fuzzy search "divne orb" ---');
const res1 = Search.filterAndRank(mockItems, { query: 'divne orb' });
console.log('Found:', res1.map(i => i.name));
assert.strictEqual(res1[0]?.name, 'Divine Orb', 'Divine Orb should be ranked #1 for typo "divne orb"');
console.log('✓ PASS: Fuzzy search "divne orb" -> Divine Orb');

console.log('\n--- Test 2: Fuzzy search "apothcary" ---');
const res2 = Search.filterAndRank(mockItems, { query: 'apothcary' });
console.log('Found:', res2.map(i => i.name));
assert.strictEqual(res2[0]?.name, 'The Apothecary', 'The Apothecary should be ranked #1 for typo "apothcary"');
console.log('✓ PASS: Fuzzy search "apothcary" -> The Apothecary');

console.log('\n--- Test 3: Liquidity Badges ---');
assert(Render.renderLiquidityBadge(25000).includes('badge-high'));
assert(Render.renderLiquidityBadge(5000).includes('badge-med'));
assert(Render.renderLiquidityBadge(500).includes('badge-low'));
assert(Render.renderLiquidityBadge(0).includes('badge-zero'));
console.log('✓ PASS: Liquidity Badges (High, Med, Low, Zero)');

console.log('\n--- Test 4: PoE 2 Price Tier Filtering (Exalted based) ---');
const poe2MockItems = [
  { id: 'p1', name: 'Cheap Catalyst', category: 'Catalysts', exaltedValue: 4, divineValue: 0.01 },
  { id: 'p2', name: 'Mid Omen', category: 'Omens', exaltedValue: 45, divineValue: 0.1 },
  { id: 'p3', name: 'High Rune', category: 'Runes', exaltedValue: 800, divineValue: 2 },
  { id: 'p4', name: 'Mirror of Kalandra', category: 'Currency', exaltedValue: 60000, divineValue: 150 }
];

const cheapResults = Search.filterAndRank(poe2MockItems, { game: 'poe2', priceFilter: '<10c' });
assert.strictEqual(cheapResults.length, 1);
assert.strictEqual(cheapResults[0].name, 'Cheap Catalyst');

const midResults = Search.filterAndRank(poe2MockItems, { game: 'poe2', priceFilter: '10-100c' });
assert.strictEqual(midResults.length, 1);
assert.strictEqual(midResults[0].name, 'Mid Omen');

const highResults = Search.filterAndRank(poe2MockItems, { game: 'poe2', priceFilter: '1-5d' });
assert.strictEqual(highResults.length, 1);
assert.strictEqual(highResults[0].name, 'High Rune');
console.log('✓ PASS: PoE 2 Price Tier Filtering works accurately with exaltedValue');

console.log('\n--- Test 5: Wiki URL Generation & Category Badges ---');
const poe1Wiki = Render.getWikiUrl({ name: 'Divine Orb' }, 'poe1');
assert(poe1Wiki.includes('poewiki.net/wiki/Divine_Orb'), 'PoE 1 Wiki should link to poewiki.net');

const poe2Wiki = Render.getWikiUrl({ name: 'Distilled Fear' }, 'poe2');
assert(poe2Wiki.includes('poe2db.tw/us/'), 'PoE 2 Wiki should link to poe2db.tw');
console.log('✓ PASS: getWikiUrl generates correct game-specific database links');

console.log('\n====================================================');
console.log('  All Frontend Module Unit Tests Passed! ✓');
console.log('====================================================\n');
