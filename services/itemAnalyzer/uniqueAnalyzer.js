const exileUiDataService = require('./exileUiDataService');

class UniqueAnalyzer {
  analyze(canonicalItem, game = 'poe1') {
    if (!canonicalItem || !canonicalItem.identity) {
      return null;
    }

    const { rarity, name, baseType } = canonicalItem.identity;
    if (rarity !== 'Unique') {
      return null;
    }

    const dropTierInfo = exileUiDataService.getUniqueDropTier(name, game);

    return {
      isUnique: true,
      name,
      baseType,
      tier: dropTierInfo ? dropTierInfo.tier : 'unknown',
      flavour: (dropTierInfo && dropTierInfo.flavour) || canonicalItem.flavourText || '',
      recognized: Boolean(dropTierInfo)
    };
  }
}

module.exports = new UniqueAnalyzer();
