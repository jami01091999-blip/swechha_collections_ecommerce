import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/HttpError.js';

export const ACCESS_COOKIE = 'sw_at';
export const REFRESH_COOKIE = 'sw_rt';
/** Two tabs refreshing together may both present the same token; the second one is accepted this long after rotation. */
export const ROTATION_GRACE_MS = 30_000;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const refreshMs = () => env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

/* ── access token (JWT in a cookie) ───────────────────────── */
export function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_MINUTES * 60,
  });
}

/** Returns the payload; throws jsonwebtoken errors (TokenExpiredError when expired). */
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });

/* ── cookies ──────────────────────────────────────────────── */
// Host-only (no domain): the browser only ever sees the Vercel/Vite origin because /api is proxied.
const cookieBase = () => ({ httpOnly: true, sameSite: 'lax', secure: env.isProd });

export function setAuthCookies(res, accessToken, refreshToken) {
  // The access cookie lives as long as the session; the JWT inside expires after ACCESS_TOKEN_MINUTES,
  // which the API reports as TOKEN_EXPIRED so the client knows to refresh.
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase(), path: '/', maxAge: refreshMs() });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase(), path: '/api/auth', maxAge: refreshMs() });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/auth' });
}

/* ── sessions (refresh tokens) ────────────────────────────── */
const newRefreshToken = () => randomBytes(48).toString('base64url');
const clientInfo = (req) => ({ ip: req.ip, userAgent: String(req.get('user-agent') || '').slice(0, 300) });

export async function createSession(user, req) {
  const token = newRefreshToken();
  const now = new Date();
  await Session.create({
    userId: user._id,
    tokenHash: sha256(token),
    ...clientInfo(req),
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + refreshMs()),
  });
  return token;
}

const sessionExpired = () => new HttpError(401, 'Your session has ended. Please sign in again.', { code: 'SESSION_EXPIRED' });

/**
 * Exchanges a refresh token for a new one (rotation). Returns { user, refreshToken }.
 * Presenting the previous token within ROTATION_GRACE_MS is allowed (parallel tabs); after that it is treated
 * as a stolen token and the whole session is revoked.
 */
export async function rotateSession(token, req, attempt = 0) {
  if (!token) throw sessionExpired();
  const hash = sha256(token);
  const now = new Date();

  let session = await Session.findOne({ tokenHash: hash });
  if (!session) {
    session = await Session.findOne({ previousTokenHash: hash });
    if (!session || session.revokedAt) throw sessionExpired();
    if (now - session.rotatedAt > ROTATION_GRACE_MS) {
      await Session.updateOne({ _id: session._id }, { $set: { revokedAt: now } });
      throw new HttpError(401, 'For your safety we signed you out. Please sign in again.', { code: 'SESSION_REVOKED' });
    }
  }
  if (session.revokedAt || session.expiresAt <= now) throw sessionExpired();

  const user = await User.findById(session.userId).lean();
  if (!user) throw sessionExpired();
  if (user.isBlocked) {
    await Session.updateOne({ _id: session._id }, { $set: { revokedAt: now } });
    throw new HttpError(403, 'This account is blocked. Contact us on WhatsApp.', { code: 'BLOCKED' });
  }

  const next = newRefreshToken();
  const updated = await Session.findOneAndUpdate(
    { _id: session._id, tokenHash: session.tokenHash, revokedAt: null },
    {
      $set: {
        previousTokenHash: session.tokenHash,
        tokenHash: sha256(next),
        rotatedAt: now,
        lastUsedAt: now,
        ...clientInfo(req),
        expiresAt: new Date(now.getTime() + refreshMs()),
      },
    },
    { new: true }
  );
  if (!updated) {
    // Another request rotated this session at the same moment: try once more (it now matches the grace path).
    if (attempt === 0) return rotateSession(token, req, 1);
    throw sessionExpired();
  }
  return { user, refreshToken: next };
}

export async function revokeByRefreshToken(token) {
  if (!token) return;
  const hash = sha256(token);
  await Session.updateOne(
    { $or: [{ tokenHash: hash }, { previousTokenHash: hash }], revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeAllForUser(userId) {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
