import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ACCESS_COOKIE, verifyAccessToken } from '../services/tokenService.js';
import { HttpError } from '../utils/HttpError.js';

const USER_FIELDS = 'email name phone role isBlocked createdAt';

export const authRequired = () => new HttpError(401, 'Please sign in to continue.', { code: 'AUTH_REQUIRED' });
export const tokenExpired = () => new HttpError(401, 'Your session needs refreshing.', { code: 'TOKEN_EXPIRED' });
const blocked = () => new HttpError(403, 'This account is blocked. Contact us on WhatsApp.', { code: 'BLOCKED' });

/**
 * Reads the access cookie. Sets req.user (lean user or null) and req.authError (why there is no user).
 * The user is loaded on every request so role changes and blocks apply immediately.
 */
async function identify(req) {
  req.user = null;
  req.authError = null;
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return;
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (e) {
    req.authError = e.name === 'TokenExpiredError' ? tokenExpired() : authRequired();
    return;
  }
  if (!mongoose.isValidObjectId(payload.sub)) {
    req.authError = authRequired();
    return;
  }
  const user = await User.findById(payload.sub).select(USER_FIELDS).lean();
  if (!user) req.authError = authRequired();
  else if (user.isBlocked) req.authError = blocked();
  else req.user = user;
}

/** Public routes that behave differently for signed-in users. Never fails. */
export async function optionalAuth(req, res, next) {
  try {
    await identify(req);
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireAuth(req, res, next) {
  try {
    await identify(req);
    if (!req.user) throw req.authError || authRequired();
    next();
  } catch (e) {
    next(e);
  }
}

/** Throws unless the (optional) user has one of the roles. Use after optionalAuth. */
export function assertRole(req, roles) {
  if (!req.user) throw req.authError || authRequired();
  if (!roles.includes(req.user.role)) throw new HttpError(403, "You don't have access to this.", { code: 'FORBIDDEN' });
}

/** Use after requireAuth: requireRole('admin', 'staff'). */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    try {
      assertRole(req, roles);
      next();
    } catch (e) {
      next(e);
    }
  };

export const STAFF_ROLES = ['admin', 'staff'];
export const isStaff = (user) => Boolean(user && STAFF_ROLES.includes(user.role));
