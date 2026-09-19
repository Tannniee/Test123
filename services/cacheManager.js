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
const USER_AGENT = 'PoE-QuickPriceChecker/2.0.1 (Local desktop tool)';

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

    this.timeoutMs = options.timeoutMs || 12000;

    // Concurrency & Operation Tracking Maps / Sets
    this.activeFetches = new Map();     // Key: `${game}:${league}:${type}` -> Promise (Single-flight)
    this.refreshJobs = new Map();       // Key: `${game}:${league}` -> Promise (Single-flight)
    this.activeMerges = new Set();      // Key: `${game}:${league}`
    this.activeDiscoveries = new Set(); // Key: `${game}:${league}`
    this.activeRefreshAll = new Set();  // Key: jobId

    // Discovery Single-Flight Map (Key: `${game}:${league}` -> Promise)
    this.discoveryJobs = new Map();

    // Per-league merge mutex queues (Key: `${game}:${league}` -> Promise)
    this.leagueMutexQueues = new Map();

    // Active & Tracked Leagues (Cleanly decoupled from disk cache history)
    this.activeLeagues = {
      poe1: 'Allflame',
      poe2: 'Forbidden Rites'
    };

    this.activeUserLeagues = {
      poe1: null,
      poe2: null
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
    this.schedulersActive = false;
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
        if (this.autoStart) {
          this.startSchedulers();
        }
      });
    }
  }

  // =========================================================================
  // Dynamic Leagues & League Pruning
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
      this.syncTrackedLeagues(game);
      console.log(`[CacheManager] Dynamic active league for ${game.toUpperCase()}: "${this.activeLeagues[game]}"`);

      // Proactively guarantee priority Currency is loaded for active league
      const activeLg = this.activeLeagues[game];
      const entry = this.memoryCache[game]?.[activeLg];
      const hasCurrency = entry?.items?.some(it => (it.sourceType || it.category) === 'Currency');
      if (!hasCurrency) {
        console.log(`[CacheManager] Active league ${game.toUpperCase()} - "${activeLg}" lacks Currency in cache, initiating immediate sync...`);
        this.syncCategoryBatch(game, activeLg, ['Currency']).catch(e => {
          console.error(`[CacheManager] Startup Currency sync failed for ${game}/${activeLg}:`, e.message);
        });
      }
    } else {
      console.warn(`[CacheManager] Could not fetch dynamic leagues for ${game}, using fallback defaults.`);
      const activeLg = this.getActiveLeague(game);
      const entry = this.memoryCache[game]?.[activeLg];
      const hasCurrency = entry?.items?.some(it => (it.sourceType || it.category) === 'Currency');
      if (!hasCurrency) {
        console.log(`[CacheManager] Fallback active league ${game.toUpperCase()} - "${activeLg}" lacks Currency, syncing...`);
        this.syncCategoryBatch(game, activeLg, ['Currency']).catch(e => {
          console.error(`[CacheManager] Startup Currency sync failed for ${game}/${activeLg}:`, e.message);
        });
      }
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
    this.activeUserLeagues[game] = league;
    this.trackedLeagues[game].add(league);
  }

  syncTrackedLeagues(game) {
    const currentActive = this.activeLeagues[game];
    const userActive = this.activeUserLeagues[game];
    const knownLeagues = new Set((this.leaguesList[game] || []).map(l => l.id));
    knownLeagues.add('Standard');
    knownLeagues.add('Hardcore');

    const nextTracked = new Set();
    if (currentActive) nextTracked.add(currentActive);
    nextTracked.add('Standard');
    if (userActive && knownLeagues.has(userActive)) {
      nextTracked.add(userActive);
    }

    this.trackedLeagues[game] = nextTracked;
    console.log(`[CacheManager] Tracked leagues for ${game.toUpperCase()} synced & pruned: [${Array.from(nextTracked).join(', ')}]`);
  }

  isValidLeague(game, league) {
    if (!league || typeof league !== 'string') return false;
    const clean = league.trim().toLowerCase();
    const list = this.leaguesList[game] || [];
    const inList = list.some(l => l.id.toLowerCase() === clean || l.name.toLowerCase() === clean);
    if (inList) return true;

    if (clean === 'standard' || clean === 'hardcore') return true;
    if (this.memoryCache[game]?.[league]) return true;

    return false;
  }

  // =========================================================================
  // Per-League Mutex Queue (Eliminating Lost Updates)
  // =========================================================================
  async withLeagueMutex(game, league, taskFn) {
    const key = `${game}:${league}`;
    this.activeMerges.add(key);
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
      } finally {
        this.activeMerges.delete(key);
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

      if (info?.status === 'unsupported') {
        continue;
      }

      available.push({
        type: reg.type,
        label: reg.label,
        group: reg.group || 'general',
        priority: reg.priority,
        iconClass: reg.iconClass,
        count: count > 0 ? count : (info?.count || 0)
      });
    }

    if (available.length === 0) {
      return registry.filter(r => r.priority).map(r => ({
        type: r.type,
        label: r.label,
        group: r.group || 'general',
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
  // Availability Discovery Pass with Single-Flight Deduplication
  // =========================================================================
  async discoverLeagueAvailability(game, league) {
    const key = `${game}:${league}`;
    if (this.discoveryJobs.has(key)) {
      console.log(`[CacheManager] Discovery for ${key} already running, attaching to existing job.`);
      return await this.discoveryJobs.get(key);
    }

    const jobPromise = (async () => {
      console.log(`[CacheManager] Running Availability Discovery Pass for ${game.toUpperCase()} - "${league}"...`);
      this.trackLeague(game, league);
      this.initAvailabilityForLeague(game, league);
      this.activeDiscoveries.add(key);

      try {
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
      } finally {
        this.discoveryJobs.delete(key);
        this.activeDiscoveries.delete(key);
      }
    })();

    this.discoveryJobs.set(key, jobPromise);
    return await jobPromise;
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
            try {
              const content = fs.readFileSync(filePath, 'utf-8');
              const data = JSON.parse(content);

              if (!this.memoryCache[game]) this.memoryCache[game] = {};
              const actualLeague = data.league || safeLeague;
              this.memoryCache[game][actualLeague] = data;

              if (data.snapshots && Array.isArray(data.snapshots)) {
                if (!this.snapshots[game]) this.snapshots[game] = {};
                this.snapshots[game][actualLeague] = data.snapshots;
              }

              // Populate diagnostics from cached sources
              if (data.sources) {
                if (!this.diagnostics[game]) this.diagnostics[game] = {};
                if (!this.diagnostics[game][actualLeague]) this.diagnostics[game][actualLeague] = {};
                for (const [sType, sData] of Object.entries(data.sources)) {
                  this.diagnostics[game][actualLeague][sType] = {
                    type: sType,
                    httpCode: sData.status === 'unsupported' ? 404 : 200,
                    latencyMs: sData.latencyMs || 100,
                    itemsCount: sData.itemsCount || 0,
                    status: sData.status || 'available',
                    lastUpdated: sData.updatedAt || data.updatedAt
                  };
                }
              }

              this.initAvailabilityForLeague(game, actualLeague);

              console.log(`[CacheManager] Loaded ${game} - ${actualLeague} (${data.items?.length || 0} items, updated: ${data.updatedAt})`);
            } catch (fileErr) {
              console.warn(`[CacheManager] Warning: Skipped corrupt cache file "${file}": ${fileErr.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('[CacheManager] Error reading cache directory:', err.message);
    }
  }

  async saveToDisk(game, league, data) {
    const filePath = this.getCacheFilePath(game, league);
    const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    try {
      const payload = data !== undefined ? data : this.memoryCache[game]?.[league];
      if (!payload) return;
      const json = JSON.stringify(payload, null, 2);
      await fs.promises.writeFile(tmpPath, json, 'utf-8');
      await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
      console.error(`[CacheManager] Async atomic write failed for ${game}/${league}:`, err.message);
      try {
        if (fs.existsSync(tmpPath)) {
          await fs.promises.unlink(tmpPath);
        }
      } catch (e) {}
    }
  }

  // =========================================================================
  // HTTP Fetching with Exponential Backoff
  // =========================================================================
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchJson(url, retries = 2, delays = [1000, 2500]) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const start = Date.now();
      try {
        const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(this.timeoutMs || 12000)
          : undefined;

        const response = await this.fetchImpl(url, {
          signal,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          }
        });
        const latencyMs = Date.now() - start;

        if (!response.ok) {
          // Handle HTTP 429 Too Many Requests with Retry-After or exponential backoff
          if (response.status === 429 && attempt < retries) {
            let delayMs = delays[attempt] || 2000;
            const retryAfterHeader = response.headers?.get?.('retry-after');
            if (retryAfterHeader) {
              const parsedSec = parseInt(retryAfterHeader, 10);
              if (!isNaN(parsedSec) && parsedSec > 0) {
                delayMs = Math.min(parsedSec * 1000, 30000);
              }
            }
            console.warn(`[CacheManager] HTTP 429 Rate Limit for ${url}. Backing off for ${delayMs}ms (attempt ${attempt + 1}/${retries})...`);
            await this.sleep(delayMs);
            continue;
          }

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
        const isAbort = err.name === 'TimeoutError' || err.name === 'AbortError';
        if (attempt < retries) {
          console.warn(`[CacheManager] Request error (${isAbort ? 'Timeout' : err.message}) for ${url}. Retrying in ${delays[attempt]}ms...`);
          await this.sleep(delays[attempt]);
          continue;
        }
        return { data: null, httpCode: isAbort ? 408 : 0, latencyMs, error: isAbort ? 'Request Timeout' : err.message };
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
        const exRate = validatedRates.exalted || 0;
        const chRate = validatedRates.chaos || 0;

        // Strictly avoid fake 1:1 conversion if live rates are not yet available
        exaltedVal = exRate > 0 ? +(rawVal * exRate).toFixed(2) : 0;
        chaosVal = chRate > 0 ? +(rawVal * chRate).toFixed(2) : 0;
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

  normalizeStashItemData(raw, type, game, league, validatedRates = {}) {
    if (!raw || !raw.lines) return [];

    const results = [];
    for (const line of raw.lines) {
      if (!line || !line.name) continue;

      let icon = line.icon || '';
      if (icon && !icon.startsWith('http')) {
        icon = `https://web.poecdn.com${icon}`;
      }

      let chaosVal = 0;
      let divineVal = 0;
      let exaltedVal = 0;

      if (game === 'poe2') {
        const rawVal = typeof line.primaryValue === 'number' ? line.primaryValue : 0;
        divineVal = rawVal;
        const exRate = validatedRates.exalted || 0;
        const chRate = validatedRates.chaos || 0;
        exaltedVal = exRate > 0 ? +(rawVal * exRate).toFixed(2) : 0;
        chaosVal = chRate > 0 ? +(rawVal * chRate).toFixed(2) : 0;
      } else {
        chaosVal = typeof line.chaosValue === 'number' ? line.chaosValue : (typeof line.primaryValue === 'number' ? line.primaryValue : 0);
        divineVal = typeof line.divineValue === 'number' ? line.divineValue : 0;
        if (divineVal === 0 && validatedRates.divine > 0) {
          divineVal = +(chaosVal * validatedRates.divine).toFixed(2);
        }
        exaltedVal = typeof line.exaltedValue === 'number' ? line.exaltedValue : 0;
      }

      const sparklineData = line.sparkLine?.data || line.sparkline?.data || [];
      const change7d = line.sparkLine?.totalChange ?? line.sparkline?.totalChange ?? 0;
      const volume = line.listingCount || line.count || 0;

      let category = CategoryRegistry.getLabel(game, type);
      let subCategory = line.baseType || type;
      if (line.mapTier) {
        subCategory = `Tier ${line.mapTier}`;
      }

      const explicitMods = Array.isArray(line.explicitModifiers)
        ? line.explicitModifiers.map(m => typeof m === 'object' && m !== null ? (m.text || '') : String(m)).filter(Boolean)
        : [];
      const implicitMods = Array.isArray(line.implicitModifiers)
        ? line.implicitModifiers.map(m => typeof m === 'object' && m !== null ? (m.text || '') : String(m)).filter(Boolean)
        : [];

      results.push({
        id: `${game}_${line.id || line.detailsId}_${type}`,
        key: String(line.id || line.detailsId),
        name: line.name,
        category: category,
        subCategory: subCategory,
        sourceType: type,
        icon: icon,
        chaosValue: chaosVal,
        divineValue: divineVal,
        exaltedValue: exaltedVal,
        primaryCurrency: game === 'poe2' ? 'divine' : 'chaos',
        change7d: change7d,
        sparkline: sparklineData,
        volume: volume,
        baseType: line.baseType || line.name,
        mapTier: line.mapTier || null,
        variant: line.variant || '',
        itemClass: line.itemClass || null,
        levelRequired: line.levelRequired || null,
        links: line.links || null,
        explicitModifiers: explicitMods,
        implicitModifiers: implicitMods,
        flavourText: line.flavourText || '',
        detailsId: line.detailsId || String(line.id),
        game,
        league,
        source: 'stash'
      });
    }

    return results;
  }

  // =========================================================================
  // Single-Flight Category Fetcher (Deduplicates concurrent requests for the same source)
  // =========================================================================
  async fetchCategorySingleFlight(game, league, type) {
    const fetchKey = `${game}:${league}:${type}`;
    if (this.activeFetches.has(fetchKey)) {
      console.log(`[CacheManager] Joining active single-flight fetch for "${fetchKey}"...`);
      return await this.activeFetches.get(fetchKey);
    }

    const fetchPromise = (async () => {
      const def = CategoryRegistry.getDefinition(game, type);
      const apiSource = def?.apiSource || 'exchange';
      let url;
      if (apiSource === 'stash') {
        url = `https://poe.ninja/${game}/api/economy/stash/current/item/overview?league=${encodeURIComponent(league)}&type=${type}`;
      } else {
        url = `https://poe.ninja/${game}/api/economy/exchange/current/overview?league=${encodeURIComponent(league)}&type=${type}`;
      }
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

      return {
        type,
        apiSource,
        url,
        res
      };
    })();

    this.activeFetches.set(fetchKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this.activeFetches.delete(fetchKey);
    }
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

    // 2. Fetch all requested categories using Single-Flight Map
    const rawResults = [];
    for (const type of types) {
      const singleFlightResult = await this.fetchCategorySingleFlight(game, league, type);
      rawResults.push(singleFlightResult);
      await this.sleep(50);
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

      const typesSet = new Set(types);
      
      // Index previous items by sourceType to guarantee resilient per-category merging
      const existingByType = new Map();
      for (const it of existingItems) {
        const srcType = it.sourceType || it.category;
        if (!existingByType.has(srcType)) {
          existingByType.set(srcType, []);
        }
        existingByType.get(srcType).push(it);
      }

      // Categories that were NOT fetched in this batch are strictly preserved
      const preservedItems = [];
      for (const [srcType, items] of existingByType.entries()) {
        if (!typesSet.has(srcType)) {
          preservedItems.push(...items);
        }
      }

      const newlyProcessedItems = [];

      for (const { type, res } of rawResults) {
        const prevSource = sourcesFreshness[type];
        const prevItems = existingByType.get(type) || [];
        const prevCount = prevSource?.itemsCount || prevItems.length;

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

              let checkChaos = { isStale: false, rate: currentRates.chaos };
              if (data.core?.rates?.chaos) {
                checkChaos = ConversionMath.validateRate(data.core.rates.chaos, currentRates.chaos);
                currentRates.chaos = checkChaos.rate;
                if (checkChaos.isAnomaly || !checkChaos.valid) {
                  console.warn(`[CacheManager] PoE2 Chaos Rate Guard: ${checkChaos.reason}. Preserved: ${checkChaos.rate}`);
                }
              }

              currentRates.isStale = !!(checkExalted.isStale || checkChaos.isStale);
              currentRates.divine = 1;

              if (checkExalted.isAnomaly || !checkExalted.valid) {
                console.warn(`[CacheManager] PoE2 Exalted Rate Guard: ${checkExalted.reason}. Preserved: ${checkExalted.rate}`);
                currentRates.staleReason = checkExalted.reason;
              }
            }
          }

          const def = CategoryRegistry.getDefinition(game, type);
          const apiSource = def?.apiSource || 'exchange';
          let normalized;
          if (apiSource === 'stash') {
            normalized = this.normalizeStashItemData(data, type, game, league, currentRates);
          } else {
            normalized = this.normalizeExchangeData(data, type, game, league, currentRates);
          }
          // 4-tier status taxonomy & resilient empty-200 handling
          let itemsCount = normalized.length;
          let isStale = false;
          let status = 'empty';

          if (normalized.length > 0) {
            newlyProcessedItems.push(...normalized);
            status = 'available';
            itemsCount = normalized.length;
          } else if (prevItems.length > 0) {
            // Category previously had valid items, but upstream 200 response returned 0 items.
            // Rather than wiping items while falsely claiming 'available' with 0 count,
            // preserve existing items and flag as stale.
            newlyProcessedItems.push(...prevItems);
            status = 'available';
            itemsCount = prevItems.length;
            isStale = true;
            console.warn(`[CacheManager] Preserved ${prevItems.length} cached items for ${game}/${league}/${type} due to unexpected zero-result 200 response (marked stale).`);
          } else {
            // Truly empty category
            status = 'empty';
            itemsCount = 0;
            isStale = false;
          }

          sourcesFreshness[type] = {
            updatedAt: new Date().toISOString(),
            status,
            itemsCount,
            latencyMs: res.latencyMs,
            isStale
          };

          this.availabilityMap[game][league][type] = {
            status,
            count: itemsCount,
            lastChecked: new Date().toISOString()
          };

          // Protect Mirror rate: Only Currency source can update Mirror of Kalandra rate (exact identity check)
          if (type === 'Currency') {
            const mirrorItem = normalized.find(i => 
              i.name === 'Mirror of Kalandra' || 
              i.key === 'mirror-of-kalandra' || 
              i.id === 'currency-mirror-of-kalandra' ||
              i.key === 'mirror'
            );
            if (mirrorItem && (mirrorItem.chaosValue > 0 || mirrorItem.divineValue > 0)) {
              mirrorRate = mirrorItem.chaosValue || mirrorItem.divineValue;
            }
          }
        } else {
          // Source returned 404 or error
          let status = 'error';
          const isTransient = res.httpCode >= 500 || res.httpCode === 429 || res.httpCode === 0 || !res.httpCode;
          
          if (res.httpCode === 404) {
            status = 'unsupported';
          } else if (isTransient) {
            status = 'transient_error';
          }

          // Resilient Cache: If transient error and previous valid items exist, PRESERVE them!
          if (status === 'transient_error' && prevItems.length > 0) {
            newlyProcessedItems.push(...prevItems);
            status = 'available';
            console.warn(`[CacheManager] Preserved ${prevItems.length} cached items for ${game}/${league}/${type} during transient error (${res.error || res.httpCode || 'network'})`);
          }

          sourcesFreshness[type] = {
            updatedAt: prevSource?.updatedAt || new Date().toISOString(),
            status,
            itemsCount: (status === 'available' && prevItems.length > 0) ? prevItems.length : 0,
            latencyMs: res.latencyMs,
            error: res.error,
            isStale: status === 'available' && prevItems.length > 0
          };

          this.availabilityMap[game][league][type] = {
            status,
            count: (status === 'available' && prevItems.length > 0) ? prevItems.length : 0,
            lastChecked: new Date().toISOString()
          };
        }
      }

      // Merge preservedItems and newlyProcessedItems, deduplicate by item id
      const uniqueMap = new Map();
      for (const it of [...preservedItems, ...newlyProcessedItems]) {
        uniqueMap.set(it.id, it);
      }
      const finalItems = Array.from(uniqueMap.values());

      // Record live diagnostics
      if (!this.diagnostics[game]) this.diagnostics[game] = {};
      if (!this.diagnostics[game][league]) this.diagnostics[game][league] = {};
      for (const { type, res } of rawResults) {
        const src = sourcesFreshness[type];
        if (src) {
          this.diagnostics[game][league][type] = {
            type,
            httpCode: res.httpCode || (src.status === 'unsupported' ? 404 : 200),
            latencyMs: res.latencyMs || src.latencyMs || 0,
            itemsCount: src.itemsCount || 0,
            status: src.status,
            lastUpdated: src.updatedAt
          };
        }
      }

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
      await this.saveToDisk(game, league, updatedEntry);

      console.log(`[CacheManager] [${game.toUpperCase()} - ${league}] Merged [${types.join(', ')}]: ${finalItems.length} items total.`);
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
  // True "Refresh All Available" (Single-Flight deduplicated)
  // =========================================================================
  isRefreshRunning(targetGame = null, targetLeague = null) {
    const specificKey = `${targetGame || 'all'}:${targetLeague || 'all'}`;
    return this.refreshJobs.has(specificKey) || this.refreshJobs.has('all:all');
  }

  async refreshAllAvailable(targetGame = null, targetLeague = null) {
    const jobKey = `${targetGame || 'all'}:${targetLeague || 'all'}`;

    if (this.refreshJobs.has(jobKey)) {
      console.log(`[CacheManager] Full refresh job for "${jobKey}" already running, attaching to existing job...`);
      return await this.refreshJobs.get(jobKey);
    }
    if (this.refreshJobs.has('all:all')) {
      console.log(`[CacheManager] Global refresh job "all:all" already running, attaching...`);
      return await this.refreshJobs.get('all:all');
    }

    const jobPromise = (async () => {
      this.activeRefreshAll.add(jobKey);
      try {
        console.log(`[CacheManager] Starting True "Refresh All Available" for ${jobKey}...`);
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
        console.log(`[CacheManager] True "Refresh All Available" completed for ${jobKey}.`);
        return { success: true, target: jobKey };
      } finally {
        this.activeRefreshAll.delete(jobKey);
        this.refreshJobs.delete(jobKey);
      }
    })();

    this.refreshJobs.set(jobKey, jobPromise);
    return await jobPromise;
  }

  // =========================================================================
  // Dynamic Schedulers with Non-Overlapping Locks & Clean Lifecycle
  // =========================================================================
  scheduleNonOverlappingTask(taskName, fn, intervalMs) {
    let timer = null;
    let isRunning = false;

    const tick = async () => {
      if (!this.schedulersActive) return;
      if (isRunning) {
        console.warn(`[CacheManager] Scheduler "${taskName}" execution took longer than interval (${intervalMs}ms). Skipping tick to prevent overlap.`);
        return;
      }
      isRunning = true;
      try {
        await fn();
      } catch (err) {
        console.error(`[CacheManager] Scheduler "${taskName}" error:`, err.message);
      } finally {
        isRunning = false;
        if (this.schedulersActive) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    timer = setTimeout(tick, intervalMs);
    return {
      stop: () => {
        if (timer) clearTimeout(timer);
        timer = null;
      },
      isRunning: () => isRunning
    };
  }

  startSchedulers() {
    this.stopSchedulers();
    this.schedulersActive = true;

    // 1. PoE 1 Priority Scheduler (Every 30 minutes)
    this.poe1PriorityTimer = this.scheduleNonOverlappingTask('poe1-priority', async () => {
      await this.refreshPriorityForGame('poe1');
    }, POE1_PRIORITY_INTERVAL_MS);

    // 2. PoE 1 Rotation Scheduler (Every 5 minutes)
    this.poe1RotationTimer = this.scheduleNonOverlappingTask('poe1-rotation', async () => {
      await this.stepRotationForGame('poe1');
    }, POE1_ROTATION_INTERVAL_MS);

    // 3. PoE 2 Priority Scheduler (Every 30 minutes)
    this.poe2PriorityTimer = this.scheduleNonOverlappingTask('poe2-priority', async () => {
      await this.refreshPriorityForGame('poe2');
    }, POE2_PRIORITY_INTERVAL_MS);

    // 4. PoE 2 Rotation Scheduler (Every 10 minutes)
    this.poe2RotationTimer = this.scheduleNonOverlappingTask('poe2-rotation', async () => {
      await this.stepRotationForGame('poe2');
    }, POE2_ROTATION_INTERVAL_MS);

    // 5. Periodic League Refresh (Every 1 hour)
    this.leagueRefreshTimer = this.scheduleNonOverlappingTask('league-refresh', async () => {
      await this.initDynamicLeagues();
    }, LEAGUE_REFRESH_INTERVAL_MS);

    console.log('[CacheManager] Schedulers active: PoE1 (Priority 30m, Rotation 5m), PoE2 (Priority 30m, Rotation 10m), Leagues 1h.');
  }

  stopSchedulers() {
    this.autoStart = false;
    this.schedulersActive = false;
    if (this.poe1PriorityTimer) this.poe1PriorityTimer.stop();
    if (this.poe1RotationTimer) this.poe1RotationTimer.stop();
    if (this.poe2PriorityTimer) this.poe2PriorityTimer.stop();
    if (this.poe2RotationTimer) this.poe2RotationTimer.stop();
    if (this.leagueRefreshTimer) this.leagueRefreshTimer.stop();
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
  // Non-Silent League Warming & Lifecycle Status Retrieval
  // =========================================================================
  ensureLeagueCache(game, league) {
    this.trackLeague(game, league);
    const key = `${game}:${league}`;
    if (this.discoveryJobs.has(key)) {
      return this.discoveryJobs.get(key);
    }

    console.log(`[CacheManager] Warming cache & discovering categories for ${game.toUpperCase()} - "${league}"...`);
    return this.discoverLeagueAvailability(game, league).catch(err => {
      console.error(`[CacheManager] Warming/Discovery failed for ${game}/${league}:`, err.message);
    });
  }

  getData(game = 'poe1', league = null) {
    const targetLeague = league || this.getActiveLeague(game);
    this.trackLeague(game, targetLeague);
    const discoveryKey = `${game}:${targetLeague}`;
    const isDiscovering = this.discoveryJobs.has(discoveryKey);
    const entry = this.memoryCache[game]?.[targetLeague];

    // Explicit Lifecycle Status: Return 'discovering' if background discovery pass is actively running
    if (isDiscovering) {
      return {
        status: 'discovering',
        game,
        league: targetLeague,
        updatedAt: entry?.updatedAt || null,
        divinePriceInChaos: entry?.divinePriceInChaos || (game === 'poe2' ? 1 : 0),
        mirrorPriceInChaos: entry?.mirrorPriceInChaos || 0,
        rates: entry?.rates || {},
        count: entry?.items?.length || 0,
        items: entry?.items || [],
        message: `Đang khám phá danh mục thị trường cho league "${targetLeague}"... Vui lòng đợi trong giây lát.`
      };
    }

    // Only return 'ready' when discovery is NOT running and cache entry is ready with items INCLUDING priority Currency
    const hasCurrency = entry?.items?.some(it => (it.sourceType || it.category) === 'Currency');
    if (entry && entry.items && entry.items.length > 0 && hasCurrency) {
      return {
        status: 'ready',
        ...entry
      };
    }

    if (entry && entry.items && entry.items.length > 0 && !hasCurrency) {
      // Entry has other categories but lacks Currency - fetch Currency actively
      this.syncCategoryBatch(game, targetLeague, ['Currency']).catch(e => {
        console.error(`[CacheManager] On-demand Currency sync failed for ${game}/${targetLeague}:`, e.message);
      });
      return {
        status: 'warming',
        game,
        league: targetLeague,
        updatedAt: entry?.updatedAt || null,
        divinePriceInChaos: entry?.divinePriceInChaos || (game === 'poe2' ? 1 : 0),
        mirrorPriceInChaos: entry?.mirrorPriceInChaos || 0,
        rates: entry?.rates || {},
        count: entry?.items?.length || 0,
        items: entry?.items || [],
        message: `Đang nạp dữ liệu Currency cho league "${targetLeague}"... Vui lòng đợi trong giây lát.`
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
      message: `Đang nạp dữ liệu khởi tạo cho league "${targetLeague}"... Vui lòng đợi trong giây lát.`
    };
  }

  getNextRotationBatch(game, league) {
    const batches = this.getRotationBatches(game, league);
    const key = `${game}_${league}`;
    const currentIndex = (this.rotationIndices[key] || 0) % batches.length;
    return batches[currentIndex] || [];
  }

  get isRefreshing() {
    return this.activeFetches.size > 0 || 
           this.refreshJobs.size > 0 ||
           this.activeMerges.size > 0 || 
           this.activeDiscoveries.size > 0 || 
           this.activeRefreshAll.size > 0;
  }

  getStatus() {
    const p1League = this.getActiveLeague('poe1');
    const p2League = this.getActiveLeague('poe2');

    return {
      status: 'ok',
      isRefreshing: this.isRefreshing,
      activeJobs: [
        ...Array.from(this.activeFetches.keys()).map(f => `fetch:${f}`),
        ...Array.from(this.refreshJobs.keys()).map(j => `refreshJob:${j}`),
        ...Array.from(this.activeMerges).map(m => `merge:${m}`),
        ...Array.from(this.activeDiscoveries).map(d => `discovery:${d}`),
        ...Array.from(this.activeRefreshAll).map(r => `refreshAll:${r}`)
      ],
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
