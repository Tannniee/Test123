const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const PRIORITY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes for Priority (Currency, Scarabs, Fragments)
const ROTATION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes for 2-category rotation batches
const USER_AGENT = 'PoE-QuickPriceChecker/1.0 (Local desktop tool)';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Priority categories (Refreshed every 30 minutes)
const POE1_PRIORITY_TYPES = ['Currency', 'Fragment', 'Scarab'];
const POE2_PRIORITY_TYPES = ['Currency'];

// Rotational batches (2 categories per batch, refreshed every 5 minutes in round-robin)
const POE1_ROTATION_BATCHES = [
  ['AllflameEmber', 'DivinationCard'], // Batch 0: Allflame Embers + Divination Cards
  ['Essence', 'Runegraft'],            // Batch 1: Essences + Runegrafts
  ['Fossil', 'Oil'],                   // Batch 2: Fossils + Oils
  ['Catalyst', 'DeliriumOrb'],         // Batch 3: Catalysts + Delirium Orbs
  ['Artifact', 'Tattoo'],              // Batch 4: Artifacts + Tattoos
  ['Omen', 'Incubator'],               // Batch 5: Omens + Incubators
  ['Ducat', 'EnshroudingCrystal']      // Batch 6: Ducats + Enshrouding Crystals
];

const POE2_ROTATION_BATCHES = [
  ['Ritual', 'Breach'],                // Batch 0: Ritual + Breach
  ['Delirium', 'Abyss'],               // Batch 1: Delirium + Abyss
  ['Expedition', 'Vaal']               // Batch 2: Expedition + Vaal Infusers
];

class CacheManager {
  constructor() {
    this.memoryCache = {
      poe1: {},
      poe2: {}
    };
    this.isRefreshing = false;
    this.refreshProgress = { current: 0, total: 0, status: 'idle' };

    // Schedulers & rotation state
    this.priorityTimer = null;
    this.rotationTimer = null;
    this.rotationIndexPoe1 = 0;
    this.rotationIndexPoe2 = 0;
    this.lastPriorityTime = null;
    this.lastRotationTime = null;
    this.lastRotatedBatch = null;

    // Load existing cache from disk on startup
    this.loadAllFromDisk();

    // Start background schedulers (30m Priority + 5m Rotation)
    this.startSchedulers();
  }

  getCacheFilePath(game, league) {
    const safeLeague = league.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(CACHE_DIR, `${game}_${safeLeague}.json`);
  }

  loadAllFromDisk() {
    console.log('[CacheManager] Loading cached files from disk...');
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const match = file.match(/^(poe1|poe2)_(.+)\.json$/);
          if (match) {
            const [, game, safeLeague] = match;
            const filePath = path.join(CACHE_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            if (!this.memoryCache[game]) this.memoryCache[game] = {};
            this.memoryCache[game][data.league || safeLeague] = data;
            console.log(`[CacheManager] Loaded ${game} - ${data.league || safeLeague} (${data.items?.length || 0} items, updated: ${data.updatedAt})`);
          }
        }
      }
    } catch (err) {
      console.error('[CacheManager] Error loading cache from disk:', err.message);
    }
  }

  saveToDisk(game, league, data) {
    try {
      const filePath = this.getCacheFilePath(game, league);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[CacheManager] Failed to save cache for ${game}/${league}:`, err.message);
    }
  }

  startSchedulers() {
    if (this.priorityTimer) clearInterval(this.priorityTimer);
    if (this.rotationTimer) clearInterval(this.rotationTimer);

    // 1. Priority scheduler (Every 30 minutes)
    this.priorityTimer = setInterval(async () => {
      console.log('[CacheManager] 30m Priority tick: Refreshing Currency, Scarabs, Fragments...');
      await this.refreshPriority();
    }, PRIORITY_INTERVAL_MS);

    // 2. Rotation scheduler (Every 5 minutes)
    this.rotationTimer = setInterval(async () => {
      console.log('[CacheManager] 5m Rotation tick: Refreshing next 2-category batch...');
      await this.stepRotation();
    }, ROTATION_INTERVAL_MS);

    console.log(`[CacheManager] Schedulers active: Priority every 30m, Rotation every 5m.`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchJson(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        if (response.status !== 404) {
          console.warn(`[CacheManager] Warning: HTTP ${response.status} for ${url}`);
        }
        return null;
      }
      return await response.json();
    } catch (err) {
      console.warn(`[CacheManager] Request error for ${url}:`, err.message);
      return null;
    }
  }

  normalizeExchangeData(raw, type, game, league) {
    if (!raw || !raw.lines || !raw.items) return [];

    const primaryCurrency = raw.core?.primary || (game === 'poe2' ? 'divine' : 'chaos');
    const rates = raw.core?.rates || {};
    const itemsMap = new Map();
    for (const it of raw.items) {
      itemsMap.set(it.id, it);
    }

    const results = [];
    for (const line of raw.lines) {
      const it = itemsMap.get(line.id);
      if (!it) continue;

      const rawVal = typeof line.primaryValue === 'number' ? line.primaryValue : 0;
      let chaosVal = 0;
      let divineVal = 0;
      let exaltedVal = 0;

      if (primaryCurrency === 'divine') {
        // PoE 2 convention: primary is Divine Orb
        divineVal = rawVal;
        exaltedVal = rates.exalted ? +(rawVal * rates.exalted).toFixed(2) : 0;
        chaosVal = rates.chaos ? +(rawVal * rates.chaos).toFixed(2) : (exaltedVal || divineVal);
      } else {
        // PoE 1 convention: primary is Chaos Orb
        chaosVal = rawVal;
        if (rates.divine > 0) {
          divineVal = +(rawVal * rates.divine).toFixed(2);
        } else if (it.id === 'divine') {
          divineVal = 1;
        }
        exaltedVal = rates.exalted ? +(rawVal * rates.exalted).toFixed(2) : 0;
      }

      let icon = it.image || '';
      if (icon && !icon.startsWith('http')) {
        icon = `https://web.poecdn.com${icon}`;
      }
      if (!icon && (type === 'DivinationCard' || it.category === 'Cards')) {
        icon = 'https://web.poecdn.com/image/Art/2DItems/Divination/InventoryIcon.png';
      }

      const category = this.mapExchangeCategory(type, it.category, game);

      results.push({
        id: `${game}_${it.id}_${type}`,
        key: it.id,
        name: it.name,
        category: category,
        subCategory: type,
        icon: icon,
        chaosValue: chaosVal,
        divineValue: divineVal,
        exaltedValue: exaltedVal,
        primaryCurrency,
        change7d: line.sparkline?.totalChange || 0,
        sparkline: line.sparkline?.data || [],
        volume: line.volumePrimaryValue || 0,
        maxVolumeCurrency: line.maxVolumeCurrency || '',
        maxVolumeRate: line.maxVolumeRate || 0,
        baseType: it.name,
        detailsId: it.detailsId || it.id,
        game,
        league,
        source: 'exchange'
      });
    }

    return results;
  }

  mapExchangeCategory(type, itCategory, game) {
    if (game === 'poe2') {
      if (type === 'Currency') {
        if (itCategory === 'Vaal') return 'Vaal';
        return 'Currency';
      }
      const p2Map = {
        'Ritual': 'Ritual',
        'Breach': 'Breach',
        'Delirium': 'Delirium',
        'Abyss': 'Abyss',
        'Expedition': 'Expedition',
        'Vaal': 'Vaal'
      };
      return p2Map[type] || p2Map[itCategory] || type;
    }

    // PoE 1
    if (type === 'Currency') {
      if (itCategory === 'Catalysts') return 'Catalysts';
      return 'Currency';
    }
    if (type === 'Scarab') return 'Scarabs';
    if (type === 'DivinationCard') return 'Divination Cards';
    if (type === 'Fragment') return 'Fragments';
    if (type === 'Essence') return 'Essences';
    if (type === 'Fossil') return 'Fossils';
    if (type === 'Oil') return 'Oils';
    if (type === 'Catalyst') return 'Catalysts';
    if (type === 'DeliriumOrb') return 'Delirium Orbs';
    if (type === 'Artifact') return 'Artifacts';
    if (type === 'Tattoo') return 'Tattoos';
    if (type === 'Omen') return 'Omens';
    if (type === 'AllflameEmber') return 'Allflame Embers';
    if (type === 'Runegraft') return 'Runegrafts';
    if (type === 'Ducat') return 'Ducats';
    if (type === 'EnshroudingCrystal') return 'Enshrouding Crystals';
    if (type === 'Incubator') return 'Incubators';

    return type || itCategory;
  }

  /**
   * Incrementally fetches and merges specified categories into existing cache.
   * Preserves all other categories completely.
   */
  async syncCategoryBatch(game, league, types) {
    let existingEntry = this.memoryCache[game]?.[league];
    if (!existingEntry) {
      const filePath = this.getCacheFilePath(game, league);
      if (fs.existsSync(filePath)) {
        try {
          existingEntry = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {}
      }
    }

    if (!existingEntry) {
      existingEntry = {
        game,
        league,
        updatedAt: new Date().toISOString(),
        divinePriceInChaos: game === 'poe2' ? 1 : 0,
        mirrorPriceInChaos: 0,
        rates: {},
        count: 0,
        items: []
      };
    }

    let existingItems = existingEntry.items || [];
    let divineRate = existingEntry.rates?.divine || 0;
    let mirrorRate = existingEntry.mirrorPriceInChaos || 0;

    // Filter out items belonging to the types we are about to re-fetch
    const typesSet = new Set(types);
    const keptItems = existingItems.filter(it => !typesSet.has(it.subCategory));

    let fetchedItems = [];
    for (const type of types) {
      const url = `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${type}`;
      const data = await this.fetchJson(url);
      if (data) {
        if (type === 'Currency') {
          if (data.core?.rates?.divine) {
            divineRate = data.core.rates.divine;
          } else if (data.core?.primary === 'divine' && data.core?.rates?.chaos) {
            divineRate = 1 / data.core.rates.chaos;
          }
        }
        const normalized = this.normalizeExchangeData(data, type, game, league);
        fetchedItems.push(...normalized);

        const mirrorItem = normalized.find(i => i.key === 'mirror' || i.name.toLowerCase().includes('mirror'));
        if (mirrorItem) {
          mirrorRate = mirrorItem.chaosValue || mirrorItem.divineValue;
        }
      }
      await this.sleep(250);
    }

    // Merge keptItems + fetchedItems, deduplicate by name + subCategory
    const uniqueMap = new Map();
    for (const it of [...keptItems, ...fetchedItems]) {
      const key = `${it.name}_${it.subCategory}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, it);
      }
    }
    const finalItems = Array.from(uniqueMap.values());

    const updatedEntry = {
      ...existingEntry,
      updatedAt: new Date().toISOString(),
      divinePriceInChaos: divineRate > 0 ? +(1 / divineRate).toFixed(1) : (game === 'poe2' ? 1 : (existingEntry.divinePriceInChaos || 0)),
      mirrorPriceInChaos: mirrorRate || existingEntry.mirrorPriceInChaos || 0,
      rates: {
        divine: divineRate || existingEntry.rates?.divine || 0,
        chaosToDivine: divineRate || existingEntry.rates?.divine || 0,
        exalted: existingEntry.rates?.exalted || 457.3
      },
      count: finalItems.length,
      items: finalItems
    };

    if (!this.memoryCache[game]) this.memoryCache[game] = {};
    this.memoryCache[game][league] = updatedEntry;
    this.saveToDisk(game, league, updatedEntry);

    console.log(`[CacheManager] Batch [${types.join(', ')}] updated for ${game.toUpperCase()} - ${league}: ${finalItems.length} total items.`);
    return updatedEntry;
  }

  /**
   * 5-minute round-robin rotation:
   * Picks 2 categories from PoE 1 and 2 categories from PoE 2, refreshes them incrementally.
   */
  async stepRotation() {
    if (this.isRefreshing) {
      console.log('[CacheManager] Cache manager busy, skipping this rotation tick...');
      return;
    }

    this.isRefreshing = true;
    const p1Batch = POE1_ROTATION_BATCHES[this.rotationIndexPoe1 % POE1_ROTATION_BATCHES.length];
    const p2Batch = POE2_ROTATION_BATCHES[this.rotationIndexPoe2 % POE2_ROTATION_BATCHES.length];

    this.rotationIndexPoe1 = (this.rotationIndexPoe1 + 1) % POE1_ROTATION_BATCHES.length;
    this.rotationIndexPoe2 = (this.rotationIndexPoe2 + 1) % POE2_ROTATION_BATCHES.length;

    const friendlyP1 = p1Batch.map(t => this.mapExchangeCategory(t, t, 'poe1')).join(' & ');
    const friendlyP2 = p2Batch.map(t => this.mapExchangeCategory(t, t, 'poe2')).join(' & ');

    console.log(`[CacheManager] Starting 5m Rotation: PoE 1 [${friendlyP1}], PoE 2 [${friendlyP2}]...`);
    this.refreshProgress = {
      current: 1,
      total: 3,
      status: `Xoay tua: ${friendlyP1} & ${friendlyP2}`
    };

    try {
      // 1. Sync PoE 1 Allflame
      await this.syncCategoryBatch('poe1', 'Allflame', p1Batch);
      await this.sleep(400);

      // 2. Sync PoE 1 Standard
      await this.syncCategoryBatch('poe1', 'Standard', p1Batch);
      await this.sleep(400);

      // 3. Sync PoE 2 Standard
      await this.syncCategoryBatch('poe2', 'Standard', p2Batch);

      this.lastRotationTime = new Date().toISOString();
      this.lastRotatedBatch = {
        poe1: p1Batch,
        poe2: p2Batch,
        friendlyP1,
        friendlyP2
      };

      console.log(`[CacheManager] 5m Rotation completed: ${friendlyP1} & ${friendlyP2}`);
    } catch (err) {
      console.error('[CacheManager] Error during 5m rotation:', err.message);
    } finally {
      this.isRefreshing = false;
      this.refreshProgress = { current: 0, total: 0, status: 'idle' };
    }
  }

  /**
   * 30-minute Priority sync:
   * Refreshes Currency (PoE 1 & 2), Scarabs (PoE 1), Fragments (PoE 1).
   */
  async refreshPriority() {
    if (this.isRefreshing) {
      console.log('[CacheManager] Busy, postponing priority tick...');
      return;
    }

    this.isRefreshing = true;
    console.log(`[CacheManager] Starting 30m Priority sync (Currency, Scarabs, Fragments)...`);
    this.refreshProgress = {
      current: 1,
      total: 3,
      status: 'Đồng bộ 30p: Currency, Scarabs, Fragments'
    };

    try {
      await this.syncCategoryBatch('poe1', 'Allflame', POE1_PRIORITY_TYPES);
      await this.sleep(400);

      await this.syncCategoryBatch('poe1', 'Standard', POE1_PRIORITY_TYPES);
      await this.sleep(400);

      await this.syncCategoryBatch('poe2', 'Standard', POE2_PRIORITY_TYPES);

      this.lastPriorityTime = new Date().toISOString();
      console.log(`[CacheManager] 30m Priority sync completed.`);
    } catch (err) {
      console.error('[CacheManager] Error in refreshPriority:', err.message);
    } finally {
      this.isRefreshing = false;
      this.refreshProgress = { current: 0, total: 0, status: 'idle' };
    }
  }

  /**
   * Manual refresh trigger:
   * Runs priority sync and then the next rotation batch so user immediately sees updates.
   */
  async refreshAll() {
    if (this.isRefreshing) {
      console.log('[CacheManager] Sync already in progress, skipping manual trigger...');
      return;
    }
    await this.refreshPriority();
    await this.stepRotation();
  }

  getData(game = 'poe1', league = 'Standard') {
    return this.memoryCache[game]?.[league] || null;
  }

  getSummary() {
    const summary = {};
    for (const game of ['poe1', 'poe2']) {
      summary[game] = {};
      const leagues = this.memoryCache[game] || {};
      for (const [league, data] of Object.entries(leagues)) {
        summary[game][league] = {
          updatedAt: data.updatedAt,
          count: data.count,
          divinePriceInChaos: data.divinePriceInChaos,
          mirrorPriceInChaos: data.mirrorPriceInChaos
        };
      }
    }
    return summary;
  }

  getStatus() {
    const nextP1 = POE1_ROTATION_BATCHES[this.rotationIndexPoe1 % POE1_ROTATION_BATCHES.length];
    const nextP2 = POE2_ROTATION_BATCHES[this.rotationIndexPoe2 % POE2_ROTATION_BATCHES.length];

    return {
      isRefreshing: this.isRefreshing,
      refreshProgress: this.refreshProgress,
      priorityIntervalMinutes: 30,
      rotationIntervalMinutes: 5,
      lastPriorityTime: this.lastPriorityTime,
      lastRotationTime: this.lastRotationTime,
      lastRotatedBatch: this.lastRotatedBatch,
      nextRotationBatch: {
        poe1: nextP1,
        poe2: nextP2,
        friendlyP1: nextP1.map(t => this.mapExchangeCategory(t, t, 'poe1')).join(', '),
        friendlyP2: nextP2.map(t => this.mapExchangeCategory(t, t, 'poe2')).join(', ')
      },
      summary: this.getSummary()
    };
  }
}

module.exports = new CacheManager();
