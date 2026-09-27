// Shiprocket API (https://apidocs.shiprocket.in/). Used when SHIPPING_PROVIDER=shiprocket.
// Written to Shiprocket's documented v1 external API; it runs only once real account keys are set.
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';

const BASE = 'https://apiv2.shiprocket.in/v1/external';
let token = null;
let tokenAt = 0;
const TOKEN_TTL_MS = 8 * 24 * 60 * 60 * 1000; // tokens last 10 days; refresh after 8

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    logger.error({ status: res.status }, 'Shiprocket login failed');
    throw new HttpError(502, 'Could not sign in to Shiprocket. Check the API user email and password.');
  }
  token = data.token;
  tokenAt = Date.now();
}

async function call(method, path, body, retry = true) {
  if (!token || Date.now() - tokenAt > TOKEN_TTL_MS) await login();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    logger.error({ path, reason: e.message }, 'Shiprocket unreachable');
    throw new HttpError(502, "We couldn't reach the courier service. Try again in a moment.");
  }
  if (res.status === 401 && retry) {
    token = null;
    return call(method, path, body, false);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ path, status: res.status, message: data?.message }, 'Shiprocket error');
    throw new HttpError(502, data?.message || 'The courier service returned an error.', { code: 'COURIER_PROVIDER' });
  }
  return data;
}

export async function serviceability({ pickupPincode, pincode, weightKg, cod }) {
  const q = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: pincode,
    weight: String(weightKg),
    cod: cod ? '1' : '0',
  });
  const data = await call('GET', `/courier/serviceability/?${q}`);
  const couriers = data?.data?.available_courier_companies || [];
  if (!couriers.length) return { serviceable: false };
  const best = [...couriers].sort((a, b) => (Number(a.estimated_delivery_days) || 99) - (Number(b.estimated_delivery_days) || 99))[0];
  return {
    serviceable: true,
    cod: couriers.some((c) => Number(c.cod) === 1),
    etaDays: Number(best.estimated_delivery_days) || undefined,
    courier: best.courier_name,
  };
}

const two = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;

/** Creates the Shiprocket order, assigns an AWB, schedules pickup and fetches the label. */
export async function createShipment(order, parcel) {
  const a = order.address;
  const created = await call('POST', '/orders/create/adhoc', {
    order_id: order.orderNumber,
    order_date: stamp(new Date(order.placedAt || order.createdAt)),
    pickup_location: env.SHIPROCKET_PICKUP_LOCATION,
    billing_customer_name: a.fullName,
    billing_last_name: '',
    billing_address: a.line1,
    billing_address_2: [a.line2, a.landmark].filter(Boolean).join(', '),
    billing_city: a.city,
    billing_pincode: a.pincode,
    billing_state: a.state,
    billing_country: 'India',
    billing_email: order.email,
    billing_phone: a.phone,
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({
      name: `${i.name} (${i.size === 'FREE' ? 'Free Size' : i.size})`,
      sku: i.sku,
      units: i.qty,
      selling_price: i.price,
      discount: i.qty ? Math.round((i.discountShare || 0) / i.qty) : 0,
      tax: i.taxRatePercent,
      hsn: i.hsnCode || undefined,
    })),
    payment_method: order.payment.method === 'cod' ? 'COD' : 'Prepaid',
    shipping_charges: order.pricing.shipping,
    transaction_charges: order.pricing.codFee,
    total_discount: order.pricing.discount,
    sub_total: order.pricing.subtotal,
    length: parcel.l,
    breadth: parcel.b,
    height: parcel.h,
    weight: parcel.weightKg,
  });
  const shipmentId = created.shipment_id;
  const awbRes = await call('POST', '/courier/assign/awb', { shipment_id: shipmentId });
  const awb = awbRes?.response?.data?.awb_code;
  if (!awb) throw new HttpError(502, awbRes?.message || 'Shiprocket could not assign a courier. Try again or ship manually.');
  await call('POST', '/courier/generate/pickup', { shipment_id: [shipmentId] }).catch((e) =>
    logger.warn({ reason: e.message }, 'Pickup request failed')
  );
  const label = await call('POST', '/courier/generate/label', { shipment_id: [shipmentId] }).catch(() => null);
  return {
    provider: 'shiprocket',
    shipmentId: String(shipmentId),
    providerOrderId: String(created.order_id),
    awb,
    courier: awbRes?.response?.data?.courier_name || '',
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
    labelUrl: label?.label_url || '',
  };
}

export async function cancelShipment(providerOrderId) {
  if (providerOrderId) await call('POST', '/orders/cancel', { ids: [Number(providerOrderId)] });
}

/** Shiprocket status text → our order status (null = no change). */
export function mapStatus(raw) {
  const s = String(raw || '').toUpperCase();
  if (s.includes('RTO')) return 'rto';
  if (s === 'DELIVERED') return 'delivered';
  if (s.includes('OUT FOR DELIVERY')) return 'out_for_delivery';
  if (['PICKED UP', 'SHIPPED', 'IN TRANSIT', 'REACHED AT DESTINATION HUB', 'IN TRANSIT-AT DESTINATION HUB'].includes(s)) return 'shipped';
  return null;
}
