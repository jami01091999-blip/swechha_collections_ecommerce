import { HttpError } from '../utils/HttpError.js';
import { INDIAN_STATES, PINCODE_RE } from './india.js';

// Checkout, delivery, COD, returns and invoice rules. Admin → Lookbook → Shop rules.
export const DEFAULT_SHOP = {
  shippingFee: 99,
  freeShippingAbove: 1999,
  codEnabled: true,
  codFee: 49,
  codMaxOrderValue: 10000,
  codBlockedPincodePrefixes: [],
  returnWindowDays: 7,
  reservationMinutes: 15,
  deliveryDaysMin: 3,
  deliveryDaysMax: 7,
  businessName: 'Swechha Collections',
  gstin: '',
  businessAddress: '',
  businessState: 'Telangana',
  pickupPincode: '500033',
};

const int = (v, label, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return Math.round(n);
};
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function sanitizeShop(body = {}) {
  const b = { ...DEFAULT_SHOP, ...body };
  const out = {
    shippingFee: int(b.shippingFee, 'Delivery charge', 0, 2000),
    freeShippingAbove: int(b.freeShippingAbove, 'Free delivery above', 0, 1000000),
    codEnabled: b.codEnabled === true || b.codEnabled === 'true',
    codFee: int(b.codFee, 'Cash on delivery fee', 0, 1000),
    codMaxOrderValue: int(b.codMaxOrderValue, 'Cash on delivery limit', 0, 1000000),
    codBlockedPincodePrefixes: [
      ...new Set(
        (Array.isArray(b.codBlockedPincodePrefixes) ? b.codBlockedPincodePrefixes : String(b.codBlockedPincodePrefixes || '').split(','))
          .map((s) => String(s).trim())
          .filter((s) => /^[1-9]\d{0,5}$/.test(s))
      ),
    ].slice(0, 200),
    returnWindowDays: int(b.returnWindowDays, 'Return window', 0, 60),
    reservationMinutes: int(b.reservationMinutes, 'Payment time limit', 5, 60),
    deliveryDaysMin: int(b.deliveryDaysMin, 'Fastest delivery days', 1, 30),
    deliveryDaysMax: int(b.deliveryDaysMax, 'Slowest delivery days', 1, 45),
    businessName: str(b.businessName, 100) || DEFAULT_SHOP.businessName,
    gstin: str(b.gstin, 15).toUpperCase(),
    businessAddress: str(b.businessAddress, 300),
    businessState: str(b.businessState, 60),
    pickupPincode: str(b.pickupPincode, 6),
  };
  if (out.deliveryDaysMax < out.deliveryDaysMin) throw new HttpError(400, 'Slowest delivery days must be at least the fastest.');
  if (out.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(out.gstin))
    throw new HttpError(400, 'GSTIN should look like 36ABCDE1234F1Z5.');
  if (!INDIAN_STATES.includes(out.businessState)) throw new HttpError(400, 'Choose the state your business is registered in.');
  if (out.pickupPincode && !PINCODE_RE.test(out.pickupPincode)) throw new HttpError(400, 'Pickup PIN code must be 6 digits.');
  return out;
}
