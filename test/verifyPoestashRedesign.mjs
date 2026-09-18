import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('  Running Automated POESTASH Redesign Verification');
console.log('====================================================\n');

// 1. Verify index.html contains POESTASH Item Inspection View and NO Calculator inputs
console.log('--- Step 1: Verify index.html Markup ---');
const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf-8');

assert(indexHtml.includes('id="itemInspectOverlay"'), 'Must contain #itemInspectOverlay');
assert(indexHtml.includes('id="sidebarCategoryFilter"'), 'Must contain #sidebarCategoryFilter');
assert(!indexHtml.includes('id="calcModalOverlay"'), 'Must NOT contain old #calcModalOverlay');
assert(!indexHtml.includes('id="calcQtyInput"'), 'Must NOT contain old calculator qty input');
assert(!indexHtml.includes('preset-btn'), 'Must NOT contain old calculator preset buttons (+5, +10, Full stack)');
assert(indexHtml.includes('id="btnInspectBack"'), 'Must contain back button to return to list');
assert(indexHtml.includes('id="inspectChartContainer"'), 'Must contain 7-day Bezier chart container');
assert(indexHtml.includes('id="inspectRankBar"'), 'Must contain category ranking bar');
assert(indexHtml.includes('id="inspectRelatedList"'), 'Must contain related items list');
console.log('✓ PASS: index.html markup strictly adheres to POESTASH design (No calculator inputs/presets).');

// 2. Verify style.css rules
console.log('\n--- Step 2: Verify style.css Rules ---');
const styleCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');
assert(styleCss.includes('.modal-card-inspect'), 'Must contain .modal-card-inspect');
assert(styleCss.includes('.nav-group-header'), 'Must contain .nav-group-header');
assert(styleCss.includes('.sidebar-category-filter'), 'Must contain .sidebar-category-filter');
assert(styleCss.includes('.map-ico'), 'Must contain .map-ico');
assert(styleCss.includes('.blight-map-ico'), 'Must contain .blight-map-ico');
assert(styleCss.includes('.unique-map-ico'), 'Must contain .unique-map-ico');
assert(styleCss.includes('.inspect-svg-chart'), 'Must contain .inspect-svg-chart');
console.log('✓ PASS: style.css contains all POESTASH styles, group headers, and map icons.');

// 3. Test Render.generateBezierAreaChart
console.log('\n--- Step 3: Verify Render.generateBezierAreaChart ---');
const { Render } = await import('../public/js/modules/render.js');
const mockSparkline = [100, 105, 110, 108, 120, 125, 130];
const chartSvg = Render.generateBezierAreaChart(mockSparkline, 30, 480, 180);

assert(chartSvg.includes('<svg viewBox="0 0 480 180" class="inspect-svg-chart"'), 'SVG must have correct viewBox and class');
assert(chartSvg.includes('<linearGradient'), 'SVG must define linearGradient for smooth area fill');
assert(chartSvg.includes('<path d="M'), 'SVG must have cubic Bezier curve path');
assert(chartSvg.includes('C '), 'Path must use cubic Bezier spline commands (C cp1 cp2 point)');
assert(chartSvg.includes('circle cx='), 'SVG must render key point dots');
console.log('✓ PASS: generateBezierAreaChart generates smooth cubic Bezier area chart with gradient fill.');

// 4. Test Modals.openItemInspection and closeItemInspection
console.log('\n--- Step 4: Verify Modals.openItemInspection & closeItemInspection ---');
const { Modals } = await import('../public/js/modules/modals.js');

// Mock DOM elements
const mockDom = {
  itemInspectOverlay: { classList: { remove: () => {}, add: () => {} }, removeAttribute: () => {}, setAttribute: () => {}, style: {} },
  inspectCategoryCrumb: {},
  inspectLeagueTag: {},
  inspectTypeTag: {},
  inspectIcon: {},
  inspectName: {},
  inspectTrendBadge: {},
  inspectMainPrice: {},
  inspectMainCur: {},
  inspectSubPrice: {},
  inspectRateNote: {},
  inspectWikiLink: {},
  inspectNinjaLink: {},
  poeCardName: {},
  poeCardType: {},
  poeCardMods: {},
  poeCardFlavour: { classList: { remove: () => {}, add: () => {} } },
  poeCardFlavourSep: { classList: { remove: () => {}, add: () => {} } },
  inspectChartContainer: {},
  inspectChartSummary: {},
  inspectRankText: {},
  inspectRankPercentile: {},
  inspectRankBar: { style: {} },
  inspectVolumeStat: {},
  inspectAvgStat: {},
  inspectRelatedList: {}
};

const mockItem = {
  id: 'poe1_nightmare_map_Map',
  name: 'Nightmare Map',
  category: 'Maps',
  sourceType: 'Map',
  baseType: 'Map (Tier 16)',
  chaosValue: 450,
  divineValue: 1.25,
  change7d: 15.4,
  sparkline: [380, 390, 400, 420, 430, 440, 450],
  volume: 1250,
  flavourText: 'The darkness whispers ancient secrets.'
};

const mockState = {
  currentGame: 'poe1',
  currentLeague: 'Allflame',
  allItems: [mockItem, { id: 'm2', name: 'Tower Map', category: 'Maps', chaosValue: 200, divineValue: 0.5 }],
  divineChaosPrice: 360
};

Modals.openItemInspection(mockItem, mockState, mockDom);

assert.strictEqual(mockDom.inspectName.textContent, 'Nightmare Map');
assert.strictEqual(mockDom.inspectMainCur.textContent, 'Divine');
assert.strictEqual(mockDom.inspectMainPrice.textContent, '1.3');
assert(mockDom.inspectChartContainer.innerHTML.includes('<svg'), 'Chart container must contain SVG');
assert(mockDom.inspectRankText.textContent.includes('Xếp hạng #1'), 'Must compute top category rank');
assert.strictEqual(mockDom.poeCardFlavour.textContent, 'The darkness whispers ancient secrets.');

Modals.closeItemInspection(mockDom);
console.log('✓ PASS: Modals.openItemInspection & closeItemInspection operate seamlessly without errors.');

// 5. Test Live HTTP Server Endpoints (Maps, Groups, Inspection Data)
console.log('\n--- Step 5: Verify Server Endpoints (Live or In-Memory Cache) ---');
let catData, itemsData;
try {
  const catRes = await fetch('http://localhost:3000/api/categories?game=poe1&league=Allflame');
  catData = await catRes.json();
  const itemsRes = await fetch('http://localhost:3000/api/items?game=poe1&league=Allflame');
  itemsData = await itemsRes.json();
  console.log('Connected to live server at http://localhost:3000');
} catch {
  console.log('Local standalone server offline, validating against cacheManager directly...');
  const cacheManager = (await import('../services/cacheManager.js')).default;
  catData = { categories: cacheManager.getAvailableCategories('poe1', 'Allflame') };
  itemsData = cacheManager.getData('poe1', 'Allflame');
}

assert(Array.isArray(catData.categories), 'Categories must be an array');
const atlasCats = catData.categories.filter(c => c.group === 'atlas');
assert(atlasCats.length >= 3, 'Must have at least 3 categories in atlas group (Maps, Blighted Maps, Unique Maps)');
console.log('Atlas Categories:', atlasCats.map(c => `${c.label} (${c.count} items)`));

const mapItems = (itemsData.items || []).filter(i => i.sourceType === 'UniqueMap' || i.sourceType === 'Map');
assert(mapItems.length > 0, 'Cache must contain map items');
console.log(`Map Items Count: ${mapItems.length}`);
console.log(`Sample Map Item: "${mapItems[0].name}" (${mapItems[0].category}) - ${mapItems[0].chaosValue} C / ${mapItems[0].divineValue} Div`);
console.log('✓ PASS: Server and cache serve Atlas maps and grouped categories flawlessly.');


console.log('\n====================================================');
console.log('  All POESTASH Redesign Verifications Passed! ✓✓✓');
console.log('====================================================');
process.exit(0);

