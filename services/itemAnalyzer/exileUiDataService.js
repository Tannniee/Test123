const fs = require('fs');
const path = require('path');

class ExileUiDataService {
  constructor() {
    this._dataDir = path.join(__dirname, '../../data/vendor/exile-ui');
    this._cache = {
      poe1: null,
      poe2: null
    };
  }

  _loadGameData(game = 'poe1') {
    const targetGame = game === 'poe2' ? 'poe2' : 'poe1';
    if (this._cache[targetGame]) {
      return this._cache[targetGame];
    }

    const gameDir = path.join(this._dataDir, targetGame);
    let bases = {};
    let mods = [];
    let dropTiers = {};

    try {
      const basesPath = path.join(gameDir, 'item-bases.json');
      if (fs.existsSync(basesPath)) {
        bases = JSON.parse(fs.readFileSync(basesPath, 'utf8'));
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load bases for ${targetGame}:`, err.message);
    }

    try {
      const modsPath = path.join(gameDir, 'item-mods.json');
      if (fs.existsSync(modsPath)) {
        mods = JSON.parse(fs.readFileSync(modsPath, 'utf8'));
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load mods for ${targetGame}:`, err.message);
    }

    try {
      const dropTiersPath = path.join(gameDir, 'item-drop-tiers.json');
      if (fs.existsSync(dropTiersPath)) {
        dropTiers = JSON.parse(fs.readFileSync(dropTiersPath, 'utf8'));
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load drop tiers for ${targetGame}:`, err.message);
    }

    // Build mod lookup index by template
    const templateIndex = new Map();
    for (const mod of mods) {
      const key = (mod.template || '').toLowerCase().trim();
      if (!templateIndex.has(key)) {
        templateIndex.set(key, []);
      }
      templateIndex.get(key).push(mod);
    }

    this._cache[targetGame] = {
      bases,
      mods,
      dropTiers,
      templateIndex
    };

    return this._cache[targetGame];
  }

  getBase(name, game = 'poe1') {
    if (!name) return null;
    const data = this._loadGameData(game);
    return data.bases[name] || null;
  }

  getBases(game = 'poe1') {
    const data = this._loadGameData(game);
    return data.bases;
  }

  getMods(game = 'poe1') {
    const data = this._loadGameData(game);
    return data.mods;
  }

  getModCandidates(normalizedTemplate, game = 'poe1') {
    if (!normalizedTemplate) return [];
    const data = this._loadGameData(game);
    const key = normalizedTemplate.toLowerCase().trim();
    return data.templateIndex.get(key) || [];
  }

  getUniqueDropTier(name, game = 'poe1') {
    if (!name) return null;
    const data = this._loadGameData(game);
    return data.dropTiers[name] || null;
  }

  clearCache() {
    this._cache.poe1 = null;
    this._cache.poe2 = null;
  }
}

module.exports = new ExileUiDataService();
