const express = require('express');
const defaultItemAnalyzerService = require('../services/itemAnalyzer/itemAnalyzerService');

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

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Field "rawText" is required and cannot be empty.'
      });
    }

    if (rawText.length > 20000) {
      return res.status(400).json({
        success: false,
        error: 'Field "rawText" exceeds maximum allowed length of 20,000 characters.'
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

