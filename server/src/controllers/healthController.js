import { env } from '../config/env.js';
import { isDbUp } from '../db/mongoose.js';
import { noStore } from '../utils/cache.js';

export function health(req, res) {
  noStore(res);
  const up = isDbUp();
  res.status(up ? 200 : 503).json({
    status: 'ok',
    db: up ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
    mode: env.APP_MODE,
  });
}
