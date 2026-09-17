/**
 * Application State & LocalStorage Persistence Module
 */

const STORAGE_KEYS = {
  FAVORITES: 'poe_checker_favorites',
  ALERTS: 'poe_checker_alerts',
  SETTINGS: 'poe_checker_settings'
};

class StateManager {
  constructor() {
    this.currentGame = 'poe1';
    this.currentLeague = 'Allflame';
    this.activeCategory = 'Currency';
    this.activeSubCategory = null;
    this.searchQuery = '';
    this.priceFilter = 'all'; // 'all' | '<10c' | '10-100c' | '1-5d' | '>5d'
    this.onlyFavorites = false;
    this.currentView = 'table'; // 'table' | 'grid'
    this.sortColumn = 'value'; // 'value' | 'name' | 'change7d' | 'volume'
    this.sortDirection = 'desc'; // 'desc' | 'asc'
    this.currentPage = 1;
    this.pageSize = 50;

    this.items = [];
    this.filteredItems = [];
    this.rates = {
      divinePriceInChaos: 0,
      mirrorPriceInChaos: 0,
      rawRates: {}
    };
    this.updatedAt = null;
    this.rotationInfo = null;
    this.activeModalItem = null;
    this.availableLeagues = {};

    // LocalStorage Persistent Data
    this.favorites = new Set(this.loadFavorites());
    this.alerts = this.loadAlerts();
    this.settings = this.loadSettings();
    this.compareList = new Map(); // id -> item (max 5)

    // Apply saved settings
    if (this.settings.defaultGame) this.currentGame = this.settings.defaultGame;
    if (this.settings.defaultView) this.currentView = this.settings.defaultView;
  }

  // --- Favorites ---
  loadFavorites() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...this.favorites]));
    } catch (e) {}
  }

  toggleFavorite(itemId) {
    if (this.favorites.has(itemId)) {
      this.favorites.delete(itemId);
    } else {
      this.favorites.add(itemId);
    }
    this.saveFavorites();
    return this.favorites.has(itemId);
  }

  isFavorite(itemId) {
    return this.favorites.has(itemId);
  }

  // --- Price Alerts ---
  loadAlerts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveAlerts() {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(this.alerts));
    } catch (e) {}
  }

  addAlert(alert) {
    // alert: { id, itemName, condition: 'above'|'below', threshold, currency: 'c'|'div'|'ex' }
    this.alerts.push({
      id: alert.id || `alert_${Date.now()}`,
      itemName: alert.itemName,
      condition: alert.condition || 'above',
      threshold: parseFloat(alert.threshold) || 0,
      currency: alert.currency || 'c',
      createdAt: new Date().toISOString()
    });
    this.saveAlerts();
  }

  removeAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.saveAlerts();
  }

  // --- Settings ---
  loadSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        defaultGame: 'poe1',
        defaultView: 'table',
        currencyFormat: 'smart'
      };
    } catch (e) {
      return {};
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {}
  }

  // --- Compare Mode ---
  toggleCompare(item) {
    if (this.compareList.has(item.id)) {
      this.compareList.delete(item.id);
      return false;
    }
    if (this.compareList.size >= 5) {
      return 'limit_reached';
    }
    this.compareList.set(item.id, item);
    return true;
  }

  isInCompare(itemId) {
    return this.compareList.has(itemId);
  }

  clearCompare() {
    this.compareList.clear();
  }
}

export const state = new StateManager();
