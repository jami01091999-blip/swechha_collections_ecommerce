import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const message = { error: 'Too many requests. Please wait a few minutes and try again.' };
const common = { standardHeaders: 'draft-7', legacyHeaders: false, message, skip: () => env.isTest };

/** Every /api request, keyed by the real client IP (see `trust proxy` in app.js). */
export const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600 });

/** Admin writes and admin-key checks: stricter, to slow down key guessing. */
export const adminWriteLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 120 });
