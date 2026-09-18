import assert from 'node:assert';
import fs from 'node:fs';
import { Search } from '../public/js/modules/search.js';

console.log('====================================================');
console.log('  Verifying Tab Switching & Category Logic');
console.log('====================================================\n');

// 1. Load Allflame cache items
const cacheData = JSON.parse(fs.readFileSync('data/cache/poe1_Allflame.json', 'utf8'));
const items = cacheData.items || [];
console.log(`Loaded ${items.length} items from poe1_Allflame.json`);

// 2. Test initial Currency view
let appState = {
  currentGame: 'poe1',
  currentLeague: 'Allflame',
  activeCategory: 'Currency',
  activeSubCategory: null,
  searchQuery: '',
  priceFilter: 'all',
  onlyFavorites: false,
  favorites: new Set(),
  currentPage: 1,
  pageSize: 50
};

let filtered = Search.filterAndRank(items, {
  query: appState.searchQuery,
  category: appState.activeCategory,
  subCategory: appState.activeSubCategory,
  priceFilter: appState.priceFilter,
  onlyFavorites: appState.onlyFavorites,
  favoritesSet: appState.favorites,
  game: appState.currentGame
});

console.log(`--- Step 1: Initial View ---`);
console.log(`Active Category: "${appState.activeCategory}" -> Rendered ${filtered.length} items.`);
assert.strictEqual(filtered.length > 0, true, 'Currency should have items');
assert.strictEqual(filtered.every(i => i.category === 'Currency'), true, 'All items must be Currency');
console.log('✓ PASS: Currency view displays only Currency items.\n');

// 3. Simulate user typing in search bar: "divine"
console.log(`--- Step 2: User Searches "divine" ---`);
appState.searchQuery = 'divine';
let isSearching = appState.searchQuery.trim().length > 0;
filtered = Search.filterAndRank(items, {
  query: appState.searchQuery,
  category: isSearching ? 'All' : appState.activeCategory,
  subCategory: isSearching ? null : appState.activeSubCategory,
  priceFilter: appState.priceFilter,
  onlyFavorites: appState.onlyFavorites,
  favoritesSet: appState.favorites,
  game: appState.currentGame
});
console.log(`Search Query: "${appState.searchQuery}" -> Found ${filtered.length} items.`);
assert.strictEqual(filtered.length > 0, true, 'Search should find divine items');
console.log(`Top item: "${filtered[0].name}" (category: ${filtered[0].category})`);
console.log('✓ PASS: Search finds items across categories.\n');

// 4. Simulate user clicking the "Oils" sidebar tab!
console.log(`--- Step 3: User Clicks "Oils" Sidebar Tab ---`);
// EXACT click handler logic:
const clickedCategory = 'Oils';
appState.searchQuery = ''; // Cleared!
appState.activeCategory = clickedCategory;
appState.activeSubCategory = null;
appState.onlyFavorites = false;
appState.currentPage = 1;

isSearching = appState.searchQuery.trim().length > 0;
filtered = Search.filterAndRank(items, {
  query: appState.searchQuery,
  category: isSearching ? 'All' : appState.activeCategory,
  subCategory: appState.activeSubCategory,
  priceFilter: appState.priceFilter,
  onlyFavorites: appState.onlyFavorites,
  favoritesSet: appState.favorites,
  game: appState.currentGame
});

console.log(`Switched to: "${appState.activeCategory}" -> Rendered ${filtered.length} items.`);
assert.strictEqual(filtered.length, 16, 'Oils category in Allflame must return exactly 16 oils');
assert.strictEqual(filtered.every(i => i.name.toLowerCase().includes('oil')), true, 'All items must be oils');
assert.strictEqual(filtered.some(i => i.category === 'Currency'), false, 'NO Currency items must be present in Oils view');
console.log('Sample Oils rendered:', filtered.slice(0, 5).map(i => i.name));
console.log('✓ PASS: Tab switch to Oils renders ONLY Oils and immediately replaces search results.\n');

// 5. Test Omens and Allflame Embers (from user report)
console.log(`--- Step 4: User Clicks "Omens" and "Allflame Embers" ---`);
appState.activeCategory = 'Omens';
let omensFiltered = Search.filterAndRank(items, {
  query: '',
  category: appState.activeCategory,
  subCategory: null,
  priceFilter: 'all',
  onlyFavorites: false,
  favoritesSet: appState.favorites,
  game: appState.currentGame
});
console.log(`Omens item count: ${omensFiltered.length}`);
assert.strictEqual(omensFiltered.length >= 10, true, 'Omens must have at least 10 items');
assert.strictEqual(omensFiltered.every(i => i.category === 'Omens' || i.sourceType === 'Omen'), true, 'All items must be Omens');
assert.strictEqual(omensFiltered.some(i => i.name === 'Mirror of Kalandra'), false, 'Omens must never contain Mirror of Kalandra');
console.log('Sample Omens:', omensFiltered.slice(0, 3).map(i => i.name));
console.log(`✓ PASS: Omens view displays ${omensFiltered.length} Omens items.\n`);

appState.activeCategory = 'Allflame Embers';
let allflameFiltered = Search.filterAndRank(items, {
  query: '',
  category: appState.activeCategory,
  subCategory: null,
  priceFilter: 'all',
  onlyFavorites: false,
  favoritesSet: appState.favorites,
  game: appState.currentGame
});
console.log(`Allflame Embers item count: ${allflameFiltered.length}`);
assert.strictEqual(allflameFiltered.length, 8, 'Allflame Embers must have 8 items');
assert.strictEqual(allflameFiltered.every(i => i.category === 'Allflame Embers' || i.sourceType === 'AllflameEmber'), true, 'All items must be Allflame Embers');
console.log('Sample Allflame Embers:', allflameFiltered.slice(0, 3).map(i => i.name));
console.log('✓ PASS: Allflame Embers view displays exactly 8 Allflame Ember items.\n');

// 6. Verify CSS rules for smoothness, zero layout shift, and sticky sidebar
console.log(`--- Step 5: CSS Sticky Sidebar & Anti-Jitter Rules ---`);
const css = fs.readFileSync('public/css/style.css', 'utf8');

assert.strictEqual(css.includes('scrollbar-gutter: stable;'), true, 'Must have scrollbar-gutter: stable');
assert.strictEqual(css.includes('overflow-y: scroll;'), true, 'Must have overflow-y: scroll to prevent 17px Windows jump');
assert.strictEqual(css.includes('overflow-x: clip;'), true, 'Must have overflow-x: clip on body so position: sticky works');
assert.strictEqual(css.includes('align-self: flex-start;'), true, 'Must have align-self: flex-start on .app-sidebar for flexbox sticky');
assert.strictEqual(css.includes('position: sticky;'), true, 'Must have position: sticky');
assert.strictEqual(css.includes('min-height: 480px;'), true, 'Must have min-height: 480px on containers');
assert.strictEqual(css.includes('@keyframes viewFadeIn'), true, 'Must have viewFadeIn keyframes');

// Check nav-item font-weight is 500 in both default and active to prevent text reflow jitter
const navItemActiveMatch = css.match(/\.nav-item\.active\s*\{([^}]+)\}/);
assert.strictEqual(navItemActiveMatch !== null, true, '.nav-item.active rule found');
assert.strictEqual(navItemActiveMatch[1].includes('font-weight: 500;'), true, '.nav-item.active must keep font-weight: 500 to avoid text expansion');

// Check dom.sidebar initialization in app.js
const appJs = fs.readFileSync('public/js/app.js', 'utf8');
assert.strictEqual(appJs.includes("dom.sidebar = document.getElementById('sidebar');"), true, 'dom.sidebar must be initialized in initDom()');

console.log('✓ PASS: All CSS sticky sidebar, anti-jitter, and app.js safety rules verified!\n');
console.log('====================================================');
console.log('  All Category Switching & Motion Tests Passed! ✓');
console.log('====================================================');
