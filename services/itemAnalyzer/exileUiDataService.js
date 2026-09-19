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

    // Also ingest full Exile-UI bases from exile-bases.json if present
    try {
      const exileBasesPath = path.join(gameDir, 'exile-bases.json');
      if (fs.existsSync(exileBasesPath)) {
        const rawExileBases = JSON.parse(fs.readFileSync(exileBasesPath, 'utf8'));
        if (targetGame === 'poe1') {
          const classArr = rawExileBases._classes || [];
          const baseMap = rawExileBases._bases || {};
          for (const [baseName, classIdStr] of Object.entries(baseMap)) {
            if (!bases[baseName]) {
              const classId = parseInt(classIdStr, 10) - 1;
              const className = classArr[classId] || 'Equipment';
              const catGroup = rawExileBases[className];
              let defences = null;
              let weapon = null;
              let tags = [];
              if (catGroup) {
                for (const [subCat, items] of Object.entries(catGroup)) {
                  if (items && items[baseName]) {
                    const itemData = items[baseName];
                    tags = itemData._tags || [];
                    if (itemData.Armour || itemData.Evasion || itemData.Energy || itemData.Ward) {
                      const parseRange = (valStr) => {
                        if (!valStr) return { min: 0, max: 0 };
                        const parts = String(valStr).split('-');
                        return { min: parseFloat(parts[0]) || 0, max: parseFloat(parts[1] || parts[0]) || 0 };
                      };
                      defences = {
                        armour: parseRange(itemData.Armour),
                        evasion: parseRange(itemData.Evasion),
                        energyShield: parseRange(itemData.Energy),
                        ward: parseRange(itemData.Ward)
                      };
                    }
                    if (itemData.phys || itemData.speed || itemData.crit) {
                      weapon = {
                        physical: parseFloat(itemData.phys) || 0,
                        speed: parseFloat(itemData.speed) || 0,
                        crit: parseFloat(itemData.crit) || 0
                      };
                    }
                    break;
                  }
                }
              }
              bases[baseName] = {
                itemClass: className,
                defences,
                weapon,
                tags
              };
            }
          }
        } else {
          // PoE 2 exile-bases.json format
          for (const [catName, catItems] of Object.entries(rawExileBases)) {
            if (typeof catItems === 'object' && catItems !== null) {
              for (const [baseName, itemData] of Object.entries(catItems)) {
                if (typeof itemData === 'object' && itemData !== null && !bases[baseName]) {
                  const defences = {
                    armour: { min: itemData.AR || 0, max: itemData.AR || 0 },
                    evasion: { min: itemData.EV || 0, max: itemData.EV || 0 },
                    energyShield: { min: itemData.ES || 0, max: itemData.ES || 0 },
                    ward: { min: 0, max: 0 }
                  };
                  bases[baseName] = {
                    itemClass: catName.charAt(0).toUpperCase() + catName.slice(1),
                    defences,
                    tags: itemData.tags || []
                  };
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load exile-bases for ${targetGame}:`, err.message);
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
    const entry = data.dropTiers[name];
    if (!entry) return null;
    if (typeof entry === 'string') {
      const match = entry.match(/^T(\d+)$/i);
      const tierClean = match ? match[1] : entry.toLowerCase();
      return {
        tier: tierClean,
        rawTier: entry
      };
    }
    return entry;
  }

  clearCache() {
    this._cache.poe1 = null;
    this._cache.poe2 = null;
  }
}

module.exports = new ExileUiDataService();
