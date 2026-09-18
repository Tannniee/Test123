/**
 * Category Registry for Path of Exile 1 & 2
 * Defines all known categories grouped by functional areas (POESTASH style).
 * Supports both Faustus Exchange and Stash Overview APIs.
 */

const CATEGORY_GROUPS = {
  general: { id: 'general', label: 'GENERAL', order: 1 },
  atlas: { id: 'atlas', label: 'ATLAS & MAPS', order: 2 },
  gems: { id: 'gems', label: 'EQUIPMENT & GEMS', order: 3 },
  crafting: { id: 'crafting', label: 'CRAFTING', order: 4 }
};

const CATEGORY_REGISTRY = {
  poe1: [
    // --- GENERAL ---
    { type: 'Currency', label: 'Currency', group: 'general', priority: true, iconClass: 'currency-ico', apiSource: 'exchange' },
    { type: 'Fragment', label: 'Fragments', group: 'general', priority: true, iconClass: 'fragment-ico', apiSource: 'exchange' },
    { type: 'Scarab', label: 'Scarabs', group: 'general', priority: true, iconClass: 'scarab-ico', apiSource: 'exchange' },
    { type: 'DivinationCard', label: 'Divination Cards', group: 'general', priority: false, iconClass: 'card-ico', apiSource: 'exchange' },
    { type: 'Artifact', label: 'Artifacts', group: 'general', priority: false, iconClass: 'artifact-ico', apiSource: 'exchange' },
    { type: 'Tattoo', label: 'Tattoos', group: 'general', priority: false, iconClass: 'tattoo-ico', apiSource: 'exchange' },
    { type: 'Omen', label: 'Omens', group: 'general', priority: false, iconClass: 'omen-ico', apiSource: 'exchange' },
    { type: 'AllflameEmber', label: 'Allflame Embers', group: 'general', priority: false, iconClass: 'allflame-ico', apiSource: 'exchange' },
    { type: 'Runegraft', label: 'Runegrafts', group: 'general', priority: false, iconClass: 'runegraft-ico', apiSource: 'exchange' },
    { type: 'Ducat', label: 'Ducats', group: 'general', priority: false, iconClass: 'ducat-ico', apiSource: 'exchange' },
    { type: 'EnshroudingCrystal', label: 'Enshrouding Crystals', group: 'general', priority: false, iconClass: 'crystal-ico', apiSource: 'exchange' },
    { type: 'Astrolabe', label: 'Astrolabes', group: 'general', priority: false, iconClass: 'astrolabe-ico', apiSource: 'exchange' },
    { type: 'DjinnCoin', label: 'Djinn Coins', group: 'general', priority: false, iconClass: 'djinn-ico', apiSource: 'exchange' },

    // --- ATLAS & MAPS ---
    { type: 'Map', label: 'Maps', group: 'atlas', priority: false, iconClass: 'map-ico', apiSource: 'stash' },
    { type: 'BlightedMap', label: 'Blighted Maps', group: 'atlas', priority: false, iconClass: 'blight-map-ico', apiSource: 'stash' },
    { type: 'UniqueMap', label: 'Unique Maps', group: 'atlas', priority: false, iconClass: 'unique-map-ico', apiSource: 'stash' },
    { type: 'DeliriumOrb', label: 'Delirium Orbs', group: 'atlas', priority: false, iconClass: 'delirium-ico', apiSource: 'exchange' },

    // --- CRAFTING ---
    { type: 'Essence', label: 'Essences', group: 'crafting', priority: false, iconClass: 'essence-ico', apiSource: 'exchange' },
    { type: 'Fossil', label: 'Fossils', group: 'crafting', priority: false, iconClass: 'fossil-ico', apiSource: 'exchange' },
    { type: 'Resonator', label: 'Resonators', group: 'crafting', priority: false, iconClass: 'resonator-ico', apiSource: 'exchange' },
    { type: 'Oil', label: 'Oils', group: 'crafting', priority: false, iconClass: 'oil-ico', apiSource: 'exchange' }
  ],
  poe2: [
    // --- GENERAL ---
    { type: 'Currency', label: 'Currency', group: 'general', priority: true, iconClass: 'poe2-currency-ico', apiSource: 'exchange' },
    { type: 'Fragments', label: 'Fragments', group: 'general', priority: true, iconClass: 'fragment-ico', apiSource: 'exchange' },
    { type: 'Ritual', label: 'Omens', group: 'general', priority: false, iconClass: 'omen-ico', apiSource: 'exchange' },
    { type: 'Expedition', label: 'Expedition', group: 'general', priority: false, iconClass: 'poe2-expedition-ico', apiSource: 'exchange' },

    // --- EQUIPMENT & GEMS ---
    { type: 'UncutGems', label: 'Uncut Gems', group: 'gems', priority: false, iconClass: 'poe2-gem-ico', apiSource: 'exchange' },
    { type: 'LineageSupportGems', label: 'Lineage Gems', group: 'gems', priority: false, iconClass: 'poe2-lineage-ico', apiSource: 'exchange' },
    { type: 'SoulCores', label: 'Soul Cores', group: 'gems', priority: false, iconClass: 'poe2-vaal-ico', apiSource: 'exchange' },
    { type: 'Idols', label: 'Idols', group: 'gems', priority: false, iconClass: 'poe2-idol-ico', apiSource: 'exchange' },
    { type: 'Runes', label: 'Runes', group: 'gems', priority: false, iconClass: 'poe2-rune-ico', apiSource: 'exchange' },
    { type: 'Verisium', label: 'Verisium', group: 'gems', priority: false, iconClass: 'verisium-ico', apiSource: 'exchange' },

    // --- CRAFTING ---
    { type: 'Essences', label: 'Essences', group: 'crafting', priority: false, iconClass: 'essence-ico', apiSource: 'exchange' },
    { type: 'Breach', label: 'Catalysts', group: 'crafting', priority: false, iconClass: 'catalyst-ico', apiSource: 'exchange' },
    { type: 'Delirium', label: 'Liquid Emotions', group: 'crafting', priority: false, iconClass: 'poe2-delirium-ico', apiSource: 'exchange' },
    { type: 'Abyss', label: 'Abyssal Bones', group: 'crafting', priority: false, iconClass: 'poe2-abyss-ico', apiSource: 'exchange' }
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

  getGroups() {
    return Object.values(CATEGORY_GROUPS).sort((a, b) => a.order - b.order);
  }
};

module.exports = CategoryRegistry;
