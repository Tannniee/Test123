process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const ItemTextParser = require('../services/itemAnalyzer/itemTextParser.js');
const ItemClassifier = require('../services/itemAnalyzer/itemClassifier.js');
const createApp = require('../server/createApp.js');
const { startServer } = require('../server/lifecycle.js');

test('PR 7 Suite: Canonical Item Model, Text Parser & Classifier (Phase 6)', async (t) => {
  t.after(() => {
    cacheManagerInstance.stopSchedulers();
  });

  await t.test('1. Rare Gear Parsing: Defences, Sockets, Modifiers & Flags', () => {
    const rawRare = `
Item Class: Body Armours
Rarity: Rare
Doom Suit
Astral Plate
--------
Armour: 1250 (augmented)
Quality: +20% (augmented)
--------
Requirements:
Level: 62
Str: 180
--------
Sockets: R-R-R-R-R-R
--------
Item Level: 85
--------
+12% to all Elemental Resistances (implicit)
--------
+105 to maximum Life
+45% to Fire Resistance
+48% to Cold Resistance
+35% to Lightning Resistance
+120 to Armour
12% increased Armour (crafted)
--------
Corrupted
`;

    const item = ItemTextParser.parse(rawRare);
    assert.equal(item.game, 'poe1');
    assert.equal(item.identity.name, 'Doom Suit');
    assert.equal(item.identity.baseType, 'Astral Plate');
    assert.equal(item.identity.itemClass, 'Body Armours');
    assert.equal(item.identity.rarity, 'Rare');

    // Properties
    assert.equal(item.properties.armour, 1250);
    assert.equal(item.properties.quality, 20);
    assert.equal(item.properties.itemLevel, 85);

    // Requirements
    assert.equal(item.requirements.level, 62);
    assert.equal(item.requirements.str, 180);

    // Sockets & Links
    assert.equal(item.sockets.length, 6);
    assert.equal(item.links, 6);
    assert.equal(item.sockets[0].color, 'R');

    // Modifiers
    assert.equal(item.modifiers.implicits.length, 1);
    assert.ok(item.modifiers.implicits[0].includes('Resistances'));
    assert.equal(item.modifiers.explicits.length, 5);
    assert.equal(item.modifiers.crafted.length, 1);
    assert.ok(item.modifiers.crafted[0].includes('increased Armour'));

    // Flags
    assert.equal(item.flags.corrupted, true);
    assert.equal(item.flags.mirrored, false);

    // Classification
    const classification = ItemClassifier.classify(item);
    assert.equal(classification.kind, 'rare_gear');
    assert.equal(classification.isGear, true);
    assert.equal(classification.requiresAffixAnalysis, true);
    assert.equal(classification.requiresMarketLookup, false);
  });

  await t.test('2. Unique Gear Parsing: Mageblood (Affixes & Flavour Text)', () => {
    const rawMageblood = `
Item Class: Belts
Rarity: Unique
Mageblood
Heavy Belt
--------
Requirements:
Level: 44
--------
Item Level: 86
--------
+35 to Strength (implicit)
--------
+42 to Dexterity
+25% to Fire Resistance
Leftmost 4 Utility Flasks constantly apply their Flask Effects to you
Magic Utility Flask Effects cannot be removed
--------
"Power is not given to the worthy,
it is seized by the bold."
`;

    const item = ItemTextParser.parse(rawMageblood);
    assert.equal(item.identity.rarity, 'Unique');
    assert.equal(item.identity.name, 'Mageblood');
    assert.equal(item.identity.baseType, 'Heavy Belt');
    assert.equal(item.identity.itemClass, 'Belts');
    assert.equal(item.properties.itemLevel, 86);
    assert.equal(item.requirements.level, 44);
    assert.equal(item.modifiers.implicits.length, 1);
    assert.equal(item.modifiers.explicits.length, 4);
    assert.ok(item.flavourText.includes('Power is not given'));

    const classification = ItemClassifier.classify(item);
    assert.equal(classification.kind, 'unique_gear');
    assert.equal(classification.isGear, true);
    assert.equal(classification.requiresMarketLookup, true);
  });

  await t.test('3. Currency & Stackables: Divine Orb', () => {
    const rawCurrency = `
Item Class: Stackable Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 10/20
--------
Randomises the numeric values of the random modifiers on an item
--------
Right click this item then left click a magic or rare item to apply it.
`;

    const item = ItemTextParser.parse(rawCurrency);
    assert.equal(item.identity.rarity, 'Currency');
    assert.equal(item.identity.name, 'Divine Orb');
    assert.equal(item.identity.baseType, 'Divine Orb');
    assert.equal(item.properties.stackSize.current, 10);
    assert.equal(item.properties.stackSize.max, 20);

    const classification = ItemClassifier.classify(item);
    assert.equal(classification.kind, 'currency');
    assert.equal(classification.isGear, false);
    assert.equal(classification.requiresMarketLookup, true);
  });

  await t.test('4. Divination Cards: The Apothecary', () => {
    const rawCard = `
Item Class: Divination Cards
Rarity: Divination Card
The Apothecary
--------
Stack Size: 1/5
--------
Mageblood
Corrupted
--------
He who has not the courage to live must die.
`;

    const item = ItemTextParser.parse(rawCard);
    assert.equal(item.identity.rarity, 'Divination Card');
    assert.equal(item.identity.name, 'The Apothecary');
    assert.equal(item.properties.stackSize.current, 1);
    assert.equal(item.properties.stackSize.max, 5);

    const classification = ItemClassifier.classify(item);
    assert.equal(classification.kind, 'divination_card');
    assert.equal(classification.requiresMarketLookup, true);
  });

  await t.test('5. Skill Gems & Maps', () => {
    // Skill Gem
    const rawGem = `
Item Class: Active Skill Gems
Rarity: Gem
Cast On Critical Strike Support
--------
Support
Level: 20
Quality: +20% (augmented)
--------
Requirements:
Level: 70
Dex: 111
Int: 111
--------
Supported Attacks have 39% more Critical Strike Chance
`;
    const gem = ItemTextParser.parse(rawGem);
    assert.equal(gem.identity.name, 'Cast On Critical Strike Support');
    assert.equal(gem.properties.gemLevel, 20);
    assert.equal(gem.properties.quality, 20);
    assert.equal(ItemClassifier.classify(gem).kind, 'gem');

    // Map
    const rawMap = `
Item Class: Maps
Rarity: Rare
Bramble Valley Map
--------
Map Tier: 16
Item Quantity: +72% (augmented)
Item Rarity: +41% (augmented)
Monster Pack Size: +26% (augmented)
--------
Item Level: 83
--------
Monsters reflect 18% of Elemental Damage
--------
Corrupted
`;
    const map = ItemTextParser.parse(rawMap);
    assert.equal(map.properties.mapTier, 16);
    assert.equal(map.properties.itemQuantity, 72);
    assert.equal(map.flags.corrupted, true);
    assert.equal(ItemClassifier.classify(map).kind, 'map');
  });

  await t.test('6. PoE 2 Item Auto-Detection & Physical Weapon Stats', () => {
    const rawPoe2 = `
Item Class: Martial Staves
Rarity: Rare
Kraken Branch
Quarterstaff
--------
Physical Damage: 65-115 (augmented)
Critical Strike Chance: 7.00%
Attacks per Second: 1.35
--------
Requirements:
Level: 65
Dex: 95
Int: 95
--------
Item Level: 75
--------
25% increased Physical Damage
+45 to maximum Life
`;
    const p2 = ItemTextParser.parse(rawPoe2);
    assert.equal(p2.game, 'poe2', 'Should auto-detect PoE 2 from Martial Staves / Quarterstaff');
    assert.equal(p2.properties.physicalDamage.min, 65);
    assert.equal(p2.properties.physicalDamage.max, 115);
    assert.equal(p2.properties.criticalChance, 7.0);
    assert.equal(p2.properties.attacksPerSecond, 1.35);
  });

  await t.test('7. REST API: POST /api/analyze-item Endpoint', async () => {
    const serverInstance = await startServer({
      port: 0,
      host: '127.0.0.1',
      skipSignalHandlers: true
    });

    try {
      const baseUrl = serverInstance.url;

      // 7a. Error on empty body
      const resBad = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: '' })
      });
      assert.equal(resBad.status, 400);

      // 7b. Success on valid item
      const sampleItem = `
Item Class: Rings
Rarity: Rare
Dusk Band
Two-Stone Ring
--------
Requirements:
Level: 64
--------
Item Level: 84
--------
+16% to Cold and Lightning Resistances (implicit)
--------
+78 to maximum Life
+44% to Fire Resistance
`;
      const resGood = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: sampleItem,
          game: 'poe1',
          source: 'manual_paste'
        })
      });

      assert.equal(resGood.status, 200);
      const json = await resGood.json();
      assert.equal(json.success, true);
      assert.equal(json.item.identity.name, 'Dusk Band');
      assert.equal(json.item.identity.baseType, 'Two-Stone Ring');
      assert.equal(json.classification.kind, 'rare_gear');
      assert.equal(json.source, 'manual_paste');

      // 7c. Bridge inspect enrichment verification
      const resBridge = await fetch(`${baseUrl}/api/bridge/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: sampleItem,
          game: 'poe1'
        })
      });
      assert.equal(resBridge.status, 200);
      const bridgeJson = await resBridge.json();
      assert.ok(bridgeJson.parsedItem, 'Bridge inspect must include enriched parsedItem');
      assert.equal(bridgeJson.parsedItem.identity.name, 'Dusk Band');
      assert.ok(bridgeJson.classification, 'Bridge inspect must include enriched classification');
    } finally {
      await serverInstance.close();
    }
  });
});
