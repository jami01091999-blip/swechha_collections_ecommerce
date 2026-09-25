import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const message = { error: 'Too many requests. Please wait a few minutes and try again.' };
const common = { standardHeaders: 'draft-7', legacyHeaders: false, message, skip: () => env.isTest };

/** Every /api request, keyed by the real client IP (see `trust proxy` in app.js). */
export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600 });

/** Staff/admin writes: stricter than the general limit. */
export const adminWriteLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 120 });

/** Sign-in endpoints (on top of the per-email / per-IP OTP limits). */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 30 });
