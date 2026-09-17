/**
 * Conversion Math and Rate Validation Utility
 * Supports both CommonJS (Node.js backend/tests) and ES/Browser
 */

const ConversionMath = {
  /**
   * Validate and guard against 0, null, NaN or extreme rate anomalies.
   * If abnormal (> 3x or < 0.3x) or invalid, flags anomaly/stale and preserves lastKnownGood.
   */
  validateRate(newRate, lastKnownGood = null, maxFactor = 3.0, minFactor = 0.3) {
    if (typeof newRate !== 'number' || !isFinite(newRate) || newRate <= 0) {
      return {
        valid: false,
        isAnomaly: false,
        rate: lastKnownGood && lastKnownGood > 0 ? lastKnownGood : 0,
        isStale: true,
        reason: 'Rate is zero, negative, or invalid'
      };
    }

    if (lastKnownGood && lastKnownGood > 0) {
      const ratio = newRate / lastKnownGood;
      if (ratio > maxFactor || ratio < minFactor) {
        return {
          valid: false,
          isAnomaly: true,
          rate: lastKnownGood,
          isStale: true,
          reason: `Abnormal rate deviation (ratio: ${ratio.toFixed(2)}x vs last known ${lastKnownGood})`
        };
      }
    }

    return {
      valid: true,
      isAnomaly: false,
      rate: newRate,
      isStale: false,
      reason: null
    };
  },

  /**
   * PoE 1 Conversion (Chaos-primary economy)
   */
  poe1ChaosToDivine(chaosVal, rates = {}, divinePriceInChaos = 0) {
    if (!chaosVal || chaosVal <= 0) return 0;
    if (typeof rates.divine === 'number' && rates.divine > 0) {
      return +(chaosVal * rates.divine).toFixed(2);
    }
    if (divinePriceInChaos > 0) {
      return +(chaosVal / divinePriceInChaos).toFixed(2);
    }
    return 0;
  },

  poe1DivineToChaos(divineVal, rates = {}, divinePriceInChaos = 0) {
    if (!divineVal || divineVal <= 0) return 0;
    if (divinePriceInChaos > 0) {
      return +(divineVal * divinePriceInChaos).toFixed(1);
    }
    if (typeof rates.divine === 'number' && rates.divine > 0) {
      return +(divineVal / rates.divine).toFixed(1);
    }
    return 0;
  },

  poe1MirrorToDivine(mirrorPriceInChaos, divinePriceInChaos) {
    if (!mirrorPriceInChaos || !divinePriceInChaos || divinePriceInChaos <= 0) return 0;
    return Math.round(mirrorPriceInChaos / divinePriceInChaos);
  },

  /**
   * PoE 2 Conversion (Divine-primary economy)
   */
  poe2DivineToExalted(divineVal, exaltedRate) {
    if (!divineVal || divineVal <= 0 || !exaltedRate || exaltedRate <= 0) return 0;
    return +(divineVal * exaltedRate).toFixed(2);
  },

  poe2ExaltedToDivine(exaltedVal, exaltedRate) {
    if (!exaltedVal || exaltedVal <= 0 || !exaltedRate || exaltedRate <= 0) return 0;
    return +(exaltedVal / exaltedRate).toFixed(3);
  },

  poe2DivineToChaos(divineVal, chaosRate) {
    if (!divineVal || divineVal <= 0 || !chaosRate || chaosRate <= 0) return 0;
    return +(divineVal * chaosRate).toFixed(2);
  },

  /**
   * Derive Exalted rate from line or core rates
   */
  derivePoE2ExaltedRate(coreRates = {}, exaltedLine = null) {
    if (typeof coreRates.exalted === 'number' && coreRates.exalted > 0) {
      return coreRates.exalted;
    }
    if (exaltedLine && typeof exaltedLine.primaryValue === 'number' && exaltedLine.primaryValue > 0) {
      return +(1 / exaltedLine.primaryValue).toFixed(1);
    }
    return 0;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversionMath;
}
