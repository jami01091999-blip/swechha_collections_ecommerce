import { HttpError } from '../utils/HttpError.js';
import { ADDRESS_TYPES } from '../models/User.js';
import { INDIAN_STATES, PHONE_RE, PINCODE_RE, normalizePhone } from './india.js';

// These messages are repeated in client/src/lib/validation.js so the form shows the same words inline.
export const MESSAGES = {
  name: 'Name can be up to 60 characters.',
  phone: 'Enter a 10-digit mobile number.',
  fullName: 'Enter the full name.',
  line1: 'Enter the house number and street.',
  city: 'Enter the city.',
  state: 'Choose a state.',
  pincode: 'Enter a 6-digit PIN code.',
};

const str = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Throws 400 with every problem joined, plus `fields` for inline form errors. */
function fail(fields) {
  throw new HttpError(400, Object.values(fields).join(' '), { fields });
}

/** PATCH /users/me — only name and phone; email is never editable. */
export function sanitizeProfile(body = {}) {
  const out = {};
  const fields = {};
  if ('name' in body) {
    const raw = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (raw.length > 60) fields.name = MESSAGES.name;
    else out.name = raw;
  }
  if ('phone' in body) {
    const phone = normalizePhone(body.phone);
    if (phone && !PHONE_RE.test(phone)) fields.phone = MESSAGES.phone;
    else out.phone = phone;
  }
  if (Object.keys(fields).length) fail(fields);
  return out;
}

const ADDRESS_FIELDS = {
  fullName: (v) => str(v, 60),
  phone: (v) => normalizePhone(v),
  line1: (v) => str(v, 120),
  line2: (v) => str(v, 120),
  landmark: (v) => str(v, 80),
  city: (v) => str(v, 60),
  state: (v) => str(v, 60),
  pincode: (v) => String(v ?? '').replace(/\s/g, ''),
  type: (v) => (ADDRESS_TYPES.includes(v) ? v : 'home'),
};

/**
 * Whitelists and checks an address. With `partial`, only the keys present are checked
 * (the caller merges them with the stored address and checks the result again).
 */
export function sanitizeAddress(body = {}, { partial = false } = {}) {
  const out = {};
  for (const [key, fn] of Object.entries(ADDRESS_FIELDS)) if (!partial || key in body) out[key] = fn(body[key]);
  if ('isDefault' in body) out.isDefault = body.isDefault === true;
  return out;
}

export function validateAddress(a) {
  const fields = {};
  if (!a.fullName) fields.fullName = MESSAGES.fullName;
  if (!PHONE_RE.test(a.phone || '')) fields.phone = MESSAGES.phone;
  if (!a.line1) fields.line1 = MESSAGES.line1;
  if (!a.city) fields.city = MESSAGES.city;
  if (!INDIAN_STATES.includes(a.state)) fields.state = MESSAGES.state;
  if (!PINCODE_RE.test(a.pincode || '')) fields.pincode = MESSAGES.pincode;
  if (Object.keys(fields).length) fail(fields);
}
