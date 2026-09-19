class MarketResolver {
  /**
   * Resolves market valuation from cached poe.ninja data with variant awareness.
   * Handles gems (level/quality/corrupted), links (5L/6L), maps (tier), and bases.
   *
   * @param {Object} canonicalItem Parsed canonical item model
   * @param {Object} options Configuration { game, league, cacheManager }
   * @returns {Object|null} Market valuation data or null
   */
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
      const flags = canonicalItem.flags || {};
      const properties = canonicalItem.properties || {};

      let matchedItem = null;
      let isBaseReference = false;

      // 1. Exact or Variant match by Name (for Uniques, Currency, Cards, Gems, Maps)
      const isRandomlyNamedGear = rarity === 'rare' || rarity === 'magic';
      if (name && !isRandomlyNamedGear) {
        const lowerName = name.toLowerCase();
        const candidates = items.filter(it => it.name && it.name.toLowerCase() === lowerName);

        if (candidates.length === 1) {
          matchedItem = candidates[0];
        } else if (candidates.length > 1) {
          // Disambiguate by variants:
          // A. Links (5L, 6L) - support canonicalItem.links (standard) and canonicalItem.maxLinks
          const rawLinks = canonicalItem.links !== undefined ? canonicalItem.links : canonicalItem.maxLinks;
          const targetLinks = (typeof rawLinks === 'number' && rawLinks >= 5) ? rawLinks : null;

          // B. Map Tier
          const targetMapTier = properties.mapTier || null;

          // C. Gem Level & Quality
          const targetGemLevel = properties.gemLevel || null;
          const targetQuality = properties.quality || 0;

          // D. Corrupted Flag
          const isCorrupted = !!flags.corrupted;

          matchedItem = candidates.find(it => {
            // 1. Links constraint
            if (targetLinks) {
              const matchesLinks = it.links === targetLinks || it.variant?.includes(`${targetLinks}L`);
              if (!matchesLinks) return false;
            }

            // 2. Map tier constraint
            if (targetMapTier) {
              const matchesTier = it.mapTier === targetMapTier || it.subCategory === `Tier ${targetMapTier}`;
              if (!matchesTier) return false;
            }

            // 3. Gem level constraint
            if (targetGemLevel) {
              const matchesGemLevel = it.gemLevel === targetGemLevel || 
                                     (it.variant && (it.variant.startsWith(`${targetGemLevel}/`) || it.variant === String(targetGemLevel)));
              if (!matchesGemLevel) return false;
            }

            // 4. Gem quality constraint
            if (targetQuality > 0 && (it.gemQuality || it.variant?.includes('/'))) {
              const matchesQuality = it.gemQuality === targetQuality || it.variant?.endsWith(`/${targetQuality}`);
              if (!matchesQuality) return false;
            }

            // 5. Corrupted state constraint
            const candidateIsCorrupted = !!(it.corrupted || it.detailsId?.includes('-corrupted') || it.variant?.toLowerCase().includes('corrupted'));
            if (isCorrupted && !candidateIsCorrupted) {
              return false;
            }
            if (!isCorrupted && candidateIsCorrupted) {
              return false;
            }

            return true;
          }) || candidates[0];
        }
      }

      // 2. Fallback match by BaseType (for normal, magic, and rare crafting bases)
      if (!matchedItem && baseType) {
        const lowerBase = baseType.toLowerCase();
        matchedItem = items.find(it => 
          (it.name && it.name.toLowerCase() === lowerBase) || 
          (it.baseType && it.baseType.toLowerCase() === lowerBase)
        );
        if (matchedItem) {
          isBaseReference = true;
        }
      }

      if (isRandomlyNamedGear && matchedItem) {
        isBaseReference = true;
      }

      if (!matchedItem) {
        return null;
      }

      const volume = matchedItem.volume ?? matchedItem.count ?? matchedItem.listingCount ?? null;
      const count = matchedItem.count ?? matchedItem.volume ?? matchedItem.listingCount ?? null;

      return {
        name: matchedItem.name,
        baseType: matchedItem.baseType || baseType,
        sourceType: matchedItem.sourceType,
        chaosValue: matchedItem.chaosValue || 0,
        divineValue: matchedItem.divineValue || 0,
        sparkline: matchedItem.sparkline || null,
        count: count,
        volume: volume,
        listingCount: volume,
        icon: matchedItem.icon || null,
        league: activeLeague,
        game,
        variant: matchedItem.variant || null,
        links: matchedItem.links || null,
        mapTier: matchedItem.mapTier || null,
        gemLevel: matchedItem.gemLevel || null,
        gemQuality: matchedItem.gemQuality || null,
        corrupted: matchedItem.corrupted ?? null,
        isBaseReference,
        referenceLabel: isBaseReference ? 'Base item reference' : null
      };
    } catch (err) {
      return null;
    }
  }
}

module.exports = new MarketResolver();
