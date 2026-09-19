const exileUiDataService = require('./exileUiDataService');

class ModMatcher {
  normalizeText(modText) {
    if (!modText || typeof modText !== 'string') {
      return { template: '', values: [] };
    }

    let trimmed = modText.trim();
    const values = [];
    
    // 1. First, check for explicit roll ranges in parentheses: value(min-max) or value(min to max)
    // e.g. "+38(21-42) to Evasion Rating" -> "+# to Evasion Rating"
    trimmed = trimmed.replace(/\b(\d+(?:\.\d+)?)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*(?:-|to)\s*([+-]?\d+(?:\.\d+)?)\s*\)/g, (match, v, min, max) => {
      values.push({
        value: parseFloat(v),
        min: parseFloat(min),
        max: parseFloat(max)
      });
      return '#';
    });

    // 2. Extract remaining bare numbers while preserving surrounding text structure
    const template = trimmed.replace(/\b\d+(\.\d+)?\b/g, (match) => {
      values.push({
        value: parseFloat(match),
        min: null,
        max: null
      });
      return '#';
    });

    return {
      template,
      values
    };
  }

  matchMod(modText, options = {}) {
    const { itemLevel = 100, itemClass = null, game = 'poe1', descriptors = {} } = options;
    const actualText = typeof modText === 'object' && modText !== null ? modText.text : modText;
    const desc = (typeof modText === 'object' && modText !== null && modText.descriptor) 
      ? modText.descriptor 
      : (descriptors[actualText] || descriptors[modText] || null);

    const { template, values } = this.normalizeText(actualText);
    const rawNumericValues = values.map(v => (typeof v === 'object' && v !== null ? v.value : v));

    if (!template) {
      return {
        text: actualText,
        normalizedTemplate: '',
        family: null,
        type: 'unknown',
        tier: null,
        values: [],
        confidence: 0,
        status: 'empty'
      };
    }

    const valueRanges = values.map(v => {
      const rawVal = typeof v === 'object' && v !== null ? v.value : v;
      const explicitMin = typeof v === 'object' && v !== null ? v.min : rawVal;
      const explicitMax = typeof v === 'object' && v !== null ? v.max : rawVal;
      return { value: rawVal, min: explicitMin, max: explicitMax };
    });

    const candidates = exileUiDataService.getModCandidates(template, game);

    // Fast-path: If game explicitly provided affix metadata via Ctrl+Alt+C
    if (desc) {
      let cand = candidates.find(c => c.type === desc.type) || candidates[0] || null;
      if (!cand && desc.name) {
        const affixCands = exileUiDataService.getAffixCandidates(desc.name, game);
        if (affixCands.length > 0) {
          cand = affixCands[0];
        }
      }
      let matchedTier = desc.tier;
      let matchedTierName = desc.name;

      // Map Eldritch text tiers to standard numeric tiers (1-6)
      const eldritchMap = {
        'perfect': 1,
        'exquisite': 2,
        'exceptional': 3,
        'grand': 4,
        'greater': 5,
        'lesser': 6
      };
      if (typeof matchedTier === 'string') {
        const lowTier = matchedTier.toLowerCase();
        if (eldritchMap[lowTier] !== undefined) {
          if (!matchedTierName) matchedTierName = matchedTier;
          matchedTier = eldritchMap[lowTier];
        }
      }

      if (cand && Array.isArray(cand.tiers) && desc.tier) {
        const tObj = cand.tiers.find(t => t.tier === desc.tier);
        if (tObj && Array.isArray(tObj.ranges)) {
          valueRanges.forEach((vr, idx) => {
            if (vr.min === vr.value && tObj.ranges[idx]) {
              vr.min = tObj.ranges[idx].min;
              vr.max = tObj.ranges[idx].max;
            }
          });
          if (!matchedTierName && tObj.name) matchedTierName = tObj.name;
        }
      }

      return {
        text: actualText,
        normalizedTemplate: template,
        family: cand ? (cand.family || cand.key) : (desc.tags && desc.tags[0] ? desc.tags[0].toLowerCase() : null),
        type: desc.type || (cand ? cand.type : 'explicit'),
        tier: matchedTier,
        tierName: matchedTierName,
        tags: desc.tags || [],
        isFractured: !!desc.isFractured,
        isCrafted: !!desc.isCrafted,
        isScourge: !!desc.isScourge,
        isSecondary: !!desc.isSecondary,
        primaryAffix: desc.primaryAffix || null,
        icon: this.resolveExileIcon(actualText, desc.tags || [], cand ? (cand.family || cand.key) : null, desc),
        values: valueRanges,
        confidence: 1.0,
        status: 'matched',
        source: 'descriptor'
      };
    }

    if (candidates.length === 0) {
      return {
        text: actualText,
        normalizedTemplate: template,
        family: null,
        type: 'unknown',
        tier: null,
        icon: this.resolveExileIcon(actualText),
        values: valueRanges,
        confidence: 0,
        status: 'unrecognized'
      };
    }

    // Match each candidate mod against tiers
    const matchedCandidates = [];

    for (const cand of candidates) {
      let matchedTier = null;

      if (Array.isArray(cand.tiers)) {
        for (const tierObj of cand.tiers) {
          const ranges = tierObj.ranges || [];
          if (ranges.length === rawNumericValues.length) {
            const allInRange = rawNumericValues.every((v, idx) => {
              const r = ranges[idx];
              return v >= r.min && v <= r.max;
            });
            if (allInRange) {
              matchedTier = tierObj;
              break;
            }
          }
        }
      } else if (Array.isArray(cand.ranges) && cand.ranges.length === 2) {
        const min = cand.ranges[0];
        const max = cand.ranges[1];
        if (rawNumericValues.length > 0 && rawNumericValues[0] >= min && rawNumericValues[0] <= max) {
          matchedTier = {
            tier: cand.tier,
            name: cand.name,
            minLevel: cand.level,
            ranges: [{ min, max }]
          };
        }
      }

      matchedCandidates.push({
        family: cand.family || cand.key,
        type: cand.type || 'explicit',
        tierObj: matchedTier
      });
    }

    // Check matches with valid tier
    const resolvedMatches = matchedCandidates.filter(c => c.tierObj !== null);

    if (resolvedMatches.length === 1) {
      const match = resolvedMatches[0];
      const tierObj = match.tierObj;
      const valueRanges = values.map((val, idx) => {
        const rawVal = typeof val === 'object' && val !== null ? val.value : val;
        const explicitMin = typeof val === 'object' && val !== null ? val.min : null;
        const explicitMax = typeof val === 'object' && val !== null ? val.max : null;
        const r = tierObj.ranges[idx] || { min: rawVal, max: rawVal };
        return {
          value: rawVal,
          min: explicitMin !== null ? explicitMin : r.min,
          max: explicitMax !== null ? explicitMax : r.max
        };
      });

      return {
        text: modText,
        normalizedTemplate: template,
        family: match.family,
        type: match.type,
        tier: tierObj.tier,
        tierName: tierObj.name,
        icon: this.resolveExileIcon(actualText, [], match.family),
        values: valueRanges,
        requiredItemLevel: tierObj.minLevel || 1,
        confidence: 1.0,
        status: 'matched'
      };
    }

    if (resolvedMatches.length > 1) {
      // Ambiguous case: multiple candidates match the values
      const valueRanges = values.map(v => {
        const rawVal = typeof v === 'object' && v !== null ? v.value : v;
        const explicitMin = typeof v === 'object' && v !== null ? v.min : null;
        const explicitMax = typeof v === 'object' && v !== null ? v.max : null;
        return { value: rawVal, min: explicitMin, max: explicitMax };
      });

      return {
        text: modText,
        normalizedTemplate: template,
        family: null,
        type: 'ambiguous',
        tier: null,
        icon: this.resolveExileIcon(actualText),
        values: valueRanges,
        confidence: parseFloat((1 / resolvedMatches.length).toFixed(2)),
        status: 'ambiguous',
        candidates: resolvedMatches.map(c => ({
          family: c.family,
          type: c.type,
          tier: c.tierObj ? c.tierObj.tier : null,
          tierName: c.tierObj ? c.tierObj.name : null
        }))
      };
    }

    // None matched a known tier range, but template is recognized
    const primary = candidates[0];
    return {
      text: modText,
      normalizedTemplate: template,
      family: primary.family,
      type: primary.type,
      tier: null,
      tierName: null,
      icon: this.resolveExileIcon(actualText, [], primary.family),
      values: values.map(v => ({ value: v, min: null, max: null })),
      confidence: 0.5,
      status: 'unmatched_tier'
    };
  }

  resolveExileIcon(string = '', tags = [], family = null, desc = null) {
    // Check descriptor first for Eldritch implicits
    if (desc && desc.raw) {
      if (/searing exarch/i.test(desc.raw)) return 'exarch';
      if (/eater of worlds/i.test(desc.raw)) return 'eater';
    }

    if (!string || typeof string !== 'string') return null;
    const str = string.toLowerCase();

    // Specific attacks
    if (str.includes('adds ') && str.includes('damage') && !str.includes('spells')) {
      if (str.includes('fire')) return 'fire_attack';
      if (str.includes('cold')) return 'cold_attack';
      if (str.includes('lightning')) return 'lightning_attack';
      if (str.includes('chaos')) return 'chaos_attack';
      if (str.includes('physical')) return 'phys';
    }

    // Minion / Totem / Flasks / Gems
    if (str.includes('minion')) return 'minion';
    if (str.includes('totem')) return 'totems';
    if (str.includes('flask')) return 'flasks';
    if (str.includes('to level of ') && str.includes('gem')) return 'gem_level';

    // Accuracy / Crit / Speed
    if (str.includes('accuracy rating')) return 'accuracy';
    if (str.includes('critical')) return 'crit';
    if (str.includes('attack speed') || str.includes('cast speed') || str.includes('movement speed')) return 'speed';

    // Resistances
    if (str.includes('all elemental resistances') || str.includes('all maximum resistances')) return 'allres';
    if (str.includes('fire resistance') || str.includes('fire and')) return 'fire';
    if (str.includes('cold resistance') || str.includes('cold and')) return 'cold';
    if (str.includes('lightning resistance') || str.includes('lightning and')) return 'lightning';
    if (str.includes('chaos resistance')) return 'chaos';

    // Life & Mana
    if (str.includes('maximum life') || str.includes('to life')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'life_regen';
      return 'life';
    }
    if (str.includes('regenerate') && str.includes('life')) return 'life_regen';

    if (str.includes('maximum mana') || str.includes('to mana')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'mana_regen';
      return 'mana';
    }
    if (str.includes('regenerate') && str.includes('mana')) return 'mana_regen';

    // Attributes / Stats
    if (str.includes('all attributes') || str.includes('increased attributes')) return 'allstats';
    if (str.includes('strength') && str.includes('dexterity') && str.includes('intelligence')) return 'allstats';
    if (str.includes('to strength') || str.includes('strength')) return 'strength';
    if (str.includes('to dexterity') || str.includes('dexterity')) return 'dexterity';
    if (str.includes('to intelligence') || str.includes('intelligence')) return 'intelligence';

    // Defences
    if (str.includes('armour and evasion') || (str.includes('armour') && str.includes('evasion rating'))) return 'armor_evasion';
    if (str.includes('armour and energy') || (str.includes('armour') && str.includes('energy shield'))) return 'armor_energy';
    if (str.includes('evasion and energy') || (str.includes('evasion') && str.includes('energy shield'))) return 'evasion_energy';
    if (str.includes('armour')) return 'armor';
    if (str.includes('evasion')) return 'evasion';
    if (str.includes('energy shield')) return 'energy';
    if (str.includes('ward')) return 'ward';
    if (str.includes('suppress spell damage') || str.includes('suppressed')) return 'defense';
    if (str.includes('block')) return 'block';

    // Damage
    if (str.includes('fire damage')) return 'fire_damage';
    if (str.includes('cold damage')) return 'cold_damage';
    if (str.includes('lightning damage')) return 'lightning_damage';
    if (str.includes('chaos damage')) return 'chaos_damage';
    if (str.includes('physical damage') || str.includes('global physical')) return 'phys';
    if (str.includes('spell damage')) return 'spell_damage';
    if (str.includes('increased damage')) return 'damage';

    // Eldritch / Special
    if (str.includes('searing exarch') || str.includes('exarch')) return 'exarch';
    if (str.includes('eater of worlds') || str.includes('eater')) return 'eater';
    if (str.includes('essence')) return 'essence';
    if (str.includes('crafted') || str.includes('master')) return 'mastercraft';
    if (str.includes('delve')) return 'delve';
    if (str.includes('incursion')) return 'incursion';
    if (str.includes('syndicate') || str.includes('veiled')) return 'syndicate';
    if (str.includes('synthesis')) return 'synthesis';
    if (str.includes('vaal')) return 'vaal';

    // Check tags or family fallback
    const tagList = Array.isArray(tags) ? tags : [];
    for (const t of tagList) {
      const tl = (t || '').toLowerCase();
      if (tl === 'life') return 'life';
      if (tl === 'mana') return 'mana';
      if (tl === 'fire') return 'fire';
      if (tl === 'cold') return 'cold';
      if (tl === 'lightning') return 'lightning';
      if (tl === 'chaos') return 'chaos';
      if (tl === 'speed') return 'speed';
      if (tl === 'physical') return 'phys';
      if (tl === 'defences') return 'defense';
      if (tl === 'elemental') return 'allres';
      if (tl === 'minion') return 'minion';
    }

    if (family) {
      const fam = family.toLowerCase();
      if (fam.includes('life')) return 'life';
      if (fam.includes('fire')) return 'fire';
      if (fam.includes('cold')) return 'cold';
      if (fam.includes('lightning')) return 'lightning';
      if (fam.includes('chaos')) return 'chaos';
      if (fam.includes('speed')) return 'speed';
      if (fam.includes('mana')) return 'mana';
      if (fam.includes('armour') || fam.includes('evasion') || fam.includes('energy') || fam.includes('defence')) return 'defense';
    }

    return null;
  }

  matchAll(modList = [], options = {}) {
    if (!Array.isArray(modList)) return [];
    return modList.map(mod => this.matchMod(mod, options));
  }
}

module.exports = new ModMatcher();
