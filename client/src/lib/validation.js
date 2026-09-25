// Same words as server/src/validators/user.js so inline form errors match what the API says.
import { INDIAN_STATES, PHONE_RE, PINCODE_RE } from './india';

export const MESSAGES = {
  name: 'Name can be up to 60 characters.',
  phone: 'Enter a 10-digit mobile number.',
  fullName: 'Enter the full name.',
  line1: 'Enter the house number and street.',
  city: 'Enter the city.',
  state: 'Choose a state.',
  pincode: 'Enter a 6-digit PIN code.',
};

/** "+91 98765 43210" → "9876543210". */
export function normalizePhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Returns { field: message } for every problem (empty object when valid). */
export function addressErrors(a) {
  const e = {};
  if (!a.fullName?.trim()) e.fullName = MESSAGES.fullName;
  if (!PHONE_RE.test(normalizePhone(a.phone))) e.phone = MESSAGES.phone;
  if (!a.line1?.trim()) e.line1 = MESSAGES.line1;
  if (!a.city?.trim()) e.city = MESSAGES.city;
  if (!INDIAN_STATES.includes(a.state)) e.state = MESSAGES.state;
  if (!PINCODE_RE.test(String(a.pincode || '').replace(/\s/g, ''))) e.pincode = MESSAGES.pincode;
  return e;
}

export function profileErrors(p) {
  const e = {};
  if ((p.name || '').trim().length > 60) e.name = MESSAGES.name;
  const phone = normalizePhone(p.phone);
  if (phone && !PHONE_RE.test(phone)) e.phone = MESSAGES.phone;
  return e;
}
