import { publicUser } from '../models/User.js';
import * as otp from '../services/otpService.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  createSession,
  revokeAllForUser,
  revokeByRefreshToken,
  rotateSession,
  setAuthCookies,
  signAccessToken,
} from '../services/tokenService.js';
import { noStore } from '../utils/cache.js';

const client = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

export async function requestOtp(req, res) {
  noStore(res);
  res.status(200).json(await otp.requestOtp({ email: req.body?.email, ...client(req) }));
}

export async function verifyOtp(req, res) {
  noStore(res);
  const { user, isNew } = await otp.verifyOtp({ email: req.body?.email, code: req.body?.code });
  const refreshToken = await createSession(user, req);
  setAuthCookies(res, signAccessToken(user), refreshToken);
  res.status(200).json({ user: publicUser(user), isNew });
}

export async function refresh(req, res) {
  noStore(res);
  try {
    const { user, refreshToken } = await rotateSession(req.cookies?.[REFRESH_COOKIE], req);
    setAuthCookies(res, signAccessToken(user), refreshToken);
    res.status(200).json({ user: publicUser(user) });
  } catch (e) {
    clearAuthCookies(res);
    throw e;
  }
}

export async function logout(req, res) {
  noStore(res);
  await revokeByRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  res.status(200).json({ ok: true });
}

export async function logoutAll(req, res) {
  noStore(res);
  await revokeAllForUser(req.user._id);
  clearAuthCookies(res);
  res.status(200).json({ ok: true });
}

// 200 with { user: null } when signed out, so page loads don't show 401s in the console.
// An expired access token still returns 401 TOKEN_EXPIRED so the client knows to refresh.
export function me(req, res) {
  noStore(res);
  if (!req.user && req.authError?.extra?.code === 'TOKEN_EXPIRED') throw req.authError;
  res.status(200).json({ user: publicUser(req.user) });
}
