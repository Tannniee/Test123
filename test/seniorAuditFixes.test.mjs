import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('  Running Senior Audit Fixes & Regressions Suite');
console.log('====================================================\n');

// 1. Verify CSS rules for floating tooltip and card inspect button
console.log('--- Step 1: Verify style.css rules for Tooltip & Inspect Button ---');
const styleCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');
assert(styleCss.includes('.poe-floating-tooltip'), 'Must contain .poe-floating-tooltip style');
assert(styleCss.includes('pointer-events: none'), 'Tooltip must have pointer-events: none to prevent mouse jitter');
assert(styleCss.includes('.btn-card-inspect'), 'Must contain .btn-card-inspect');
console.log('✓ PASS: style.css contains all tooltip and inspect button styles.');

// 2. Verify Render.getNinjaUrl
console.log('\n--- Step 2: Verify Render.getNinjaUrl ---');
const { Render } = await import('../public/js/modules/render.js');

// PoE 1 tests
const zorathFrag = { name: "Zorath's Eye of the Inevitable", category: 'Fragments', sourceType: 'Fragment' };
const ninjaUrlZorath = Render.getNinjaUrl(zorathFrag, 'poe1', 'Allflame');
assert.strictEqual(ninjaUrlZorath, 'https://poe.ninja/economy/allflame/fragments', 'PoE 1 fragments must use /economy/{league}/fragments (NO /poe1/ !)');

const divCard = { name: 'The Apothecary', category: 'Divination Cards', sourceType: 'DivinationCard' };
const ninjaUrlCard = Render.getNinjaUrl(divCard, 'poe1', 'Allflame');
assert.strictEqual(ninjaUrlCard, 'https://poe.ninja/economy/allflame/divination-cards', 'PoE 1 cards must use /economy/{league}/divination-cards');

const scarab = { name: 'Ambush Scarab', category: 'Scarabs', sourceType: 'Scarab' };
const ninjaUrlScarab = Render.getNinjaUrl(scarab, 'poe1', 'Standard');
assert.strictEqual(ninjaUrlScarab, 'https://poe.ninja/economy/standard/scarabs', 'PoE 1 scarabs must use /economy/{league}/scarabs');

const deliriumOrb = { name: "Diviner's Delirium Orb", category: 'Delirium Orbs', sourceType: 'DeliriumOrb' };
const ninjaUrlDelirium = Render.getNinjaUrl(deliriumOrb, 'poe1', 'Allflame');
assert.strictEqual(ninjaUrlDelirium, 'https://poe.ninja/economy/allflame/delirium-orbs', 'PoE 1 delirium orbs must use /economy/{league}/delirium-orbs');

// PoE 2 tests
const poe2Currency = { name: 'Divine Orb', category: 'Currency', sourceType: 'Currency' };
const ninjaUrlPoe2Cur = Render.getNinjaUrl(poe2Currency, 'poe2', 'Standard');
assert.strictEqual(ninjaUrlPoe2Cur, 'https://poe.ninja/poe2/economy/standard/currency', 'PoE 2 currency must use /poe2/economy/{league}/currency');

const poe2Gems = { name: 'Uncut Skill Gem', category: 'Uncut Gems', sourceType: 'UncutGems' };
const ninjaUrlPoe2Gems = Render.getNinjaUrl(poe2Gems, 'poe2', 'Standard');
assert.strictEqual(ninjaUrlPoe2Gems, 'https://poe.ninja/poe2/economy/standard/uncut-gems', 'PoE 2 gems must use /poe2/economy/{league}/uncut-gems');
console.log('✓ PASS: Render.getNinjaUrl formats all PoE 1 and PoE 2 URLs flawlessly.');

// 3. Verify PoeItemDescriptions.getPoEDescription
console.log('\n--- Step 3: Verify PoeItemDescriptions.getPoEDescription ---');
const { default: PoeItemDescriptions } = await import('../public/js/itemDescriptions.js');

const zorathDesc = PoeItemDescriptions.getPoEDescription(zorathFrag);
assert(zorathDesc.includes('Zorath, Vile Assembled'), 'Zorath description must mention boss name');

const divineItem = { name: 'Divine Orb', category: 'Currency', sourceType: 'Currency', detailsId: 'divine-orb' };
const divineDesc = PoeItemDescriptions.getPoEDescription(divineItem);
assert(divineDesc.includes('Randomises the numeric values'), 'Divine Orb description must match in-game text');

const explicitItem = { name: 'Rare Map', explicitModifiers: ['Monsters reflect 15% Physical Damage', 'Area contains 2 additional Harbingers'] };
const explicitDesc = PoeItemDescriptions.getPoEDescription(explicitItem);
assert(explicitDesc.includes('Monsters reflect 15% Physical Damage'), 'Explicit modifiers must be preserved');
console.log('✓ PASS: PoeItemDescriptions.getPoEDescription delivers authentic PoE descriptions.');

// 4. Verify Modals.openItemInspection with state.items (Fixing the "Top 100% trong 1 item" bug)
console.log('\n--- Step 4: Verify Modals.openItemInspection category ranking with real state.items ---');
const { Modals } = await import('../public/js/modules/modals.js');

const mockFrag1 = { id: 'f1', name: "Zorath's Eye of the Inevitable", category: 'Fragments', sourceType: 'Fragment', chaosValue: 1773, divineValue: 4.85, volume: 11820 };
const mockFrag2 = { id: 'f2', name: 'Syndicate Medallion', category: 'Fragments', sourceType: 'Fragment', chaosValue: 1925, divineValue: 5.26, volume: 4500 };
const mockFrag3 = { id: 'f3', name: "Maven's Writ", category: 'Fragments', sourceType: 'Fragment', chaosValue: 800, divineValue: 2.2, volume: 21000 };

const mockStateWithItems = {
  currentGame: 'poe1',
  currentLeague: 'Allflame',
  // Notice: state.items is used, NOT state.allItems
  items: [mockFrag1, mockFrag2, mockFrag3],
  divineChaosPrice: 365
};

const mockElements = {
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

// Set window.PoeItemDescriptions
globalThis.window = { PoeItemDescriptions };

Modals.openItemInspection(mockFrag1, mockStateWithItems, mockElements);

// Zorath is #2 behind Syndicate Medallion (5.26 > 4.85) among 3 fragments
assert.strictEqual(mockElements.inspectRankText.textContent, 'Xếp hạng #2 trong 3 vật phẩm (Fragments)', 'Must rank #2 in 3 items, NOT #1 in 1 item!');
assert.strictEqual(mockElements.inspectNinjaLink.href, 'https://poe.ninja/economy/allflame/fragments', 'Ninja link must be valid poe.ninja url');
assert(mockElements.inspectRelatedList.innerHTML.includes('Syndicate Medallion'), 'Related items must include other items in category');
assert(mockElements.poeCardMods.innerHTML.includes('Zorath, Vile Assembled'), 'PoE Card must show rich boss description');

console.log('✓ PASS: Category ranking accurately evaluates state.items (fixed #1 in 1 item bug).');

// 5. Verify Clipboard.formatWhisper
console.log('\n--- Step 5: Verify Clipboard.formatWhisper ---');
const { Clipboard } = await import('../public/js/modules/clipboard.js');
const whisper = Clipboard.formatWhisper(mockFrag1, 1, '4.85 Div', 'Allflame');
assert(whisper.includes("Zorath's Eye of the Inevitable"), 'Whisper must contain item name');
assert(whisper.includes('Allflame'), 'Whisper must contain league name');
assert(whisper.includes('4.85 Div'), 'Whisper must contain price');
console.log('✓ PASS: Clipboard.formatWhisper produces accurate trade whisper.');

// 6. Verify Hover Tooltip System & Jitter-Free Markup
console.log('\n--- Step 6: Verify Hover Tooltip System & Jitter-Free Markup ---');
const tableHtml = Render.renderTableRows([mockFrag1], { currentGame: 'poe1', isFavorite: () => false, isInCompare: () => false });
assert(tableHtml.includes('class="item-table-row " data-id="f1" data-tooltip-id="f1"'), 'Table row must carry data-tooltip-id');
assert(!tableHtml.includes('class="table-item-icon" loading="lazy" data-tooltip-id='), 'Nested img must NOT carry duplicate data-tooltip-id');
assert(!tableHtml.includes('class="item-link-name rarity-normal" data-action="open-inspect" data-id="f1" data-tooltip-id='), 'Nested span must NOT carry duplicate data-tooltip-id');

const gridHtml = Render.renderGridCards([mockFrag1], { currentGame: 'poe1', isFavorite: () => false, isInCompare: () => false });
assert(gridHtml.includes('class="item-grid-card " data-id="f1" data-tooltip-id="f1"'), 'Grid card must carry data-tooltip-id');
assert(!gridHtml.includes('class="grid-item-thumb-wrapper" data-tooltip-id='), 'Grid thumb wrapper must NOT carry duplicate data-tooltip-id');

const appJs = fs.readFileSync(path.join(rootDir, 'public', 'js', 'app.js'), 'utf-8');
assert(appJs.includes('handleItemHover'), 'app.js must use handleItemHover');
assert(appJs.includes('currentHoveredItemId'), 'app.js must track currentHoveredItemId to prevent flickering');
assert(appJs.includes('dom.tooltipPrice'), 'app.js must bind and display dom.tooltipPrice');

const updatedStyleCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');
assert(updatedStyleCss.includes('.tooltip-footer-val'), 'style.css must style .tooltip-footer-val');
assert(updatedStyleCss.includes('min-width: 260px'), 'style.css must enforce min-width on tooltip');
console.log('✓ PASS: Hover system and jitter-free markup verified with 0 regressions.');

// 7. Verify Flexible Exchange Ratios & Most Popular Column (poe.ninja Replica)
console.log('\n--- Step 7: Verify Flexible Exchange Ratios & Most Popular Column ---');
const testRates = { divinePriceInChaos: 366, rawRates: { exalted: 120 } };

const bauble = { name: "Glassblower's Bauble", chaosValue: 0.8948, divineValue: 0.0024 };
const baubleValHtml = Render.formatValueHtml(bauble, 'poe1', testRates);
assert(baubleValHtml.includes('1.0') && baubleValHtml.includes('1.1'), 'Bauble Value must invert ratio to 1.0 C ⇆ 1.1 Bauble');
const baublePopHtml = Render.formatMostPopularHtml(bauble, 'poe1', testRates);
assert(baublePopHtml.includes('1.0') && baublePopHtml.includes('409'), 'Bauble Most Popular must show 1.0 Div ⇆ 409 Bauble');

const wildLife = { name: 'Wild Crystallised Lifeforce', chaosValue: 0.0277, divineValue: 0.000075 };
const wildValHtml = Render.formatValueHtml(wildLife, 'poe1', testRates);
assert(wildValHtml.includes('1.0') && wildValHtml.includes('36'), 'Wild Lifeforce Value must invert ratio to 1.0 C ⇆ 36 Lifeforce');
const wildPopHtml = Render.formatMostPopularHtml(wildLife, 'poe1', testRates);
assert(wildPopHtml.includes('1.0') && wildPopHtml.includes('13.2k'), 'Wild Lifeforce Most Popular must show 1.0 Div ⇆ 13.2k');

const sacredLife = { name: 'Sacred Crystallised Lifeforce', chaosValue: 50, divineValue: 0.14 };
const sacredPopHtml = Render.formatMostPopularHtml(sacredLife, 'poe1', testRates);
assert(sacredPopHtml.includes('50') && sacredPopHtml.includes('1.0'), 'Sacred Lifeforce Most Popular must show 50 C ⇆ 1.0');

console.log('✓ PASS: Flexible exchange ratios and Most Popular column match poe.ninja perfectly.');

console.log('\n====================================================');
console.log('  All Senior Audit Fixes & Regressions Passed! ✓✓✓');
console.log('====================================================');
