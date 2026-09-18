/**
 * Category Registry for Path of Exile 1 & 2
 * Defines all known categories grouped by functional areas (POESTASH style).
 * Supports both Faustus Exchange and Stash Overview APIs.
 */

const CATEGORY_GROUPS = {
  poe1: [
    { id: 'general', label: 'GENERAL', order: 1 },
    { id: 'gems', label: 'EQUIPMENT & GEMS', order: 2 },
    { id: 'atlas', label: 'ATLAS', order: 3 },
    { id: 'crafting', label: 'CRAFTING', order: 4 }
  ],
  poe2: [
    { id: 'general', label: 'GENERAL', order: 1 },
    { id: 'equipment', label: 'EQUIPMENT', order: 2 },
    { id: 'atlas', label: 'ATLAS', order: 3 }
  ]
};

const CATEGORY_REGISTRY = {
  poe1: [
    // --- GENERAL (13 tabs, DjinnCoin & Incubator removed) ---
    { type: 'Currency', label: 'Currency', group: 'general', priority: true, iconClass: 'currency-ico', apiSource: 'exchange' },
    { type: 'Fragment', label: 'Fragments', group: 'general', priority: true, iconClass: 'fragment-ico', apiSource: 'exchange' },
    { type: 'Wombgift', label: 'Wombgifts', group: 'general', priority: false, iconClass: 'wombgift-ico', apiSource: 'stash' },
    { type: 'Runegraft', label: 'Runegrafts', group: 'general', priority: false, iconClass: 'runegraft-ico', apiSource: 'exchange' },
    { type: 'AllflameEmber', label: 'Allflame Embers', group: 'general', priority: false, iconClass: 'allflame-ico', apiSource: 'exchange' },
    { type: 'Corpse', label: 'Corpses', group: 'general', priority: false, iconClass: 'corpse-ico', apiSource: 'stash' },
    { type: 'Tattoo', label: 'Tattoos', group: 'general', priority: false, iconClass: 'tattoo-ico', apiSource: 'exchange' },
    { type: 'Omen', label: 'Omens', group: 'general', priority: false, iconClass: 'omen-ico', apiSource: 'exchange' },
    { type: 'Ducat', label: 'Ducats', group: 'general', priority: false, iconClass: 'ducat-ico', apiSource: 'exchange' },
    { type: 'EnshroudingCrystal', label: 'Enshrouding Crystals', group: 'general', priority: false, iconClass: 'crystal-ico', apiSource: 'exchange' },
    { type: 'DivinationCard', label: 'Divination Cards', group: 'general', priority: false, iconClass: 'card-ico', apiSource: 'exchange' },
    { type: 'Artifact', label: 'Artifacts', group: 'general', priority: false, iconClass: 'artifact-ico', apiSource: 'exchange' },
    { type: 'Oil', label: 'Oils', group: 'general', priority: false, iconClass: 'oil-ico', apiSource: 'exchange' },

    // --- EQUIPMENT & GEMS (12 tabs) ---
    { type: 'UniqueWeapon', label: 'Unique Weapons', group: 'gems', priority: false, iconClass: 'unique-weapon-ico', apiSource: 'stash' },
    { type: 'UniqueArmour', label: 'Unique Armours', group: 'gems', priority: false, iconClass: 'unique-armour-ico', apiSource: 'stash' },
    { type: 'UniqueAccessory', label: 'Unique Accessories', group: 'gems', priority: false, iconClass: 'unique-accessory-ico', apiSource: 'stash' },
    { type: 'UniqueFlask', label: 'Unique Flasks', group: 'gems', priority: false, iconClass: 'unique-flask-ico', apiSource: 'stash' },
    { type: 'UniqueJewel', label: 'Unique Jewels', group: 'gems', priority: false, iconClass: 'unique-jewel-ico', apiSource: 'stash' },
    { type: 'ForbiddenJewel', label: 'Forbidden Jewels', group: 'gems', priority: false, iconClass: 'forbidden-jewel-ico', apiSource: 'stash' },
    { type: 'ShrineBelt', label: 'Shrine Belts', group: 'gems', priority: false, iconClass: 'shrine-belt-ico', apiSource: 'stash' },
    { type: 'UniqueTincture', label: 'Unique Tinctures', group: 'gems', priority: false, iconClass: 'unique-tincture-ico', apiSource: 'stash' },
    { type: 'UniqueRelic', label: 'Unique Relics', group: 'gems', priority: false, iconClass: 'unique-relic-ico', apiSource: 'stash' },
    { type: 'SkillGem', label: 'Skill Gems', group: 'gems', priority: false, iconClass: 'skill-gem-ico', apiSource: 'stash' },
    { type: 'ImbuedGem', label: 'Imbued Gems', group: 'gems', priority: false, iconClass: 'imbued-gem-ico', apiSource: 'stash' },
    { type: 'ClusterJewel', label: 'Cluster Jewels', group: 'gems', priority: false, iconClass: 'cluster-jewel-ico', apiSource: 'stash' },

    // --- ATLAS (12 tabs) ---
    { type: 'Map', label: 'Maps', group: 'atlas', priority: false, iconClass: 'map-ico', apiSource: 'stash' },
    { type: 'BlightedMap', label: 'Blighted Maps', group: 'atlas', priority: false, iconClass: 'blight-map-ico', apiSource: 'stash' },
    { type: 'BlightRavagedMap', label: 'Blight-ravaged Maps', group: 'atlas', priority: false, iconClass: 'blight-ravaged-ico', apiSource: 'stash' },
    { type: 'UniqueMap', label: 'Unique Maps', group: 'atlas', priority: false, iconClass: 'unique-map-ico', apiSource: 'stash' },
    { type: 'ValdoMap', label: 'Valdo Maps', group: 'atlas', priority: false, iconClass: 'valdo-map-ico', apiSource: 'stash' },
    { type: 'DeliriumOrb', label: 'Delirium Orbs', group: 'atlas', priority: false, iconClass: 'delirium-ico', apiSource: 'exchange' },
    { type: 'Invitation', label: 'Invitations', group: 'atlas', priority: false, iconClass: 'invitation-ico', apiSource: 'stash' },
    { type: 'Scarab', label: 'Scarabs', group: 'atlas', priority: false, iconClass: 'scarab-ico', apiSource: 'exchange' },
    { type: 'Astrolabe', label: 'Astrolabes', group: 'atlas', priority: false, iconClass: 'astrolabe-ico', apiSource: 'exchange' },
    { type: 'Memory', label: 'Memories', group: 'atlas', priority: false, iconClass: 'memory-ico', apiSource: 'stash' },
    { type: 'Temple', label: 'Temples', group: 'atlas', priority: false, iconClass: 'temple-ico', apiSource: 'exchange' },
    { type: 'ScryingOrb', label: 'Scrying Orbs', group: 'atlas', priority: false, iconClass: 'scrying-orb-ico', apiSource: 'stash' },

    // --- CRAFTING (7 tabs) ---
    { type: 'BaseType', label: 'Base Types', group: 'crafting', priority: false, iconClass: 'base-type-ico', apiSource: 'stash' },
    { type: 'Flask', label: 'Flasks', group: 'crafting', priority: false, iconClass: 'flask-ico', apiSource: 'stash' },
    { type: 'Fossil', label: 'Fossils', group: 'crafting', priority: false, iconClass: 'fossil-ico', apiSource: 'exchange' },
    { type: 'Resonator', label: 'Resonators', group: 'crafting', priority: false, iconClass: 'resonator-ico', apiSource: 'exchange' },
    { type: 'Beast', label: 'Beasts', group: 'crafting', priority: false, iconClass: 'beast-ico', apiSource: 'stash' },
    { type: 'Essence', label: 'Essences', group: 'crafting', priority: false, iconClass: 'essence-ico', apiSource: 'exchange' },
    { type: 'Vial', label: 'Vials', group: 'crafting', priority: false, iconClass: 'vial-ico', apiSource: 'stash' }
  ],
  poe2: [
    // --- GENERAL (14 tabs, matching screenshot) ---
    { type: 'Currency', label: 'Currency', group: 'general', priority: true, iconClass: 'poe2-currency-ico', apiSource: 'exchange' },
    { type: 'Fragments', label: 'Fragments', group: 'general', priority: true, iconClass: 'fragment-ico', apiSource: 'exchange' },
    { type: 'Abyss', label: 'Abyssal Bones', group: 'general', priority: false, iconClass: 'poe2-abyss-ico', apiSource: 'exchange' },
    { type: 'UncutGems', label: 'Uncut Gems', group: 'general', priority: false, iconClass: 'poe2-gem-ico', apiSource: 'exchange' },
    { type: 'LineageSupportGems', label: 'Lineage Gems', group: 'general', priority: false, iconClass: 'poe2-lineage-ico', apiSource: 'exchange' },
    { type: 'Essences', label: 'Essences', group: 'general', priority: false, iconClass: 'essence-ico', apiSource: 'exchange' },
    { type: 'SoulCores', label: 'Soul Cores', group: 'general', priority: false, iconClass: 'poe2-vaal-ico', apiSource: 'exchange' },
    { type: 'Idols', label: 'Idols', group: 'general', priority: false, iconClass: 'poe2-idol-ico', apiSource: 'exchange' },
    { type: 'Runes', label: 'Runes', group: 'general', priority: false, iconClass: 'poe2-rune-ico', apiSource: 'exchange' },
    { type: 'Ritual', label: 'Omens', group: 'general', priority: false, iconClass: 'omen-ico', apiSource: 'exchange' },
    { type: 'Expedition', label: 'Expedition', group: 'general', priority: false, iconClass: 'poe2-expedition-ico', apiSource: 'exchange' },
    { type: 'Delirium', label: 'Liquid Emotions', group: 'general', priority: false, iconClass: 'poe2-delirium-ico', apiSource: 'exchange' },
    { type: 'Breach', label: 'Catalysts', group: 'general', priority: false, iconClass: 'catalyst-ico', apiSource: 'exchange' },
    { type: 'Verisium', label: 'Verisium', group: 'general', priority: false, iconClass: 'verisium-ico', apiSource: 'exchange' },

    // --- EQUIPMENT (7 tabs, matching screenshot) ---
    { type: 'UniqueWeapons', label: 'Unique Weapons', group: 'equipment', priority: false, iconClass: 'unique-weapon-ico', apiSource: 'stash' },
    { type: 'UniqueArmours', label: 'Unique Armours', group: 'equipment', priority: false, iconClass: 'unique-armour-ico', apiSource: 'stash' },
    { type: 'UniqueAccessories', label: 'Unique Accessories', group: 'equipment', priority: false, iconClass: 'unique-accessory-ico', apiSource: 'stash' },
    { type: 'UniqueFlasks', label: 'Unique Flasks', group: 'equipment', priority: false, iconClass: 'unique-flask-ico', apiSource: 'stash' },
    { type: 'UniqueCharms', label: 'Unique Charms', group: 'equipment', priority: false, iconClass: 'unique-charm-ico', apiSource: 'stash' },
    { type: 'UniqueJewels', label: 'Unique Jewels', group: 'equipment', priority: false, iconClass: 'unique-jewel-ico', apiSource: 'stash' },
    { type: 'UniqueSanctumRelics', label: 'Unique Relics', group: 'equipment', priority: false, iconClass: 'unique-relic-ico', apiSource: 'stash' },

    // --- ATLAS (2 tabs, matching screenshot) ---
    { type: 'UniqueTablets', label: 'Unique Tablets', group: 'atlas', priority: false, iconClass: 'unique-tablet-ico', apiSource: 'stash' },
    { type: 'PrecursorTablets', label: 'Precursor Tablets', group: 'atlas', priority: false, iconClass: 'precursor-tablet-ico', apiSource: 'stash' }
  ]
};

const CategoryRegistry = {
  GROUPS: CATEGORY_GROUPS,

  getRegistry(game = 'poe1') {
    return CATEGORY_REGISTRY[game] || [];
  },

  getDefinition(game, type) {
    const list = this.getRegistry(game);
    return list.find(c => c.type.toLowerCase() === (type || '').toLowerCase());
  },

  findType(game, input) {
    if (!input) return null;
    const lower = input.toLowerCase().trim();
    const list = this.getRegistry(game);
    const match = list.find(c => c.type.toLowerCase() === lower || c.label.toLowerCase() === lower);
    return match ? match.type : null;
  },

  isValid(game, input) {
    return !!this.findType(game, input);
  },

  getLabel(game, type) {
    const def = this.getDefinition(game, type);
    return def ? def.label : type;
  },

  getGroup(game, type) {
    const def = this.getDefinition(game, type);
    return def ? def.group : 'general';
  },

  getGroups(game = 'poe1') {
    if (CATEGORY_GROUPS[game]) {
      return CATEGORY_GROUPS[game];
    }
    return CATEGORY_GROUPS.poe1;
  }
};

module.exports = CategoryRegistry;
