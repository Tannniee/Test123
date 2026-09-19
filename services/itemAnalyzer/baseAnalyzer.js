const exileUiDataService = require('./exileUiDataService');

class BaseAnalyzer {
  analyze(canonicalItem, matchedMods = [], game = 'poe1') {
    if (!canonicalItem) return null;

    const baseType = canonicalItem.identity ? canonicalItem.identity.baseType : null;
    const rarity = canonicalItem.identity ? canonicalItem.identity.rarity : 'Normal';
    const baseInfo = exileUiDataService.getBase(baseType, game);

    // Compute affix capacity & open crafting slots
    let maxPrefixes = 0;
    let maxSuffixes = 0;
    let canCraft = false;

    if (rarity === 'Rare') {
      maxPrefixes = 3;
      maxSuffixes = 3;
      canCraft = true;
    } else if (rarity === 'Magic') {
      maxPrefixes = 1;
      maxSuffixes = 1;
      canCraft = true;
    }

    let prefixesCount = 0;
    let suffixesCount = 0;
    let unknownCount = 0;

    for (const mod of matchedMods) {
      if (mod.type === 'prefix') {
        prefixesCount++;
      } else if (mod.type === 'suffix') {
        suffixesCount++;
      } else {
        unknownCount++;
      }
    }

    const openPrefixes = Math.max(0, maxPrefixes - prefixesCount);
    const openSuffixes = Math.max(0, maxSuffixes - suffixesCount);

    // Compute requirements comparison
    const reqs = canonicalItem.requirements || { level: 0, str: 0, dex: 0, int: 0 };
    const baseReqs = baseInfo ? {
      level: baseInfo.requiredLevel || 0,
      str: baseInfo.requiredStr || 0,
      dex: baseInfo.requiredDex || 0,
      int: baseInfo.requiredInt || 0
    } : reqs;

    // Compute base defences percentile
    let baseDefencePercentile = null;
    if (baseInfo && baseInfo.defences && canonicalItem.properties) {
      const props = canonicalItem.properties;
      const bDefs = baseInfo.defences;
      const percentiles = [];
      for (const defKey of ['armour', 'evasion', 'energyShield', 'ward']) {
        const itemVal = props[defKey] || 0;
        const bDef = bDefs[defKey];
        if (itemVal > 0 && bDef && bDef.max > 0 && bDef.max > bDef.min) {
          const pct = Math.min(1.0, Math.max(0, (itemVal - bDef.min) / (bDef.max - bDef.min)));
          percentiles.push(pct);
        }
      }
      if (percentiles.length > 0) {
        baseDefencePercentile = parseFloat((percentiles.reduce((a, b) => a + b, 0) / percentiles.length).toFixed(2));
      }
    }

    return {
      baseType,
      itemClass: baseInfo ? baseInfo.itemClass : (canonicalItem.identity ? canonicalItem.identity.itemClass : null),
      recognized: Boolean(baseInfo),
      dropLevel: baseInfo ? (baseInfo.dropLevel || baseInfo.requiredLevel || 1) : null,
      requirements: {
        item: reqs,
        base: baseReqs
      },
      baseDefences: baseInfo && baseInfo.defences ? baseInfo.defences : null,
      baseDefencePercentile,
      baseWeapon: baseInfo && baseInfo.weapon ? baseInfo.weapon : null,
      affixCapacity: {
        rarity,
        prefixesCount,
        suffixesCount,
        unknownCount,
        maxPrefixes,
        maxSuffixes,
        openPrefixes,
        openSuffixes,
        canCraft,
        isAffixCountPrecise: unknownCount === 0,
        hasUncertainAffixes: unknownCount > 0
      }
    };
  }
}

module.exports = new BaseAnalyzer();
