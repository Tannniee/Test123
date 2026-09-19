const fs = require('fs');
const path = require('path');

class PoedbService {
  constructor(cacheDir = path.join(__dirname, '../data/cache'), options = {}) {
    this.cacheDir = cacheDir;
    this.cacheFilePath = path.join(this.cacheDir, 'poedb_descriptions.json');
    this.memoryCache = new Map();
    this.activeFetches = new Map();
    this.saveTimer = null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.initCache();
  }

  initCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      // Migrate from legacy ../cache/poedb_descriptions.json if needed
      const legacyPath = path.join(__dirname, '../cache/poedb_descriptions.json');
      if (!fs.existsSync(this.cacheFilePath) && fs.existsSync(legacyPath)) {
        try {
          fs.copyFileSync(legacyPath, this.cacheFilePath);
        } catch (e) {}
      }

      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
          for (const [key, val] of Object.entries(data)) {
            if (val && typeof val === 'object') {
              if (!Array.isArray(val.explicitModifiers) && val.explicitMod) {
                val.explicitModifiers = val.explicitMod.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              }
              if (!Array.isArray(val.implicitModifiers) && val.implicitMod) {
                val.implicitModifiers = val.implicitMod.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
              }
            }
            this.memoryCache.set(key, val);
          }
          console.log(`[PoedbService] Loaded ${this.memoryCache.size} cached item descriptions.`);
        }
      }
    } catch (err) {
      console.warn('[PoedbService] Error initializing cache from disk:', err.message);
    }
  }

  saveCacheToDisk() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        if (!fs.existsSync(this.cacheDir)) {
          await fs.promises.mkdir(this.cacheDir, { recursive: true });
        }
        const obj = Object.fromEntries(this.memoryCache);
        const tmpPath = `${this.cacheFilePath}.${Date.now()}.tmp`;
        await fs.promises.writeFile(tmpPath, JSON.stringify(obj, null, 2), 'utf8');
        await fs.promises.rename(tmpPath, this.cacheFilePath);
      } catch (err) {
        console.warn('[PoedbService] Error saving cache to disk:', err.message);
      }
    }, 300);
  }

  getCacheKey(name, game = 'poe1') {
    return `${(game || 'poe1').toLowerCase()}:${(name || '').toLowerCase().trim()}`;
  }

  getCleanSlug(name) {
    if (!name) return '';
    return name
      .trim()
      .replace(/['’]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Get description from memory or disk cache
   */
  getCachedDescription(name, game = 'poe1') {
    const key = this.getCacheKey(name, game);
    return this.memoryCache.get(key) || null;
  }

  async fetchItemDescription(name, game = 'poe1') {
    return this.getItemDescription(name, game);
  }

  /**
   * Fetch and parse item description directly from poedb.tw / poe2db.tw
   */
  async getItemDescription(name, game = 'poe1') {
    if (!name || typeof name !== 'string') return null;

    const cacheKey = this.getCacheKey(name, game);
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.activeFetches.has(cacheKey)) {
      return await this.activeFetches.get(cacheKey);
    }

    const fetchPromise = (async () => {
      const isPoe2 = game === 'poe2';
      const cleanSlug = this.getCleanSlug(name);
      const domain = isPoe2 ? 'https://poe2db.tw/us' : 'https://poedb.tw/us';
      const url = `${domain}/${encodeURIComponent(cleanSlug)}`;

      try {
        const res = await this.fetchImpl(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) {
          // If 404 with stripped apostrophe, try once with encoded apostrophe
          if (res.status === 404 && name.includes("'")) {
            const altSlug = name.trim().replace(/\s+/g, '_');
            const altUrl = `${domain}/${encodeURIComponent(altSlug)}`;
            const altRes = await this.fetchImpl(altUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(4000)
            });
            if (altRes.ok) {
              const altHtml = await altRes.text();
              return this.parsePoedbHtml(name, altHtml, game, altUrl);
            }
          }
          return null;
        }

        const html = await res.text();
        const parsed = this.parsePoedbHtml(name, html, game, url);
        if (parsed) {
          this.memoryCache.set(cacheKey, parsed);
          this.saveCacheToDisk();
          return parsed;
        }

        return null;
      } catch (err) {
        console.warn(`[PoedbService] Failed to fetch description for "${name}":`, err.message);
        return null;
      } finally {
        this.activeFetches.delete(cacheKey);
      }
    })();

    this.activeFetches.set(cacheKey, fetchPromise);
    return await fetchPromise;
  }

  /**
   * Parse poedb item tooltip HTML
   */
  parsePoedbHtml(originalName, html, game, url) {
    if (!html) return null;

    let title = '';
    const titleMatch = html.match(/<div class="itemName[^"]*">([\s\S]*?)<\/div>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    let stackSize = null;
    const stackMatch = html.match(/Stack Size:\s*<span[^>]*>[^<]*\/\s*(\d+)<\/span>/i)
      || html.match(/Stack Size:\s*(\d+)/i)
      || html.match(/Stack Size:[^0-9]*(\d+)/i);
    if (stackMatch) {
      stackSize = parseInt(stackMatch[1], 10);
    }

    let explicitMod = '';
    const explicitMatch = html.match(/<div class="explicitMod">([\s\S]*?)<\/div>/i);
    if (explicitMatch) {
      explicitMod = explicitMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
    }

    let implicitMod = '';
    const implicitMatch = html.match(/<div class="implicitMod">([\s\S]*?)<\/div>/i);
    if (implicitMatch) {
      implicitMod = implicitMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
    }

    let instructions = '';
    const instrMatch = html.match(/<div class="default fst-italic">([\s\S]*?)<\/div>/i)
      || html.match(/<div class="[^"]*fst-italic[^"]*">([\s\S]*?)<\/div>/i);
    if (instrMatch) {
      instructions = instrMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
    }

    let flavourText = '';
    const flavourMatch = html.match(/<div class="flavourText">([\s\S]*?)<\/div>/i);
    if (flavourMatch) {
      flavourText = flavourMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
    }

    let levelRequired = null;
    const lvlMatch = html.match(/Requires Level\s*<span[^>]*>(\d+)<\/span>/i)
      || html.match(/Requires Level\s*(\d+)/i);
    if (lvlMatch) {
      levelRequired = parseInt(lvlMatch[1], 10);
    }

    const explicitModifiers = explicitMod ? explicitMod.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
    const implicitModifiers = implicitMod ? implicitMod.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

    return {
      title: title || originalName,
      name: originalName,
      stackSize,
      explicitMod,
      explicitModifiers,
      implicitMod,
      implicitModifiers,
      instructions,
      flavourText,
      levelRequired,
      game,
      sourceUrl: url,
      fetchedAt: new Date().toISOString()
    };
  }
}

const instance = new PoedbService();
instance.PoedbService = PoedbService;
module.exports = instance;
