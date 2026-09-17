const express = require('express');
const cors = require('cors');
const path = require('path');
const cacheManager = require('./services/cacheManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Check system status, diagnostics and cache info
app.get('/api/status', (req, res) => {
  res.json(cacheManager.getStatus());
});

// API: Get items for a game and league
app.get('/api/items', (req, res) => {
  const game = req.query.game === 'poe2' ? 'poe2' : 'poe1';
  let league = req.query.league || cacheManager.getActiveLeague(game);

  let data = cacheManager.getData(game, league);
  
  // Fallback to Standard or first available if requested league is not cached
  if (!data && league !== 'Standard') {
    data = cacheManager.getData(game, 'Standard');
    league = 'Standard';
  }

  if (!data) {
    return res.json({
      game,
      league,
      updatedAt: null,
      divinePriceInChaos: 0,
      mirrorPriceInChaos: 0,
      rates: {},
      count: 0,
      items: [],
      snapshots: [],
      message: 'Data is being prepared or not yet cached.'
    });
  }

  res.json({
    game: data.game,
    league: data.league,
    updatedAt: data.updatedAt,
    divinePriceInChaos: data.divinePriceInChaos,
    mirrorPriceInChaos: data.mirrorPriceInChaos,
    rates: data.rates || {},
    count: data.count,
    items: data.items,
    snapshots: data.snapshots || []
  });
});

// API: Trigger full refresh manually
app.post('/api/refresh', async (req, res) => {
  if (cacheManager.isRefreshing) {
    return res.status(409).json({
      success: false,
      message: 'A refresh is already currently running.',
      status: cacheManager.refreshProgress
    });
  }

  // Run in background so user doesn't wait
  cacheManager.refreshAll().catch(err => {
    console.error('[Server] Manual refresh error:', err);
  });

  res.json({
    success: true,
    message: 'Full cache refresh started in background.',
    intervalMinutes: 30
  });
});

// API: Refresh single category on-demand
app.post('/api/refresh-category', async (req, res) => {
  const { game, league, category } = req.body;
  if (!category) {
    return res.status(400).json({ success: false, message: 'Category is required.' });
  }

  const targetGame = game === 'poe2' ? 'poe2' : 'poe1';
  const targetLeague = league || cacheManager.getActiveLeague(targetGame);

  try {
    const updated = await cacheManager.refreshSingleCategory(targetGame, targetLeague, category);
    res.json({
      success: true,
      message: `Category "${category}" refreshed successfully for ${targetGame.toUpperCase()} - ${targetLeague}.`,
      itemCount: updated?.count || 0,
      rates: updated?.rates || {}
    });
  } catch (err) {
    console.error(`[Server] Error refreshing category ${category}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Dynamic available leagues
app.get('/api/leagues', (req, res) => {
  res.json(cacheManager.getLeagues());
});

// Serve frontend SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initial boot check: if cache is empty, start sync
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`  PoE Quick Price Checker is running!`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Cache refresh interval: Every 30 minutes`);
  console.log(`=======================================================`);

  // Check if any cache already loaded
  const status = cacheManager.getStatus();
  const hasItems = Object.values(status.summary.poe1).some(l => l.count > 0);

  if (!hasItems) {
    console.log('[Server] No local cache found. Initiating first sync from PoE Ninja in background...');
    cacheManager.refreshAll().catch(err => console.error('[Server] Initial sync error:', err));
  } else {
    console.log('[Server] Local cache ready! Ready for instant search.');
  }
});
