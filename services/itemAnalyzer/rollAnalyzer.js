class RollAnalyzer {
  calculatePercentile(value, min, max, inverted = false) {
    if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {
      return null;
    }

    if (min === max) {
      return {
        percentile: 1.0,
        display: '100%'
      };
    }

    const range = max - min;
    let rawRatio;

    if (inverted) {
      rawRatio = (max - value) / range;
    } else {
      rawRatio = (value - min) / range;
    }

    const clamped = Math.max(0, Math.min(1, rawRatio));
    const percentile = parseFloat(clamped.toFixed(3));
    const display = `${Math.round(clamped * 100)}%`;

    return {
      percentile,
      display
    };
  }

  analyzeValueRange(valRange, options = {}) {
    if (!valRange || typeof valRange.value !== 'number') {
      return null;
    }

    const { value, min, max } = valRange;
    if (min === null || min === undefined || max === null || max === undefined) {
      return {
        value,
        min: null,
        max: null,
        percentile: null,
        display: null
      };
    }

    const res = this.calculatePercentile(value, min, max, options.inverted || false);
    return {
      value,
      min,
      max,
      percentile: res ? res.percentile : null,
      display: res ? res.display : null
    };
  }

  analyzeMod(matchedMod) {
    if (!matchedMod) return null;

    const values = matchedMod.values || [];
    const rollAnalysis = [];

    for (const v of values) {
      const analyzed = this.analyzeValueRange(v);
      if (analyzed) {
        rollAnalysis.push(analyzed);
      }
    }

    return {
      ...matchedMod,
      rollAnalysis: rollAnalysis.length > 0 ? rollAnalysis : null
    };
  }

  analyzeAll(matchedMods = []) {
    if (!Array.isArray(matchedMods)) return [];
    return matchedMods.map(m => this.analyzeMod(m));
  }
}

module.exports = new RollAnalyzer();
