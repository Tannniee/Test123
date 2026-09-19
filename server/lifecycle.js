const http = require('http');
const createApp = require('./createApp');
const defaultCacheManager = require('../services/cacheManager');

/**
 * Parses command line arguments (e.g. node server.js --port 3456 --host 127.0.0.1)
 */
function parseArgs(args = process.argv.slice(2)) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const p = parseInt(args[++i], 10);
      if (!isNaN(p) && p > 0 && p <= 65535) result.port = p;
    } else if (args[i] === '--host' && args[i + 1]) {
      result.host = args[++i];
    }
  }
  return result;
}

/**
 * Starts the HTTP server with strict loopback binding (127.0.0.1) and graceful lifecycle management.
 *
 * @param {Object} options Options for starting server
 * @returns {Promise<{server: http.Server, app: import('express').Application, port: number, host: string, url: string, close: () => Promise<void>}>}
 */
function startServer(options = {}) {
  const cliArgs = parseArgs();
  const host = options.host || cliArgs.host || process.env.HOST || '127.0.0.1';
  const port = options.port !== undefined
    ? options.port
    : (cliArgs.port !== undefined
      ? cliArgs.port
      : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000));
  const cacheManager = options.cacheManager || defaultCacheManager;
  const app = options.app || createApp({ ...options, cacheManager });

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);

    server.listen(port, host, () => {
      const boundAddress = server.address();
      const actualPort = typeof boundAddress === 'object' && boundAddress ? boundAddress.port : port;
      const actualHost = typeof boundAddress === 'object' && boundAddress ? boundAddress.address : host;
      const url = `http://${actualHost}:${actualPort}`;

      console.log('=======================================================');
      console.log('  POESTASH Local Price Companion v2.0.0');
      console.log(`  Loopback Address : http://${actualHost}:${actualPort}`);
      console.log(`  Process ID (PID) : ${process.pid}`);
      console.log(`  Security Mode    : Localhost Loopback Only (${actualHost})`);
      console.log('=======================================================');

      const close = () => {
        return new Promise((resClose) => {
          try {
            if (cacheManager && typeof cacheManager.stopSchedulers === 'function') {
              cacheManager.stopSchedulers();
            }
          } catch (e) {}

          server.close(() => {
            resClose();
          });
        });
      };

      // Register graceful shutdown hooks
      const shutdownHandler = async (signal) => {
        console.log(`\n[Server Lifecycle] Received ${signal}. Shutting down gracefully...`);
        await close();
        console.log('[Server Lifecycle] Closed all connections and stopped background schedulers.');
        process.exit(0);
      };

      if (!options.skipSignalHandlers) {
        process.once('SIGINT', () => shutdownHandler('SIGINT'));
        process.once('SIGTERM', () => shutdownHandler('SIGTERM'));
      }

      resolve({
        server,
        app,
        port: actualPort,
        host: actualHost,
        url,
        close
      });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  parseArgs,
  startServer
};
