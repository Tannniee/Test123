/**
 * POESTASH Main Server Entry Point
 * Modularized lifecycle, loopback security, and health probe support.
 */

const createApp = require('./server/createApp');
const { startServer, parseArgs } = require('./server/lifecycle');

// Pre-create standard default app instance for backward-compatible module requires
const app = createApp();
let server = null;

if (require.main === module) {
  startServer({ app }).then((instance) => {
    server = instance.server;
  }).catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  server,
  createApp,
  startServer,
  parseArgs
};
