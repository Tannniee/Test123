/**
 * POESTASH Bridge State Module
 * Tracks desktop bridge connection state and persists the latest inspected item for cold-start web recovery.
 */

class BridgeState {
  constructor() {
    this.latestItem = null;
    this.history = [];
    this.maxHistorySize = 10;
  }

  /**
   * Sets the latest inspected item received from desktop or manual paste.
   * @param {Object} itemData Inspected item payload
   */
  setLatest(itemData) {
    if (!itemData || typeof itemData !== 'object') return null;

    const payload = {
      requestId: itemData.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      game: itemData.game === 'poe2' ? 'poe2' : 'poe1',
      source: itemData.source || 'clipboard',
      rawText: String(itemData.rawText || '').trim(),
      capturedAt: itemData.capturedAt || new Date().toISOString()
    };

    this.latestItem = payload;

    // Keep circular history buffer for audit and debugging
    this.history.unshift(payload);
    if (this.history.length > this.maxHistorySize) {
      this.history.pop();
    }

    return payload;
  }

  /**
   * Gets the latest inspected item.
   * @returns {Object|null}
   */
  getLatest() {
    return this.latestItem;
  }

  /**
   * Clears state (used in testing or explicit reset).
   */
  clear() {
    this.latestItem = null;
    this.history = [];
  }

  /**
   * Returns diagnostic status.
   */
  getStatus(clientCount = 0) {
    return {
      status: 'active',
      activeClients: clientCount,
      hasLatest: this.latestItem !== null,
      lastCapturedAt: this.latestItem?.capturedAt || null,
      historyCount: this.history.length
    };
  }
}

module.exports = new BridgeState();
module.exports.BridgeState = BridgeState;
