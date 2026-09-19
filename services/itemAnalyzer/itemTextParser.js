/**
 * POESTASH Canonical Item Model & Text Parser
 * Decomposes native Path of Exile clipboard text (PoE 1 & PoE 2) into structured canonical objects.
 */

class ItemTextParser {
  /**
   * Parses raw clipboard item text into a canonical item representation.
   * @param {string} rawText Raw item text copied from game via Ctrl+C
   * @param {string} [gameOverride] Optional game version ('poe1' | 'poe2')
   * @returns {Object} Canonical item model
   */
  static parse(rawText, gameOverride = null) {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid input: rawText must be a non-empty string.');
    }

    const trimmed = rawText.trim();
    if (trimmed.length === 0) {
      throw new Error('Invalid input: rawText cannot be whitespace only.');
    }

    // Determine game version (PoE 2 markers or explicit override)
    const isPoe2Detected =
      gameOverride === 'poe2' ||
      trimmed.includes('realm: poe2') ||
      trimmed.includes('Waystone Tier') ||
      trimmed.includes('Martial Staves') ||
      trimmed.includes('Quarterstaff') ||
      trimmed.includes('Crossbow') ||
      trimmed.includes('Focus') ||
      trimmed.includes('Flail') ||
      trimmed.includes('Uncut Skill Gem') ||
      trimmed.includes('Uncut Spirit Gem');

    const game = isPoe2Detected ? 'poe2' : (gameOverride === 'poe1' ? 'poe1' : 'poe1');

    // Split text into sections separated by '--------'
    const sectionBlocks = trimmed.split(/\r?\n-{6,}\r?\n/);
    const sections = sectionBlocks.map(block =>
      block.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
    ).filter(sec => sec.length > 0);

    if (sections.length === 0) {
      throw new Error('Failed to parse item: No valid sections found.');
    }

    // 1. Parse Identity Section (Header)
    const identity = this._parseIdentity(sections[0]);

    // 2. Initialize Property & Modifier Containers
    const properties = {
      itemLevel: null,
      quality: 0,
      qualityType: null,
      armour: 0,
      evasion: 0,
      energyShield: 0,
      ward: 0,
      physicalDamage: null,
      elementalDamage: [],
      chaosDamage: null,
      criticalChance: null,
      attacksPerSecond: null,
      stackSize: null,
      gemLevel: null,
      mapTier: null,
      itemQuantity: null,
      itemRarity: null,
      monsterPackSize: null
    };

    const requirements = {
      level: null,
      str: null,
      dex: null,
      int: null
    };

    const sockets = [];
    let maxLinks = 0;

    const modifiers = {
      enchants: [],
      implicits: [],
      explicits: [],
      fractured: [],
      crafted: [],
      scourge: []
    };

    const flags = {
      corrupted: false,
      mirrored: false,
      synthesised: false,
      fractured: false,
      unidentified: false,
      veiled: false,
      split: false,
      relic: false
    };

    let flavourTextLines = [];

    // 3. Process Subsequent Sections
    for (let i = 1; i < sections.length; i++) {
      const sec = sections[i];

      // Sockets Section
      const socketsLine = sec.find(l => l.startsWith('Sockets:'));
      if (socketsLine) {
        const parsedSockets = this._parseSockets(socketsLine);
        sockets.push(...parsedSockets.sockets);
        maxLinks = parsedSockets.maxLinks;
        continue;
      }

      // Requirements Section
      if (sec[0] === 'Requirements:' || sec.some(l => l.startsWith('Requirements:'))) {
        this._parseRequirements(sec, requirements);
        continue;
      }

      // Item Level Section
      const ilvlLine = sec.find(l => l.startsWith('Item Level:'));
      if (ilvlLine) {
        const m = ilvlLine.match(/Item Level:\s*(\d+)/i);
        if (m) properties.itemLevel = parseInt(m[1], 10);
        continue;
      }

      // Single-flag Section (Corrupted, Mirrored, Unidentified, etc.)
      const flagFound = this._parseFlags(sec, flags);
      if (flagFound) {
        continue;
      }

      // Properties Section (Armour, Energy Shield, Weapon DPS, Stack Size, Gem Level, Quality)
      const hasProperty = this._parseProperties(sec, properties);
      if (hasProperty) {
        continue;
      }

      // Modifiers or Flavour Text
      const isFlavour = this._parseModifiersOrFlavour(sec, modifiers, flavourTextLines);
    }

    return {
      game,
      identity,
      properties,
      requirements,
      sockets,
      links: maxLinks,
      modifiers,
      flags,
      flavourText: flavourTextLines.join('\n').trim(),
      rawText: trimmed
    };
  }

  static _parseIdentity(headerLines) {
    let itemClass = '';
    let rarity = '';
    let name = '';
    let baseType = '';

    const remaining = [];
    for (const line of headerLines) {
      if (line.startsWith('Item Class:')) {
        itemClass = line.replace('Item Class:', '').trim();
      } else if (line.startsWith('Rarity:')) {
        rarity = line.replace('Rarity:', '').trim();
      } else {
        remaining.push(line);
      }
    }

    if (remaining.length === 1) {
      name = remaining[0];
      baseType = remaining[0];
    } else if (remaining.length >= 2) {
      name = remaining[0];
      baseType = remaining[1];
    }

    // Normalized Rarity & Name overrides
    const isSpecialType = rarity === 'Currency' ||
                          rarity === 'Divination Card' ||
                          rarity === 'Gem' ||
                          itemClass === 'Stackable Currency' ||
                          itemClass === 'Divination Cards' ||
                          itemClass.includes('Gem');

    if (isSpecialType && !baseType) {
      baseType = name;
    }

    return {
      rarity: rarity || 'Normal',
      name: name || baseType,
      baseType: baseType || name,
      itemClass: itemClass || 'Unknown'
    };
  }

  static _parseProperties(lines, props) {
    let matchedAny = false;

    for (const line of lines) {
      // Quality
      if (line.startsWith('Quality:')) {
        const qm = line.match(/Quality:\s*([+-]?\d+)%/i);
        if (qm) props.quality = parseInt(qm[1], 10);
        const tm = line.match(/Quality\s*\((.*?)\):/i);
        if (tm) props.qualityType = tm[1];
        matchedAny = true;
      }
      // Armour
      else if (line.startsWith('Armour:')) {
        const m = line.match(/Armour:\s*(\d+)/i);
        if (m) props.armour = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Evasion Rating
      else if (line.startsWith('Evasion Rating:')) {
        const m = line.match(/Evasion Rating:\s*(\d+)/i);
        if (m) props.evasion = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Energy Shield
      else if (line.startsWith('Energy Shield:')) {
        const m = line.match(/Energy Shield:\s*(\d+)/i);
        if (m) props.energyShield = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Ward
      else if (line.startsWith('Ward:')) {
        const m = line.match(/Ward:\s*(\d+)/i);
        if (m) props.ward = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Physical Damage
      else if (line.startsWith('Physical Damage:')) {
        const m = line.match(/Physical Damage:\s*(\d+)-(\d+)/i);
        if (m) props.physicalDamage = { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        matchedAny = true;
      }
      // Elemental Damage
      else if (line.startsWith('Elemental Damage:')) {
        // e.g. "Elemental Damage: 25-50 (fire), 10-30 (lightning)"
        const elements = [];
        const matches = line.matchAll(/(\d+)-(\d+)\s*\((fire|cold|lightning)\)/gi);
        for (const em of matches) {
          elements.push({
            type: em[3].toLowerCase(),
            min: parseInt(em[1], 10),
            max: parseInt(em[2], 10)
          });
        }
        if (elements.length > 0) props.elementalDamage = elements;
        matchedAny = true;
      }
      // Chaos Damage
      else if (line.startsWith('Chaos Damage:')) {
        const m = line.match(/Chaos Damage:\s*(\d+)-(\d+)/i);
        if (m) props.chaosDamage = { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        matchedAny = true;
      }
      // Critical Strike Chance
      else if (line.startsWith('Critical Strike Chance:')) {
        const m = line.match(/Critical Strike Chance:\s*([\d.]+)%/i);
        if (m) props.criticalChance = parseFloat(m[1]);
        matchedAny = true;
      }
      // Attacks per Second
      else if (line.startsWith('Attacks per Second:')) {
        const m = line.match(/Attacks per Second:\s*([\d.]+)/i);
        if (m) props.attacksPerSecond = parseFloat(m[1]);
        matchedAny = true;
      }
      // Stack Size
      else if (line.startsWith('Stack Size:')) {
        const m = line.match(/Stack Size:\s*(\d+)\/(\d+)/i);
        if (m) props.stackSize = { current: parseInt(m[1], 10), max: parseInt(m[2], 10) };
        matchedAny = true;
      }
      // Gem Level
      else if (line.startsWith('Level:')) {
        const m = line.match(/^Level:\s*(\d+)/i);
        if (m) props.gemLevel = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Map Tier / Waystone Tier
      else if (line.startsWith('Map Tier:') || line.startsWith('Waystone Tier:')) {
        const m = line.match(/(?:Map|Waystone) Tier:\s*(\d+)/i);
        if (m) props.mapTier = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Item Quantity
      else if (line.startsWith('Item Quantity:')) {
        const m = line.match(/Item Quantity:\s*\+?(\d+)%/i);
        if (m) props.itemQuantity = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Item Rarity
      else if (line.startsWith('Item Rarity:')) {
        const m = line.match(/Item Rarity:\s*\+?(\d+)%/i);
        if (m) props.itemRarity = parseInt(m[1], 10);
        matchedAny = true;
      }
      // Monster Pack Size
      else if (line.startsWith('Monster Pack Size:')) {
        const m = line.match(/Monster Pack Size:\s*\+?(\d+)%/i);
        if (m) props.monsterPackSize = parseInt(m[1], 10);
        matchedAny = true;
      }
    }

    return matchedAny;
  }

  static _parseRequirements(lines, reqs) {
    for (const line of lines) {
      if (line.startsWith('Level:')) {
        const m = line.match(/Level:\s*(\d+)/i);
        if (m) reqs.level = parseInt(m[1], 10);
      } else if (line.startsWith('Str:')) {
        const m = line.match(/Str:\s*(\d+)/i);
        if (m) reqs.str = parseInt(m[1], 10);
      } else if (line.startsWith('Dex:')) {
        const m = line.match(/Dex:\s*(\d+)/i);
        if (m) reqs.dex = parseInt(m[1], 10);
      } else if (line.startsWith('Int:')) {
        const m = line.match(/Int:\s*(\d+)/i);
        if (m) reqs.int = parseInt(m[1], 10);
      }
    }
  }

  static _parseSockets(line) {
    const raw = line.replace('Sockets:', '').trim();
    if (!raw) return { sockets: [], maxLinks: 0 };

    const groups = raw.split(/\s+/);
    const result = [];
    let maxLinks = 0;

    groups.forEach((grp, gIdx) => {
      const colors = grp.split('-');
      if (colors.length > maxLinks) {
        maxLinks = colors.length;
      }
      colors.forEach(c => {
        result.push({ group: gIdx, color: c.toUpperCase() });
      });
    });

    return { sockets: result, maxLinks };
  }

  static _parseFlags(lines, flags) {
    let matched = false;
    for (const line of lines) {
      if (line === 'Corrupted') {
        flags.corrupted = true;
        matched = true;
      } else if (line === 'Mirrored') {
        flags.mirrored = true;
        matched = true;
      } else if (line === 'Synthesised Item' || line === 'Synthesised') {
        flags.synthesised = true;
        matched = true;
      } else if (line === 'Fractured Item' || line === 'Fractured') {
        flags.fractured = true;
        matched = true;
      } else if (line === 'Unidentified') {
        flags.unidentified = true;
        matched = true;
      } else if (line === 'Veiled') {
        flags.veiled = true;
        matched = true;
      } else if (line === 'Split') {
        flags.split = true;
        matched = true;
      } else if (line === 'Foil Unique' || line === 'Relic Unique') {
        flags.relic = true;
        matched = true;
      }
    }
    return matched;
  }

  static _parseModifiersOrFlavour(lines, modifiers, flavour) {
    // Determine if line or section is flavour text (in PoE, flavour text is wrapped in quotes or follows attribution)
    const isFlavourLine = (l) =>
      l.startsWith('"') ||
      l.endsWith('"') ||
      l.startsWith('“') ||
      l.endsWith('”') ||
      l.startsWith('—') ||
      l.startsWith('-- ') ||
      l.startsWith('- ');

    const allAreFlavour = lines.length > 0 && lines.every(l => isFlavourLine(l));

    for (const line of lines) {
      if (line.endsWith('(enchant)')) {
        modifiers.enchants.push(line.replace(/\s*\(enchant\)$/i, ''));
      } else if (line.endsWith('(implicit)')) {
        modifiers.implicits.push(line.replace(/\s*\(implicit\)$/i, ''));
      } else if (line.endsWith('(fractured)')) {
        modifiers.fractured.push(line.replace(/\s*\(fractured\)$/i, ''));
      } else if (line.endsWith('(crafted)')) {
        modifiers.crafted.push(line.replace(/\s*\(crafted\)$/i, ''));
      } else if (line.endsWith('(scourge)')) {
        modifiers.scourge.push(line.replace(/\s*\(scourge\)$/i, ''));
      } else if (isFlavourLine(line) || allAreFlavour) {
        flavour.push(line);
      } else {
        modifiers.explicits.push(line);
      }
    }

    return true;
  }
}

module.exports = ItemTextParser;
