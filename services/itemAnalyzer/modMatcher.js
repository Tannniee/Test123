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
      const cand = candidates.find(c => c.type === desc.type) || candidates[0] || null;
      let matchedTier = desc.tier;
      let matchedTierName = desc.name;

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
        family: cand ? cand.family : (desc.tags && desc.tags[0] ? desc.tags[0].toLowerCase() : null),
        type: desc.type || (cand ? cand.type : 'explicit'),
        tier: matchedTier,
        tierName: matchedTierName,
        tags: desc.tags || [],
        isFractured: !!desc.isFractured,
        isCrafted: !!desc.isCrafted,
        isScourge: !!desc.isScourge,
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
      }

      matchedCandidates.push({
        family: cand.family,
        type: cand.type,
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
      values: values.map(v => ({ value: v, min: null, max: null })),
      confidence: 0.5,
      status: 'unmatched_tier'
    };
  }

  matchAll(modList = [], options = {}) {
    if (!Array.isArray(modList)) return [];
    return modList.map(mod => this.matchMod(mod, options));
  }
}

module.exports = new ModMatcher();
