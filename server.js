const express = require('express');
const cors = require('cors');
const path = require('path');
const cacheManager = require('./services/cacheManager');
const CategoryRegistry = require('./services/categoryRegistry');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// API: Get items for a game and league (with non-silent warming status)
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

// API: Trigger true full refresh across all available categories
app.post('/api/refresh', async (req, res) => {
  const { game, league } = req.body || {};

  if (game && game !== 'poe1' && game !== 'poe2') {
    return res.status(400).json({ error: 'Invalid game parameter. Must be "poe1" or "poe2".' });
  }

  if (league && game && !cacheManager.isValidLeague(game, league)) {
    return res.status(400).json({ error: `Invalid or unknown league "${league}" for ${game}.` });
  }

  cacheManager.refreshAllAvailable(game, league).catch(err => {
    console.error('[Server] Manual refresh error:', err);
  });

  res.json({
    success: true,
    message: 'Full cache refresh across all available categories started in background.',
    activeJobs: Array.from(cacheManager.activeFetches)
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

// Serve frontend SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Boot server
const server = app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`  PoE Quick Price Checker v1.0.1 is running!`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Data Architecture: Data-Driven Dynamic Categories`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
