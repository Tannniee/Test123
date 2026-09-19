/**
 * POESTASH Desktop <-> Web Bridge Client
 * Connects to Server-Sent Events (SSE) stream at /api/bridge/events to receive real-time item inspections from Desktop Host.
 */

export class BridgeClient {
  constructor(options = {}) {
    this.eventsUrl = options.eventsUrl || '/api/bridge/events';
    this.latestUrl = options.latestUrl || '/api/bridge/latest';
    this.inspectUrl = options.inspectUrl || '/api/bridge/inspect';
    this.eventSource = null;
    this.inspectListeners = new Set();
    this.statusListeners = new Set();
    this.isConnected = false;
    this.reconnectTimer = null;
  }

  /**
   * Connects to the SSE endpoint.
   */
  connect() {
    if (typeof EventSource === 'undefined') {
      console.warn('[BridgeClient] EventSource is not supported in this browser.');
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    }

    try {
      this.eventSource = new EventSource(this.eventsUrl);

      this.eventSource.addEventListener('connected', (e) => {
        this.isConnected = true;
        this.notifyStatus(true);
        console.log('[BridgeClient] Connected to Desktop Bridge SSE stream.');
      });

      this.eventSource.addEventListener('inspect', (e) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyInspect(data);
        } catch (err) {
          console.error('[BridgeClient] Error parsing inspect event:', err);
        }
      });

      this.eventSource.addEventListener('latest', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data) {
            console.log('[BridgeClient] Received latest item on cold-start synchronization.');
            this.notifyInspect(data, true);
          }
        } catch (err) {
          console.error('[BridgeClient] Error parsing latest event:', err);
        }
      });

      this.eventSource.onerror = () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.notifyStatus(false);
          console.warn('[BridgeClient] Bridge SSE stream disconnected, scheduling reconnect...');
        }
        if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[BridgeClient] Failed to establish SSE connection:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectDelay = Math.min((this.reconnectDelay || 2000) * 1.5, 15000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected) {
        console.log(`[BridgeClient] Reconnecting SSE stream (delay: ${this.reconnectDelay}ms)...`);
        this.connect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Disconnects active EventSource.
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }

  /**
   * Subscribes to real-time inspect events from desktop.
   * @param {Function} callback Function receiving (inspectData, isColdStart)
   * @returns {Function} Unsubscribe function
   */
  onInspect(callback) {
    if (typeof callback === 'function') {
      this.inspectListeners.add(callback);
      return () => this.inspectListeners.delete(callback);
    }
    return () => {};
  }

  /**
   * Subscribes to connection status changes.
   * @param {Function} callback Function receiving (isConnected)
   * @returns {Function} Unsubscribe function
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.add(callback);
      callback(this.isConnected);
      return () => this.statusListeners.delete(callback);
    }
    return () => {};
  }

  notifyInspect(data, isColdStart = false) {
    for (const listener of this.inspectListeners) {
      try {
        listener(data, isColdStart);
      } catch (err) {
        console.error('[BridgeClient] Error in inspect listener:', err);
      }
    }
  }

  notifyStatus(connected) {
    for (const listener of this.statusListeners) {
      try {
        listener(connected);
      } catch (err) {
        console.error('[BridgeClient] Error in status listener:', err);
      }
    }
  }

  /**
   * Fetches the latest inspected item explicitly (cold-start recovery).
   */
  async fetchLatest() {
    try {
      const res = await fetch(this.latestUrl);
      if (res.ok) {
        const json = await res.json();
        return json.item || null;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Submits a manual raw item text into the bridge.
   */
  async sendManualInspect(rawText, game = 'poe1') {
    const res = await fetch(this.inspectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, game, source: 'manual_paste' })
    });
    return await res.json();
  }
}

export const bridge = new BridgeClient();
