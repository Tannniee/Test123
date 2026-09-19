/**
 * POESTASH Quick Inspect Broker
 * Manages Server-Sent Events (SSE) connections with web companion clients, broadcasting real-time item inspections.
 */

const defaultBridgeState = require('./bridgeState');

class QuickInspectBroker {
  constructor(bridgeState = defaultBridgeState) {
    this.bridgeState = bridgeState;
    this.clients = new Set();
    this.pingInterval = null;
    this.startHeartbeat();
  }

  get clientCount() {
    return this.clients.size;
  }

  /**
   * Starts periodic SSE comment ping to keep long-lived connections alive through proxies and firewalls.
   */
  startHeartbeat() {
    if (process.env.NODE_ENV === 'test') return; // Avoid keeping Node event loop open during tests
    if (this.pingInterval) return;

    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 25000);

    if (this.pingInterval.unref) {
      this.pingInterval.unref();
    }
  }

  sendPing() {
    for (const client of this.clients) {
      try {
        client.write(': ping\n\n');
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Registers a new Express response as an SSE client.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  addClient(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.clients.add(res);

    // 1. Initial Handshake Event
    const handshakePayload = JSON.stringify({
      status: 'connected',
      clientsCount: this.clients.size,
      timestamp: new Date().toISOString()
    });
    res.write(`event: connected\ndata: ${handshakePayload}\n\n`);

    // 2. Immediate synchronization if a recent item was already inspected
    const latest = this.bridgeState.getLatest();
    if (latest) {
      res.write(`event: latest\ndata: ${JSON.stringify(latest)}\n\n`);
    }

    // Cleanup on disconnect
    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcasts a named event to all connected clients.
   * @param {string} event Event name
   * @param {Object} data JSON serializable data
   */
  broadcast(event, data) {
    const raw = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(raw);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Broadcasts an inspected item to all connected web clients and updates latest state.
   * @param {Object} itemData Inspected item payload
   * @returns {Object} Stored and broadcasted item payload
   */
  broadcastInspect(itemData) {
    const payload = this.bridgeState.setLatest(itemData);
    if (payload) {
      this.broadcast('inspect', payload);
    }
    return payload;
  }

  /**
   * Closes all active SSE connections cleanly.
   */
  closeAll() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    for (const client of this.clients) {
      try {
        client.end();
      } catch (e) {}
    }
    this.clients.clear();
  }
}

module.exports = new QuickInspectBroker();
module.exports.QuickInspectBroker = QuickInspectBroker;
