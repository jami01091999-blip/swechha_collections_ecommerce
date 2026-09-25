import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const message = { error: 'Too many requests. Please wait a few minutes and try again.' };
const common = { standardHeaders: 'draft-7', legacyHeaders: false, message, skip: () => env.isTest };
const WINDOW_MS = 15 * 60 * 1000;

/** Requests per IP per 15 minutes. Many Indian mobile users share one public IP (carrier NAT), so keep these generous. */
export const LIMITS = { api: 600, adminWrite: 120, auth: 100 };

/** Every /api request, keyed by the real client IP (see `trust proxy` in app.js). */
export const apiLimiter = rateLimit({ ...common, windowMs: WINDOW_MS, limit: LIMITS.api });

/** Staff/admin writes: stricter than the general limit. */
export const adminWriteLimiter = rateLimit({ ...common, windowMs: WINDOW_MS, limit: LIMITS.adminWrite });

/** Sign-in endpoints (on top of the per-email / per-IP OTP limits). */
export const authLimiter = rateLimit({ ...common, windowMs: WINDOW_MS, limit: LIMITS.auth });
