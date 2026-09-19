const exileUiDataService = require('./exileUiDataService');

class ModMatcher {
  normalizeText(modText) {
    if (!modText || typeof modText !== 'string') {
      return { template: '', values: [] };
    }

    const trimmed = modText.trim();
    const values = [];
    
    // Extract numbers while preserving surrounding text structure
    const template = trimmed.replace(/\b\d+(\.\d+)?\b/g, (match) => {
      values.push(parseFloat(match));
      return '#';
    });

    return {
      template,
      values
    };
  }

  matchMod(modText, options = {}) {
    const { itemLevel = 100, itemClass = null, game = 'poe1' } = options;
    const { template, values } = this.normalizeText(modText);

    if (!template) {
      return {
        text: modText,
        normalizedTemplate: '',
        family: null,
        type: 'unknown',
        tier: null,
        values: [],
        confidence: 0,
        status: 'empty'
      };
    }

    const candidates = exileUiDataService.getModCandidates(template, game);

    if (candidates.length === 0) {
      return {
        text: modText,
        normalizedTemplate: template,
        family: null,
        type: 'unknown',
        tier: null,
        values: values.map(v => ({ value: v, min: v, max: v })),
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
          if (ranges.length === values.length) {
            const allInRange = values.every((v, idx) => {
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
        const r = tierObj.ranges[idx] || { min: val, max: val };
        return {
          value: val,
          min: r.min,
          max: r.max
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
      return {
        text: modText,
        normalizedTemplate: template,
        family: null,
        type: 'ambiguous',
        tier: null,
        values: values.map(v => ({ value: v, min: null, max: null })),
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
