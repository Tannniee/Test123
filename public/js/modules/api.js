/**
 * API Client Module
 */

export const Api = {
  async fetchLeagues() {
    const res = await fetch('/api/leagues');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async fetchItems(game, league) {
    const url = `/api/items?game=${encodeURIComponent(game)}&league=${encodeURIComponent(league)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async fetchStatus() {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async refreshAll() {
    const res = await fetch('/api/refresh', { method: 'POST' });
    if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async refreshCategory(game, league, category) {
    const res = await fetch('/api/refresh-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, league, category })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
};
