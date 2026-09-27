// Online payments. Provider: `razorpay` (real gateway, test or live keys) or `mock` (built-in test screen, test mode only).
// The amount always comes from the order in the database; the browser only reports which payment it made.
import { env } from '../config/env.js';
import { Order } from '../models/Order.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';
import { toPaise } from '../utils/money.js';
import * as rzp from '../integrations/razorpay.js';
import { getShop } from './settingsService.js';
import * as orders from './orderService.js';
import * as emails from './orderEmails.js';

const isMock = (order) => order.payment.provider === 'mock';

/** What the browser needs to open the payment screen. */
export async function paymentPayload(order) {
  const shop = await getShop();
  const base = {
    provider: order.payment.provider,
    orderNumber: order.orderNumber,
    amount: toPaise(order.pricing.total),
    currency: 'INR',
    expiresAt: order.reservationExpiresAt,
  };
  if (isMock(order)) return { ...base, testMode: true };
  return {
    ...base,
    keyId: env.RAZORPAY_KEY_ID,
    providerOrderId: order.payment.providerOrderId,
    name: shop.businessName,
    description: `Order ${order.orderNumber}`,
    prefill: { name: order.address.fullName, email: order.email, contact: order.address.phone },
    testMode: !env.isLive,
  };
}

/** Creates the gateway order for a new online order. */
export async function startPayment(order) {
  let providerOrderId;
  if (isMock(order)) {
    if (env.isLive) throw new HttpError(503, 'Online payment is not set up yet.');
    providerOrderId = `mock_${order.orderNumber}`;
  } else {
    const rz = await rzp.createOrder({
      amountPaise: toPaise(order.pricing.total),
      receipt: order.orderNumber,
      notes: { orderNumber: order.orderNumber },
    });
    providerOrderId = rz.id;
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id },
    { $set: { 'payment.providerOrderId': providerOrderId }, $push: { 'payment.attempts': { providerOrderId, status: 'created' } } },
    { new: true }
  );
  return paymentPayload(updated);
}

async function ownPendingOrder(user, orderNumber) {
  const order = await orders.findMyOrder(user._id, orderNumber);
  if (order.payment.method !== 'online') throw new HttpError(400, 'This order is cash on delivery.');
  return order;
}

/** "Pay now" again for an unpaid order that is still inside its time limit. */
export async function retryPayment(user, orderNumber) {
  const order = await ownPendingOrder(user, orderNumber);
  if (order.status !== 'pending_payment') throw new HttpError(409, 'This order is no longer waiting for payment.');
  if (!(order.reservationExpiresAt > new Date()))
    throw new HttpError(409, 'The time to pay for this order has ended. Please place the order again.', { code: 'PAYMENT_EXPIRED' });
  if (!order.payment.providerOrderId) return startPayment(order);
  return paymentPayload(order);
}

/** Razorpay Checkout success callback: check the signature, then the payment itself, then confirm. */
export async function verifyRazorpay(user, body) {
  const order = await ownPendingOrder(user, body.orderNumber);
  if (body.razorpay_order_id !== order.payment.providerOrderId) throw new HttpError(400, 'This payment does not belong to this order.');
  if (
    !rzp.verifyCheckoutSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    })
  ) {
    throw new HttpError(400, "We couldn't verify this payment. If money was deducted, it will be confirmed automatically or refunded.", {
      code: 'BAD_SIGNATURE',
    });
  }
  await captureAndConfirm(order, body.razorpay_payment_id);
  return orders.myOrder(user._id, order.orderNumber);
}

async function captureAndConfirm(order, paymentId) {
  let p = await rzp.fetchPayment(paymentId);
  if (p.order_id !== order.payment.providerOrderId) throw new HttpError(400, 'This payment does not belong to this order.');
  if (p.status === 'authorized') p = await rzp.capturePayment(paymentId, p.amount);
  if (p.status !== 'captured') throw new HttpError(409, 'The payment has not completed yet. We will update your order when it does.');
  return orders.markPaid(order._id, { paymentId: p.id, amountPaise: p.amount });
}

/** Built-in test payment screen (APP_MODE=test only): succeed or fail on demand. */
export async function mockComplete(user, orderNumber, outcome) {
  if (env.isLive) throw new HttpError(404, 'Unknown API route.');
  const order = await ownPendingOrder(user, orderNumber);
  if (!isMock(order)) throw new HttpError(400, 'This order uses the real payment gateway.');
  if (outcome === 'success') {
    if (order.status === 'pending_payment' && !(order.reservationExpiresAt > new Date())) {
      throw new HttpError(409, 'The time to pay for this order has ended. Please place the order again.', { code: 'PAYMENT_EXPIRED' });
    }
    await orders.markPaid(order._id, { paymentId: `mockpay_${Date.now()}`, amountPaise: toPaise(order.pricing.total) });
  } else {
    await recordFailure(order, 'Test payment failed');
  }
  return orders.myOrder(user._id, orderNumber);
}

async function recordFailure(order, reason) {
  await Order.updateOne(
    { _id: order._id },
    {
      $push: {
        'payment.attempts': { providerOrderId: order.payment.providerOrderId, status: 'failed', error: String(reason || '').slice(0, 200) },
      },
    }
  );
}

/** The browser reports a failed/cancelled attempt (the order stays payable until its time limit). */
export async function reportFailure(user, orderNumber, reason) {
  const order = await ownPendingOrder(user, orderNumber);
  if (order.status === 'pending_payment') await recordFailure(order, reason || 'Payment not completed');
  return orders.myOrder(user._id, orderNumber);
}

/** Before expiring an unpaid order: did the customer pay after all? Returns true when the order got confirmed. */
export async function settleWithProvider(order) {
  if (order.payment.provider !== 'razorpay' || !order.payment.providerOrderId) return false;
  const list = await rzp.orderPayments(order.payment.providerOrderId);
  const p = (list.items || []).find((x) => x.status === 'captured' || x.status === 'authorized');
  if (!p) return false;
  await captureAndConfirm(order, p.id);
  return true;
}

/** Razorpay webhook: signature-checked, each event handled once. */
export async function handleRazorpayWebhook(rawBody, signature, eventIdHeader) {
  if (!rzp.verifyWebhookSignature(rawBody, signature)) throw new HttpError(400, 'Invalid signature.');
  const event = JSON.parse(rawBody.toString('utf8'));
  const eventId =
    eventIdHeader || `${event.event}:${event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id || event.created_at}`;
  // Upsert (plus a unique index) so a retried delivery is processed once.
  let first;
  try {
    first = await WebhookEvent.updateOne(
      { provider: 'razorpay', eventId },
      { $setOnInsert: { type: event.event, receivedAt: new Date() } },
      { upsert: true }
    );
  } catch (e) {
    if (e?.code === 11000) return { duplicate: true };
    throw e;
  }
  if (!first.upsertedCount) return { duplicate: true };
  const payment = event.payload?.payment?.entity;
  const refundEntity = event.payload?.refund?.entity;
  if ((event.event === 'payment.captured' || event.event === 'order.paid') && payment?.order_id) {
    const order = await Order.findOne({ 'payment.providerOrderId': payment.order_id });
    if (order) await orders.markPaid(order._id, { paymentId: payment.id, amountPaise: payment.amount });
  } else if (event.event === 'payment.failed' && payment?.order_id) {
    const order = await Order.findOne({ 'payment.providerOrderId': payment.order_id });
    if (order) await recordFailure(order, payment.error_description);
  } else if ((event.event === 'refund.processed' || event.event === 'refund.failed') && refundEntity?.id) {
    const status = event.event === 'refund.processed' ? 'processed' : 'failed';
    const order = await Order.findOneAndUpdate(
      { 'payment.refunds.refundId': refundEntity.id },
      { $set: { 'payment.refunds.$.status': status } },
      { new: true }
    );
    if (order) await syncRefundStatus(order._id);
  }
  return { handled: event.event };
}

async function syncRefundStatus(orderId) {
  const o = await Order.findById(orderId).lean();
  const refunds = o.payment.refunds || [];
  const refunded = refunds.filter((r) => r.status !== 'failed').reduce((s, r) => s + r.amount, 0);
  const pending = refunds.some((r) => r.status === 'pending');
  const status =
    refunded <= 0
      ? o.payment.paymentId && o.payment.method === 'online'
        ? 'paid'
        : o.payment.status
      : refunded >= o.pricing.total
        ? pending
          ? 'refund_pending'
          : 'refunded'
        : 'partially_refunded';
  await Order.updateOne({ _id: orderId }, { $set: { 'payment.refundedTotal': refunded, 'payment.status': status } });
}

/**
 * Refunds `amount` rupees. Online payments go back through the gateway; cash-on-delivery refunds are recorded as
 * manual (you pay by UPI/bank transfer and note the reference).
 */
export async function refund(order, amount, { reason, by, note, manual } = {}) {
  const o = await Order.findById(order._id);
  const remaining = o.pricing.total - (o.payment.refundedTotal || 0);
  const amt = Math.round(Number(amount));
  if (!(amt > 0)) throw new HttpError(400, 'Refund amount must be more than 0.');
  if (amt > remaining) throw new HttpError(400, `You can refund at most ₹${remaining} on this order.`);
  let entry;
  if (o.payment.method === 'online' && !manual) {
    if (!['paid', 'partially_refunded', 'refund_pending'].includes(o.payment.status) || !o.payment.paymentId) {
      throw new HttpError(409, 'This order has no captured online payment to refund.');
    }
    if (isMock(o)) entry = { refundId: `mockrfnd_${Date.now()}`, status: 'processed' };
    else {
      const r = await rzp.refundPayment(o.payment.paymentId, toPaise(amt), {
        orderNumber: o.orderNumber,
        reason: String(reason || '').slice(0, 200),
      });
      entry = { refundId: r.id, status: r.status === 'processed' ? 'processed' : 'pending' };
    }
    entry.method = 'gateway';
  } else {
    if (!note && by !== 'system') throw new HttpError(400, 'Add the UPI/bank reference for this refund.');
    entry = { status: 'processed', method: 'manual' };
  }
  await Order.updateOne({ _id: o._id }, { $push: { 'payment.refunds': { ...entry, amount: amt, reason, note, by, at: new Date() } } });
  await syncRefundStatus(o._id);
  const updated = await Order.findById(o._id);
  emails.refundIssued(updated, amt);
  logger.info({ orderNumber: o.orderNumber, amount: amt, method: entry.method }, 'Refund recorded');
  return updated;
}
