class DpsAnalyzer {
  analyze(canonicalItem) {
    if (!canonicalItem || !canonicalItem.properties) {
      return null;
    }

    const props = canonicalItem.properties;
    const physDmg = props.physicalDamage;
    const elemDmg = props.elementalDamage || [];
    const chaosDmg = props.chaosDamage;
    const aps = props.attacksPerSecond;
    const crit = props.criticalChance;
    const quality = props.quality || 0;

    // Item must have at least attack speed, physical, elemental or chaos damage to qualify as weapon DPS
    if (!physDmg && elemDmg.length === 0 && !chaosDmg && !aps) {
      return null;
    }

    const effectiveAps = aps || 1.0;

    // Physical DPS
    let pDps = 0;
    if (physDmg && typeof physDmg.min === 'number' && typeof physDmg.max === 'number') {
      const avgPhys = (physDmg.min + physDmg.max) / 2;
      pDps = avgPhys * effectiveAps;
    }

    // Elemental DPS
    let eDps = 0;
    const elemBreakdown = [];
    if (Array.isArray(elemDmg)) {
      for (const elem of elemDmg) {
        if (elem && typeof elem.min === 'number' && typeof elem.max === 'number') {
          const avgElem = (elem.min + elem.max) / 2;
          const dps = avgElem * effectiveAps;
          eDps += dps;
          elemBreakdown.push({
            type: elem.type || 'elemental',
            min: elem.min,
            max: elem.max,
            dps: parseFloat(dps.toFixed(1))
          });
        }
      }
    }

    // Chaos DPS
    let cDps = 0;
    if (chaosDmg && typeof chaosDmg.min === 'number' && typeof chaosDmg.max === 'number') {
      const avgChaos = (chaosDmg.min + chaosDmg.max) / 2;
      cDps = avgChaos * effectiveAps;
    }

    // Quality scaling on Physical DPS
    // If current quality is > 0, we estimate 0% quality baseline:
    // approx: pDpsAt0 = pDps / (1 + (quality / 100))
    // potential at 20% quality:
    let pDpsAt20 = pDps;
    let pDpsAt0 = pDps;

    if (pDps > 0) {
      if (quality > 0) {
        pDpsAt0 = pDps / (1 + quality / 100);
      }
      pDpsAt20 = pDpsAt0 * 1.20;
    }

    const totalDps = pDps + eDps + cDps;
    const totalDpsAt20 = pDpsAt20 + eDps + cDps;

    return {
      isWeapon: true,
      aps: effectiveAps,
      criticalChance: crit !== undefined ? crit : null,
      quality,
      physicalDps: parseFloat(pDps.toFixed(1)),
      elementalDps: parseFloat(eDps.toFixed(1)),
      chaosDps: parseFloat(cDps.toFixed(1)),
      totalDps: parseFloat(totalDps.toFixed(1)),
      elementalBreakdown: elemBreakdown,
      chaosDamage: chaosDmg ? { min: chaosDmg.min, max: chaosDmg.max, dps: parseFloat(cDps.toFixed(1)) } : null,
      qualityScaling: {
        physicalDpsAt0Quality: parseFloat(pDpsAt0.toFixed(1)),
        physicalDpsAt20Quality: parseFloat(pDpsAt20.toFixed(1)),
        totalDpsAt20Quality: parseFloat(totalDpsAt20.toFixed(1))
      }
    };
  }
}

module.exports = new DpsAnalyzer();
