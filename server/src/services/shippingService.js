// Delivery: PIN code checks, shipments and tracking.
//  manual     — you pack and hand over to any courier, then enter the courier name + AWB (test mode can auto-fill one).
//  shiprocket — Shiprocket picks the courier, assigns the AWB, schedules pickup and sends tracking updates.
import { env } from '../config/env.js';
import { PINCODE_RE } from '../validators/india.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';
import * as shiprocket from '../integrations/shiprocket.js';

const cache = new Map(); // pincode|cod|weight → { at, value }
const CACHE_MS = 6 * 60 * 60 * 1000;

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

function manualServiceability(pincode, shop) {
  const codBlocked = (shop.codBlockedPincodePrefixes || []).some((p) => pincode.startsWith(p));
  // Same postal region (first two digits) as the pickup PIN arrives sooner.
  const near = shop.pickupPincode && pincode.slice(0, 2) === shop.pickupPincode.slice(0, 2);
  const min = near ? shop.deliveryDaysMin : Math.min(shop.deliveryDaysMin + 1, shop.deliveryDaysMax);
  const max = near ? Math.min(shop.deliveryDaysMin + 1, shop.deliveryDaysMax) : shop.deliveryDaysMax;
  return { serviceable: true, cod: !codBlocked, etaDays: { min, max } };
}

/** { serviceable, cod, etaDays: {min,max}, etaDate, courier? } — never throws for customer input. */
export async function serviceability(pincode, shop, { weightGrams = 500 } = {}) {
  const pin = String(pincode || '').trim();
  if (!PINCODE_RE.test(pin)) return { serviceable: false, cod: false, message: 'Enter a valid 6-digit PIN code.' };
  const key = `${env.SHIPPING_PROVIDER}|${pin}|${Math.ceil(weightGrams / 500)}`;
  const hit = cache.get(key);
  let result = hit && Date.now() - hit.at < CACHE_MS ? hit.value : null;
  if (!result) {
    if (env.SHIPPING_PROVIDER === 'shiprocket') {
      try {
        const r = await shiprocket.serviceability({
          pickupPincode: shop.pickupPincode,
          pincode: pin,
          weightKg: Math.max(0.5, weightGrams / 1000),
          cod: true,
        });
        result = r.serviceable
          ? {
              serviceable: true,
              cod: r.cod && manualServiceability(pin, shop).cod,
              etaDays: { min: r.etaDays || shop.deliveryDaysMin, max: r.etaDays || shop.deliveryDaysMax },
              courier: r.courier,
            }
          : { serviceable: false, cod: false };
      } catch (e) {
        // Courier API down: don't block checkout — fall back to the shop's own rules.
        logger.warn({ reason: e.message }, 'Serviceability check failed, using shop rules');
        result = manualServiceability(pin, shop);
      }
    } else {
      result = manualServiceability(pin, shop);
    }
    cache.set(key, { at: Date.now(), value: result });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
  }
  if (!result.serviceable) return { ...result, message: "We don't deliver to this PIN code yet." };
  if (result.cod && (shop.codBlockedPincodePrefixes || []).some((p) => pin.startsWith(p))) result = { ...result, cod: false };
  return { ...result, etaDate: addDays(result.etaDays.max).toISOString().slice(0, 10) };
}

/** Parcel size from the order lines: weights add up; the box is the largest item's box. */
export function parcelFor(order) {
  const grams = order.items.reduce((s, i) => s + (i.weightGrams || 500) * i.qty, 0);
  return { weightKg: Math.max(0.5, Math.round(grams / 100) / 10), l: 30, b: 25, h: Math.min(30, 5 * order.items.length) };
}

/** Creates the shipment. `manual` needs courier + AWB from the admin (test mode fills them in when blank). */
export async function createShipment(order, { courier, awb, trackingUrl } = {}) {
  if (env.SHIPPING_PROVIDER === 'shiprocket') return shiprocket.createShipment(order, parcelFor(order));
  let c = String(courier || '')
    .trim()
    .slice(0, 60);
  let a = String(awb || '')
    .trim()
    .slice(0, 40);
  if (!env.isLive) {
    c ||= 'Test courier';
    a ||= `TEST${Date.now().toString().slice(-8)}`;
  }
  if (!c || !a) throw new HttpError(400, 'Enter the courier name and AWB (tracking) number.');
  const url = String(trackingUrl || '').trim();
  if (url && !/^https?:\/\//i.test(url)) throw new HttpError(400, 'Tracking link must start with https://');
  return { provider: 'manual', courier: c, awb: a, trackingUrl: url, labelUrl: '' };
}

export async function cancelShipment(order) {
  if (order.shipment?.provider === 'shiprocket') await shiprocket.cancelShipment(order.shipment.providerOrderId).catch(() => {});
}

export const mapCourierStatus = shiprocket.mapStatus;
