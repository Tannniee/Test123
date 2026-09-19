const express = require('express');
const path = require('path');
const defaultCacheManager = require('../services/cacheManager');
const defaultCategoryRegistry = require('../services/categoryRegistry');
const defaultPoedbService = require('../services/poedbService');
const createBridgeRouter = require('../routes/bridgeRoutes');
const createAnalyzeRouter = require('../routes/analyzeRoutes');

const LOOPBACK_ORIGIN_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

/**
 * Factory that creates and configures the Express application instance without binding to a network port.
 * Allows pure in-memory testing, custom dependencies, and lifecycle decoupling.
 *
 * @param {Object} options Configuration and service overrides
 * @returns {import('express').Application} Configured Express app
 */
function createApp(options = {}) {
  const cacheManager = options.cacheManager || defaultCacheManager;
  const CategoryRegistry = options.categoryRegistry || defaultCategoryRegistry;
  const poedbService = options.poedbService || defaultPoedbService;
  const staticDir = options.staticDir || path.join(__dirname, '..', 'public');

  const app = express();

  // Strict loopback-only CORS & Origin protection:
  // Blocks malicious external websites on the internet from making cross-origin requests to local APIs.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) {
      // Non-browser direct requests (e.g. C# Desktop Host, curl, unit tests) or same-origin navigation
      return next();
    }

    if (LOOPBACK_ORIGIN_PATTERN.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Vary', 'Origin');
    } else {
      // Reject cross-origin preflight requests from external websites
      if (req.method === 'OPTIONS') {
        return res.status(403).json({ error: 'CORS Forbidden: External web origins not permitted.' });
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json());
  app.use(express.static(staticDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    }
  }));

  // API: Health probe for Desktop Host (HealthClient.cs) & process monitoring
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'poestash-server',
      version: '2.0.1',
      pid: process.pid,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // API: System status, diagnostics and cache info
  app.get('/api/status', (req, res) => {
    res.json(cacheManager.getStatus());
  });

  // API: Dynamic available categories for a specific game and league
  app.get('/api/categories', (req, res) => {
    const game = (req.query.game || 'poe1').toLowerCase();
    if (game !== 'poe1' && game !== 'poe2') {
      return res.status(400).json({ error: 'Invalid game parameter. Allowed values: poe1, poe2.' });
    }

    const league = req.query.league || cacheManager.getActiveLeague(game);
    if (!cacheManager.isValidLeague(game, league)) {
      return res.status(400).json({ 
        error: `Invalid or unknown league "${league}" for ${game}.`,
        validLeagues: cacheManager.getLeagues()[game]?.map(l => l.id) || []
      });
    }

    const categories = cacheManager.getAvailableCategories(game, league);
    res.json({
      game,
      league,
      categories
    });
  });

  // API: Get items for a game and league
  app.get('/api/items', (req, res) => {
    const game = (req.query.game || 'poe1').toLowerCase();
    if (game !== 'poe1' && game !== 'poe2') {
      return res.status(400).json({ error: 'Invalid game parameter. Allowed values: poe1, poe2.' });
    }

    const league = req.query.league || cacheManager.getActiveLeague(game);
    if (!cacheManager.isValidLeague(game, league)) {
      return res.status(400).json({ 
        error: `Invalid or unknown league "${league}" for ${game}.`,
        validLeagues: cacheManager.getLeagues()[game]?.map(l => l.id) || []
      });
    }

    const data = cacheManager.getData(game, league);
    res.json(data);
  });

  // API: Authentic in-game item description from PoEDB (with disk caching)
  app.get('/api/item-description', async (req, res) => {
    const name = req.query.name;
    const game = (req.query.game || 'poe1').toLowerCase();

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Parameter "name" is required.' });
    }

    try {
      const desc = await poedbService.getItemDescription(name, game);
      if (desc) {
        return res.json({ success: true, description: desc });
      }
      return res.status(404).json({ success: false, message: `No poedb description found for "${name}"` });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Trigger true full refresh across all available categories (Single-flight deduplicated)
  app.post('/api/refresh', async (req, res) => {
    const { game, league } = req.body || {};

    if (game && game !== 'poe1' && game !== 'poe2') {
      return res.status(400).json({ error: 'Invalid game parameter. Must be "poe1" or "poe2".' });
    }

    if (league && game && !cacheManager.isValidLeague(game, league)) {
      return res.status(400).json({ error: `Invalid or unknown league "${league}" for ${game}.` });
    }

    const alreadyRunning = cacheManager.isRefreshRunning(game, league);
    if (alreadyRunning) {
      return res.status(200).json({
        success: true,
        status: 'already_running',
        message: 'Full cache refresh already in progress, attached to active single-flight job.',
        activeJobs: Array.from(cacheManager.refreshJobs.keys())
      });
    }

    cacheManager.refreshAllAvailable(game, league).catch(err => {
      console.error('[Server] Manual refresh error:', err);
    });

    res.json({
      success: true,
      status: 'started',
      message: 'Full cache refresh across all available categories started in background.',
      activeJobs: Array.from(cacheManager.refreshJobs.keys())
    });
  });

  // API: Refresh single category on-demand with strict whitelist validation
  app.post('/api/refresh-category', async (req, res) => {
    const { game = 'poe1', league, category } = req.body || {};

    if (game !== 'poe1' && game !== 'poe2') {
      return res.status(400).json({ error: 'Invalid game parameter. Must be "poe1" or "poe2".' });
    }

    const targetLeague = league || cacheManager.getActiveLeague(game);
    if (!cacheManager.isValidLeague(game, targetLeague)) {
      return res.status(400).json({ 
        error: `Invalid or unknown league "${targetLeague}" for ${game}.`,
        validLeagues: cacheManager.getLeagues()[game]?.map(l => l.id) || []
      });
    }

    if (!category || typeof category !== 'string') {
      return res.status(400).json({ error: 'Category parameter is required and must be a string.' });
    }

    if (!CategoryRegistry.isValid(game, category)) {
      return res.status(400).json({ 
        error: `Unknown category "${category}" for ${game}.`,
        validCategories: CategoryRegistry.getRegistry(game).map(c => c.type)
      });
    }

    try {
      const updated = await cacheManager.refreshSingleCategory(game, targetLeague, category);
      res.json({
        success: true,
        message: `Category "${category}" refreshed successfully for ${game.toUpperCase()} - ${targetLeague}.`,
        itemCount: updated?.count || 0,
        rates: updated?.rates || {}
      });
    } catch (err) {
      console.error(`[Server] Error refreshing category ${category}:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // API: Dynamic available leagues list
  app.get('/api/leagues', (req, res) => {
    res.json(cacheManager.getLeagues());
  });

  // API: Desktop <-> Web Quick Inspect Bridge (SSE & Inspect Broadcast)
  app.use(createBridgeRouter(options));

  // API: Canonical Item Analysis (Phase 6 / 14)
  app.use(createAnalyzeRouter(options));

  // Serve frontend SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  return app;
}

module.exports = createApp;
