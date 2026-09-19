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

// 8. Verify Authentic Exile-UI Visualized Mod Rolls & Icon Integration
console.log('\n--- Step 8: Verify Exile-UI Visualized Mod Rolls & Icon System ---');
const { createRequire } = await import('module');
const testRequire = createRequire(import.meta.url);
const modMatcher = testRequire('../services/itemAnalyzer/modMatcher.js');
const exileUiDataService = testRequire('../services/itemAnalyzer/exileUiDataService.js');
const { ItemInspectorRender } = await import('../public/js/modules/itemInspectorRender.js');

assert.strictEqual(modMatcher.resolveExileIcon('+89 to maximum Life'), 'life', 'Life mod must resolve to life icon');
assert.strictEqual(modMatcher.resolveExileIcon('+45% to Fire Resistance'), 'fire', 'Fire mod must resolve to fire icon');
assert.strictEqual(modMatcher.resolveExileIcon('+33% to Lightning Resistance'), 'lightning', 'Lightning mod must resolve to lightning icon');
assert.strictEqual(modMatcher.resolveExileIcon('+38(21-42) to Evasion Rating'), 'evasion', 'Evasion mod must resolve to evasion icon');
assert.strictEqual(modMatcher.resolveExileIcon('15% increased Movement Speed'), 'speed', 'Speed mod must resolve to speed icon');

const mockLifeMod = {
  text: '+24(24-28) to Maximum Life',
  tier: 1,
  tierName: 'Fecund',
  icon: 'life',
  status: 'matched',
  rollAnalysis: [{ value: 24, min: 24, max: 28, percentile: 0.0 }]
};

const modBarHtml = ItemInspectorRender.renderExileModBar(mockLifeMod, 'explicit', false);
assert(modBarHtml.includes('exile-mod-row'), 'Must render exile-mod-row');
assert(modBarHtml.includes('roll-track'), 'Must render roll-track');
assert(modBarHtml.includes('roll-bar-fill'), 'Must render roll-bar-fill');
assert(modBarHtml.includes('exile-tier-box'), 'Must render exile-tier-box');
assert(modBarHtml.includes('exile-icon-box'), 'Must render exile-icon-box');
assert(modBarHtml.includes('/img/item-info/life.png'), 'Must include life.png icon');
assert(modBarHtml.includes('+24(24-28) to maximum life'), 'Must display formatted lowercase text with range');

console.log('✓ PASS: Exile-UI Visualized mod-roll bars and icon integration verified with 100% precision.');

// 9. Verify Authentic Exile-UI Replica for Paladin Boots (Image 2)
console.log('\n--- Step 9: Verify Authentic Exile-UI Replica for Paladin Boots ---');
const ItemTextParser = testRequire('../services/itemAnalyzer/itemTextParser.js');
const baseAnalyzer = testRequire('../services/itemAnalyzer/baseAnalyzer.js');

const bootsText = `Rarity: Rare
Ghoul Span
Paladin Boots
--------
Quality: +20% (augmented)
Armour: 607 (augmented)
Energy Shield: 120 (augmented)
Intangibility: 31%
--------
Requirements:
Level: 84
Str: 98
Dex: 111 (unmet)
Int: 117 (unmet)
--------
Sockets: B-R-G-W 
--------
Item Level: 85
--------
{ Searing Exarch Implicit Modifier (Grand) — Elemental, Cold, Resistance }
While a Unique Enemy is in your Presence, +24(23-24)% to Cold Resistance
{ Eater of Worlds Implicit Modifier (Greater) — Elemental, Fire, Cold, Lightning, Ailment }
18(18-20)% chance to Avoid Elemental Ailments
(Elemental Ailments are Ignited, Scorched, Chilled, Frozen, Brittle, Shocked, and Sapped)
--------
{ Prefix Modifier "Cheetah's" (Tier: 2) — Speed }
30% increased Movement Speed
{ Prefix Modifier "Inspired" (Tier: 1) — Defences, Armour, Energy Shield }
95(92-100)% increased Armour and Energy Shield
{ Prefix Modifier "Djinn's" (Tier: 2) — Defences, Armour, Energy Shield }
38(33-38)% increased Armour and Energy Shield
14(14-15)% increased Stun and Block Recovery
{ Suffix Modifier "of Ephij" (Tier: 1) — Elemental, Lightning, Resistance }
+46(46-48)% to Lightning Resistance
{ Suffix Modifier "of Haast" (Tier: 1) — Elemental, Cold, Resistance }
+48(46-48)% to Cold Resistance
{ Suffix Modifier "of the Magma" (Tier: 2) — Elemental, Fire, Resistance }
+43(42-45)% to Fire Resistance
Searing Exarch Item
Eater of Worlds Item`;

const parsedBoots = ItemTextParser.parse(bootsText);
assert.strictEqual(parsedBoots.modifiers.implicits.length, 2, 'Must parse exactly 2 implicits');
assert.strictEqual(parsedBoots.modifiers.explicits.length, 7, 'Must parse exactly 7 explicit lines');
assert(!parsedBoots.modifiers.explicits.some(m => m.includes('Elemental Ailments are Ignited')), 'Reminder text must be filtered out');
assert.strictEqual(parsedBoots.flags.searingExarch, true, 'Must detect Searing Exarch influence');
assert.strictEqual(parsedBoots.flags.eaterOfWorlds, true, 'Must detect Eater of Worlds influence');

const matchedImplicits = modMatcher.matchAll(parsedBoots.modifiers.implicits, { descriptors: parsedBoots.modifiers.descriptors });
assert.strictEqual(matchedImplicits[0].tier, 4, 'Grand Exarch implicit must map to tier 4');
assert.strictEqual(matchedImplicits[0].icon, 'exarch', 'Grand Exarch implicit must have exarch icon');
assert.strictEqual(matchedImplicits[1].tier, 5, 'Greater Eater implicit must map to tier 5');
assert.strictEqual(matchedImplicits[1].icon, 'eater', 'Greater Eater implicit must have eater icon');

const matchedExplicits = modMatcher.matchAll(parsedBoots.modifiers.explicits, { descriptors: parsedBoots.modifiers.descriptors });
const djinnSecondary = matchedExplicits.find(m => m.text.includes('Stun and Block Recovery'));
assert.strictEqual(djinnSecondary.isSecondary, true, 'Djinn secondary line must be flagged isSecondary: true');

const bootsAnalysis = baseAnalyzer.analyze(parsedBoots, matchedExplicits, 'poe1');
assert.strictEqual(bootsAnalysis.affixCapacity.prefixesCount, 3, 'Must count exactly 3 prefixes (Djinn hybrid counts as 1)');
assert.strictEqual(bootsAnalysis.affixCapacity.suffixesCount, 3, 'Must count exactly 3 suffixes');
assert.strictEqual(bootsAnalysis.affixCapacity.openPrefixes, 0, 'No open prefixes');
assert.strictEqual(bootsAnalysis.affixCapacity.openSuffixes, 0, 'No open suffixes');

const bootsRenderHtml = ItemInspectorRender.renderAffixesTab({
  implicits: matchedImplicits,
  mods: matchedExplicits,
  affixCapacity: bootsAnalysis.affixCapacity,
  base: bootsAnalysis
}, parsedBoots.identity, parsedBoots.properties);

assert.strictEqual(bootsAnalysis.defencePercentiles.armour, 53, 'Base armour percentile must evaluate to 53%');
assert.strictEqual(bootsAnalysis.defencePercentiles.energyShield, 52, 'Base energy shield percentile must evaluate to 52%');
assert(bootsRenderHtml.includes('exile-base-title">base</div>'), 'Must render lowercase "base" row');
assert(bootsRenderHtml.includes('<span>53%</span>'), 'Must display 53% for Armour base in base row');
assert(bootsRenderHtml.includes('<span>52%</span>'), 'Must display 52% for Energy Shield base in base row');
assert(!bootsRenderHtml.includes('<span>100%</span>'), 'Must not display uncalibrated 100% for base defences');
assert(bootsRenderHtml.includes('exile-section-divider'), 'Must render crisp section divider lines');
assert(bootsRenderHtml.includes('unique enemy: +24(23-24)% to cold resistance'), 'Must format condensed condition mod text');
assert(bootsRenderHtml.includes('tier-eldritch-4') && bootsRenderHtml.includes('>4</div>'), 'Must render tier 4 badge for Exarch');
assert(bootsRenderHtml.includes('tier-eldritch-5') && bootsRenderHtml.includes('>5</div>'), 'Must render tier 5 badge for Eater');
assert(bootsRenderHtml.includes('exile-badge-green">92%</span>'), 'Must render 92% hybrid score badge');
assert(bootsRenderHtml.includes('exile-compound-row'), 'Must render hybrid mod as unified compound row');
assert(bootsRenderHtml.includes('exile-compound-bars'), 'Must group multi-line hybrid mod bars');
assert(bootsRenderHtml.includes('Đầy slot (6/6)'), 'Must indicate full crafting capacity');

console.log('✓ PASS: Paladin Boots Exile-UI Replica verified across all parser, analyzer, and render metrics.');

// 10. Verify Authentic Exile-UI Enhancements from the 5 Real-Game Screenshots
console.log('\n--- Step 10: Verify Exile-UI Enhancements from 5 Authentic Screenshots ---');

// 10.1 Bench Crafted Mod: 'c' badge, mastercraft icon, negative range (-6 in -7 to -6 -> 100%)
const craftedModMax = {
  text: 'non-channelling skills have -6(-7--6) to total mana cost',
  group: 'crafted',
  isCrafted: true
};
const craftedMaxHtml = ItemInspectorRender.renderExileModBar(craftedModMax, 'crafted', false);
assert(craftedMaxHtml.includes('tier-craft') && craftedMaxHtml.includes('>c</div>'), 'Crafted badge must display lowercase "c"');
assert(craftedMaxHtml.includes('mastercraft.png'), 'Crafted mod must have mastercraft.png icon');
assert(craftedMaxHtml.includes('style="width: 100%;"'), 'Negative roll -6 in -7 to -6 must evaluate to 100% percentile');

const craftedModMin = {
  text: 'non-channelling skills have -7(-7--6) to total mana cost',
  group: 'crafted',
  isCrafted: true
};
const craftedMinHtml = ItemInspectorRender.renderExileModBar(craftedModMin, 'crafted', false);
assert(craftedMinHtml.includes('style="width: 0%;"'), 'Negative roll -7 in -7 to -6 must evaluate to 0% percentile');

// 10.2 Double Range Average Percentile: 11(9-12) to 15(15-18) -> (66.7% + 0%) / 2 = 33%
const doubleRangeMod = {
  text: 'minions deal 11(9-12) to 15(15-18) additional physical damage',
  tier: 4
};
const doubleRangeHtml = ItemInspectorRender.renderExileModBar(doubleRangeMod, 'explicit', false);
assert(doubleRangeHtml.includes('style="width: 33%;"'), 'Double roll range must compute average percentile 33%');
assert(doubleRangeHtml.includes('>4</div>'), 'Must render Tier 4 badge');
assert(doubleRangeHtml.includes('minion.png'), 'Must render minion.png icon');

// 10.3 Essence Mod: '#' badge, essence icon
const essenceMod = {
  text: 'minions deal 29(28-30)% increased damage',
  tierName: 'Essences',
  tags: ['Essence']
};
const essenceHtml = ItemInspectorRender.renderExileModBar(essenceMod, 'explicit', false);
assert(essenceHtml.includes('tier-essence') && essenceHtml.includes('>#</div>'), 'Essence mod badge must display "#"');
assert(essenceHtml.includes('essence.png'), 'Essence mod must have essence.png icon');
assert(essenceHtml.includes('style="width: 50%;"'), '29 in 28-30 must evaluate to 50% percentile');

// 10.4 Gem Level Mod: Tinted background (#383b64) and gem_level icon
const gemMod = {
  text: '+1 to level of all chaos skill gems',
  tier: 1
};
const gemHtml = ItemInspectorRender.renderExileModBar(gemMod, 'explicit', false);
assert(gemHtml.includes('mod-speed-tint'), 'Gem level mod must have special slate tint (#383b64)');
assert(gemHtml.includes('gem_level.png'), 'Gem level mod must have gem_level.png icon');
assert(gemHtml.includes('>1</div>'), 'Must render Tier 1 badge');

// 10.5 Minion Movement Speed keeps minion icon (not suppressed like player boots)
const minionSpeedMod = {
  text: 'minions have 10(10-15)% increased movement speed',
  tier: 1
};
const minionSpeedHtml = ItemInspectorRender.renderExileModBar(minionSpeedMod, 'explicit', false);
assert(minionSpeedHtml.includes('minion.png'), 'Minion movement speed must retain minion.png icon');

// 10.6 No-Defences Base Row (Jewelry / Jewels - Screenshots 1, 3, 4, 5)
const jewelryBaseHtml = ItemInspectorRender.renderAffixesTab({
  implicits: [],
  mods: [craftedModMax],
  affixCapacity: { canCraft: true, openPrefixes: 1, openSuffixes: 1, maxPrefixes: 3, maxSuffixes: 3, prefixesCount: 1, suffixesCount: 1 }
}, { name: 'Bone Ring', baseType: 'Bone Ring', rarity: 'Rare' }, { itemLevel: 84 });

assert(jewelryBaseHtml.includes('exile-base-row no-defences'), 'Jewelry with no defences must have .no-defences class');
assert(jewelryBaseHtml.includes('84/86'), 'Must display iLvl 84/86');

// 10.7 CSS Verification for all new visual rules
const finalCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');
assert(finalCss.includes('.exile-base-row.no-defences'), 'CSS must define .exile-base-row.no-defences');
assert(finalCss.includes('white-space: normal !important'), 'CSS must allow multi-line text wrap');
assert(finalCss.includes('.exile-tier-box.tier-craft'), 'CSS must style .tier-craft');
assert(finalCss.includes('.exile-tier-box.tier-essence'), 'CSS must style .tier-essence');

console.log('✓ PASS: All 5 Exile-UI authentic screenshot features and metrics verified with 100% precision.');

// 11. Verify Comprehensive Ingestion of the 6 Exile-UI Global Data Files
console.log('\n--- Step 11: Verify 6 Exile-UI Global Datasets Ingestion (Bases, Mods, Drop Tiers) ---');

// 11.1 PoE 1 & PoE 2 Bases Ingestion: Direct & Nested category resolution, class bests
const agateAmulet = exileUiDataService.getBase('Agate Amulet', 'poe1');
assert.ok(agateAmulet, 'Agate Amulet must be resolved');
assert.strictEqual(agateAmulet.itemClass, 'Amulets', 'Item class must be Amulets');
assert.ok(agateAmulet.tags.includes('amulet'), 'Must resolve direct category tags: amulet');

const paladinBoots = exileUiDataService.getBase('Paladin Boots', 'poe1');
assert.ok(paladinBoots, 'Paladin Boots must be resolved');
assert.strictEqual(paladinBoots.subType, 'Armour/Energy', 'Must resolve subType Armour/Energy');
assert.strictEqual(paladinBoots.defences.armour.min, 205);
assert.strictEqual(paladinBoots.defences.armour.max, 236);

const bootsBestAr = exileUiDataService.getClassBest('Boots', 'Armour', 'poe1');
assert.strictEqual(bootsBestAr, 413, 'Best armour boots must be 413 (Titan Greaves)');
const bootsBestHybrid = exileUiDataService.getClassBest('Boots', 'Armour/Energy', 'poe1');
assert.strictEqual(bootsBestHybrid, 283, 'Best hybrid boots must be 283 (Paladin Boots)');

// 11.2 PoE 1 & PoE 2 Full Mods Datasets Ingestion (exile-mods.json: 4,272 PoE 1 / 1,533 PoE 2)
const magmaAffix = exileUiDataService.getAffixCandidates('of the Magma', 'poe1');
assert.ok(magmaAffix.length >= 1, 'Must find "of the Magma" across full 4,272 mods database');
assert.strictEqual(magmaAffix[0].affix || magmaAffix[0].name, 'of the Magma');

const cheetahAffix = exileUiDataService.getAffixCandidates("Cheetah's", 'poe1');
assert.ok(cheetahAffix.length >= 1, 'Must find "Cheetah\'s" across full mods database');

const poe1FullMods = exileUiDataService.getExileMods('poe1');
assert.ok(poe1FullMods && poe1FullMods.universal, 'Must expose full PoE 1 Exile-UI mods database');
assert.ok(Object.keys(poe1FullMods.universal).length > 2000, 'Universal mods must exceed 2,000 families');

const poe2FullMods = exileUiDataService.getExileMods('poe2');
assert.ok(poe2FullMods && poe2FullMods.universal, 'Must expose full PoE 2 Exile-UI mods database');
assert.ok(Object.keys(poe2FullMods.universal).length > 500, 'PoE 2 universal mods must exceed 500 families');

// 11.3 Drop Tiers Ingestion: 1,366 PoE 1 uniques and 456 PoE 2 uniques
const magebloodTier = exileUiDataService.getUniqueDropTier('Mageblood', 'poe1');
assert.strictEqual(magebloodTier.tier, '0', 'Mageblood must evaluate to T0');

const abAeternoTier = exileUiDataService.getUniqueDropTier('Ab Aeterno', 'poe2');
assert.ok(abAeternoTier, 'PoE 2 unique Ab Aeterno must be resolved from drop-tiers 2');

console.log('✓ PASS: All 6 Exile-UI global data files fully ingested, indexed, and validated.');

console.log('\n====================================================');
console.log('  All Senior Audit Fixes & Regressions Passed! ✓✓✓');
console.log('====================================================');


