import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { OtpCode } from '../models/OtpCode.js';
import { User } from '../models/User.js';
import { sendOtpEmail } from '../integrations/mailer.js';
import { HttpError } from '../utils/HttpError.js';
import { EMAIL_RE, normalizeEmail } from '../validators/india.js';

export const OTP = {
  validMs: 10 * 60 * 1000,
  cooldownMs: 60 * 1000,
  maxAttempts: 5,
  perEmailPerHour: 5,
  perIpPerHour: 20,
};
const HOUR = 60 * 60 * 1000;

// Bound to the email so a code hash is useless for any other address.
const hashCode = (email, code) => createHmac('sha256', env.OTP_SECRET).update(`${email}:${code}`).digest('hex');

function sameHash(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

export function parseEmail(raw) {
  const email = normalizeEmail(raw);
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}

const tooMany = (message, retryAfterMs) =>
  new HttpError(429, message, { code: 'OTP_RATE_LIMIT', retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)) });

const minutes = (ms) => Math.max(1, Math.ceil(ms / 60000));

/** Sends a new code. Limits are counted from the OtpCode collection so they survive restarts. */
export async function requestOtp({ email: rawEmail, ip, userAgent }) {
  const email = parseEmail(rawEmail);
  const now = Date.now();
  const hourAgo = new Date(now - HOUR);

  const last = await OtpCode.findOne({ email }).sort({ createdAt: -1 }).select('createdAt').lean();
  if (last && now - last.createdAt < OTP.cooldownMs) {
    const wait = OTP.cooldownMs - (now - last.createdAt);
    throw tooMany(`Wait ${Math.ceil(wait / 1000)} seconds before asking for a new code.`, wait);
  }

  const emailRecent = await OtpCode.find({ email, createdAt: { $gte: hourAgo } })
    .sort({ createdAt: 1 })
    .select('createdAt')
    .lean();
  if (emailRecent.length >= OTP.perEmailPerHour) {
    const wait = emailRecent[0].createdAt.getTime() + HOUR - now;
    throw tooMany(`Too many codes for this email. Try again in ${minutes(wait)} minutes.`, wait);
  }

  if (ip) {
    const ipRecent = await OtpCode.find({ ip, createdAt: { $gte: hourAgo } })
      .sort({ createdAt: 1 })
      .select('createdAt')
      .lean();
    if (ipRecent.length >= OTP.perIpPerHour) {
      const wait = ipRecent[0].createdAt.getTime() + HOUR - now;
      throw tooMany(`Too many codes requested from this network. Try again in ${minutes(wait)} minutes.`, wait);
    }
  }

  // A new code makes every earlier unused code for this email stop working.
  await OtpCode.updateMany({ email, consumedAt: null, expiresAt: { $gt: new Date(now) } }, { $set: { expiresAt: new Date(now) } });

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const doc = await OtpCode.create({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(now + OTP.validMs),
    ip,
    userAgent: String(userAgent || '').slice(0, 300),
  });

  try {
    await sendOtpEmail(email, code);
  } catch (e) {
    // Don't count a code the customer never received against their cool-down.
    await OtpCode.deleteOne({ _id: doc._id });
    throw e;
  }
  return { ok: true, resendIn: OTP.cooldownMs / 1000, expiresIn: OTP.validMs / 1000 };
}

const codeExpired = () => new HttpError(400, 'This code has expired. Ask for a new one.', { code: 'OTP_EXPIRED' });
const codeLocked = () => new HttpError(400, 'Too many wrong tries. Ask for a new code.', { code: 'OTP_LOCKED' });

/** Checks the code; on success creates the user if needed. Returns { user (lean), isNew }. */
export async function verifyOtp({ email: rawEmail, code: rawCode }) {
  const email = parseEmail(rawEmail);
  const code = String(rawCode || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code.', { code: 'OTP_INVALID' });

  const doc = await OtpCode.findOne({ email, consumedAt: null }).sort({ createdAt: -1 });
  if (!doc || doc.expiresAt <= new Date()) throw codeExpired();
  if (doc.attempts >= OTP.maxAttempts) throw codeLocked();

  if (!sameHash(doc.codeHash, hashCode(email, code))) {
    const after = await OtpCode.findOneAndUpdate({ _id: doc._id }, { $inc: { attempts: 1 } }, { new: true }).lean();
    const left = OTP.maxAttempts - after.attempts;
    if (left <= 0) throw codeLocked();
    throw new HttpError(400, `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.`, {
      code: 'OTP_WRONG',
      attemptsLeft: left,
    });
  }

  // Consume atomically so the same code can never sign in twice.
  const consumed = await OtpCode.findOneAndUpdate(
    { _id: doc._id, consumedAt: null, attempts: { $lt: OTP.maxAttempts } },
    { $set: { consumedAt: new Date() } }
  );
  if (!consumed) throw codeExpired();

  const found = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { email } },
    { upsert: true, new: true, includeResultMetadata: true, setDefaultsOnInsert: true, runValidators: true }
  );
  const isNew = !found.lastErrorObject?.updatedExisting;
  let user = found.value.toObject();

  if (user.isBlocked) throw new HttpError(403, 'This account is blocked. Contact us on WhatsApp.', { code: 'BLOCKED' });

  const set = { lastLoginAt: new Date() };
  if (env.adminEmails.includes(email) && user.role !== 'admin') set.role = 'admin';
  user = await User.findByIdAndUpdate(user._id, { $set: set }, { new: true }).lean();
  return { user, isNew };
}
