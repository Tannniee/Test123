process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const cacheManagerInstance = require('../services/cacheManager.js');
cacheManagerInstance.stopSchedulers();

const createApp = require('../server/createApp.js');
const baseAnalyzer = require('../services/itemAnalyzer/baseAnalyzer.js');
const dpsAnalyzer = require('../services/itemAnalyzer/dpsAnalyzer.js');
const marketResolver = require('../services/itemAnalyzer/marketResolver.js');
const itemAnalyzerService = require('../services/itemAnalyzer/itemAnalyzerService.js');
const { ItemInspectorRender } = await import('../public/js/modules/itemInspectorRender.js');

describe('PR 9 Suite: Web Item Inspector UI & Deep Analysis Integration (Phases 16 & 17)', () => {
  let server;
  let baseUrl;

  before(async () => {
    cacheManagerInstance.stopSchedulers();
    const app = createApp();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    cacheManagerInstance.stopSchedulers();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('1. Backend Improvements & Payload Guards', () => {
    it('rejects rawText exceeding 20,000 characters with 400 error', async () => {
      const hugeText = 'Item Class: Helmets\n' + 'a'.repeat(21000);
      const res = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: hugeText, game: 'poe1' })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.ok(body.error.includes('exceeds maximum allowed length'));
    });

    it('baseAnalyzer exposes isAffixCountPrecise and hasUncertainAffixes flags', () => {
      const canonicalItem = {
        identity: { rarity: 'Rare', baseType: 'Hubris Circlet', itemClass: 'Helmets' }
      };

      // 1. Precise case (all mods recognized as prefix/suffix)
      const preciseMods = [{ type: 'prefix' }, { type: 'suffix' }];
      const res1 = baseAnalyzer.analyze(canonicalItem, preciseMods, 'poe1');
      assert.equal(res1.affixCapacity.isAffixCountPrecise, true);
      assert.equal(res1.affixCapacity.hasUncertainAffixes, false);

      // 2. Imprecise case (contains unknown mod)
      const uncertainMods = [{ type: 'prefix' }, { type: 'unknown' }];
      const res2 = baseAnalyzer.analyze(canonicalItem, uncertainMods, 'poe1');
      assert.equal(res2.affixCapacity.isAffixCountPrecise, false);
      assert.equal(res2.affixCapacity.hasUncertainAffixes, true);
    });

    it('marketResolver skips random item name for Rare items and matches baseType', () => {
      const rareItem = {
        identity: {
          rarity: 'Rare',
          name: 'Cataclysm Coil', // random rare name
          baseType: 'Hubris Circlet'
        }
      };

      // Mock cache manager with BaseType item
      const mockCacheMgr = {
        getActiveLeague: () => 'Standard',
        getData: () => ({
          items: [
            { name: 'Hubris Circlet', baseType: 'Hubris Circlet', chaosValue: 15, divineValue: 0.1, sourceType: 'BaseType' }
          ]
        })
      };

      const resolved = marketResolver.resolve(rareItem, {
        game: 'poe1',
        cacheManager: mockCacheMgr
      });

      assert.ok(resolved, 'Should resolve market data by baseType');
      assert.equal(resolved.name, 'Hubris Circlet');
      assert.equal(resolved.chaosValue, 15);
    });
  });

  describe('2. Weapon Chaos DPS & Combat Analysis', () => {
    it('parses Chaos Damage and computes chaosDps and totalDps', () => {
      const weaponItem = {
        properties: {
          physicalDamage: { min: 50, max: 100 },
          chaosDamage: { min: 20, max: 40 },
          attacksPerSecond: 1.5,
          criticalChance: 6.0,
          quality: 20
        }
      };

      const dps = dpsAnalyzer.analyze(weaponItem);
      assert.ok(dps);
      assert.equal(dps.isWeapon, true);
      // avgPhys = 75 * 1.5 = 112.5
      assert.equal(dps.physicalDps, 112.5);
      // avgChaos = 30 * 1.5 = 45.0
      assert.equal(dps.chaosDps, 45.0);
      // total = 112.5 + 45.0 = 157.5
      assert.equal(dps.totalDps, 157.5);
    });
  });

  describe('3. ItemInspectorRender Engine (Phase 16 UI)', () => {
    const rareHelmetRaw = `Item Class: Helmets
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

    it('renders full inspector modal HTML with header, tier badges, roll progress bars, and tabs', () => {
      const analysisData = itemAnalyzerService.analyze(rareHelmetRaw, { game: 'poe1' });
      assert.equal(analysisData.success, true);

      const html = ItemInspectorRender.renderInspectorModal(analysisData, 'affixes');
      assert.ok(html.includes('Doom Veil'), 'HTML should include item name');
      assert.ok(html.includes('Hubris Circlet'), 'HTML should include base type');
      assert.ok(html.includes('iLvl 86'), 'HTML should include item level');
      assert.ok(html.includes('rarity-rare'), 'HTML should include rarity-rare class');
      assert.ok(html.includes('T1'), 'HTML should display Tier 1 badge');
      assert.ok(html.includes('roll-track'), 'HTML should include roll progress bar track');
      assert.ok(html.includes('roll-bar-fill'), 'HTML should include roll fill element');
      assert.ok(html.includes('crafting-summary-banner'), 'HTML should render crafting slot banner');
      assert.ok(html.includes('inspector-nav-tabs'), 'HTML should render tab navigation');
    });

    it('renders combat tab with DPS and quality scaling for weapons', () => {
      const rawSword = `Item Class: One Hand Swords
Rarity: Rare
Foe Edge
Corsair Sword
--------
One Handed Sword
Physical Damage: 120-240 (augmented)
Chaos Damage: 30-60
Critical Strike Chance: 5.00%
Attacks per Second: 1.55
--------
Requirements:
Level: 58
Dex: 81
Str: 81
--------
Item Level: 83
--------
Adds 40 to 80 Physical Damage`;

      const analysisData = itemAnalyzerService.analyze(rawSword, { game: 'poe1' });
      const html = ItemInspectorRender.renderInspectorModal(analysisData, 'combat');

      assert.ok(html.includes('Weapon DPS'), 'Combat tab should have Weapon DPS section');
      assert.ok(html.includes('Total DPS'), 'Combat tab should show Total DPS');
      assert.ok(html.includes('pDPS'), 'Combat tab should show pDPS');
      assert.ok(html.includes('cDPS'), 'Combat tab should show cDPS');
      assert.ok(html.includes('Blacksmith\'s Whetstone'), 'Combat tab should show Quality projection');
    });

    it('escapes user input preventing XSS injection', () => {
      const maliciousData = {
        item: {
          identity: {
            name: '<script>alert("xss")</script>',
            baseType: '<img src=x onerror=alert(1)>',
            rarity: 'Rare'
          }
        },
        analysis: {}
      };

      const html = ItemInspectorRender.renderInspectorModal(maliciousData);
      assert.ok(!html.includes('<script>alert'), 'Should not contain unescaped script tag');
      assert.ok(html.includes('&lt;script&gt;alert'), 'Should contain escaped script tag');
      assert.ok(!html.includes('<img src=x onerror='), 'Should not contain unescaped img onerror');
    });
  });

  describe('4. End-to-End Analysis REST Endpoint', () => {
    it('POST /api/analyze-item returns 200 with complete analysis and crafting slots', async () => {
      const rareItem = `Item Class: Body Armours
Rarity: Rare
Kraken Shell
Astral Plate
--------
Armour: 1200 (augmented)
--------
Requirements:
Level: 62
Str: 180
--------
Item Level: 85
--------
+12% to all Elemental Resistances (implicit)
--------
+89 to maximum Life
+45% to Fire Resistance`;

      const res = await fetch(`${baseUrl}/api/analyze-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rareItem,
          game: 'poe1'
        })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.item.identity.name, 'Kraken Shell');
      assert.equal(data.analysis.affixCapacity.openPrefixes, 2);
      assert.equal(data.analysis.affixCapacity.openSuffixes, 2);
      assert.equal(data.analysis.affixCapacity.isAffixCountPrecise, true);
    });
  });
});
