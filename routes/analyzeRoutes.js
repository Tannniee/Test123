const express = require('express');
const defaultItemAnalyzerService = require('../services/itemAnalyzer/itemAnalyzerService');
const { validateItemRawText } = require('../services/itemAnalyzer/itemValidator');

/**
 * Creates routes router for the Item Analyzer API.
 * @param {Object} options Configuration and service overrides
 * @returns {import('express').Router}
 */
function createAnalyzeRouter(options = {}) {
  const router = express.Router();
  const itemAnalyzerService = options.itemAnalyzerService || defaultItemAnalyzerService;
  const cacheManager = options.cacheManager;

  router.post('/api/analyze-item', (req, res) => {
    const { rawText, game = 'poe1', league = null, source = 'manual_paste' } = req.body || {};

    const validation = validateItemRawText(rawText, { requirePoeMarkers: false, maxLength: 20000 });
    if (!validation.isValid) {
      return res.status(validation.status || 400).json({
        success: false,
        error: validation.error
      });
    }

    try {
      const result = itemAnalyzerService.analyze(rawText, {
        game,
        league,
        cacheManager,
        source
      });

      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to parse item text.'
      });
    }
  });

  return router;
}

module.exports = createAnalyzeRouter;

