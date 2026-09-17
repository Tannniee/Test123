const fs = require('fs');
const path = require('path');
const ConversionMath = require('./conversionMath');

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

// Rotational batches (Clean valid 200 OK Exchange categories)
const POE1_ROTATION_BATCHES = [
  ['AllflameEmber', 'DivinationCard'], // Batch 0: Allflame Embers + Divination Cards
  ['Essence', 'Runegraft'],            // Batch 1: Essences + Runegrafts
  ['Fossil', 'Oil'],                   // Batch 2: Fossils + Oils
  ['DeliriumOrb', 'Omen'],             // Batch 3: Delirium Orbs + Omens
  ['Artifact', 'Tattoo'],              // Batch 4: Artifacts + Tattoos
  ['Ducat', 'EnshroudingCrystal']      // Batch 5: Ducats + Enshrouding Crystals
];

const POE2_ROTATION_BATCHES = [
  ['Ritual', 'Breach'],                // Batch 0: Ritual + Breach
  ['Delirium', 'Abyss'],               // Batch 1: Delirium + Abyss
  ['Expedition']                       // Batch 2: Expedition
];

class CacheManager {
  constructor() {
    this.memoryCache = {
      poe1: {},
      poe2: {}
    };
    this.isRefreshing = false;
    this.refreshProgress = { current: 0, total: 0, status: 'idle' };

    // Dynamic Leagues
    this.activeLeagues = {
      poe1: 'Allflame',
      poe2: 'Forbidden Rites'
    };
    this.leaguesList = {
      poe1: [
        { id: 'Allflame', name: 'Allflame (Current League)', default: true },
        { id: 'Standard', name: 'Standard', default: false }
      ],
      poe2: [
        { id: 'Forbidden Rites', name: 'Forbidden Rites (Current League)', default: true },
        { id: 'Standard', name: 'Standard', default: false }
      ]
    };

    // Diagnostics per category
    this.diagnostics = {
      poe1: {},
      poe2: {}
    };

    // Historical Snapshots (up to 48 recent checkpoints per league)
    this.snapshots = {
      poe1: {},
      poe2: {}
    };

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

    // Detect dynamic leagues, then start schedulers
    this.initDynamicLeagues().then(() => {
      this.startSchedulers();
    });
  }

  async initDynamicLeagues() {
    console.log('[CacheManager] Detecting dynamic leagues from poe.ninja...');
    await Promise.allSettled([
      this.fetchLeagues('poe1'),
      this.fetchLeagues('poe2')
    ]);
  }

  async fetchLeagues(game) {
    const url = `https://poe.ninja/${game}/api/economy/leagues`;
    const res = await this.fetchJson(url);
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const list = res.data.map((l, index) => ({
        id: l.id || l.name,
        name: index === 0 ? `${l.name} (Current League)` : l.name,
        default: index === 0
      }));
      this.leaguesList[game] = list;
      this.activeLeagues[game] = list[0].id;
      console.log(`[CacheManager] Dynamic active league for ${game.toUpperCase()}: "${this.activeLeagues[game]}"`);
    } else {
      console.warn(`[CacheManager] Could not fetch dynamic leagues for ${game}, using defaults.`);
    }
  }

  getActiveLeague(game) {
    return this.activeLeagues[game] || (game === 'poe2' ? 'Forbidden Rites' : 'Allflame');
  }

  getLeagues() {
    return this.leaguesList;
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

            if (data.snapshots && Array.isArray(data.snapshots)) {
              if (!this.snapshots[game]) this.snapshots[game] = {};
              this.snapshots[game][data.league || safeLeague] = data.snapshots;
            }

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

  /**
   * Fetch with Retry & Exponential Backoff
   */
  async fetchJson(url, retries = 2, delays = [500, 1500]) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const start = Date.now();
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          }
        });
        const latencyMs = Date.now() - start;

        if (!response.ok) {
          if (response.status >= 500 && attempt < retries) {
            console.warn(`[CacheManager] HTTP ${response.status} for ${url}. Retrying in ${delays[attempt]}ms...`);
            await this.sleep(delays[attempt]);
            continue;
          }
          console.warn(`[CacheManager] Warning: HTTP ${response.status} for ${url}`);
          return { data: null, httpCode: response.status, latencyMs, error: `HTTP ${response.status}` };
        }

        const json = await response.json();
        return { data: json, httpCode: 200, latencyMs, error: null };
      } catch (err) {
        const latencyMs = Date.now() - start;
        if (attempt < retries) {
          console.warn(`[CacheManager] Request error for ${url}: ${err.message}. Retrying in ${delays[attempt]}ms...`);
          await this.sleep(delays[attempt]);
          continue;
        }
        console.warn(`[CacheManager] Final request error for ${url}:`, err.message);
        return { data: null, httpCode: 0, latencyMs, error: err.message };
      }
    }
    return { data: null, httpCode: 0, latencyMs: 0, error: 'Max retries reached' };
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

      // Map categories cleanly, extracting Catalysts and Vaal from Currency
      let category = this.mapExchangeCategory(type, it.category, game);
      let subCategory = type;

      if (game === 'poe1' && type === 'Currency' && it.category === 'Catalysts') {
        category = 'Catalysts';
        subCategory = 'Catalyst';
      } else if (game === 'poe2' && type === 'Currency' && it.category === 'Vaal') {
        category = 'Vaal';
        subCategory = 'Vaal';
      }

      results.push({
        id: `${game}_${it.id}_${subCategory}`,
        key: it.id,
        name: it.name,
        category: category,
        subCategory: subCategory,
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

    return type || itCategory;
  }

  /**
   * Incrementally fetches and merges specified categories into existing cache.
   * With Rate Validation & Anomaly Guard
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
    let exaltedRate = existingEntry.rates?.exalted || 0;
    let chaosRate = existingEntry.rates?.chaos || 0;
    let mirrorRate = existingEntry.mirrorPriceInChaos || 0;
    let isRateStale = existingEntry.rates?.isStale || false;
    let rateValidationReason = null;

    // Filter out items belonging to the types we are about to re-fetch
    const typesSet = new Set(types);
    const keptItems = existingItems.filter(it => !typesSet.has(it.subCategory));

    let fetchedItems = [];
    for (const type of types) {
      const url = `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${type}`;
      const res = await this.fetchJson(url);

      // Record Diagnostics
      if (!this.diagnostics[game]) this.diagnostics[game] = {};
      this.diagnostics[game][type] = {
        type,
        url,
        status: res.httpCode === 200 ? 'ok' : 'error',
        httpCode: res.httpCode,
        latencyMs: res.latencyMs,
        itemsCount: res.data?.lines?.length || 0,
        lastUpdated: new Date().toISOString(),
        error: res.error
      };

      if (res.data) {
        const data = res.data;
        if (type === 'Currency') {
          if (game === 'poe1') {
            // PoE 1 Rate Validation
            let candidateDivineRate = 0;
            if (data.core?.rates?.divine) {
              candidateDivineRate = data.core.rates.divine;
            }
            const validation = ConversionMath.validateRate(candidateDivineRate, existingEntry.rates?.divine);
            if (validation.valid) {
              divineRate = validation.rate;
              isRateStale = false;
            } else {
              console.warn(`[CacheManager] PoE1 Divine rate guard triggered: ${validation.reason}. Preserving last-known-good: ${validation.rate}`);
              divineRate = validation.rate;
              isRateStale = true;
              rateValidationReason = validation.reason;
            }
          } else if (game === 'poe2') {
            // PoE 2 Rate Validation
            const exaltedLine = data.lines?.find(l => l.id === 'exalted');
            const candidateExalted = ConversionMath.derivePoE2ExaltedRate(data.core?.rates, exaltedLine);
            const validation = ConversionMath.validateRate(candidateExalted, existingEntry.rates?.exalted);

            if (validation.valid) {
              exaltedRate = validation.rate;
              isRateStale = false;
            } else {
              console.warn(`[CacheManager] PoE2 Exalted rate guard triggered: ${validation.reason}. Preserving last-known-good: ${validation.rate}`);
              exaltedRate = validation.rate;
              isRateStale = true;
              rateValidationReason = validation.reason;
            }

            if (data.core?.rates?.chaos) {
              chaosRate = data.core.rates.chaos;
            }
            divineRate = 1;
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

    // Record Historical Snapshot (keep up to 48 recent checkpoints)
    if (!this.snapshots[game]) this.snapshots[game] = {};
    if (!this.snapshots[game][league]) this.snapshots[game][league] = [];
    this.snapshots[game][league].push({
      timestamp: new Date().toISOString(),
      divinePriceInChaos: divineRate > 0 ? +(1 / divineRate).toFixed(1) : (game === 'poe2' ? 1 : (existingEntry.divinePriceInChaos || 0)),
      exaltedPrice: exaltedRate || existingEntry.rates?.exalted || 0,
      mirrorPriceInChaos: mirrorRate || existingEntry.mirrorPriceInChaos || 0,
      itemCount: finalItems.length
    });
    if (this.snapshots[game][league].length > 48) {
      this.snapshots[game][league].shift();
    }

    const updatedEntry = {
      ...existingEntry,
      updatedAt: new Date().toISOString(),
      divinePriceInChaos: divineRate > 0 ? +(1 / divineRate).toFixed(1) : (game === 'poe2' ? 1 : (existingEntry.divinePriceInChaos || 0)),
      mirrorPriceInChaos: mirrorRate || existingEntry.mirrorPriceInChaos || 0,
      rates: {
        divine: divineRate || existingEntry.rates?.divine || 0,
        chaosToDivine: divineRate || existingEntry.rates?.divine || 0,
        exalted: exaltedRate || existingEntry.rates?.exalted || 0,
        chaos: chaosRate || existingEntry.rates?.chaos || 0,
        isStale: isRateStale,
        staleReason: rateValidationReason
      },
      snapshots: this.snapshots[game][league],
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
   * Refresh a single specific category on-demand
   */
  async refreshSingleCategory(game, league, categoryName) {
    console.log(`[CacheManager] Refreshing single category "${categoryName}" for ${game} - ${league}...`);

    // Category mapping to underlying Exchange types
    const catTypeMap = {
      'Currency': ['Currency'],
      'Catalysts': ['Currency'],
      'Vaal': ['Currency'],
      'Scarabs': ['Scarab'],
      'Divination Cards': ['DivinationCard'],
      'Fragments': ['Fragment'],
      'Essences': ['Essence'],
      'Fossils': ['Fossil'],
      'Oils': ['Oil'],
      'Delirium Orbs': ['DeliriumOrb'],
      'Artifacts': ['Artifact'],
      'Tattoos': ['Tattoo'],
      'Omens': ['Omen'],
      'Allflame Embers': ['AllflameEmber'],
      'Runegrafts': ['Runegraft'],
      'Ducats': ['Ducat'],
      'Enshrouding Crystals': ['EnshroudingCrystal'],
      'Ritual': ['Ritual'],
      'Breach': ['Breach'],
      'Delirium': ['Delirium'],
      'Abyss': ['Abyss'],
      'Expedition': ['Expedition']
    };

    const types = catTypeMap[categoryName] || [categoryName];
    return await this.syncCategoryBatch(game, league, types);
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

    const activeP1 = this.getActiveLeague('poe1');
    const activeP2 = this.getActiveLeague('poe2');

    console.log(`[CacheManager] Starting 5m Rotation: PoE 1 [${friendlyP1}], PoE 2 [${friendlyP2}]...`);
    this.refreshProgress = {
      current: 1,
      total: 3,
      status: `Xoay tua: ${friendlyP1} & ${friendlyP2}`
    };

    try {
      // 1. Sync PoE 1 Active League
      await this.syncCategoryBatch('poe1', activeP1, p1Batch);
      await this.sleep(400);

      // 2. Sync PoE 1 Standard
      if (activeP1 !== 'Standard') {
        await this.syncCategoryBatch('poe1', 'Standard', p1Batch);
        await this.sleep(400);
      }

      // 3. Sync PoE 2 Active League
      await this.syncCategoryBatch('poe2', activeP2, p2Batch);

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

    const activeP1 = this.getActiveLeague('poe1');
    const activeP2 = this.getActiveLeague('poe2');

    try {
      await this.syncCategoryBatch('poe1', activeP1, POE1_PRIORITY_TYPES);
      await this.sleep(400);

      if (activeP1 !== 'Standard') {
        await this.syncCategoryBatch('poe1', 'Standard', POE1_PRIORITY_TYPES);
        await this.sleep(400);
      }

      await this.syncCategoryBatch('poe2', activeP2, POE2_PRIORITY_TYPES);

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

  getData(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    return this.memoryCache[game]?.[targetLeague] || null;
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
          mirrorPriceInChaos: data.mirrorPriceInChaos,
          exaltedRate: data.rates?.exalted,
          isStale: data.rates?.isStale
        };
      }
    }
    return summary;
  }

  getStatus() {
    const nextP1 = POE1_ROTATION_BATCHES[this.rotationIndexPoe1 % POE1_ROTATION_BATCHES.length];
    const nextP2 = POE2_ROTATION_BATCHES[this.rotationIndexPoe2 % POE2_ROTATION_BATCHES.length];

    return {
      status: 'ok',
      isRefreshing: this.isRefreshing,
      refreshProgress: this.refreshProgress,
      priorityIntervalMinutes: 30,
      rotationIntervalMinutes: 5,
      activeLeagues: this.activeLeagues,
      lastPriorityTime: this.lastPriorityTime,
      lastRotationTime: this.lastRotationTime,
      lastRotatedBatch: this.lastRotatedBatch,
      nextRotationBatch: {
        poe1: nextP1,
        poe2: nextP2,
        friendlyP1: nextP1.map(t => this.mapExchangeCategory(t, t, 'poe1')).join(', '),
        friendlyP2: nextP2.map(t => this.mapExchangeCategory(t, t, 'poe2')).join(', ')
      },
      diagnostics: this.diagnostics,
      summary: this.getSummary()
    };
  }
}

module.exports = new CacheManager();
