import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Paths (under /api) that receive server-to-server calls, e.g. payment webhooks in Phase 5. */
export const CSRF_EXEMPT = new Set(['/webhooks/razorpay', '/webhooks/courier', '/internal/jobs']);

const blocked = (res, req) =>
  res.status(403).json({ error: 'This request was blocked. Reload the page and try again.', code: 'CSRF', requestId: req.id });

/**
 * State-changing requests must carry `X-Requested-With: swechha` (a custom header a cross-site form can't send),
 * and when the browser sends an Origin it must be one of CLIENT_ORIGIN.
 * In development an Origin matching the request's own host is also fine (phone testing over the LAN via Vite --host).
 */
export function csrf(req, res, next) {
  if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT.has(req.path)) return next();
  if (req.get('x-requested-with') !== 'swechha') return blocked(res, req);
  const origin = req.get('origin');
  if (origin) {
    const clean = origin.replace(/\/$/, '');
    const sameHost =
      !env.isProd &&
      (() => {
        try {
          return new URL(clean).host === req.get('host');
        } catch {
          return false;
        }
      })();
    if (!env.clientOrigins.includes(clean) && !sameHost) return blocked(res, req);
  }
  next();
}
