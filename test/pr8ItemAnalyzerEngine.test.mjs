process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const exileUiDataService = require('../services/itemAnalyzer/exileUiDataService.js');
const modMatcher = require('../services/itemAnalyzer/modMatcher.js');
const rollAnalyzer = require('../services/itemAnalyzer/rollAnalyzer.js');
const baseAnalyzer = require('../services/itemAnalyzer/baseAnalyzer.js');
const dpsAnalyzer = require('../services/itemAnalyzer/dpsAnalyzer.js');
const uniqueAnalyzer = require('../services/itemAnalyzer/uniqueAnalyzer.js');
const itemAnalyzerService = require('../services/itemAnalyzer/itemAnalyzerService.js');
const createApp = require('../server/createApp.js');

describe('PR 8 Suite: Exile-UI Datasets & Deep Item Analysis Engine (Phases 7–14)', () => {
  after(() => {
    cacheManagerInstance.stopSchedulers();
  });



  describe('1. ExileUiDataService & Datasets (Phase 7)', () => {
    it('loads PoE 1 bases, mods, and unique drop tiers cleanly', () => {
      const hubris = exileUiDataService.getBase('Hubris Circlet', 'poe1');
      assert.ok(hubris, 'Hubris Circlet should exist in PoE 1 bases');
      assert.equal(hubris.itemClass, 'Helmets');
      assert.equal(hubris.requiredInt, 154);
      assert.equal(hubris.defences.energyShield.max, 76);

      const lifeCandidates = exileUiDataService.getModCandidates('+# to maximum Life', 'poe1');
      assert.ok(lifeCandidates.length >= 1, 'Should find candidate for Life mod');
      assert.equal(lifeCandidates[0].family, 'MaximumLife');

      const mageblood = exileUiDataService.getUniqueDropTier('Mageblood', 'poe1');
      assert.ok(mageblood, 'Mageblood should exist in drop tiers');
      assert.equal(mageblood.tier, '0');
    });

    it('loads PoE 2 bases, mods, and staves cleanly', () => {
      const quarterstaff = exileUiDataService.getBase("Expert Sione's Quarterstaff", 'poe2');
      assert.ok(quarterstaff, 'PoE 2 Quarterstaff should exist');
      assert.equal(quarterstaff.itemClass, 'Martial Staves');
      assert.equal(quarterstaff.weapon.aps, 1.35);

      const spiritCandidates = exileUiDataService.getModCandidates('+# to maximum Spirit', 'poe2');
      assert.ok(spiritCandidates.length >= 1, 'Should find Spirit mod in PoE 2');
      assert.equal(spiritCandidates[0].family, 'MaximumSpirit');
    });
  });

  describe('2. ModMatcher: Affix Normalization & Tier Recognition (Phase 9)', () => {
    it('normalizes text and identifies exact T1 Life prefix', () => {
      const match = modMatcher.matchMod('+89 to maximum Life', { game: 'poe1' });
      assert.equal(match.status, 'matched');
      assert.equal(match.confidence, 1.0);
      assert.equal(match.family, 'MaximumLife');
      assert.equal(match.type, 'prefix');
      assert.equal(match.tier, 1);
      assert.equal(match.tierName, 'Rapturous');
      assert.equal(match.values[0].value, 89);
      assert.equal(match.values[0].min, 80);
      assert.equal(match.values[0].max, 89);
    });

    it('identifies exact T2 Fire Resistance suffix', () => {
      const match = modMatcher.matchMod('+42% to Fire Resistance', { game: 'poe1' });
      assert.equal(match.status, 'matched');
      assert.equal(match.confidence, 1.0);
      assert.equal(match.family, 'FireResistance');
      assert.equal(match.type, 'suffix');
      assert.equal(match.tier, 2);
      assert.equal(match.values[0].min, 42);
      assert.equal(match.values[0].max, 45);
    });

    it('identifies newly expanded PoE 1 and PoE 2 mod families accurately', () => {
      // PoE 1: Spell Damage
      const spellMatch = modMatcher.matchMod('105% increased Spell Damage', { game: 'poe1' });
      assert.equal(spellMatch.status, 'matched');
      assert.equal(spellMatch.family, 'SpellDamage');
      assert.equal(spellMatch.tier, 1);

      // PoE 1: Strength
      const strMatch = modMatcher.matchMod('+53 to Strength', { game: 'poe1' });
      assert.equal(strMatch.status, 'matched');
      assert.equal(strMatch.family, 'Strength');
      assert.equal(strMatch.tier, 1);

      // PoE 1: Spell Suppression
      const suppMatch = modMatcher.matchMod('+14% chance to Suppress Spell Damage', { game: 'poe1' });
      assert.equal(suppMatch.status, 'matched');
      assert.equal(suppMatch.family, 'SpellSuppression');
      assert.equal(suppMatch.tier, 1);

      // PoE 2: Cold Resistance
      const p2ColdMatch = modMatcher.matchMod('+42% to Cold Resistance', { game: 'poe2' });
      assert.equal(p2ColdMatch.status, 'matched');
      assert.equal(p2ColdMatch.family, 'ColdResistance');
      assert.equal(p2ColdMatch.tier, 1);

      // PoE 2: Movement Speed
      const p2SpeedMatch = modMatcher.matchMod('32% increased Movement Speed', { game: 'poe2' });
      assert.equal(p2SpeedMatch.status, 'matched');
      assert.equal(p2SpeedMatch.family, 'MovementSpeed');
      assert.equal(p2SpeedMatch.tier, 1);
    });

    it('handles unrecognized mods without throwing or guessing', () => {
      const match = modMatcher.matchMod('Socketed Gems are Supported by Level 20 Faster Casting', { game: 'poe1' });
      assert.equal(match.status, 'unrecognized');
      assert.equal(match.confidence, 0);
      assert.equal(match.family, null);
      assert.equal(match.type, 'unknown');
    });

    it('exposes ambiguous matches with candidate details and does not silently guess', () => {
      // Mock ambiguity: template matching multiple candidates
      const originalCandidates = exileUiDataService.getModCandidates;
      exileUiDataService.getModCandidates = (template, game) => {
        if (template === '+# to Armour and Life') {
          return [
            { family: 'ArmourLifeA', type: 'prefix', tiers: [{ tier: 1, ranges: [{ min: 50, max: 100 }] }] },
            { family: 'ArmourLifeB', type: 'prefix', tiers: [{ tier: 1, ranges: [{ min: 50, max: 100 }] }] }
          ];
        }
        return originalCandidates.call(exileUiDataService, template, game);
      };

      try {
        const match = modMatcher.matchMod('+75 to Armour and Life', { game: 'poe1' });
        assert.equal(match.status, 'ambiguous');
        assert.equal(match.confidence, 0.5);
        assert.equal(match.type, 'ambiguous');
        assert.equal(match.candidates.length, 2);
      } finally {
        exileUiDataService.getModCandidates = originalCandidates;
      }
    });
  });

  describe('3. RollAnalyzer: Formula & Percentiles (Phase 10)', () => {
    it('computes exact roll percentile formula (value - min) / (max - min)', () => {
      // 84 in range 80-89: (84 - 80) / (89 - 80) = 4 / 9 ≈ 0.444 (44%)
      const res = rollAnalyzer.calculatePercentile(84, 80, 89);
      assert.equal(res.percentile, 0.444);
      assert.equal(res.display, '44%');
    });

    it('handles boundary values (min, max) and zero-width range', () => {
      const atMin = rollAnalyzer.calculatePercentile(80, 80, 89);
      assert.equal(atMin.percentile, 0);
      assert.equal(atMin.display, '0%');

      const atMax = rollAnalyzer.calculatePercentile(89, 80, 89);
      assert.equal(atMax.percentile, 1.0);
      assert.equal(atMax.display, '100%');

      const zeroWidth = rollAnalyzer.calculatePercentile(30, 30, 30);
      assert.equal(zeroWidth.percentile, 1.0);
      assert.equal(zeroWidth.display, '100%');
    });

    it('decorates matched mod with rollAnalysis data', () => {
      const matchedMod = {
        text: '+84 to maximum Life',
        values: [{ value: 84, min: 80, max: 89 }]
      };
      const analyzed = rollAnalyzer.analyzeMod(matchedMod);
      assert.ok(analyzed.rollAnalysis);
      assert.equal(analyzed.rollAnalysis[0].percentile, 0.444);
      assert.equal(analyzed.rollAnalysis[0].display, '44%');
    });
  });

  describe('4. BaseAnalyzer: Requirements & Open Affixes (Phase 11)', () => {
    it('determines base data, item requirements, and open crafting slots for Rare item', () => {
      const canonicalItem = {
        identity: {
          rarity: 'Rare',
          name: 'Doom Veil',
          baseType: 'Hubris Circlet',
          itemClass: 'Helmets'
        },
        requirements: { level: 69, str: 0, dex: 0, int: 154 }
      };

      // 3 prefixes, 2 suffixes
      const matchedMods = [
        { type: 'prefix' },
        { type: 'prefix' },
        { type: 'prefix' },
        { type: 'suffix' },
        { type: 'suffix' }
      ];

      const analysis = baseAnalyzer.analyze(canonicalItem, matchedMods, 'poe1');
      assert.ok(analysis);
      assert.equal(analysis.recognized, true);
      assert.equal(analysis.itemClass, 'Helmets');
      assert.equal(analysis.affixCapacity.rarity, 'Rare');
      assert.equal(analysis.affixCapacity.prefixesCount, 3);
      assert.equal(analysis.affixCapacity.suffixesCount, 2);
      assert.equal(analysis.affixCapacity.maxPrefixes, 3);
      assert.equal(analysis.affixCapacity.maxSuffixes, 3);
      assert.equal(analysis.affixCapacity.openPrefixes, 0);
      assert.equal(analysis.affixCapacity.openSuffixes, 1);
      assert.equal(analysis.affixCapacity.canCraft, true);
    });

    it('handles Magic items with 1 prefix and 1 suffix max', () => {
      const canonicalItem = {
        identity: {
          rarity: 'Magic',
          baseType: 'Hubris Circlet'
        }
      };
      const matchedMods = [{ type: 'prefix' }];
      const analysis = baseAnalyzer.analyze(canonicalItem, matchedMods, 'poe1');
      assert.equal(analysis.affixCapacity.maxPrefixes, 1);
      assert.equal(analysis.affixCapacity.maxSuffixes, 1);
      assert.equal(analysis.affixCapacity.openPrefixes, 0);
      assert.equal(analysis.affixCapacity.openSuffixes, 1);
    });
  });

  describe('5. DpsAnalyzer: Weapon Performance & Quality (Phase 12)', () => {
    it('calculates physical DPS, elemental DPS, total DPS, and quality scaling', () => {
      const weaponItem = {
        properties: {
          physicalDamage: { min: 100, max: 200 },
          elementalDamage: [
            { type: 'fire', min: 20, max: 40 }
          ],
          attacksPerSecond: 1.5,
          criticalChance: 5.0,
          quality: 20
        }
      };

      const dps = dpsAnalyzer.analyze(weaponItem);
      assert.ok(dps);
      assert.equal(dps.isWeapon, true);
      // avgPhys = 150 * 1.5 = 225.0
      assert.equal(dps.physicalDps, 225.0);
      // avgElem = 30 * 1.5 = 45.0
      assert.equal(dps.elementalDps, 45.0);
      // total = 225 + 45 = 270.0
      assert.equal(dps.totalDps, 270.0);
      assert.equal(dps.quality, 20);
      assert.ok(dps.qualityScaling.physicalDpsAt0Quality < 225.0);
    });

    it('returns null for non-weapon items', () => {
      const helmetItem = {
        properties: {
          energyShield: 284,
          quality: 20
        }
      };
      assert.equal(dpsAnalyzer.analyze(helmetItem), null);
    });
  });

  describe('6. UniqueAnalyzer: Drop Tiers & Metadata (Phase 13)', () => {
    it('classifies Mageblood as Tier 0 unique belt', () => {
      const item = {
        identity: {
          rarity: 'Unique',
          name: 'Mageblood',
          baseType: 'Heavy Belt'
        },
        flavourText: ''
      };

      const res = uniqueAnalyzer.analyze(item, 'poe1');
      assert.ok(res);
      assert.equal(res.isUnique, true);
      assert.equal(res.tier, '0');
      assert.equal(res.recognized, true);
      assert.ok(res.flavour.includes('godhood'));
    });

    it('returns null for non-unique items', () => {
      const rareItem = {
        identity: { rarity: 'Rare', name: 'Doom Veil' }
      };
      assert.equal(uniqueAnalyzer.analyze(rareItem, 'poe1'), null);
    });
  });

  describe('7. ItemAnalyzerService & Unified Analysis API (Phase 14)', () => {
    const rawRareHelmet = `Item Class: Helmets
Rarity: Rare
Doom Veil
Hubris Circlet
--------
Quality: +20% (augmented)
Energy Shield: 284 (augmented)
--------
Requirements:
Level: 69
Int: 154
--------
Sockets: B-B-B-B
--------
Item Level: 86
--------
+89 to maximum Life
+42% to Fire Resistance
+48% to Cold Resistance`;

    it('runs end-to-end analysis on rare helmet and populates all analysis domains', () => {
      const result = itemAnalyzerService.analyze(rawRareHelmet, { game: 'poe1' });
      assert.equal(result.success, true);
      assert.equal(result.item.identity.name, 'Doom Veil');
      assert.equal(result.classification.kind, 'rare_gear');

      // Mod Analysis
      const mods = result.analysis.mods;
      assert.equal(mods.length, 3);
      assert.equal(mods[0].family, 'MaximumLife');
      assert.equal(mods[0].tier, 1);
      assert.equal(mods[0].rollAnalysis[0].percentile, 1.0); // 89 in [80, 89] = 100%

      // Base & Affix Capacity
      assert.equal(result.analysis.base.recognized, true);
      assert.equal(result.analysis.affixCapacity.prefixesCount, 1);
      assert.equal(result.analysis.affixCapacity.suffixesCount, 2);
      assert.equal(result.analysis.affixCapacity.openPrefixes, 2);
      assert.equal(result.analysis.affixCapacity.openSuffixes, 1);

      // Weapon DPS & Unique should be null
      assert.equal(result.analysis.dps, null);
      assert.equal(result.analysis.unique, null);
    });

    it('rejects empty input with descriptive error', () => {
      assert.throws(() => {
        itemAnalyzerService.analyze('');
      }, /required and cannot be empty/);
    });
  });

  describe('8. Express REST Endpoint: POST /api/analyze-item', () => {
    let server;
    let baseUrl;

    before(async () => {
      const app = createApp();
      server = http.createServer(app);
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
      if (server) {
        await new Promise(resolve => server.close(resolve));
      }
    });

    it('POST /api/analyze-item returns 200 with full analysis payload', async () => {
      const rawItem = `Item Class: Belts
Rarity: Unique
Mageblood
Heavy Belt
--------
Requirements:
Level: 44
--------
Item Level: 85
--------
Magic Utility Flasks cannot be used
Leftmost 4 Magic Utility Flasks constantly apply their Flask Effects to you`;

      const res = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: 'poe1',
          rawText: rawItem,
          source: 'test'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.item.identity.name, 'Mageblood');
      assert.equal(data.classification.kind, 'unique_gear');
      assert.equal(data.analysis.unique.tier, '0');
      assert.equal(data.analysis.unique.recognized, true);
    });

    it('POST /api/analyze-item returns 400 when rawText is missing', async () => {
      const res = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('rawText'));
    });
  });

});
