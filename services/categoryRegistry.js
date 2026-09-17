/**
 * Category Registry for Path of Exile 1 & 2
 * Defines all known Faustus Currency Exchange types supported by the system.
 */

const CATEGORY_REGISTRY = {
  poe1: [
    { type: 'Currency', label: 'Currency', priority: true, iconClass: 'currency-ico' },
    { type: 'Fragment', label: 'Fragments', priority: true, iconClass: 'fragment-ico' },
    { type: 'Scarab', label: 'Scarabs', priority: true, iconClass: 'scarab-ico' },
    { type: 'DivinationCard', label: 'Divination Cards', priority: false, iconClass: 'card-ico' },
    { type: 'Essence', label: 'Essences', priority: false, iconClass: 'essence-ico' },
    { type: 'Fossil', label: 'Fossils', priority: false, iconClass: 'fossil-ico' },
    { type: 'Resonator', label: 'Resonators', priority: false, iconClass: 'fossil-ico' },
    { type: 'Oil', label: 'Oils', priority: false, iconClass: 'oil-ico' },
    { type: 'DeliriumOrb', label: 'Delirium Orbs', priority: false, iconClass: 'delirium-ico' },
    { type: 'Artifact', label: 'Artifacts', priority: false, iconClass: 'artifact-ico' },
    { type: 'Tattoo', label: 'Tattoos', priority: false, iconClass: 'tattoo-ico' },
    { type: 'Omen', label: 'Omens', priority: false, iconClass: 'omen-ico' },
    { type: 'AllflameEmber', label: 'Allflame Embers', priority: false, iconClass: 'allflame-ico' },
    { type: 'Runegraft', label: 'Runegrafts', priority: false, iconClass: 'runegraft-ico' },
    { type: 'Ducat', label: 'Ducats', priority: false, iconClass: 'ducat-ico' },
    { type: 'EnshroudingCrystal', label: 'Enshrouding Crystals', priority: false, iconClass: 'crystal-ico' },
    { type: 'Astrolabe', label: 'Astrolabes', priority: false, iconClass: 'crystal-ico' },
    { type: 'DjinnCoin', label: 'Djinn Coins', priority: false, iconClass: 'ducat-ico' }
  ],
  poe2: [
    { type: 'Currency', label: 'Currency', priority: true, iconClass: 'poe2-currency-ico' },
    { type: 'Fragments', label: 'Fragments', priority: true, iconClass: 'fragment-ico' },
    { type: 'Ritual', label: 'Omens', priority: false, iconClass: 'omen-ico' },
    { type: 'Breach', label: 'Catalysts', priority: false, iconClass: 'catalyst-ico' },
    { type: 'Delirium', label: 'Liquid Emotions', priority: false, iconClass: 'delirium-ico' },
    { type: 'Abyss', label: 'Abyssal Bones', priority: false, iconClass: 'fossil-ico' },
    { type: 'Expedition', label: 'Expedition', priority: false, iconClass: 'poe2-expedition-ico' },
    { type: 'UncutGems', label: 'Uncut Gems', priority: false, iconClass: 'poe2-ritual-ico' },
    { type: 'Essences', label: 'Essences', priority: false, iconClass: 'essence-ico' },
    { type: 'SoulCores', label: 'Soul Cores', priority: false, iconClass: 'poe2-vaal-ico' },
    { type: 'Idols', label: 'Idols', priority: false, iconClass: 'tattoo-ico' },
    { type: 'Runes', label: 'Runes', priority: false, iconClass: 'runegraft-ico' },
    { type: 'Verisium', label: 'Verisium', priority: false, iconClass: 'allflame-ico' }
  ]
};

const CategoryRegistry = {
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
  }
};

module.exports = CategoryRegistry;
