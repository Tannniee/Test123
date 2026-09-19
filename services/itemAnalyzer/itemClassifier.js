/**
 * POESTASH Item Classifier
 * Categorizes canonical items into semantic product groups (currency, gear, cards, gems, maps, etc.)
 */

class ItemClassifier {
  /**
   * Classifies a canonical item into semantic metadata.
   * @param {Object} canonicalItem Canonical item model from ItemTextParser
   * @returns {Object} Semantic classification result
   */
  static classify(canonicalItem) {
    if (!canonicalItem || typeof canonicalItem !== 'object') {
      return {
        kind: 'unknown',
        isGear: false,
        requiresMarketLookup: false,
        requiresAffixAnalysis: false,
        displayLabel: 'Unknown Item'
      };
    }

    const rarity = (canonicalItem.identity?.rarity || '').toLowerCase().trim();
    const itemClass = (canonicalItem.identity?.itemClass || '').toLowerCase().trim();
    const name = (canonicalItem.identity?.name || '').toLowerCase().trim();
    const baseType = (canonicalItem.identity?.baseType || '').toLowerCase().trim();

    // 1. Currency
    if (
      rarity === 'currency' ||
      itemClass === 'stackable currency' ||
      itemClass === 'currency' ||
      itemClass.includes('delirium orb') ||
      itemClass.includes('essence') ||
      itemClass.includes('fossil') ||
      itemClass.includes('resonator') ||
      itemClass.includes('oil') ||
      itemClass.includes('tattoo') ||
      itemClass.includes('omen') ||
      itemClass.includes('catalyst') ||
      itemClass.includes('rune') ||
      itemClass.includes('soul core')
    ) {
      return {
        kind: 'currency',
        isGear: false,
        requiresMarketLookup: true,
        requiresAffixAnalysis: false,
        displayLabel: 'Currency'
      };
    }

    // 2. Divination Card
    if (
      rarity === 'divination card' ||
      itemClass === 'divination cards' ||
      itemClass === 'divination card'
    ) {
      return {
        kind: 'divination_card',
        isGear: false,
        requiresMarketLookup: true,
        requiresAffixAnalysis: false,
        displayLabel: 'Divination Card'
      };
    }

    // 3. Gems
    if (
      rarity === 'gem' ||
      itemClass.includes('gem') ||
      baseType.includes('uncut skill gem') ||
      baseType.includes('uncut spirit gem')
    ) {
      return {
        kind: 'gem',
        isGear: false,
        requiresMarketLookup: true,
        requiresAffixAnalysis: false,
        displayLabel: 'Skill / Support Gem'
      };
    }

    // 4. Maps / Waystones
    if (
      itemClass.includes('map') ||
      itemClass.includes('waystone') ||
      canonicalItem.properties?.mapTier !== null ||
      name.includes('map') ||
      baseType.includes('waystone')
    ) {
      return {
        kind: 'map',
        isGear: false,
        requiresMarketLookup: rarity === 'unique',
        requiresAffixAnalysis: true,
        displayLabel: 'Map / Waystone'
      };
    }

    // 5. Fragments
    if (
      itemClass.includes('fragment') ||
      itemClass.includes('breachstone') ||
      itemClass.includes('splinter') ||
      itemClass.includes('invitation') ||
      itemClass.includes('emblem') ||
      itemClass.includes('tablet')
    ) {
      return {
        kind: 'fragment',
        isGear: false,
        requiresMarketLookup: true,
        requiresAffixAnalysis: false,
        displayLabel: 'Fragment / Boss Key'
      };
    }

    // 6. Jewels
    if (itemClass.includes('jewel') || baseType.includes('jewel')) {
      return {
        kind: 'jewel',
        isGear: true,
        requiresMarketLookup: rarity === 'unique',
        requiresAffixAnalysis: rarity !== 'normal',
        displayLabel: 'Jewel'
      };
    }

    // 7. Flasks & Tinctures & Charms
    if (
      itemClass.includes('flask') ||
      itemClass.includes('tincture') ||
      itemClass.includes('charm') ||
      baseType.includes('flask') ||
      baseType.includes('tincture')
    ) {
      return {
        kind: 'flask',
        isGear: true,
        requiresMarketLookup: rarity === 'unique',
        requiresAffixAnalysis: rarity !== 'normal',
        displayLabel: 'Flask / Tincture'
      };
    }

    // 8. Gear (Weapons, Armours, Accessories)
    const isGearClass =
      itemClass.includes('body armour') ||
      itemClass.includes('helmet') ||
      itemClass.includes('glove') ||
      itemClass.includes('boot') ||
      itemClass.includes('shield') ||
      itemClass.includes('quiver') ||
      itemClass.includes('bow') ||
      itemClass.includes('staff') ||
      itemClass.includes('stave') ||
      itemClass.includes('wand') ||
      itemClass.includes('sceptre') ||
      itemClass.includes('axe') ||
      itemClass.includes('sword') ||
      itemClass.includes('mace') ||
      itemClass.includes('dagger') ||
      itemClass.includes('claw') ||
      itemClass.includes('flail') ||
      itemClass.includes('crossbow') ||
      itemClass.includes('amulet') ||
      itemClass.includes('ring') ||
      itemClass.includes('belt') ||
      itemClass.includes('focus');

    if (isGearClass || canonicalItem.requirements?.level !== null || canonicalItem.properties?.armour > 0 || canonicalItem.properties?.physicalDamage !== null) {
      if (rarity === 'unique') {
        return {
          kind: 'unique_gear',
          isGear: true,
          requiresMarketLookup: true,
          requiresAffixAnalysis: true,
          displayLabel: 'Unique Equipment'
        };
      }
      if (rarity === 'rare') {
        return {
          kind: 'rare_gear',
          isGear: true,
          requiresMarketLookup: false, // Rares rely on roll and mod analysis
          requiresAffixAnalysis: true,
          displayLabel: 'Rare Equipment'
        };
      }
      if (rarity === 'magic') {
        return {
          kind: 'magic_gear',
          isGear: true,
          requiresMarketLookup: false,
          requiresAffixAnalysis: true,
          displayLabel: 'Magic Equipment'
        };
      }
      return {
        kind: 'normal_gear',
        isGear: true,
        requiresMarketLookup: false,
        requiresAffixAnalysis: false,
        displayLabel: 'Normal Base Item'
      };
    }

    return {
      kind: 'unknown',
      isGear: false,
      requiresMarketLookup: false,
      requiresAffixAnalysis: false,
      displayLabel: 'Other Item'
    };
  }
}

module.exports = ItemClassifier;
