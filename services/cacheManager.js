const fs = require('fs');
const path = require('path');
const ConversionMath = require('./conversionMath');
const CategoryRegistry = require('./categoryRegistry');

const DEFAULT_CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const POE1_PRIORITY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes for PoE 1 Priority sync
const POE1_ROTATION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes for PoE 1 Rotational batches
const POE2_PRIORITY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes for PoE 2 Priority sync
const POE2_ROTATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes for PoE 2 Rotational batches
const LEAGUE_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour for League list refresh
const USER_AGENT = 'PoE-QuickPriceChecker/1.0.1 (Local desktop tool)';

class CacheManager {
  constructor(options = {}) {
    this.options = options;
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.autoStart = options.autoStart !== undefined ? options.autoStart : (process.env.NODE_ENV !== 'test');

    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (e) {}
    }

    this.memoryCache = {
      poe1: {},
      poe2: {}
    };

    // Explicit Availability Map:
    // [game][league][type] -> { status: 'available'|'empty'|'unsupported'|'transient_error', count, lastChecked }
    this.availabilityMap = {
      poe1: {},
      poe2: {}
    };

    // Concurrency: Source-level fetch locks
    this.activeFetches = new Set(); // Key: `${game}:${league}:${type}`
    // Concurrency: Per-league merge mutex queues
    this.leagueMutexQueues = new Map(); // Key: `${game}:${league}` -> Promise

    // Active & Tracked Leagues
    this.activeLeagues = {
      poe1: 'Allflame',
      poe2: 'Forbidden Rites'
    };

    this.trackedLeagues = {
      poe1: new Set(['Allflame', 'Standard']),
      poe2: new Set(['Forbidden Rites', 'Standard'])
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

    // Historical Snapshots (up to 48 checkpoints per league)
    this.snapshots = {
      poe1: {},
      poe2: {}
    };

    // Rotation indices per game+league
    this.rotationIndices = {};

    // Schedulers & Timers
    this.poe1PriorityTimer = null;
    this.poe1RotationTimer = null;
    this.poe2PriorityTimer = null;
    this.poe2RotationTimer = null;
    this.leagueRefreshTimer = null;
    this.lastPriorityTime = null;
    this.lastRotationTime = null;

    // Load existing cache from disk
    this.loadAllFromDisk();

    // Initialize dynamic leagues and schedulers if autoStart is enabled
    if (this.autoStart) {
      this.initDynamicLeagues().then(() => {
        this.startSchedulers();
      });
    }
  }

  // =========================================================================
  // Dynamic Leagues & League Validation
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
      this.trackLeague(game, list[0].id);
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

  trackLeague(game, league) {
    if (!league) return;
    if (!this.trackedLeagues[game]) {
      this.trackedLeagues[game] = new Set();
    }
    this.trackedLeagues[game].add(league);
  }

  isValidLeague(game, league) {
    if (!league || typeof league !== 'string') return false;
    const clean = league.trim().toLowerCase();
    const list = this.leaguesList[game] || [];
    const inList = list.some(l => l.id.toLowerCase() === clean || l.name.toLowerCase() === clean);
    if (inList) return true;

    // Standard fallback allowance
    if (clean === 'standard' || clean === 'hardcore') return true;

    // Check if league exists in cached memory
    if (this.memoryCache[game]?.[league]) return true;

    return false;
  }

  // =========================================================================
  // Per-League Mutex Queue (Eliminating Lost Updates)
  // =========================================================================
  async withLeagueMutex(game, league, taskFn) {
    const key = `${game}:${league}`;
    const currentQueue = this.leagueMutexQueues.get(key) || Promise.resolve();

    let taskPromiseResolve, taskPromiseReject;
    const taskExecutionPromise = new Promise((resolve, reject) => {
      taskPromiseResolve = resolve;
      taskPromiseReject = reject;
    });

    const nextQueue = currentQueue.then(async () => {
      try {
        const result = await taskFn();
        taskPromiseResolve(result);
        return result;
      } catch (err) {
        taskPromiseReject(err);
      }
    });

    this.leagueMutexQueues.set(key, nextQueue.catch(() => {}));
    return await taskExecutionPromise;
  }

  // =========================================================================
  // Category Availability Engine (4-tier status taxonomy)
  // =========================================================================
  initAvailabilityForLeague(game, league) {
    if (!this.availabilityMap[game]) this.availabilityMap[game] = {};
    if (!this.availabilityMap[game][league]) {
      this.availabilityMap[game][league] = {};
      const registry = CategoryRegistry.getRegistry(game);
      const entry = this.memoryCache[game]?.[league];

      for (const reg of registry) {
        const cachedSource = entry?.sources?.[reg.type];
        const cachedCount = entry?.items?.filter(it => (it.sourceType || it.subCategory) === reg.type).length || 0;

        if (cachedCount > 0) {
          this.availabilityMap[game][league][reg.type] = {
            status: 'available',
            count: cachedCount,
            lastChecked: cachedSource?.updatedAt || entry?.updatedAt || new Date().toISOString()
          };
        } else if (cachedSource) {
          this.availabilityMap[game][league][reg.type] = {
            status: cachedSource.status || 'empty',
            count: cachedSource.itemsCount || 0,
            lastChecked: cachedSource.updatedAt || new Date().toISOString()
          };
        } else {
          // Unknown / unprobed
          this.availabilityMap[game][league][reg.type] = {
            status: reg.priority ? 'available' : 'unknown',
            count: 0,
            lastChecked: null
          };
        }
      }
    }
  }

  getAvailableCategories(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    this.initAvailabilityForLeague(game, targetLeague);

    const registry = CategoryRegistry.getRegistry(game);
    const leagueAvail = this.availabilityMap[game]?.[targetLeague] || {};
    const entry = this.memoryCache[game]?.[targetLeague];
    const items = entry?.items || [];

    const available = [];
    for (const reg of registry) {
      const info = leagueAvail[reg.type];
      const count = items.filter(it => (it.sourceType || it.subCategory) === reg.type).length;

      // Status must be strictly 'available' (or count > 0 from active items)
      if (info?.status === 'available' || count > 0) {
        available.push({
          type: reg.type,
          label: reg.label,
          priority: reg.priority,
          iconClass: reg.iconClass,
          count: count > 0 ? count : (info?.count || 0)
        });
      } else if (!entry && reg.priority) {
        // Uncached league priority items available for initial display
        available.push({
          type: reg.type,
          label: reg.label,
          priority: reg.priority,
          iconClass: reg.iconClass,
          count: 0
        });
      }
    }

    if (available.length === 0) {
      return registry.filter(r => r.priority).map(r => ({
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
  // Availability Discovery Pass (Breaking Circular Discovery)
  // =========================================================================
  async discoverLeagueAvailability(game, league) {
    console.log(`[CacheManager] Running Availability Discovery Pass for ${game.toUpperCase()} - "${league}"...`);
    this.trackLeague(game, league);
    this.initAvailabilityForLeague(game, league);

    const registry = CategoryRegistry.getRegistry(game);
    const chunks = [];
    for (let i = 0; i < registry.length; i += 3) {
      chunks.push(registry.slice(i, i + 3).map(r => r.type));
    }

    // Probe Currency first to establish valid rates
    if (!chunks[0]?.includes('Currency')) {
      await this.syncCategoryBatch(game, league, ['Currency']);
    }

    for (const chunk of chunks) {
      await this.syncCategoryBatch(game, league, chunk);
      await this.sleep(150);
    }

    console.log(`[CacheManager] Availability Discovery Pass completed for ${game.toUpperCase()} - "${league}".`);
    return this.getAvailableCategories(game, league);
  }

  // =========================================================================
  // Disk Persistence (Atomic Writes)
  // =========================================================================
  getCacheFilePath(game, league) {
    const safeLeague = league.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${game}_${safeLeague}.json`);
  }

  loadAllFromDisk() {
    console.log('[CacheManager] Loading cached files from disk...');
    try {
      if (!fs.existsSync(this.cacheDir)) return;
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json') && !file.endsWith('.tmp')) {
          const match = file.match(/^(poe1|poe2)_(.+)\.json$/);
          if (match) {
            const [, game, safeLeague] = match;
            const filePath = path.join(this.cacheDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            if (!this.memoryCache[game]) this.memoryCache[game] = {};
            const actualLeague = data.league || safeLeague;
            this.memoryCache[game][actualLeague] = data;
            this.trackLeague(game, actualLeague);

            if (data.snapshots && Array.isArray(data.snapshots)) {
              if (!this.snapshots[game]) this.snapshots[game] = {};
              this.snapshots[game][actualLeague] = data.snapshots;
            }

            this.initAvailabilityForLeague(game, actualLeague);

            console.log(`[CacheManager] Loaded ${game} - ${actualLeague} (${data.items?.length || 0} items, updated: ${data.updatedAt})`);
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
        const response = await this.fetchImpl(url, {
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
        return { data: null, httpCode: 0, latencyMs, error: err.message };
      }
    }
    return { data: null, httpCode: 0, latencyMs, error: 'Max retries reached' };
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
        divineVal = rawVal;
        const exRate = validatedRates.exalted || 1;
        const chRate = validatedRates.chaos || 1;

        exaltedVal = +(rawVal * exRate).toFixed(2);
        chaosVal = +(rawVal * chRate).toFixed(2);
      } else {
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
        sourceType: type,
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
  // Incremental Batch Sync with Source Locks & Per-League Merge Mutex
  // =========================================================================
  async syncCategoryBatch(game, league, types) {
    this.trackLeague(game, league);
    this.initAvailabilityForLeague(game, league);

    // 1. Pre-Condition: Ensure rates before syncing secondary categories
    const isCurrencyIncluded = types.includes('Currency');
    const existingMemory = this.memoryCache[game]?.[league];
    const hasValidRates = game === 'poe1' 
      ? (existingMemory?.rates?.divine > 0)
      : (existingMemory?.rates?.exalted > 0);

    if (!isCurrencyIncluded && !hasValidRates) {
      console.log(`[CacheManager] Core rates not ready for ${game}/${league}. Warming Currency first...`);
      await this.syncCategoryBatch(game, league, ['Currency']);
    }

    // 2. Filter out types currently locked by activeFetches
    const typesToFetch = [];
    for (const type of types) {
      const fetchKey = `${game}:${league}:${type}`;
      if (this.activeFetches.has(fetchKey)) {
        console.log(`[CacheManager] Fetch for ${fetchKey} already active in parallel, skipping duplicate.`);
      } else {
        this.activeFetches.add(fetchKey);
        typesToFetch.push(type);
      }
    }

    if (typesToFetch.length === 0) {
      return this.memoryCache[game]?.[league] || null;
    }

    const rawResults = [];

    try {
      // 3. Parallel/stepped network fetches
      for (const type of typesToFetch) {
        const url = `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${type}`;
        const res = await this.fetchJson(url);

        rawResults.push({
          type,
          url,
          res
        });

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

        await this.sleep(150);
      }
    } finally {
      // Release source fetch locks
      for (const type of typesToFetch) {
        this.activeFetches.delete(`${game}:${league}:${type}`);
      }
    }

    // 4. Critical: Serialize memory cache update and atomic disk write with Per-League Mutex!
    return await this.withLeagueMutex(game, league, async () => {
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

      const typesSet = new Set(typesToFetch);
      const keptItems = existingItems.filter(it => !typesSet.has(it.sourceType));
      const newlyNormalizedItems = [];

      for (const { type, res } of rawResults) {
        const prevSource = sourcesFreshness[type];
        const prevCount = prevSource?.itemsCount || 0;

        if (res.data) {
          const data = res.data;

          // Rate Guard validation
          if (type === 'Currency') {
            if (game === 'poe1') {
              const candidateRate = data.core?.rates?.divine;
              const check = ConversionMath.validateRate(candidateRate, currentRates.divine);
              currentRates.divine = check.rate;
              currentRates.chaosToDivine = check.rate;
              currentRates.isStale = check.isStale;
              if (check.isAnomaly || !check.valid) {
                console.warn(`[CacheManager] PoE1 Divine Rate Guard: ${check.reason}. Preserved: ${check.rate}`);
                currentRates.staleReason = check.reason;
              }
            } else if (game === 'poe2') {
              const exaltedLine = data.lines?.find(l => l.id === 'exalted');
              const candidateExalted = ConversionMath.derivePoE2ExaltedRate(data.core?.rates, exaltedLine);
              const checkExalted = ConversionMath.validateRate(candidateExalted, currentRates.exalted);
              currentRates.exalted = checkExalted.rate;
              currentRates.isStale = checkExalted.isStale;

              if (data.core?.rates?.chaos) {
                const checkChaos = ConversionMath.validateRate(data.core.rates.chaos, currentRates.chaos);
                currentRates.chaos = checkChaos.rate;
                if (checkChaos.isAnomaly || !checkChaos.valid) {
                  console.warn(`[CacheManager] PoE2 Chaos Rate Guard: ${checkChaos.reason}. Preserved: ${checkChaos.rate}`);
                }
              }

              currentRates.divine = 1;
              if (checkExalted.isAnomaly || !checkExalted.valid) {
                console.warn(`[CacheManager] PoE2 Exalted Rate Guard: ${checkExalted.reason}. Preserved: ${checkExalted.rate}`);
                currentRates.staleReason = checkExalted.reason;
              }
            }
          }

          const normalized = this.normalizeExchangeData(data, type, game, league, currentRates);
          newlyNormalizedItems.push(...normalized);

          // 4-tier status taxonomy
          let status = 'empty';
          if (normalized.length > 0) {
            status = 'available';
          } else if (prevCount > 0) {
            status = 'available';
          }

          sourcesFreshness[type] = {
            updatedAt: new Date().toISOString(),
            status,
            itemsCount: normalized.length,
            latencyMs: res.latencyMs
          };

          this.availabilityMap[game][league][type] = {
            status,
            count: normalized.length,
            lastChecked: new Date().toISOString()
          };

          const mirrorItem = normalized.find(i => i.key === 'mirror' || i.name.toLowerCase().includes('mirror'));
          if (mirrorItem) {
            mirrorRate = mirrorItem.chaosValue || mirrorItem.divineValue;
          }
        } else {
          // Source returned 404 or error
          let status = 'error';
          if (res.httpCode === 404) {
            status = 'unsupported';
          } else if (res.httpCode >= 500 || res.httpCode === 0) {
            status = 'transient_error';
          }

          if (status === 'transient_error' && prevCount > 0) {
            status = 'available';
          }

          sourcesFreshness[type] = {
            updatedAt: new Date().toISOString(),
            status,
            itemsCount: 0,
            latencyMs: res.latencyMs,
            error: res.error
          };

          this.availabilityMap[game][league][type] = {
            status,
            count: 0,
            lastChecked: new Date().toISOString()
          };
        }
      }

      // Merge keptItems and newlyNormalizedItems, deduplicate by item id
      const uniqueMap = new Map();
      for (const it of [...keptItems, ...newlyNormalizedItems]) {
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

      console.log(`[CacheManager] [${game.toUpperCase()} - ${league}] Merged [${typesToFetch.join(', ')}]: ${finalItems.length} items total.`);
      return updatedEntry;
    });
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
  // True "Refresh All Available"
  // =========================================================================
  async refreshAllAvailable(targetGame = null, targetLeague = null) {
    console.log(`[CacheManager] Starting True "Refresh All Available" for ${targetGame || 'all games'}...`);
    const games = targetGame ? [targetGame] : ['poe1', 'poe2'];

    for (const game of games) {
      const leagues = targetLeague ? [targetLeague] : Array.from(this.trackedLeagues[game] || [this.getActiveLeague(game)]);
      for (const league of leagues) {
        const available = this.getAvailableCategories(game, league);
        const types = available.map(c => c.type);
        if (types.length > 0) {
          console.log(`[CacheManager] Refreshing all ${types.length} available categories for ${game.toUpperCase()} - ${league}...`);
          const nonCurrency = types.filter(t => t !== 'Currency');
          if (types.includes('Currency')) {
            await this.syncCategoryBatch(game, league, ['Currency']);
          }
          for (let i = 0; i < nonCurrency.length; i += 2) {
            await this.syncCategoryBatch(game, league, nonCurrency.slice(i, i + 2));
            await this.sleep(200);
          }
        }
      }
    }
    console.log('[CacheManager] True "Refresh All Available" completed.');
  }

  // =========================================================================
  // Dynamic Schedulers with Differentiated Cadence & Clean Lifecycle
  // =========================================================================
  startSchedulers() {
    this.stopSchedulers();

    // 1. PoE 1 Priority Scheduler (Every 30 minutes)
    this.poe1PriorityTimer = setInterval(async () => {
      await this.refreshPriorityForGame('poe1');
    }, POE1_PRIORITY_INTERVAL_MS);

    // 2. PoE 1 Rotation Scheduler (Every 5 minutes)
    this.poe1RotationTimer = setInterval(async () => {
      await this.stepRotationForGame('poe1');
    }, POE1_ROTATION_INTERVAL_MS);

    // 3. PoE 2 Priority Scheduler (Every 30 minutes)
    this.poe2PriorityTimer = setInterval(async () => {
      await this.refreshPriorityForGame('poe2');
    }, POE2_PRIORITY_INTERVAL_MS);

    // 4. PoE 2 Rotation Scheduler (Every 10 minutes)
    this.poe2RotationTimer = setInterval(async () => {
      await this.stepRotationForGame('poe2');
    }, POE2_ROTATION_INTERVAL_MS);

    // 5. Periodic League Refresh (Every 1 hour)
    this.leagueRefreshTimer = setInterval(async () => {
      await this.initDynamicLeagues();
    }, LEAGUE_REFRESH_INTERVAL_MS);

    console.log('[CacheManager] Schedulers active: PoE1 (Priority 30m, Rotation 5m), PoE2 (Priority 30m, Rotation 10m), Leagues 1h.');
  }

  stopSchedulers() {
    if (this.poe1PriorityTimer) clearInterval(this.poe1PriorityTimer);
    if (this.poe1RotationTimer) clearInterval(this.poe1RotationTimer);
    if (this.poe2PriorityTimer) clearInterval(this.poe2PriorityTimer);
    if (this.poe2RotationTimer) clearInterval(this.poe2RotationTimer);
    if (this.leagueRefreshTimer) clearInterval(this.leagueRefreshTimer);
    this.poe1PriorityTimer = null;
    this.poe1RotationTimer = null;
    this.poe2PriorityTimer = null;
    this.poe2RotationTimer = null;
    this.leagueRefreshTimer = null;
  }

  async stepRotationForGame(game) {
    const tracked = Array.from(this.trackedLeagues[game] || [this.getActiveLeague(game)]);
    for (const league of tracked) {
      const batches = this.getRotationBatches(game, league);
      const key = `${game}_${league}`;
      const currentIndex = (this.rotationIndices[key] || 0) % batches.length;
      this.rotationIndices[key] = currentIndex + 1;

      const currentBatch = batches[currentIndex];
      if (currentBatch && currentBatch.length > 0) {
        console.log(`[CacheManager] Rotation [${game.toUpperCase()} - ${league}]: Batch [${currentBatch.join(', ')}]`);
        await this.syncCategoryBatch(game, league, currentBatch);
      }
    }
    this.lastRotationTime = new Date().toISOString();
  }

  async refreshPriorityForGame(game) {
    const tracked = Array.from(this.trackedLeagues[game] || [this.getActiveLeague(game)]);
    for (const league of tracked) {
      const priorityTypes = this.getPriorityTypes(game, league);
      if (priorityTypes.length > 0) {
        console.log(`[CacheManager] Priority [${game.toUpperCase()} - ${league}]: [${priorityTypes.join(', ')}]`);
        await this.syncCategoryBatch(game, league, priorityTypes);
      }
    }
    this.lastPriorityTime = new Date().toISOString();
  }

  async stepRotation() {
    await this.stepRotationForGame('poe1');
    await this.stepRotationForGame('poe2');
  }

  async refreshPriority() {
    await this.refreshPriorityForGame('poe1');
    await this.refreshPriorityForGame('poe2');
  }

  async refreshAll() {
    await this.refreshAllAvailable();
  }

  // =========================================================================
  // Non-Silent League Warming & Retrieval
  // =========================================================================
  ensureLeagueCache(game, league) {
    this.trackLeague(game, league);
    console.log(`[CacheManager] Warming cache & discovering categories for ${game.toUpperCase()} - "${league}"...`);
    this.discoverLeagueAvailability(game, league).catch(err => {
      console.error(`[CacheManager] Warming/Discovery failed for ${game}/${league}:`, err.message);
    });
  }

  getData(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    this.trackLeague(game, targetLeague);
    const entry = this.memoryCache[game]?.[targetLeague];

    if (entry && entry.items && entry.items.length > 0) {
      return {
        status: 'ready',
        ...entry
      };
    }

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
      message: `Đang tải dữ liệu và khám phá các danh mục khả dụng cho league "${targetLeague}"... Vui lòng đợi trong giây lát.`
    };
  }

  getNextRotationBatch(game, league) {
    const batches = this.getRotationBatches(game, league);
    const key = `${game}_${league}`;
    const currentIndex = (this.rotationIndices[key] || 0) % batches.length;
    return batches[currentIndex] || [];
  }

  getStatus() {
    const p1League = this.getActiveLeague('poe1');
    const p2League = this.getActiveLeague('poe2');

    return {
      status: 'ok',
      isRefreshing: this.activeFetches.size > 0,
      activeJobs: Array.from(this.activeFetches),
      priorityIntervalMinutes: { poe1: 30, poe2: 30 },
      rotationIntervalMinutes: { poe1: 5, poe2: 10 },
      activeLeagues: this.activeLeagues,
      trackedLeagues: {
        poe1: Array.from(this.trackedLeagues.poe1),
        poe2: Array.from(this.trackedLeagues.poe2)
      },
      lastPriorityTime: this.lastPriorityTime,
      lastRotationTime: this.lastRotationTime,
      nextRotationBatch: {
        poe1: this.getNextRotationBatch('poe1', p1League),
        poe2: this.getNextRotationBatch('poe2', p2League)
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

const defaultInstance = new CacheManager();
defaultInstance.CacheManager = CacheManager;
module.exports = defaultInstance;
