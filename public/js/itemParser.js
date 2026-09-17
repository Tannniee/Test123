/**
 * PoE In-game Item Text Parser (Ctrl+C from game)
 */
const PoeItemParser = {
  parse(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();
    if (!trimmed.includes('Rarity:')) {
      // Not a standard PoE item text, might be just a single name pasted
      return {
        isPoEFormat: false,
        name: trimmed,
        raw: trimmed
      };
    }

    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    let rarity = '';
    let itemClass = '';
    let name = '';
    let baseType = '';
    let links = 0;

    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith('Item Class:')) {
        itemClass = line.replace('Item Class:', '').trim();
      } else if (line.startsWith('Rarity:')) {
        rarity = line.replace('Rarity:', '').trim();
        // The line(s) following Rarity are name and base type
        if (index + 1 < lines.length && !lines[index + 1].startsWith('---')) {
          name = lines[index + 1];
        }
        if (index + 2 < lines.length && !lines[index + 2].startsWith('---')) {
          baseType = lines[index + 2];
        }
      } else if (line.startsWith('Sockets:')) {
        // Count links (e.g. R-R-B-B-G-G -> 6 links)
        const socketStr = line.replace('Sockets:', '').trim();
        const groups = socketStr.split(' ');
        for (const g of groups) {
          const groupLinks = (g.match(/-/g) || []).length + 1;
          if (groupLinks > links) links = groupLinks;
        }
      }
      index++;
    }

    // Special cases: for Currency, Cards, Gems, the item name is the base type
    if (rarity === 'Currency' || rarity === 'Divination Card' || rarity === 'Gem' || 
        itemClass === 'Stackable Currency' || itemClass === 'Divination Cards' || 
        (itemClass && itemClass.includes('Gem'))) {
      baseType = name;
    }

    // For Rare items in PoE, random names (e.g. 'Gloom Buckle') won't exist on ninja, search by baseType!
    let query = name;
    if (rarity === 'Rare' && baseType) {
      query = baseType;
    }

    return {
      isPoEFormat: true,
      itemClass,
      rarity,
      name,
      baseType,
      links,
      searchQuery: query || name || baseType,
      raw: text
    };
  }
};

if (typeof module !== 'undefined') {
  module.exports = PoeItemParser;
}
