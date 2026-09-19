const express = require('express');
const defaultBroker = require('../services/bridge/quickInspectBroker');
const defaultState = require('../services/bridge/bridgeState');
const { validateItemRawText } = require('../services/itemAnalyzer/itemValidator');

/**
 * Creates bridge routes router.
 * @param {Object} options Service overrides
 * @returns {import('express').Router}
 */
function createBridgeRouter(options = {}) {
  const router = express.Router();
  const broker = options.broker || defaultBroker;
  const bridgeState = options.bridgeState || defaultState;

  // 1. Desktop or manual inspect submission
  router.post('/api/bridge/inspect', (req, res) => {
    const { rawText, game = 'poe1', source = 'clipboard', requestId } = req.body || {};

    const validation = validateItemRawText(rawText, { requirePoeMarkers: true, maxLength: 20000 });
    if (!validation.isValid) {
      return res.status(validation.status || 400).json({
        success: false,
        error: validation.error
      });
    }

    const trimmed = validation.trimmedText;

    let parsedItem = null;
    let classification = null;
    let analysis = null;
    let market = null;

    try {
      const itemAnalyzerService = options.itemAnalyzerService || require('../services/itemAnalyzer/itemAnalyzerService');
      const analysisResult = itemAnalyzerService.analyze(trimmed, {
        game,
        cacheManager: options.cacheManager
      });

      parsedItem = analysisResult.item;
      classification = analysisResult.classification;
      analysis = analysisResult.analysis;
      market = analysisResult.market;
    } catch (e) {
      // Non-fatal fallback to basic parser if analysis has edge error
      try {
        const ItemTextParser = require('../services/itemAnalyzer/itemTextParser');
        const ItemClassifier = require('../services/itemAnalyzer/itemClassifier');
        parsedItem = ItemTextParser.parse(trimmed, game);
        classification = ItemClassifier.classify(parsedItem);
      } catch (innerErr) {
        // Fallback: rawText will still be broadcasted
      }
    }

    const payload = {
      requestId: requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      game: parsedItem ? parsedItem.game : (game === 'poe2' ? 'poe2' : 'poe1'),
      source,
      rawText: trimmed,
      parsedItem,
      classification,
      analysis,
      market,
      capturedAt: new Date().toISOString()
    };

    const broadcasted = broker.broadcastInspect(payload);

    return res.status(200).json({
      success: true,
      requestId: payload.requestId,
      clientsNotified: broker.clientCount,
      item: broadcasted,
      parsedItem,
      classification,
      analysis,
      market
    });
  });

  // 2. Real-time Browser SSE Stream
  router.get('/api/bridge/events', (req, res) => {
    broker.addClient(req, res);
  });

  // 3. Cold-Start Web Recovery
  router.get('/api/bridge/latest', (req, res) => {
    const latest = bridgeState.getLatest();
    res.json({
      success: true,
      item: latest
    });
  });

  // 4. Bridge Diagnostics & Status
  router.get('/api/bridge/status', (req, res) => {
    res.json({
      success: true,
      ...bridgeState.getStatus(broker.clientCount)
    });
  });

  return router;
}

module.exports = createBridgeRouter;
