class MarketResolver {
  resolve(canonicalItem, options = {}) {
    const { game = 'poe1', league = null, cacheManager = null } = options;
    if (!canonicalItem || !cacheManager) {
      return null;
    }

    try {
      const activeLeague = league || cacheManager.getActiveLeague(game);
      const data = cacheManager.getData(game, activeLeague);
      const items = (data && Array.isArray(data.items)) ? data.items : [];

      const name = canonicalItem.identity ? canonicalItem.identity.name : null;
      const baseType = canonicalItem.identity ? canonicalItem.identity.baseType : null;
      const rarity = canonicalItem.identity ? (canonicalItem.identity.rarity || '').toLowerCase() : '';

      let matchedItem = null;

      // 1. Exact match by Name (for Uniques, Currency, Cards, Gems - skip for randomly named Rare/Magic gear)
      const isRandomlyNamedGear = rarity === 'rare' || rarity === 'magic';
      if (name && !isRandomlyNamedGear) {
        const lowerName = name.toLowerCase();
        matchedItem = items.find(it => it.name && it.name.toLowerCase() === lowerName);
      }

      // 2. Fallback match by BaseType (for normal/magic/rare bases)
      if (!matchedItem && baseType) {
        const lowerBase = baseType.toLowerCase();
        matchedItem = items.find(it => (it.name && it.name.toLowerCase() === lowerBase) || (it.baseType && it.baseType.toLowerCase() === lowerBase));
      }

      if (!matchedItem) {
        return null;
      }

      return {
        name: matchedItem.name,
        baseType: matchedItem.baseType || baseType,
        sourceType: matchedItem.sourceType,
        chaosValue: matchedItem.chaosValue || 0,
        divineValue: matchedItem.divineValue || 0,
        sparkline: matchedItem.sparkline || null,
        count: matchedItem.count || null,
        icon: matchedItem.icon || null,
        league: activeLeague,
        game
      };
    } catch (err) {
      return null;
    }
  }
}

module.exports = new MarketResolver();
