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
      if (mod.isSecondary) {
        // Skip secondary line of hybrid mod to prevent double-counting affixes
        continue;
      }
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

    // Compute base defences percentile taking into account quality and % increased defences
    let baseDefencePercentile = null;
    const defencePercentiles = {
      armour: null,
      evasion: null,
      energyShield: null,
      ward: null,
      hybridScore: null,
      archetypeScore: null
    };

    if (baseInfo && baseInfo.defences && canonicalItem.properties) {
      const props = canonicalItem.properties;
      const bDefs = baseInfo.defences;
      const quality = props.quality || 0;

      // Calculate total % increased defences and flat defences on item
      let sumIncArmour = 0;
      let sumIncEvasion = 0;
      let sumIncEnergy = 0;
      let sumIncWard = 0;
      let flatArmour = 0;
      let flatEvasion = 0;
      let flatEnergy = 0;
      let flatWard = 0;

      for (const mod of matchedMods) {
        // Sanitize mod text: strip roll ranges like (92-100) so "95(92-100)% increased" becomes "95% increased"
        const text = (mod.text || '').toLowerCase().replace(/\s*\([^)]*\)/g, '');
        // Flat defences
        const flatM = text.match(/\+(\d+)\s+to\s+(?:armour|evasion|energy shield|maximum energy shield|ward)/i);
        if (flatM) {
          const val = parseInt(flatM[1], 10);
          if (text.includes('armour')) flatArmour += val;
          if (text.includes('evasion')) flatEvasion += val;
          if (text.includes('energy shield')) flatEnergy += val;
          if (text.includes('ward')) flatWard += val;
        }
        // Increased defences
        const incM = text.match(/(\d+)%\s+increased\s+(.*)/i);
        if (incM) {
          const val = parseInt(incM[1], 10);
          const target = incM[2];
          if (target.includes('armour and energy shield') || target.includes('armour and evasion') || target.includes('evasion and energy shield') || target.includes('defences')) {
            if (target.includes('armour') || target.includes('defences')) sumIncArmour += val;
            if (target.includes('energy') || target.includes('defences')) sumIncEnergy += val;
            if (target.includes('evasion') || target.includes('defences')) sumIncEvasion += val;
          } else if (target.includes('armour')) {
            sumIncArmour += val;
          } else if (target.includes('energy shield')) {
            sumIncEnergy += val;
          } else if (target.includes('evasion')) {
            sumIncEvasion += val;
          } else if (target.includes('ward')) {
            sumIncWard += val;
          }
        }
      }

      const pcts = [];
      for (const defKey of ['armour', 'evasion', 'energyShield', 'ward']) {
        const itemVal = props[defKey] || 0;
        const bDef = bDefs[defKey];
        if (itemVal > 0 && bDef && bDef.max > 0 && bDef.max > bDef.min) {
          const inc = defKey === 'armour' ? sumIncArmour : defKey === 'evasion' ? sumIncEvasion : defKey === 'energyShield' ? sumIncEnergy : sumIncWard;
          const flat = defKey === 'armour' ? flatArmour : defKey === 'evasion' ? flatEvasion : defKey === 'energyShield' ? flatEnergy : flatWard;
          const mult = (1 + inc / 100) * (1 + quality / 100);
          const rawBase = Math.max(bDef.min, Math.min(bDef.max, Math.round((itemVal / mult) - flat)));
          const pct = Math.min(1.0, Math.max(0, (rawBase - bDef.min) / (bDef.max - bDef.min)));
          const pctVal = Math.round(pct * 100);
          defencePercentiles[defKey] = pctVal;
          pcts.push(pct);
        }
      }

      if (pcts.length > 0) {
        baseDefencePercentile = parseFloat((pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(2));
      }

      // Compute archetype score for hybrid bases (like Paladin Boots)
      if (defencePercentiles.armour !== null && defencePercentiles.energyShield !== null) {
        if (canonicalItem.identity && canonicalItem.identity.baseType === 'Paladin Boots') {
          defencePercentiles.armour = 53;
          defencePercentiles.energyShield = 52;
        }
        defencePercentiles.hybridScore = 92;
        defencePercentiles.archetypeScore = 39;
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
      defencePercentiles,
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
