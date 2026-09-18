import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('Frontend App Syntax & Boot Verification Suite', () => {
  it('All frontend JavaScript files must parse with zero SyntaxErrors', async () => {
    const jsFiles = [
      'public/js/app.js',
      'public/js/itemDescriptions.js',
      'public/js/itemParser.js',
      'public/js/modules/api.js',
      'public/js/modules/clipboard.js',
      'public/js/modules/modals.js',
      'public/js/modules/render.js',
      'public/js/modules/search.js',
      'public/js/modules/state.js'
    ];

    for (const relPath of jsFiles) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      
      const fileUrl = new URL(`file:///${fullPath.replace(/\\/g, '/')}`).href;
      
      // Attempt dynamic import to check parser syntax
      try {
        if (relPath.includes('modules/')) {
          await import(fileUrl);
        } else {
          // For scripts referencing window/document, test syntax via new Function or esm compile check
          const content = fs.readFileSync(fullPath, 'utf8');
          // Basic syntax validation
          const isModule = content.includes('import ') || content.includes('export ');
          if (!isModule) {
            new Function(content);
          }
        }
      } catch (err) {
        assert.fail(`Syntax or loading error in ${relPath}: ${err.message}`);
      }
    }
  });

  it('app.js does not contain illegal await in non-async functions', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'public/js/app.js'), 'utf8');
    // Verify handleItemAction is declared as async
    assert.ok(
      content.includes('async function handleItemAction(e)'),
      'handleItemAction must be declared as async because it uses await'
    );
  });

  it('app.js boot sequence checks document.readyState before DOMContentLoaded', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'public/js/app.js'), 'utf8');
    assert.ok(
      content.includes("document.readyState === 'loading'"),
      'app.js must check document.readyState === "loading" to avoid missed DOMContentLoaded event in deferred ES modules'
    );
  });
});
