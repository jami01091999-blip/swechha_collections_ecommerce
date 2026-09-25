import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export const adminKeyRequired = () => Boolean(env.ADMIN_KEY);

/** True when the request carries the correct x-admin-key (or no key is configured). */
export function isAdmin(req) {
  const expected = env.ADMIN_KEY;
  if (!expected) return true;
  const a = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'Admin key is missing or incorrect.');
}

/** Route middleware form of assertAdmin. */
export function requireAdmin(req, res, next) {
  try {
    assertAdmin(req);
    next();
  } catch (e) {
    next(e);
  }
}
