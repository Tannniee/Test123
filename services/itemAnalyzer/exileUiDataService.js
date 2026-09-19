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
    const classBests = {};
    const templateIndex = new Map();
    const affixIndex = new Map();

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

          // Extract class bests for archetype defense and weapon scaling
          for (const [key, val] of Object.entries(rawExileBases)) {
            if (!key.startsWith('_') && typeof val === 'object' && val !== null) {
              classBests[key] = {};
              for (const [subKey, subVal] of Object.entries(val)) {
                if (subVal && typeof subVal === 'object' && subVal._best !== undefined) {
                  classBests[key][subKey] = subVal._best;
                } else if (subKey === '_best') {
                  classBests[key]._best = subVal;
                }
              }
            }
          }

          for (const [baseName, classIdStr] of Object.entries(baseMap)) {
            if (!bases[baseName]) {
              const classId = parseInt(classIdStr, 10) - 1;
              const className = classArr[classId] || 'Equipment';
              const catGroup = rawExileBases[className];
              let defences = null;
              let weapon = null;
              let tags = [];
              let subTypeName = null;

              if (catGroup && typeof catGroup === 'object') {
                // Check direct item first (e.g. Amulets['Agate Amulet'], Belts['Heavy Belt'])
                let itemData = catGroup[baseName];
                if (!itemData) {
                  // Check nested subcategories (e.g. Boots['Armour/Energy']['Paladin Boots'])
                  for (const [subCat, items] of Object.entries(catGroup)) {
                    if (items && typeof items === 'object' && items[baseName]) {
                      itemData = items[baseName];
                      subTypeName = subCat;
                      break;
                    }
                  }
                }

                if (itemData) {
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
                }
              }

              bases[baseName] = {
                itemClass: className,
                subType: subTypeName,
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

    // 1. Load curated mods from item-mods.json (maintains primary tier structures)
    try {
      const modsPath = path.join(gameDir, 'item-mods.json');
      if (fs.existsSync(modsPath)) {
        const seedMods = JSON.parse(fs.readFileSync(modsPath, 'utf8'));
        if (Array.isArray(seedMods)) {
          for (const m of seedMods) {
            mods.push(m);
            const key = (m.template || '').toLowerCase().trim();
            if (!templateIndex.has(key)) templateIndex.set(key, []);
            templateIndex.get(key).push(m);
            if (Array.isArray(m.tiers)) {
              for (const t of m.tiers) {
                if (t.name) {
                  const affKey = t.name.toLowerCase().trim();
                  if (!affixIndex.has(affKey)) affixIndex.set(affKey, []);
                  affixIndex.get(affKey).push({ ...m, affix: t.name, name: t.name, matchedTier: t });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load seed mods for ${targetGame}:`, err.message);
    }

    // 2. Load complete Exile-UI exile-mods.json (4,272 PoE 1 mods / 1,533 PoE 2 mod families) into affixIndex and exileMods
    let exileMods = null;
    try {
      const exileModsPath = path.join(gameDir, 'exile-mods.json');
      if (fs.existsSync(exileModsPath)) {
        exileMods = JSON.parse(fs.readFileSync(exileModsPath, 'utf8'));
        if (targetGame === 'poe1') {
          for (const [catName, catItems] of Object.entries(exileMods)) {
            if (typeof catItems === 'object' && catItems !== null) {
              for (const [modKey, modData] of Object.entries(catItems)) {
                if (typeof modData === 'object' && modData !== null) {
                  const texts = Array.isArray(modData.texts) ? modData.texts : [modData.text || ''];
                  const entry = {
                    key: modKey,
                    category: catName,
                    affix: modData.affix || '',
                    name: modData.affix || '',
                    level: parseInt(modData.level, 10) || 1,
                    tags: modData.tags || [],
                    texts,
                    type: (modData.type || 'prefix').toLowerCase(),
                    weights: modData.weights || null
                  };
                  if (modData.affix) {
                    const affKey = modData.affix.toLowerCase().trim();
                    if (!affixIndex.has(affKey)) affixIndex.set(affKey, []);
                    affixIndex.get(affKey).push(entry);
                  }
                }
              }
            }
          }
        } else {
          // PoE 2 exile-mods.json format
          for (const [catName, catItems] of Object.entries(exileMods)) {
            if (typeof catItems === 'object' && catItems !== null) {
              for (const [modKey, tierList] of Object.entries(catItems)) {
                if (Array.isArray(tierList)) {
                  tierList.forEach((tObj, idx) => {
                    const calculatedTier = tierList.length - idx;
                    const entry = {
                      family: modKey,
                      category: catName,
                      tier: calculatedTier,
                      affix: tObj.name || '',
                      name: tObj.name || '',
                      level: tObj.level || 1,
                      weights: tObj.weights || [],
                      text: tObj.text || []
                    };
                    if (tObj.name) {
                      const affKey = tObj.name.toLowerCase().trim();
                      if (!affixIndex.has(affKey)) affixIndex.set(affKey, []);
                      affixIndex.get(affKey).push(entry);
                    }
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load exile-mods for ${targetGame}:`, err.message);
    }

    try {
      const dropTiersPath = path.join(gameDir, 'item-drop-tiers.json');
      if (fs.existsSync(dropTiersPath)) {
        dropTiers = JSON.parse(fs.readFileSync(dropTiersPath, 'utf8'));
      }
    } catch (err) {
      console.warn(`[ExileUiDataService] Failed to load drop tiers for ${targetGame}:`, err.message);
    }

    this._cache[targetGame] = {
      bases,
      mods,
      dropTiers,
      classBests,
      templateIndex,
      affixIndex,
      exileMods
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

  getExileMods(game = 'poe1') {
    const data = this._loadGameData(game);
    return data.exileMods;
  }

  getModCandidates(normalizedTemplate, game = 'poe1') {
    if (!normalizedTemplate) return [];
    const data = this._loadGameData(game);
    const key = normalizedTemplate.toLowerCase().trim();
    return data.templateIndex.get(key) || [];
  }

  getAffixCandidates(affixName, game = 'poe1') {
    if (!affixName) return [];
    const data = this._loadGameData(game);
    const key = affixName.toLowerCase().trim();
    return data.affixIndex.get(key) || [];
  }

  getClassBest(className, subType = null, game = 'poe1') {
    const data = this._loadGameData(game);
    if (!data.classBests || !className) return null;
    const group = data.classBests[className];
    if (!group) return null;
    let res = null;
    if (subType && group[subType] !== undefined) res = group[subType];
    else res = group._best !== undefined ? group._best : group;
    if (typeof res === 'string' && !isNaN(Number(res))) {
      return Number(res);
    }
    return res;
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
