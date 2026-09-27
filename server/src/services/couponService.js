import mongoose from 'mongoose';
import { Coupon } from '../models/Coupon.js';
import { Order } from '../models/Order.js';
import { HttpError } from '../utils/HttpError.js';
import { formatINR } from '../utils/format.js';

export const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

/** Checks a coupon for this customer and bag subtotal. Never throws for customer mistakes: returns { valid:false, message }. */
export async function evaluateCoupon(rawCode, { userId, subtotal, now = new Date() }) {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const c = await Coupon.findOne({ code }).lean();
  const invalid = (message) => ({ code, valid: false, discount: 0, message });
  if (!c || !c.active) return invalid('This coupon code is not valid.');
  if (c.startsAt && now < c.startsAt) return invalid('This coupon is not active yet.');
  if (c.endsAt && now > c.endsAt) return invalid('This coupon has expired.');
  if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return invalid('This coupon has been fully used.');
  if (c.perUserLimit > 0 && userId) {
    const used = await Order.countDocuments({ userId, 'pricing.couponCode': code, status: { $ne: 'cancelled' } });
    if (used >= c.perUserLimit) return invalid("You've already used this coupon.");
  }
  if (subtotal < c.minOrder) return invalid(`Add ${formatINR(c.minOrder - subtotal)} more to use ${code}.`);
  const raw = c.type === 'percent' ? Math.floor((subtotal * c.value) / 100) : c.value;
  const capped = c.type === 'percent' && c.maxDiscount > 0 ? Math.min(raw, c.maxDiscount) : raw;
  const discount = Math.min(capped, subtotal);
  return { code, valid: true, discount, message: `${code} applied: you save ${formatINR(discount)}.`, description: c.description };
}

export async function countUse(code, delta) {
  if (code) await Coupon.updateOne({ code }, { $inc: { usedCount: delta } });
}

/* ── admin ─────────────────────────────────────────────── */

const toDate = (v) => (v ? new Date(v) : undefined);

export function sanitizeCoupon(body = {}, { partial = false } = {}) {
  const out = {};
  const has = (k) => !partial || k in body;
  if (has('code')) {
    out.code = normalizeCode(body.code);
    if (!/^[A-Z0-9_-]{3,20}$/.test(out.code)) throw new HttpError(400, 'Code must be 3–20 letters or numbers.');
  }
  if (has('description'))
    out.description = String(body.description || '')
      .trim()
      .slice(0, 140);
  if (has('type')) {
    if (!['percent', 'flat'].includes(body.type)) throw new HttpError(400, 'Choose percent or flat amount.');
    out.type = body.type;
  }
  const num = (k, label, min, max) => {
    if (!has(k) || body[k] === undefined || body[k] === '') return;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
    out[k] = Math.round(n);
  };
  num('value', 'Discount', 1, 100000);
  num('minOrder', 'Minimum order', 0, 1000000);
  num('maxDiscount', 'Maximum discount', 0, 1000000);
  num('usageLimit', 'Total uses', 0, 1000000);
  num('perUserLimit', 'Uses per customer', 0, 1000);
  if (has('startsAt')) out.startsAt = toDate(body.startsAt);
  if (has('endsAt')) out.endsAt = toDate(body.endsAt);
  if (has('active')) out.active = body.active !== false && body.active !== 'false';
  for (const k of ['startsAt', 'endsAt']) if (out[k] && Number.isNaN(out[k].getTime())) throw new HttpError(400, 'Dates are not valid.');
  if (out.startsAt && out.endsAt && out.endsAt < out.startsAt) throw new HttpError(400, 'End date must be after the start date.');
  return out;
}

export async function listCoupons() {
  return Coupon.find().sort({ createdAt: -1 }).lean();
}

export async function createCoupon(body) {
  const data = sanitizeCoupon(body);
  if (!data.value) throw new HttpError(400, 'Discount is required.');
  if (data.type === 'percent' && data.value > 90) throw new HttpError(400, 'Percent discount can be at most 90%.');
  const clash = () => new HttpError(409, 'A coupon with this code already exists.');
  if (await Coupon.exists({ code: data.code })) throw clash();
  try {
    return (await Coupon.create(data)).toObject();
  } catch (e) {
    if (e?.code === 11000) throw clash();
    throw e;
  }
}

const assertId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Coupon not found.');
};

export async function updateCoupon(id, body) {
  assertId(id);
  const data = sanitizeCoupon(body, { partial: true });
  delete data.code; // codes can't change once customers may have used them
  const updated = await Coupon.findByIdAndUpdate(id, { $set: data }, { new: true, lean: true, runValidators: true });
  if (!updated) throw new HttpError(404, 'Coupon not found.');
  if (updated.type === 'percent' && updated.value > 90) throw new HttpError(400, 'Percent discount can be at most 90%.');
  return updated;
}

export async function deleteCoupon(id) {
  assertId(id);
  const res = await Coupon.deleteOne({ _id: id });
  if (!res.deletedCount) throw new HttpError(404, 'Coupon not found.');
}
