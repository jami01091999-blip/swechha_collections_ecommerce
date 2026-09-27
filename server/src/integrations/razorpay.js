// Razorpay REST API (https://razorpay.com/docs/api/) — orders, payments, refunds, signatures.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';

const BASE = 'https://api.razorpay.com/v1';

async function call(method, path, body) {
  if (!env.razorpayConfigured) throw new HttpError(503, 'Online payment is not set up yet. Choose cash on delivery.');
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    logger.error({ path, reason: e.message }, 'Razorpay unreachable');
    throw new HttpError(502, "We couldn't reach the payment service. Try again in a moment.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ path, status: res.status, code: data?.error?.code, description: data?.error?.description }, 'Razorpay error');
    throw new HttpError(502, data?.error?.description || 'The payment service returned an error.', { code: 'PAYMENT_PROVIDER' });
  }
  return data;
}

export const createOrder = ({ amountPaise, receipt, notes }) =>
  call('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes, payment_capture: 1 });
export const fetchPayment = (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`);
export const capturePayment = (paymentId, amountPaise) =>
  call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' });
export const orderPayments = (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
export const refundPayment = (paymentId, amountPaise, notes) =>
  call('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, notes });

const safeEqualHex = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, key secret). */
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}
