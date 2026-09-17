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

console.log('\n====================================================');
console.log('  All Frontend Module Unit Tests Passed! ✓');
console.log('====================================================\n');
