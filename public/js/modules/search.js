/**
 * Fuzzy Search & Multi-Token Ranking Module
 */

export const Search = {
  /**
   * Fast Levenshtein distance algorithm
   */
  levenshtein(a, b) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;

    const row = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) row[j] = j;

    for (let i = 1; i <= la; i++) {
      let prev = i;
      for (let j = 1; j <= lb; j++) {
        let val;
        if (a[i - 1] === b[j - 1]) {
          val = row[j - 1];
        } else {
          val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
        }
        row[j - 1] = prev;
        prev = val;
      }
      row[lb] = prev;
    }
    return row[lb];
  },

  /**
   * Check if a word fuzzy-matches a target word
   */
  isWordFuzzyMatch(word, targetWord) {
    if (targetWord.includes(word)) return true;
    if (word.length < 3) return false;

    const maxDist = word.length <= 4 ? 1 : 2;
    // Direct edit distance
    const dist = this.levenshtein(word, targetWord);
    if (dist <= maxDist) return true;

    // Check substring prefixes if targetWord is longer
    if (targetWord.length > word.length) {
      const prefix = targetWord.slice(0, word.length);
      if (this.levenshtein(word, prefix) <= maxDist) return true;
    }

    return false;
  },

  /**
   * Compute multi-token ranking score
   * Higher score = better match
   */
  calculateScore(itemName, rawQuery) {
    const name = itemName.toLowerCase().trim();
    const query = rawQuery.toLowerCase().trim();

    if (!query) return 1;

    // 1. Exact match (Score 100)
    if (name === query) return 100;

    // 2. Starts with query (Score 80)
    if (name.startsWith(query)) return 80;

    // 3. Substring match (Score 50-70 depending on position)
    const subIdx = name.indexOf(query);
    if (subIdx !== -1) {
      return 70 - Math.min(subIdx, 20);
    }

    // 4. Token-based word matching
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const nameTokens = name.split(/\s+/).filter(Boolean);

    let allExactTokens = true;
    let allFuzzyTokens = true;
    let matchedTokenCount = 0;

    for (const qTok of queryTokens) {
      const hasExact = nameTokens.some(nTok => nTok.includes(qTok));
      if (hasExact) {
        matchedTokenCount++;
      } else {
        allExactTokens = false;
        const hasFuzzy = nameTokens.some(nTok => this.isWordFuzzyMatch(qTok, nTok));
        if (hasFuzzy) {
          matchedTokenCount++;
        } else {
          allFuzzyTokens = false;
        }
      }
    }

    if (allExactTokens && matchedTokenCount === queryTokens.length) {
      return 60; // All query words present in name
    }

    if (allFuzzyTokens && matchedTokenCount === queryTokens.length) {
      return 35; // Fuzzy matched all tokens (e.g. "divne orb" -> "Divine Orb")
    }

    if (matchedTokenCount > 0) {
      return Math.round((matchedTokenCount / queryTokens.length) * 25);
    }

    // Direct whole-name fuzzy fallback
    if (query.length >= 4) {
      const dist = this.levenshtein(query, name);
      if (dist <= 2) return 30;
      if (dist <= 3 && name.length >= 7) return 20;
    }

    return 0;
  },

  /**
   * Filter and rank items based on search query, price filter, category, and favorites
   */
  filterAndRank(items, options) {
    const {
      query = '',
      category = 'All',
      subCategory = null,
      priceFilter = 'all',
      onlyFavorites = false,
      favoritesSet = new Set(),
      game = 'poe1'
    } = options;

    const trimmedQuery = query.trim();
    const results = [];

    for (const item of items) {
      // 1. Favorites filter
      if (onlyFavorites && !favoritesSet.has(item.id)) {
        continue;
      }

      // 2. Category filter
      if (category !== 'All' && item.category !== category) {
        continue;
      }

      if (subCategory && item.subCategory !== subCategory) {
        continue;
      }

      // 3. Price tier filter
      const primaryVal = game === 'poe2' ? (typeof item.exaltedValue === 'number' ? item.exaltedValue : 0) : (item.chaosValue || 0);
      if (priceFilter === '<10c' && primaryVal >= 10) continue;
      if (priceFilter === '10-100c' && (primaryVal < 10 || primaryVal > 100)) continue;
      if (priceFilter === '1-5d') {
        const div = item.divineValue || 0;
        if (div < 1 || div > 5) continue;
      }
      if (priceFilter === '>5d') {
        const div = item.divineValue || 0;
        if (div < 5) continue;
      }

      // 4. Search Ranking
      let score = 1;
      if (trimmedQuery) {
        score = this.calculateScore(item.name, trimmedQuery);
        if (score === 0) continue; // Does not match
      }

      results.push({ item, score });
    }

    // Sort by search score descending if searching, otherwise keep natural/presorted
    if (trimmedQuery) {
      results.sort((a, b) => b.score - a.score);
    }

    return results.map(r => r.item);
  }
};
