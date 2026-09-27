import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { expireUnpaidOrders } from './orderService.js';

let running = false;

/** Periodic housekeeping. Safe to call from several places at once (only one run at a time per instance). */
export async function runJobs() {
  if (running) return { skipped: true };
  running = true;
  try {
    const expired = await expireUnpaidOrders();
    if (expired.cancelled) logger.info(expired, 'Released stock from unpaid orders');
    return { expired };
  } finally {
    running = false;
  }
}

/** Every 2 minutes inside the API process (Render keeps one instance running). Not in tests. */
export function startScheduler() {
  if (env.isTest) return null;
  const t = setInterval(() => runJobs().catch((e) => logger.error({ reason: e.message }, 'Scheduled job failed')), 2 * 60 * 1000);
  t.unref();
  return t;
}
