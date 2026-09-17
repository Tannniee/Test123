const fs = require('fs');
const path = require('path');
const ConversionMath = require('./conversionMath');
const CategoryRegistry = require('./categoryRegistry');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const PRIORITY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes for Priority sync
const ROTATION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes for Rotational batches
const LEAGUE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour for League list refresh
const USER_AGENT = 'PoE-QuickPriceChecker/1.0 (Local desktop tool)';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class CacheManager {
  constructor() {
    this.memoryCache = {
      poe1: {},
      poe2: {}
    };

    // Concurrency Job Locks (keyed by game:league:sourceTypes)
    this.activeJobs = new Set();

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

    // Diagnostics per game -> league -> type
    this.diagnostics = {
      poe1: {},
      poe2: {}
    };

    // Historical Snapshots (up to 48 recent checkpoints per league)
    this.snapshots = {
      poe1: {},
      poe2: {}
    };

    // Rotation indices per game+league
    this.rotationIndices = {};

    // Schedulers & Timers
    this.priorityTimer = null;
    this.rotationTimer = null;
    this.leagueRefreshTimer = null;
    this.lastPriorityTime = null;
    this.lastRotationTime = null;
    this.lastRotatedBatch = null;

    // 1. Load existing cache from disk
    this.loadAllFromDisk();

    // 2. Initialize dynamic leagues and start schedulers
    this.initDynamicLeagues().then(() => {
      this.startSchedulers();
    });
  }

  // =========================================================================
  // Dynamic Leagues
  // =========================================================================
  async initDynamicLeagues() {
    console.log('[CacheManager] Fetching dynamic leagues from poe.ninja...');
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
      console.warn(`[CacheManager] Could not fetch dynamic leagues for ${game}, using fallback defaults.`);
    }
  }

  getActiveLeague(game) {
    return this.activeLeagues[game] || (game === 'poe2' ? 'Forbidden Rites' : 'Allflame');
  }

  getLeagues() {
    return this.leaguesList;
  }

  // =========================================================================
  // Category Availability & Auto-Adapting Scheduler Batches
  // =========================================================================
  getAvailableCategories(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    const registry = CategoryRegistry.getRegistry(game);
    const entry = this.memoryCache[game]?.[targetLeague];
    const items = entry?.items || [];

    const available = [];
    for (const reg of registry) {
      // Check if this type has items in current cache (support both sourceType and legacy subCategory)
      const count = items.filter(it => (it.sourceType || it.subCategory) === reg.type).length;
      if (count > 0 || (entry && entry.sources?.[reg.type]?.status === 'ok')) {
        available.push({
          type: reg.type,
          label: reg.label,
          priority: reg.priority,
          iconClass: reg.iconClass,
          count: count
        });
      } else if (!entry) {
        // Cache not yet loaded, default to priority items
        if (reg.priority) {
          available.push({
            type: reg.type,
            label: reg.label,
            priority: reg.priority,
            iconClass: reg.iconClass,
            count: 0
          });
        }
      }
    }

    // Fallback if cache empty: return full registry with priority items on top
    if (available.length === 0) {
      return registry.map(r => ({
        type: r.type,
        label: r.label,
        priority: r.priority,
        iconClass: r.iconClass,
        count: 0
      }));
    }

    return available;
  }

  getPriorityTypes(game, league) {
    const available = this.getAvailableCategories(game, league);
    const priority = available.filter(c => c.priority);
    return priority.map(c => c.type);
  }

  getRotationBatches(game, league) {
    const available = this.getAvailableCategories(game, league);
    const rotational = available.filter(c => !c.priority);

    if (rotational.length === 0) {
      return [['Currency']];
    }

    const batches = [];
    for (let i = 0; i < rotational.length; i += 2) {
      batches.push(rotational.slice(i, i + 2).map(c => c.type));
    }
    return batches;
  }

  // =========================================================================
  // Disk Persistence (Atomic Writes)
  // =========================================================================
  getCacheFilePath(game, league) {
    const safeLeague = league.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(CACHE_DIR, `${game}_${safeLeague}.json`);
  }

  loadAllFromDisk() {
    console.log('[CacheManager] Loading cached files from disk...');
    try {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.json') && !file.endsWith('.tmp')) {
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
    const filePath = this.getCacheFilePath(game, league);
    const tmpPath = `${filePath}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      // Validate JSON parse before replacing
      JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.error(`[CacheManager] Atomic write failed for ${game}/${league}:`, err.message);
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
      }
    }
  }

  // =========================================================================
  // HTTP Fetching with Exponential Backoff
  // =========================================================================
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
          console.warn(`[CacheManager] Notice: HTTP ${response.status} for ${url}`);
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

  // =========================================================================
  // Normalization with Full Pipeline Rate Guard
  // =========================================================================
  normalizeExchangeData(raw, type, game, league, validatedRates = {}) {
    if (!raw || !raw.lines || !raw.items) return [];

    const primaryCurrency = raw.core?.primary || (game === 'poe2' ? 'divine' : 'chaos');
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
        const exRate = validatedRates.exalted || 1;
        const chRate = validatedRates.chaos || 1;

        exaltedVal = +(rawVal * exRate).toFixed(2);
        chaosVal = +(rawVal * chRate).toFixed(2);
      } else {
        // PoE 1 convention: primary is Chaos Orb
        chaosVal = rawVal;
        const divRate = validatedRates.divine || 0;
        if (divRate > 0) {
          divineVal = +(rawVal * divRate).toFixed(2);
        } else if (it.id === 'divine') {
          divineVal = 1;
        }
        exaltedVal = validatedRates.exalted ? +(rawVal * validatedRates.exalted).toFixed(2) : 0;
      }

      let icon = it.image || '';
      if (icon && !icon.startsWith('http')) {
        icon = `https://web.poecdn.com${icon}`;
      }
      if (!icon && (type === 'DivinationCard' || it.category === 'Cards')) {
        icon = 'https://web.poecdn.com/image/Art/2DItems/Divination/InventoryIcon.png';
      }

      // Grouping: Catalysts and Vaal items are under Currency display category
      let category = CategoryRegistry.getLabel(game, type);
      let subCategory = it.category || type;

      if (game === 'poe1' && type === 'Currency' && it.category === 'Catalysts') {
        category = 'Currency';
        subCategory = 'Catalysts';
      } else if (game === 'poe2' && type === 'Currency' && it.category === 'Vaal') {
        category = 'Currency';
        subCategory = 'Vaal';
      }

      results.push({
        id: `${game}_${it.id}_${type}`,
        key: it.id,
        name: it.name,
        category: category,
        subCategory: subCategory,
        sourceType: type, // Explicit source type for clean cache merging!
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

  // =========================================================================
  // Incremental Batch Sync with Rate Guard & Concurrency Lock
  // =========================================================================
  async syncCategoryBatch(game, league, types) {
    const jobKey = `${game}:${league}:${[...types].sort().join(',')}`;
    if (this.activeJobs.has(jobKey)) {
      console.log(`[CacheManager] Job ${jobKey} is already active, avoiding duplicate concurrency.`);
      return this.memoryCache[game]?.[league] || null;
    }

    this.activeJobs.add(jobKey);

    try {
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
          sources: {},
          count: 0,
          items: []
        };
      }

      let existingItems = existingEntry.items || [];
      let currentRates = { ...(existingEntry.rates || {}) };
      let mirrorRate = existingEntry.mirrorPriceInChaos || 0;
      let sourcesFreshness = { ...(existingEntry.sources || {}) };

      // Cleanly filter out previous items whose sourceType is in types to be updated
      const typesSet = new Set(types);
      const keptItems = existingItems.filter(it => !typesSet.has(it.sourceType));

      let fetchedItems = [];

      for (const type of types) {
        const url = `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${type}`;
        const res = await this.fetchJson(url);

        // Record diagnostics
        if (!this.diagnostics[game]) this.diagnostics[game] = {};
        if (!this.diagnostics[game][league]) this.diagnostics[game][league] = {};
        this.diagnostics[game][league][type] = {
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

          // 1. Rate Guard validation
          if (type === 'Currency') {
            if (game === 'poe1') {
              const candidateRate = data.core?.rates?.divine;
              const check = ConversionMath.validateRate(candidateRate, currentRates.divine);
              currentRates.divine = check.rate;
              currentRates.chaosToDivine = check.rate;
              currentRates.isStale = check.isStale;
              if (check.isAnomaly || !check.valid) {
                console.warn(`[CacheManager] PoE1 Divine Rate Guard triggered: ${check.reason}. Preserved: ${check.rate}`);
                currentRates.staleReason = check.reason;
              }
            } else if (game === 'poe2') {
              const exaltedLine = data.lines?.find(l => l.id === 'exalted');
              const candidateExalted = ConversionMath.derivePoE2ExaltedRate(data.core?.rates, exaltedLine);
              const check = ConversionMath.validateRate(candidateExalted, currentRates.exalted);
              currentRates.exalted = check.rate;
              currentRates.isStale = check.isStale;
              if (data.core?.rates?.chaos) {
                currentRates.chaos = data.core.rates.chaos;
              }
              currentRates.divine = 1;
              if (check.isAnomaly || !check.valid) {
                console.warn(`[CacheManager] PoE2 Exalted Rate Guard triggered: ${check.reason}. Preserved: ${check.rate}`);
                currentRates.staleReason = check.reason;
              }
            }
          }

          // 2. Normalize items using the validated rates!
          const normalized = this.normalizeExchangeData(data, type, game, league, currentRates);
          fetchedItems.push(...normalized);

          // 3. Track sources freshness
          sourcesFreshness[type] = {
            updatedAt: new Date().toISOString(),
            status: 'ok',
            itemsCount: normalized.length,
            latencyMs: res.latencyMs
          };

          const mirrorItem = normalized.find(i => i.key === 'mirror' || i.name.toLowerCase().includes('mirror'));
          if (mirrorItem) {
            mirrorRate = mirrorItem.chaosValue || mirrorItem.divineValue;
          }
        } else {
          // Source failed or returned 0/404
          sourcesFreshness[type] = {
            updatedAt: new Date().toISOString(),
            status: res.httpCode === 404 ? 'unsupported' : 'error',
            itemsCount: 0,
            latencyMs: res.latencyMs,
            error: res.error
          };
        }

        await this.sleep(250);
      }

      // Merge keptItems + fetchedItems, deduplicate by item id
      const uniqueMap = new Map();
      for (const it of [...keptItems, ...fetchedItems]) {
        uniqueMap.set(it.id, it);
      }
      const finalItems = Array.from(uniqueMap.values());

      // Historical Snapshot
      if (!this.snapshots[game]) this.snapshots[game] = {};
      if (!this.snapshots[game][league]) this.snapshots[game][league] = [];
      this.snapshots[game][league].push({
        timestamp: new Date().toISOString(),
        divinePriceInChaos: currentRates.divine > 0 ? +(1 / currentRates.divine).toFixed(1) : (game === 'poe2' ? 1 : (existingEntry.divinePriceInChaos || 0)),
        exaltedPrice: currentRates.exalted || 0,
        itemCount: finalItems.length
      });
      if (this.snapshots[game][league].length > 48) {
        this.snapshots[game][league].shift();
      }

      const updatedEntry = {
        ...existingEntry,
        status: 'ready',
        updatedAt: new Date().toISOString(),
        divinePriceInChaos: currentRates.divine > 0 ? +(1 / currentRates.divine).toFixed(1) : (game === 'poe2' ? 1 : (existingEntry.divinePriceInChaos || 0)),
        mirrorPriceInChaos: mirrorRate || existingEntry.mirrorPriceInChaos || 0,
        rates: currentRates,
        sources: sourcesFreshness,
        snapshots: this.snapshots[game][league],
        count: finalItems.length,
        items: finalItems
      };

      if (!this.memoryCache[game]) this.memoryCache[game] = {};
      this.memoryCache[game][league] = updatedEntry;
      this.saveToDisk(game, league, updatedEntry);

      console.log(`[CacheManager] [${game.toUpperCase()} - ${league}] Merged [${types.join(', ')}]: ${finalItems.length} items total.`);
      return updatedEntry;
    } finally {
      this.activeJobs.delete(jobKey);
    }
  }

  // =========================================================================
  // Per-Category Refresh (On-Demand)
  // =========================================================================
  async refreshSingleCategory(game, league, categoryInput) {
    const targetType = CategoryRegistry.findType(game, categoryInput);
    if (!targetType) {
      throw new Error(`Invalid or unknown category "${categoryInput}" for ${game}.`);
    }

    console.log(`[CacheManager] Refreshing single category "${targetType}" for ${game} - ${league}...`);
    return await this.syncCategoryBatch(game, league, [targetType]);
  }

  // =========================================================================
  // Dynamic Schedulers (Adapting to Available Categories)
  // =========================================================================
  startSchedulers() {
    if (this.priorityTimer) clearInterval(this.priorityTimer);
    if (this.rotationTimer) clearInterval(this.rotationTimer);
    if (this.leagueRefreshTimer) clearInterval(this.leagueRefreshTimer);

    // 1. Priority Scheduler (Every 30 minutes)
    this.priorityTimer = setInterval(async () => {
      console.log('[CacheManager] 30m Priority tick: Refreshing core liquid types...');
      await this.refreshPriority();
    }, PRIORITY_INTERVAL_MS);

    // 2. Dynamic Rotation Scheduler (Every 5 minutes)
    this.rotationTimer = setInterval(async () => {
      console.log('[CacheManager] 5m Rotation tick: Refreshing next dynamic batches...');
      await this.stepRotation();
    }, ROTATION_INTERVAL_MS);

    // 3. Periodic League Refresh (Every 1 hour)
    this.leagueRefreshTimer = setInterval(async () => {
      console.log('[CacheManager] 1h Periodic League check: Refreshing leagues from poe.ninja...');
      await this.initDynamicLeagues();
    }, LEAGUE_REFRESH_INTERVAL_MS);

    console.log('[CacheManager] Schedulers active: Priority every 30m, Rotation every 5m, Leagues every 1h.');
  }

  async stepRotation() {
    for (const game of ['poe1', 'poe2']) {
      const activeLeague = this.getActiveLeague(game);
      const batches = this.getRotationBatches(game, activeLeague);

      const key = `${game}_${activeLeague}`;
      const currentIndex = (this.rotationIndices[key] || 0) % batches.length;
      this.rotationIndices[key] = currentIndex + 1;

      const currentBatch = batches[currentIndex];
      if (currentBatch && currentBatch.length > 0) {
        console.log(`[CacheManager] 5m Rotation [${game.toUpperCase()} - ${activeLeague}]: Batch [${currentBatch.join(', ')}]`);
        await this.syncCategoryBatch(game, activeLeague, currentBatch);
      }
    }
    this.lastRotationTime = new Date().toISOString();
  }

  async refreshPriority() {
    for (const game of ['poe1', 'poe2']) {
      const activeLeague = this.getActiveLeague(game);
      const priorityTypes = this.getPriorityTypes(game, activeLeague);
      if (priorityTypes.length > 0) {
        console.log(`[CacheManager] 30m Priority [${game.toUpperCase()} - ${activeLeague}]: [${priorityTypes.join(', ')}]`);
        await this.syncCategoryBatch(game, activeLeague, priorityTypes);
      }
    }
    this.lastPriorityTime = new Date().toISOString();
  }

  async refreshAll() {
    await this.refreshPriority();
    await this.stepRotation();
  }

  // =========================================================================
  // Non-Silent League Warming & Retrieval
  // =========================================================================
  ensureLeagueCache(game, league) {
    const priorityTypes = CategoryRegistry.getRegistry(game).filter(c => c.priority).map(c => c.type);
    console.log(`[CacheManager] Warming cache for requested league ${game.toUpperCase()} - "${league}"...`);
    this.syncCategoryBatch(game, league, priorityTypes).catch(err => {
      console.error(`[CacheManager] Warming failed for ${game}/${league}:`, err.message);
    });
  }

  getData(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    const entry = this.memoryCache[game]?.[targetLeague];

    if (entry && entry.items && entry.items.length > 0) {
      return {
        status: 'ready',
        ...entry
      };
    }

    // League not yet cached: warm in background, do NOT silently return Standard!
    this.ensureLeagueCache(game, targetLeague);
    return {
      status: 'warming',
      game,
      league: targetLeague,
      updatedAt: null,
      divinePriceInChaos: game === 'poe2' ? 1 : 0,
      mirrorPriceInChaos: 0,
      rates: {},
      count: 0,
      items: [],
      message: `Đang tải dữ liệu cache cho league "${targetLeague}"... Vui lòng đợi trong giây lát.`
    };
  }

  getStatus() {
    const p1League = this.getActiveLeague('poe1');
    const p2League = this.getActiveLeague('poe2');

    return {
      status: 'ok',
      isRefreshing: this.activeJobs.size > 0,
      activeJobs: Array.from(this.activeJobs),
      priorityIntervalMinutes: 30,
      rotationIntervalMinutes: 5,
      activeLeagues: this.activeLeagues,
      lastPriorityTime: this.lastPriorityTime,
      lastRotationTime: this.lastRotationTime,
      nextRotationBatch: {
        poe1: this.getRotationBatches('poe1', p1League)[0] || [],
        poe2: this.getRotationBatches('poe2', p2League)[0] || []
      },
      diagnostics: this.diagnostics,
      summary: this.getSummary()
    };
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
          exaltedRate: data.rates?.exalted,
          isStale: data.rates?.isStale
        };
      }
    }
    return summary;
  }
}

module.exports = new CacheManager();
