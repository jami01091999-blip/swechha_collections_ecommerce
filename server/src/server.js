import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDb, disconnectDb } from './db/mongoose.js';
import { createApp } from './app.js';
import { startScheduler } from './services/jobService.js';

const app = createApp();
const server = app.listen(env.PORT, () => logger.info(`API ready on http://localhost:${env.PORT} (${env.NODE_ENV}, ${env.APP_MODE} mode)`));

// Keep serving /api/health (db: "down") while the database is unreachable, and keep retrying.
async function connectWithRetry() {
  try {
    await connectDb();
    logger.info('MongoDB connected');
    startScheduler();
  } catch (e) {
    logger.error({ reason: e.message }, 'MongoDB connection failed, retrying in 5s');
    setTimeout(connectWithRetry, 5000).unref();
  }
}
connectWithRetry();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    try {
      await disconnectDb();
    } finally {
      clearTimeout(force);
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
