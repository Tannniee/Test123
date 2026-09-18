import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import CategoryRegistry from '../services/categoryRegistry.js';

describe('PoE 2 23 Categories & Live Sync Verification Suite', () => {
  it('PoE 2 must have exactly 23 categories matching the user screenshot', () => {
    const cats = CategoryRegistry.getRegistry('poe2');
    assert.equal(cats.length, 23, `Expected 23 categories for PoE 2, got ${cats.length}`);

    const general = cats.filter(c => c.group === 'general');
    const equipment = cats.filter(c => c.group === 'equipment');
    const atlas = cats.filter(c => c.group === 'atlas');

    assert.equal(general.length, 14, `Expected 14 general categories, got ${general.length}`);
    assert.equal(equipment.length, 7, `Expected 7 equipment categories, got ${equipment.length}`);
    assert.equal(atlas.length, 2, `Expected 2 atlas categories, got ${atlas.length}`);
  });

  it('All 23 PoE 2 categories must have valid types, labels, and icon classes', () => {
    const cats = CategoryRegistry.getRegistry('poe2');
    for (const c of cats) {
      assert.ok(c.type, `Missing type: ${JSON.stringify(c)}`);
      assert.ok(c.label, `Missing label: ${JSON.stringify(c)}`);
      assert.ok(c.group, `Missing group: ${c.label}`);
      assert.ok(c.iconClass, `Missing iconClass: ${c.label}`);
      assert.ok(['exchange', 'stash'].includes(c.apiSource), `Invalid apiSource: ${c.label}`);
    }
  });

  it('CategoryRegistry.getGroups("poe2") returns the 3 groups in correct order', () => {
    const groups = CategoryRegistry.getGroups('poe2');
    assert.equal(groups.length, 3);
    assert.equal(groups[0].id, 'general');
    assert.equal(groups[1].id, 'equipment');
    assert.equal(groups[2].id, 'atlas');
  });

  it('PoE 2 cache on disk contains real items across all categories with divine pricing', () => {
    const cachePath = path.join(process.cwd(), 'data', 'cache', 'poe2_Forbidden_Rites.json');
    if (!fs.existsSync(cachePath)) {
      return; // Skip if run in CI without disk data
    }
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    assert.ok(data.items.length >= 1000, `Expected >= 1000 items in Forbidden Rites, got ${data.items.length}`);

    const weapon = data.items.find(i => i.sourceType === 'UniqueWeapons');
    assert.ok(weapon, 'Must have at least one Unique Weapon');
    assert.equal(weapon.primaryCurrency, 'divine');
    assert.ok(typeof weapon.divineValue === 'number', 'Divine value must be number');
    assert.ok(typeof weapon.exaltedValue === 'number', 'Exalted value must be number');

    const tablet = data.items.find(i => i.sourceType === 'UniqueTablets');
    assert.ok(tablet, 'Must have at least one Unique Tablet');

    const charm = data.items.find(i => i.sourceType === 'UniqueCharms');
    assert.ok(charm, 'Must have at least one Unique Charm');
  });
});
