const express = require('express');
const cors = require('cors');
const path = require('path');
const cacheManager = require('./services/cacheManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Check system status and cache info
app.get('/api/status', (req, res) => {
  res.json(cacheManager.getStatus());
});

// API: Get items for a game and league
app.get('/api/items', (req, res) => {
  const game = req.query.game === 'poe2' ? 'poe2' : 'poe1';
  let league = req.query.league || (game === 'poe1' ? 'Allflame' : 'Standard');

  let data = cacheManager.getData(game, league);
  
  // Fallback to Standard if requested league is not found
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
      count: 0,
      items: [],
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
    items: data.items
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
    message: 'Cache refresh started in background.',
    intervalMinutes: 30
  });
});

// API: Available leagues
app.get('/api/leagues', (req, res) => {
  res.json({
    poe1: [
      { id: 'Allflame', name: 'Allflame (Current League)', default: true },
      { id: 'Standard', name: 'Standard', default: false }
    ],
    poe2: [
      { id: 'Standard', name: 'PoE 2 Standard', default: true }
    ]
  });
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
