/**
 * PoE In-game Item Descriptions & Wiki Engine
 * Provides rich in-game and community wiki tooltips for currencies, cards, scarabs, essences, fossils, catalysts, and PoE 2 items.
 */

const PoeItemDescriptions = {
  // Built-in descriptions for currencies, special fragments and orbs
  currencies: {
    'mirror-of-kalandra': {
      magic: 'Creates a mirrored copy of an item',
      instructions: 'Right click this item then left click an equipable non-unique item to apply it. Mirrored copies cannot be modified.'
    },
    'mirror': {
      magic: 'Creates a mirrored copy of an item',
      instructions: 'Right click this item then left click an equipable non-unique item to apply it. Mirrored copies cannot be modified.'
    },
    'hinekoras-lock': {
      magic: 'Foresees the result of the next Currency item used on it',
      instructions: 'Allows an item to foresee the result of the next Currency item used on it. Modifying the item in any way will consume the foresight.'
    },
    'divine-orb': {
      magic: 'Randomises the numeric values of the random modifiers on an item',
      instructions: 'Right click this item then left click a magic, rare or unique item to apply it.'
    },
    'divine': {
      magic: 'Randomises the numeric values of the random modifiers on an item',
      instructions: 'Right click this item then left click a magic, rare or unique item to apply it.'
    },
    'chaos-orb': {
      magic: 'Reforges a rare item with new random modifiers',
      instructions: 'Right click this item then left click a rare item to apply it.'
    },
    'chaos': {
      magic: 'Reforges a rare item with new random modifiers',
      instructions: 'Right click this item then left click a rare item to apply it.'
    },
    'exalted-orb': {
      magic: 'Augments a rare item with a new random modifier',
      instructions: 'Right click this item then left click a rare item to apply it. Rare items can have up to six random modifiers.'
    },
    'exalted': {
      magic: 'Augments a rare item with a new random modifier',
      instructions: 'Right click this item then left click a rare item to apply it. Rare items can have up to six random modifiers.'
    },
    'mirror-shard': {
      magic: 'A stack of 20 shards combines to form a Mirror of Kalandra.',
      instructions: 'Collect 20 shards to create a complete Mirror of Kalandra.'
    },
    'veiled-exalted-orb': {
      magic: 'Adds a random Veiled modifier to a rare item',
      instructions: 'Right click this item then left click a rare item to apply it.'
    },
    'veiled-chaos-orb': {
      magic: 'Reforges a rare item with new random modifiers, including a veiled modifier',
      instructions: 'Right click this item then left click a rare item to apply it.'
    },
    'tainted-divine-teardrop': {
      magic: 'Unpredictably raises or lowers the tiers of each modifier on a corrupted rare item',
      instructions: 'Right click this item then left click a corrupted rare item to apply it.'
    },
    'foulborn-exalted-orb': {
      magic: 'Augments a rare item with a new Breach modifier',
      instructions: 'Right click this item then left click a rare item to apply it.'
    },
    'orb-of-dominance': {
      magic: 'Removes one Influenced modifier from an item and upgrades another',
      instructions: 'Right click this item then left click an item with at least two Influenced modifiers.'
    },
    'reflecting-mist': {
      magic: 'Creates a mirrored ring or amulet with amplified and negated modifiers',
      instructions: 'Use on an uncorrupted non-unique Ring or Amulet.'
    },
    'volatile-vaal-orb': {
      magic: 'Unpredictably modifies an item, with chaotic corruption outcomes',
      instructions: 'Corrupts an item unpredictably.'
    },
    'awakener-orb': {
      magic: 'Destroys an item, applying its influence to another of the same item class',
      instructions: 'The second item is reforged as a rare item with both influences and new modifiers.'
    },
    'tainted-exalted-orb': {
      magic: 'Unpredictably adds or removes a modifier on a corrupted rare item',
      instructions: 'Right click this item then left click a corrupted rare item.'
    },
    'tailoring-orb': {
      magic: 'Adds or replaces an enchantment on a body armour',
      instructions: 'Enchantments modify the magnitude of affixes and socket properties.'
    },
    'tempering-orb': {
      magic: 'Adds or replaces an enchantment on a weapon',
      instructions: 'Enchantments modify weapon damage, attack speed and socket properties.'
    },
    'fracturing-orb': {
      magic: 'Fractures a random modifier on a rare item with at least 4 modifiers',
      instructions: 'The chosen modifier is permanently locked and cannot be altered.'
    },
    'sacred-orb': {
      magic: 'Unpredictably alters the base armour, evasion or energy shield of an item',
      instructions: 'Right click this item then left click an armour item to apply it.'
    },
    'ancient-orb': {
      magic: 'Reforges a unique item as another of the same item class',
      instructions: 'Right click this item then left click a unique item to apply it.'
    },
    'orb-of-annulment': {
      magic: 'Removes a random modifier from an item',
      instructions: 'Right click this item then left click a magic or rare item to apply it.'
    },
    'stacked-deck': {
      magic: 'A deck of unknown divination cards',
      instructions: 'Right click to draw a random divination card from the deck.'
    },
    'vaal-orb': {
      magic: 'Corrupts an item, causing unpredictable alterations',
      instructions: 'Right click this item then left click an item to corrupt it. Corrupted items cannot be modified again.'
    },
    'regal-orb': {
      magic: 'Upgrades a magic item to a rare item',
      instructions: 'Right click this item then left click a magic item to apply it. Current modifiers are retained and one new modifier is added.'
    },
    'gemcutters-prism': {
      magic: 'Improves the quality of a skill or support gem',
      instructions: 'Right click this item then left click a gem to apply it. Maximum quality is 20%.'
    },
    'cartographers-chisel': {
      magic: 'Improves the quality of a map',
      instructions: 'Right click this item then left click a map to apply it. Maximum quality is 20%.'
    },
    'orb-of-unmaking': {
      magic: 'Grants one Atlas Passive Respec Point',
      instructions: 'Right click to gain one Atlas Passive Respec Point.'
    },
    'orb-of-scouring': {
      magic: 'Removes all random modifiers from an item',
      instructions: 'Right click this item then left click a magic or rare item to apply it.'
    },
    'orb-of-alchemy': {
      magic: 'Upgrades a normal item to a rare item',
      instructions: 'Right click this item then left click a normal item to apply it.'
    },
    'orb-of-fusing': {
      magic: 'Reforges the links between sockets on an item',
      instructions: 'Right click this item then left click a socketed item to apply it.'
    },
    'chromatic-orb': {
      magic: 'Reforges the colours of sockets on an item',
      instructions: 'Right click this item then left click a socketed item to apply it. Socket colours are influenced by item attribute requirements.'
    },
    'jewellers-orb': {
      magic: 'Reforges the number of sockets on an item',
      instructions: 'Right click this item then left click an equipable item to apply it.'
    }
  },

  // Popular Divination Cards Rewards Dictionary
  divinationCards: {
    'the-apothecary': { reward: 'Mageblood', count: 5, lore: 'An empire crumbled in the blink of an eye, yet in a small apothecary\'s shop, time stands entirely still.' },
    'the-doctor': { reward: 'Headhunter', count: 8, lore: 'A mind is a terrible thing to waste, but a marvelous thing to steal.' },
    'the-nurse': { reward: 'The Doctor', count: 8, lore: 'Every great doctor requires faithful assistance.' },
    'the-patient': { reward: 'The Nurse', count: 8, lore: 'Patience is a virtue, especially when life hangs by a thread.' },
    'house-of-mirrors': { reward: 'Mirror of Kalandra', count: 9, lore: 'What you see is never what you get.' },
    'unrequited-love': { reward: '19x Mirror Shards', count: 16, lore: 'Love given freely, returned as dust and scattered glass.' },
    'the-immortal': { reward: 'House of Mirrors', count: 10, lore: 'Death was merely an inconvenience to the ancients.' },
    'brothers-gift': { reward: '5x Divine Orbs', count: 1, lore: 'A bond stronger than greed, a gift to light the darkest trials.' },
    'brothers-stash': { reward: '5x Exalted Orbs', count: 1, lore: 'Left behind with love, discovered with remembrance.' },
    'the-fiend': { reward: 'Headhunter (Corrupted)', count: 11, lore: 'The devil you know is rarely the one holding the leash.' },
    'the-demon': { reward: 'Headhunter (Two-Implicit Corrupted)', count: 10, lore: 'Bargains sealed in brimstone always carry an unforeseen cost.' },
    'dragons-heart': { reward: 'Empower Support (Level 4, Corrupted)', count: 11, lore: 'Within the beast\'s blazing core beats the pulse of pure majesty.' },
    'the-cheater': { reward: 'Awakened Support Gem (Level 6, Quality 23%, Corrupted)', count: 3, lore: 'Rules exist to be broken; fortune belongs to the daring.' },
    'seven-years-bad-luck': { reward: 'Mirror Shard', count: 13, lore: 'Shatter the glass and face the echoes of thirteen fortunes.' },
    'alluring-bounty': { reward: '10x Exalted Orbs', count: 7, lore: 'The deep waters promise wealth untold, but water always claims its toll.' },
    'succor-of-the-sinless': { reward: 'Bottled Faith', count: 6, lore: 'A single sip washes clean the heaviest sins.' },
    'the-scout': { reward: '7x Exalted Orbs', count: 8, lore: 'Eyes on the ridgeline, pockets heavy with plundered gold.' },
    'love-through-ice': { reward: 'Unrequited Love', count: 4, lore: 'Frozen beneath a sea of tears, warm hearts refuse to wither.' },
    'the-price-of-devotion': { reward: 'Mageblood (Two-Implicit Corrupted)', count: 7, lore: 'Devotion without sacrifice is merely hollow worship.' },
    'the-shieldbearer': { reward: 'The Squire', count: 8, lore: 'Behind every great champion stands one who holds the shield.' },
    'the-enlightened': { reward: 'Enlighten Support (Level 3)', count: 6, lore: 'Clear mind, opened eyes, transcending the mortal plane.' },
    'wealth-and-power': { reward: 'Enlighten Support (Level 4, Corrupted)', count: 11, lore: 'Those who rule with knowledge shall command the world.' },
    'the-soul': { reward: 'Soul Taker', count: 9, lore: 'The axe does not sleep; it thirsts for blood and flesh.' },
    'the-mayor': { reward: 'The Perandus Manor (Tier 16)', count: 5, lore: 'Cadiro smiles upon those with enough gold in their purses.' },
    'the-spark-and-the-flame': { reward: 'Berek\'s Respite', count: 2, lore: 'A spark will leap, and from its ashes a bonfire roars.' },
    'the-destination': { reward: 'The Apothecary', count: 5, lore: 'The journey was long, but salvation is finally within grasp.' },
    'the-price-of-loyalty': { reward: 'Skin of the Loyal (Item Level 25, Two-Implicit Corrupted)', count: 4, lore: 'Loyalty demands flesh and soul, never wavering.' },
    'the-damned': { reward: 'Soul Ripper (Corrupted)', count: 6, lore: 'Torn from the abyss, screaming with forgotten malice.' },
    'doryanis-epiphany': { reward: 'Synthesised Map with 3 Synthesis Implicits', count: 3, lore: 'His visions tore apart the veil of sanity.' },
    'the-saints-treasure': { reward: '2x Exalted Orbs', count: 10, lore: 'A saint needs neither gold nor silver, yet leaves behind untold wealth.' },
    'the-hoarder': { reward: '1x Exalted Orb', count: 12, lore: 'Every coin counts, stacked high in damp catacombs.' },
    'abandoned-wealth': { reward: '3x Exalted Orbs', count: 5, lore: 'Left in hasty retreat, waiting for greedy fingers.' },
    'the-fortunate': { reward: '2x Divine Orbs', count: 12, lore: 'Fortune smiles upon those who wander the path of exile.' },
    'the-sephirot': { reward: '10x Divine Orbs', count: 10, lore: 'Ten emanations of divine light, radiating pure creation.' },
    'the-void': { reward: 'A random Divination Card outcome', count: 1, lore: 'Stare into the abyss, and the abyss rewards your gaze.' },
    'the-valkyrie': { reward: 'Nemesis Unique Item', count: 8, lore: 'She rides across thunderclouds, choosing the slain.' },
    'the-samurais-eye': { reward: 'Watcher\'s Eye', count: 3, lore: 'One eye watches the void, the other pierces reality.' },
    'i-see-brothers': { reward: 'Brother\'s Gift', count: 5, lore: 'Together we conquered the atlas, together we remember.' },
    'a-fate-worse-than-death': { reward: 'Cortex Unique Item', count: 4, lore: 'Trapped in Venarius\' endless distorted memory.' },
    'choking-guilt': { reward: 'Stranglegasp', count: 6, lore: 'Tightly around the neck, cold breath of regret.' },
    'desecrated-virtue': { reward: 'Awakened Enhance Support (Level 6)', count: 9, lore: 'Virtue corrupted bears the sweetest and deadliest fruit.' },
    'eternal-bonds': { reward: 'Replica Farrul\'s Fur', count: 4, lore: 'Tied together by blood, beast and hunter unite.' },
    'fathers-love': { reward: 'The Squire', count: 7, lore: 'A father\'s shield is his enduring legacy.' },
    'home': { reward: 'Mirror Shard', count: 5, lore: 'There is no place like the shores we once called peace.' },
    'the-insane-cat': { reward: 'Mageblood (Corrupted)', count: 9, lore: 'Nine lives of madness wrapped around four glowing flasks.' },
    'humility': { reward: 'Tabula Rasa', count: 9, lore: 'Clothed in purity, unbound by sockets or colours.' },
    'imperial-legacy': { reward: 'Six-Link Imperial Bow (Item Level 100)', count: 22, lore: 'Forged in the dawn of the Lioneye dynasty.' },
    'the-porcupine': { reward: 'Six-Link Short Bow (Item Level 50)', count: 6, lore: 'Sharp as quills, ready for explosive contraptions.' }
  },

  // Catalysts Dictionary
  catalysts: {
    'accelerating-catalyst': { magic: 'Quality increases Speed modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Attack Speed, Cast Speed, and Movement Speed modifiers.' },
    'fertile-catalyst': { magic: 'Quality increases Life and Mana modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Maximum Life, Maximum Mana, and Life/Mana Regeneration.' },
    'imbued-catalyst': { magic: 'Quality increases Caster modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Spell Damage, Cast Speed, and Spell Critical Strikes.' },
    'intrinsic-catalyst': { magic: 'Quality increases Attribute modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Strength, Dexterity, Intelligence, and All Attributes.' },
    'noxious-catalyst': { magic: 'Quality increases Physical and Chaos Damage modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Physical and Chaos damage scaling.' },
    'prismatic-catalyst': { magic: 'Quality increases Resistance modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Fire, Cold, Lightning, Chaos and All Elemental Resistances.' },
    'tempering-catalyst': { magic: 'Quality increases Defence modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Armour, Evasion Rating, and Energy Shield modifiers.' },
    'turbulent-catalyst': { magic: 'Quality increases Elemental Damage modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Fire, Cold, and Lightning Damage modifiers.' },
    'tainted-catalyst': { magic: 'Unpredictably increases quality on a Corrupted Ring, Amulet or Belt', desc: 'Modifies corrupted jewellery with a random catalyst quality type.' },
    'true-catalyst': { magic: 'Quality increases Critical Strike modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Global Critical Strike Chance and Multiplier.' },
    'abrasive-catalyst': { magic: 'Quality increases Attack modifiers on a Ring, Amulet or Belt', desc: 'Adds quality that enhances Attack Damage, Accuracy, and Attack Speed.' }
  },

  // Fossils & Crafting Rules
  fossils: {
    'pristine-fossil': 'More Life modifiers • No Defence modifiers',
    'dense-fossil': 'More Defence modifiers • No Life modifiers',
    'corroded-fossil': 'More Physical & Chaos modifiers • No Elemental modifiers',
    'metallic-fossil': 'More Lightning modifiers • No Physical modifiers',
    'scorched-fossil': 'More Fire modifiers • No Cold modifiers',
    'frigid-fossil': 'More Cold modifiers • No Fire modifiers',
    'aberrant-fossil': 'More Chaos modifiers • No Lightning modifiers',
    'bound-fossil': 'More Minion or Aura modifiers',
    'jagged-fossil': 'More Physical modifiers • No Chaos modifiers',
    'sanctified-fossil': 'Modifiers are more likely to be higher tier • Numeric values are lucky',
    'gilded-fossil': 'Item sells for much more to vendors (adds vendor implicit)',
    'hollow-fossil': 'Has an Abyssal Socket',
    'faceted-fossil': 'More Gem modifiers',
    'fractured-fossil': 'Creates a mirrored copy of the item with modified implicit',
    'bloodstained-fossil': 'Corrupted item modifiers • Grants Vaal skills bonuses',
    'glyphic-fossil': 'Contains a Corrupted Essence modifier (Horror, Delirium, Hysteria, Insanity)',
    'tangled-fossil': 'More random modifiers of varied league types',
    'lucent-fossil': 'More Mana modifiers • No Speed modifiers',
    'shuddering-fossil': 'More Speed modifiers • No Mana modifiers',
    'perfect-fossil': 'Improves item base quality up to 30%',
    'deft-fossil': 'More Critical modifiers • No Attribute modifiers',
    'fundamental-fossil': 'More Attribute modifiers • No Critical modifiers',
    'aetheric-fossil': 'More Caster modifiers • No Attack modifiers',
    'resonating-fossil': 'Alters resonator sockets when crafting in Delve',
    'enchanted-fossil': 'Adds an ancient Labyrinth enchantment to helmets, boots or gloves'
  },

  /**
   * Generates a complete tooltip structure for any item
   */
  getTooltip(item) {
    if (!item) return null;

    const key = (item.detailsId || item.key || item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const currencyInfo = this.currencies[key] || this.currencies[item.key?.toLowerCase()];

    let magicLine = '';
    let instructions = '';
    let explicits = [];
    let implicits = [];
    let flavour = item.flavourText || '';

    // 1. Currency item
    if (currencyInfo) {
      magicLine = currencyInfo.magic;
      instructions = currencyInfo.instructions;
    }
    // 2. Divination Card
    else if (item.category === 'Divination Cards' || item.subCategory === 'DivinationCard') {
      const cardInfo = this.divinationCards[key];
      if (cardInfo) {
        magicLine = `Reward: ${cardInfo.reward}`;
        instructions = `Stack Size: ${cardInfo.count} • Turn in full set to Lilly Roth or Divinia.`;
        if (!flavour && cardInfo.lore) flavour = cardInfo.lore;
      } else {
        magicLine = `Collect a complete stack to trade for the designated reward.`;
        instructions = `Turn in full sets to Lilly Roth, Divinia, or Tasuni in your Hideout.`;
        flavour = `A fragment of destiny, waiting to be woven into fortune.`;
      }
    }
    // 3. Scarabs
    else if (item.category === 'Scarabs' || item.subCategory === 'Scarab') {
      const name = item.name || '';
      instructions = `Can be placed into the Map Device alongside a map to modify area modifiers and encounters.`;

      if (name.includes('Abyss')) {
        magicLine = name.includes('Descending') ? 'Abysses in Area lead to an Abyssal Depths' :
                    name.includes('Edifice') ? 'Abyssal Troves in Area drop rare jewels and currencies' :
                    'Area contains 2 additional Abysses with higher monster density';
      } else if (name.includes('Ambush')) {
        magicLine = name.includes('Containment') ? 'Area contains guarded Ambush Strongboxes instead of monster packs' :
                    name.includes('Discernment') ? 'Strongboxes in Area are of higher rarities' :
                    name.includes('Potency') ? '75% increased effect of Explicit Modifiers on Strongboxes in Area' :
                    'Area contains 5 additional Strongboxes';
      } else if (name.includes('Breach')) {
        magicLine = name.includes('Lordship') ? 'Breaches in Area each contain a Breachlord' :
                    name.includes('Resonant') ? 'Breach monsters in Area drop 50% more Breachstones' :
                    'Area contains 2 additional Breaches with increased monster density';
      } else if (name.includes('Blight')) {
        magicLine = name.includes('Blightheart') ? 'Blight encounters contain 30% more Blight reward chests' :
                    name.includes('Invigoration') ? 'Blight towers deal 100% more damage' :
                    'Area contains a Blight encounter';
      } else if (name.includes('Divination')) {
        magicLine = name.includes('Curation') ? '10% increased Divination Cards found in Area per 5% Pack Size' :
                    name.includes('Completion') ? 'Divination Cards dropped in Area drop in completed stacks' :
                    'Area contains 100% increased Divination Cards found';
      } else if (name.includes('Essence')) {
        magicLine = name.includes('Ascent') ? 'Monsters trapped in Essences have higher Tier essences' :
                    name.includes('Calcification') ? 'Rare monsters in Area are imprisoned in Essences' :
                    'Area contains 2 additional Essences';
      } else if (name.includes('Harbinger')) {
        magicLine = name.includes('Warhoards') ? 'Harbingers in Area drop rarer currency shards' :
                    'Area contains 3 additional Harbingers';
      } else if (name.includes('Expedition')) {
        magicLine = name.includes('Runefinding') ? 'Expedition encounters have 20% increased Runic Monster markers' :
                    'Area contains an Expedition Encounter with Kalguuran expeditionaries';
      } else if (name.includes('Harvest')) {
        magicLine = name.includes('Doubling') ? 'Lifeforce dropped by Harvest monsters in Area is duplicated' :
                    'Area contains the Sacred Grove';
      } else if (name.includes('Incursion')) {
        magicLine = name.includes('Timelines') ? 'Incursions in Area have a chance to add an additional Architect' :
                    'Area contains Alva and 3 Temporal Incursions';
      } else if (name.includes('Betrayal')) {
        magicLine = 'Immortal Syndicate encounters in Area grant 50% increased Intelligence';
      } else if (name.includes('Domination')) {
        magicLine = 'Area contains 4 additional Shrines granting player buffs';
      } else if (name.includes('Ultimatum')) {
        magicLine = 'Area contains an Ultimatum encounter with the Trialmaster';
      } else if (name.includes('Sulphite')) {
        magicLine = 'Area contains Niko and Voltaxic Sulphite veins for the Azurite Mine';
      } else if (name.includes('Titanic')) {
        magicLine = 'Unique Monsters in Area have 50% increased Life and drop additional valuable loot';
      } else if (name.includes('Horned')) {
        magicLine = 'Infuses the Area with mysterious and rare Horned eldritch alterations';
      } else if (name.includes('Delirium')) {
        magicLine = name.includes('Mania') ? 'Delirium reward meter fills 100% faster in Area' :
                    'Area contains a Mirror of Delirium';
      } else if (name.includes('Cartography')) {
        magicLine = name.includes('Duplication') ? 'Maps dropped in Area have 30% chance to be duplicated' :
                    name.includes('Ascension') ? 'Non-Unique Maps in Area drop 1 Tier higher (up to T16)' :
                    '50% increased Maps dropped in Area';
      } else if (name.includes('Legion')) {
        magicLine = name.includes('Officers') ? 'Legion Encounters contain 5 additional Sergeants per army' :
                    'Area contains an additional Legion Encounter';
      } else if (name.includes('Beyond')) {
        magicLine = 'Slaying enemies in Area has a chance to attract Beyond demons from the Realm of the Scourge';
      } else if (name.includes('Bestiary')) {
        magicLine = 'Area contains Einhar and additional red beasts for the Menagerie';
      } else if (name.includes('Ritual')) {
        magicLine = 'Area contains Ritual Altars and grants increased Tribute';
      } else if (name.includes('Torment')) {
        magicLine = 'Area is haunted by 5 additional Tormented Spirits';
      } else {
        magicLine = `Augments map encounters with powerful modifiers when placed in the Map Device.`;
      }
    }
    // 4. Catalysts
    else if (item.category === 'Catalysts' || item.subCategory === 'Catalyst' || item.name.includes('Catalyst')) {
      const catInfo = this.catalysts[key];
      if (catInfo) {
        magicLine = catInfo.magic;
        instructions = `${catInfo.desc}\nRight click this item then left click a Ring, Amulet, or Belt to apply.`;
      } else {
        magicLine = `Increases the quality of jewellery, enhancing specific modifiers.`;
        instructions = `Right click this item then left click a Ring, Amulet, or Belt to apply.`;
      }
    }
    // 5. Fossils
    else if (item.category === 'Fossils' || item.subCategory === 'Fossil') {
      const fossilMod = this.fossils[key];
      if (fossilMod) {
        magicLine = fossilMod;
      } else {
        magicLine = `Alters modifier probabilities when crafting inside a Resonator.`;
      }
      instructions = `Socket this into a Resonator, then use on an item to craft.`;
    }
    // 6. Oils
    else if (item.category === 'Oils' || item.subCategory === 'Oil') {
      magicLine = `Used in Blight anointments to grant Notable Passives or upgrade Blight Towers.`;
      instructions = `Bring to Sister Cassia to anoint amulets, rings, blighted maps or anointed gear.`;
    }
    // 7. Tattoos & Omens
    else if (item.category === 'Tattoos' || item.subCategory === 'Tattoo') {
      magicLine = `Replaces a small Attribute Passive Skill on the Passive Skill Tree.`;
      instructions = `Right click to engrave on an allocated Attribute passive node.`;
    }
    else if (item.category === 'Omens' || item.subCategory === 'Omen') {
      magicLine = `Consumed automatically from inventory when a specific in-game trigger condition is met.`;
      instructions = `Keep in inventory. Only one Omen can trigger per area.`;
    }
    // 8. Delirium Orbs
    else if (item.category === 'Delirium Orbs' || item.subCategory === 'DeliriumOrb') {
      magicLine = `Modifies a Map to add layers of Delirium and guaranteed reward types.`;
      instructions = `Right click this item then left click an endgame Map to apply Delirium fog.`;
    }
    // 9. Allflame Embers & League items
    else if (item.category === 'Allflame Embers' || item.subCategory === 'AllflameEmber') {
      magicLine = `Infuses monster packs in the Lantern of Arimor with special packs.`;
      instructions = `Used at the entrance of a Map in the Lantern of Arimor interface.`;
    }
    else if (item.category === 'Runegrafts' || item.subCategory === 'Runegraft') {
      magicLine = `Kalguuran runic power etched onto equipment at the Runesmithing Table.`;
      instructions = `Take to Settlers Kingsmarch Runesmithing Table to imbue weapons.`;
    }
    else if (item.category === 'Ducats' || item.category === 'Enshrouding Crystals') {
      magicLine = `Special league currency used for settlement trade and bartering.`;
      instructions = `Exchange with settlement traders or Faustus on the black market.`;
    }
    // 10. PoE 2 categories
    else if (item.category === 'Ritual') {
      magicLine = `PoE 2 Ritual mechanic omen or ritual vessel item.`;
      instructions = `Used in Ritual Altars to defer and purchase valuable tribute rewards.`;
    }
    else if (item.category === 'Breach') {
      magicLine = `PoE 2 Breachstone splinter or catalyst stone.`;
      instructions = `Open tears in reality to harvest breach monsters, catalysts, and breach uniques.`;
    }
    else if (item.category === 'Delirium') {
      magicLine = `PoE 2 Delirium Distilled Emotion.`;
      instructions = `Distilled emotions used to spread the fog of delirium across endgame waystones.`;
    }
    else if (item.category === 'Abyss') {
      magicLine = `PoE 2 Abyssal jewel, desecration, or subterranean artifact.`;
      instructions = `Sourced from deep Abyssal troves and underworld nests.`;
    }
    else if (item.category === 'Expedition') {
      magicLine = `PoE 2 Kalguuran expedition coinage and ancient runic flux.`;
      instructions = `Used to barter with Kalguuran traders for valuable gear and rerolls.`;
    }
    else if (item.category === 'Vaal') {
      magicLine = `PoE 2 Ancient Vaal Infuser.`;
      instructions = `Imbues items with volatile sacrificial Vaal power and ancient corruption.`;
    }
    // Default fallback
    else {
      magicLine = `${item.name} (${item.category})`;
      instructions = `Liquid economy trade item on the Faustus Currency Exchange.`;
    }

    return {
      title: item.name,
      baseType: item.baseType && item.baseType !== item.name ? item.baseType : '',
      category: item.category,
      rarity: this.getItemRarity(item),
      magicLine,
      instructions,
      implicits,
      explicits,
      flavour,
      icon: item.icon,
      chaosValue: item.chaosValue,
      divineValue: item.divineValue,
      exaltedValue: item.exaltedValue,
      volume: item.volume
    };
  },

  getItemRarity(item) {
    const cat = (item.category || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    if (cat.includes('card') || sub.includes('card')) return 'divination';
    if (cat.includes('currency') || sub.includes('currency')) return 'currency';
    if (cat.includes('gem') || sub.includes('gem')) return 'gem';
    if (cat.includes('unique') || sub.includes('unique')) return 'unique';
    return 'normal';
  },

  /**
   * Returns official Community PoE Wiki URL
   */
  getWikiUrl(item) {
    if (!item || !item.name) return 'https://www.poewiki.net';
    const isPoe2 = item.game === 'poe2';
    const cleanName = item.name.trim().replace(/ /g, '_');

    if (isPoe2) {
      return `https://poe2db.tw/us/${encodeURIComponent(cleanName)}`;
    }
    return `https://www.poewiki.net/wiki/${encodeURIComponent(cleanName)}`;
  }
};

if (typeof module !== 'undefined') {
  module.exports = PoeItemDescriptions;
}
