import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import CategoryRegistry from '../services/categoryRegistry.js';
import poedbService from '../services/poedbService.js';
import PoeItemDescriptions from '../public/js/itemDescriptions.js';

describe('Full 46 PoE 1 Categories & PoEDB Descriptions Suite', () => {
  it('CategoryRegistry.poe1 must have exactly 46 categories across 4 groups', () => {
    const cats = CategoryRegistry.getRegistry('poe1');
    assert.equal(cats.length, 46, `Expected 46 categories in poe1, found ${cats.length}`);

    const groups = new Set(cats.map(c => c.group));
    assert.deepEqual(Array.from(groups).sort(), ['atlas', 'crafting', 'gems', 'general'].sort());

    const generalCats = cats.filter(c => c.group === 'general');
    const gemsCats = cats.filter(c => c.group === 'gems');
    const atlasCats = cats.filter(c => c.group === 'atlas');
    const craftingCats = cats.filter(c => c.group === 'crafting');

    assert.equal(generalCats.length, 15, `Expected 15 general categories, got ${generalCats.length}`);
    assert.equal(gemsCats.length, 12, `Expected 12 gems/equipment categories, got ${gemsCats.length}`);
    assert.equal(atlasCats.length, 12, `Expected 12 atlas categories, got ${atlasCats.length}`);
    assert.equal(craftingCats.length, 7, `Expected 7 crafting categories, got ${craftingCats.length}`);
  });

  it('All categories must have non-empty required fields and valid icon classes', () => {
    const cats = CategoryRegistry.getRegistry('poe1');
    for (const cat of cats) {
      assert.ok(cat.label, `Category missing label: ${JSON.stringify(cat)}`);
      assert.ok(cat.type, `Category missing type: ${cat.label}`);
      assert.ok(cat.group, `Category missing group: ${cat.label}`);
      assert.ok(cat.iconClass, `Category missing iconClass: ${cat.label}`);
      assert.ok(['exchange', 'stash'].includes(cat.apiSource), `Invalid apiSource for ${cat.label}: ${cat.apiSource}`);
    }
  });

  it('poedbService retrieves and parses Maven\'s Chisel of Avarice correctly', async () => {
    const desc = await poedbService.fetchItemDescription("Maven's Chisel of Avarice", 'poe1');
    assert.ok(desc, "Should return description object");
    assert.equal(desc.title, "Maven's Chisel of Avarice");
    assert.equal(desc.stackSize, 20);
    assert.ok(Array.isArray(desc.explicitModifiers), "explicitModifiers should be array");
    assert.ok(desc.explicitModifiers.some(m => m.toLowerCase().includes('map') || m.toLowerCase().includes('currency')), "Should contain Map/Currency quality modifier");
    assert.ok(desc.instructions && desc.instructions.includes('Right click'), "Should contain instructions");
  });

  it('poedbService retrieves and parses Glassblower\'s Bauble correctly', async () => {
    const desc = await poedbService.fetchItemDescription("Glassblower's Bauble", 'poe1');
    assert.ok(desc, "Should return description object");
    assert.equal(desc.title, "Glassblower's Bauble");
    assert.equal(desc.stackSize, 20);
    assert.ok(desc.instructions && desc.instructions.includes('flask'), "Should instruct using on flask");
  });

  it('PoeItemDescriptions produces authentic in-game card HTML matching user requirements', () => {
    const mockItem = {
      name: "Maven's Chisel of Avarice",
      baseType: "Currency",
      category: "Currency",
      game: "poe1"
    };

    // Pre-populate poedb cache for mock item
    PoeItemDescriptions.poedbCache.set("poe1:maven's chisel of avarice", {
      title: "Maven's Chisel of Avarice",
      stackSize: 20,
      instructions: "Right click this item then left click a Map to apply it. Has greater effect on lower Tier Maps. Maximum quality is 20%.",
      explicitModifiers: [
        "Increases the Item Rarity of a non-Unique Map by 3% per 1% Quality",
        "Replaces other Quality types"
      ],
      implicitModifiers: []
    });

    const cardHtml = PoeItemDescriptions.getPoEDescription(mockItem);
    assert.ok(cardHtml.includes('STACK SIZE: 20'), 'HTML must contain STACK SIZE: 20');
    assert.ok(cardHtml.includes('Increases the Item Rarity'), 'HTML must contain explicit modifier');
    assert.ok(cardHtml.includes('Right click this item then left click a Map'), 'HTML must contain instructions');
    assert.ok(cardHtml.includes('poe-card-property'), 'HTML must use authentic poe-card-property class');
    assert.ok(cardHtml.includes('poe-card-instructions'), 'HTML must use authentic poe-card-instructions class');
  });
});
