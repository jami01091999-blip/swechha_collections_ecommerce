// Checkout and orders. Rules:
//  - Every price, total, discount and stock number is recomputed here from the database.
//  - Stock is held (reserved) when an order is placed and released if it's cancelled or never paid;
//    it leaves stock when the order ships.
//  - Status changes go through transition(), which checks the allowed moves and applies side effects once.
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Cart } from '../models/Cart.js';
import { User } from '../models/User.js';
import { nextNumber } from '../models/Counter.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';
import { formatINR } from '../utils/format.js';
import { getShop } from './settingsService.js';
import { BUYABLE, bagSummary, orderTotals, priceLines } from './pricingService.js';
import { countUse, evaluateCoupon } from './couponService.js';
import { commitLines, releaseLines, reserveLines, restockLines } from './stockService.js';
import { serviceability } from './shippingService.js';
import { removeOrderedLines } from './cartService.js';
import * as payments from './paymentService.js';
import * as emails from './orderEmails.js';

export const TRANSITIONS = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'shipped', 'cancelled'],
  packed: ['confirmed', 'shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'rto'],
  out_for_delivery: ['shipped', 'delivered', 'rto'],
  delivered: [],
  cancelled: [],
  rto: [],
};
export const CUSTOMER_CANCELLABLE = ['pending_payment', 'confirmed', 'packed'];
const STATUS_WORDS = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Order confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rto: 'Returned to us by the courier',
};

const stockLinesOf = (order, items = order.items) => items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty }));
const history = (status, note, by) => ({ status, note: note || STATUS_WORDS[status], by, at: new Date() });

/* ── quote ──────────────────────────────────────────────── */

async function rawLinesFor(userId, { source, item }) {
  if (source === 'buy_now') {
    if (!item?.productId || !item?.size) throw new HttpError(400, 'Choose a size.', { code: 'SIZE_REQUIRED' });
    return [{ productId: item.productId, size: item.size, qty: item.qty || 1 }];
  }
  const cart = await Cart.findOne({ userId }).lean();
  if (!cart?.items?.length) throw new HttpError(400, 'Your bag is empty.', { code: 'EMPTY_BAG' });
  return cart.items.map((i) => ({ _id: i._id, productId: i.productId, size: i.size, qty: i.qty }));
}

async function addressFor(userId, addressId) {
  if (!addressId) return null;
  if (!mongoose.isValidObjectId(addressId)) return null;
  const user = await User.findOne({ _id: userId, 'addresses._id': addressId }, { 'addresses.$': 1 }).lean();
  const a = user?.addresses?.[0];
  if (!a) return null;
  return {
    _id: String(a._id),
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || '',
    landmark: a.landmark || '',
    city: a.city,
    state: a.state,
    pincode: a.pincode,
  };
}

function codAvailability(lines, pricingWithCod, shop, delivery) {
  if (!shop.codEnabled) return { available: false, reason: 'Cash on delivery is not available right now.' };
  const blocked = lines.find((l) => BUYABLE.has(l.status) && l.isCodAllowed === false);
  if (blocked) return { available: false, reason: `Cash on delivery is not available for ${blocked.name}.` };
  if (shop.codMaxOrderValue > 0 && pricingWithCod.total > shop.codMaxOrderValue) {
    return { available: false, reason: `Cash on delivery is available on orders up to ${formatINR(shop.codMaxOrderValue)}.` };
  }
  if (delivery && !delivery.cod) return { available: false, reason: 'Cash on delivery is not available for this PIN code.' };
  return { available: true, fee: shop.codFee };
}

const onlineAvailability = () =>
  env.paymentProvider === 'razorpay' && !env.razorpayConfigured
    ? { available: false, reason: 'Online payment is not set up yet.' }
    : { available: true, provider: env.paymentProvider, testMode: !env.isLive };

/** Live price check for checkout. `problems` blocks placing the order; the client shows each message. */
export async function quote(user, body) {
  const raw = await rawLinesFor(user._id, body);
  const lines = await priceLines(raw);
  const shop = await getShop();
  const address = await addressFor(user._id, body.addressId);
  const { subtotal } = bagSummary(lines);
  const coupon = body.couponCode ? await evaluateCoupon(body.couponCode, { userId: user._id, subtotal }) : null;
  const discount = coupon?.valid ? coupon.discount : 0;
  const weightGrams = lines.reduce((s, l) => s + (l.weightGrams || 500) * (l.buyQty || 0), 0);
  const delivery = address ? await serviceability(address.pincode, shop, { weightGrams }) : null;
  const method = body.paymentMethod || null;
  const totals = orderTotals(lines, { shop, discount, paymentMethod: method, address });
  const withCod = method === 'cod' ? totals.pricing : orderTotals(lines, { shop, discount, paymentMethod: 'cod', address }).pricing;
  const cod = codAvailability(lines, withCod, shop, delivery);
  const online = onlineAvailability();

  const problems = [];
  for (const l of lines) {
    if (l.status === 'unavailable' || l.status === 'out_of_stock')
      problems.push({ type: 'item', lineId: l._id, message: `${l.name} (${l.sizeLabel}): ${l.message}.` });
    if (l.status === 'qty_reduced')
      problems.push({ type: 'qty', lineId: l._id, message: `${l.name} (${l.sizeLabel}): ${l.message}. Update the quantity to continue.` });
  }
  if (!lines.some((l) => BUYABLE.has(l.status))) problems.push({ type: 'empty', message: 'Nothing in this order is available right now.' });
  if (body.addressId && !address) problems.push({ type: 'address', message: 'Choose a delivery address.' });
  if (delivery && !delivery.serviceable) problems.push({ type: 'delivery', message: delivery.message });
  if (method === 'cod' && !cod.available) problems.push({ type: 'payment', message: cod.reason });
  if (method === 'online' && !online.available) problems.push({ type: 'payment', message: online.reason });

  const buyable = totals.lines;
  const notBuyable = lines.filter((l) => !BUYABLE.has(l.status));
  return {
    source: body.source,
    lines: [...buyable, ...notBuyable],
    pricing: { ...totals.pricing, couponCode: coupon?.valid ? coupon.code : '' },
    coupon,
    address,
    delivery,
    payment: { method, cod, online },
    shop: { freeShippingAbove: shop.freeShippingAbove, returnWindowDays: shop.returnWindowDays },
    problems,
    canPlace: problems.length === 0 && Boolean(address) && Boolean(method) && (method === 'cod' ? cod.available : online.available),
  };
}

/* ── place order ───────────────────────────────────────── */

export async function placeOrder(user, body) {
  const key = body.idempotencyKey;
  const existing = await Order.findOne({ userId: user._id, idempotencyKey: key });
  if (existing) return responseFor(existing, user);

  const q = await quote(user, body);
  if (!q.address) throw new HttpError(400, 'Choose a delivery address.', { code: 'ADDRESS_REQUIRED' });
  if (!q.payment.method) throw new HttpError(400, 'Choose how you want to pay.', { code: 'PAYMENT_REQUIRED' });
  if (!q.canPlace)
    throw new HttpError(409, q.problems[0]?.message || 'Please review your order.', { code: 'CHECKOUT_PROBLEMS', problems: q.problems });

  const shop = await getShop();
  const lines = q.lines.filter((l) => BUYABLE.has(l.status));
  const holds = lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.buyQty, name: l.name }));
  await reserveLines(holds);

  const method = q.payment.method;
  const online = method === 'online';
  let order;
  try {
    order = await Order.create({
      orderNumber: await nextNumber('SW'),
      invoiceNumber: online ? undefined : await nextNumber('SWI'),
      userId: user._id,
      email: user.email,
      source: body.source,
      idempotencyKey: key,
      items: lines.map((l) => ({
        productId: l.productId,
        slug: l.slug,
        name: l.name,
        image: l.image,
        fabric: l.fabric,
        category: l.category,
        sku: l.sku,
        size: l.size,
        qty: l.buyQty,
        price: l.price,
        mrp: l.mrp,
        lineTotal: l.lineTotal,
        discountShare: l.discountShare,
        taxRatePercent: l.taxRatePercent,
        taxableValue: l.taxableValue,
        taxAmount: l.taxAmount,
        hsnCode: l.hsnCode,
        weightGrams: l.weightGrams,
        isReturnable: l.isReturnable,
      })),
      address: { ...q.address, _id: undefined },
      pricing: q.pricing,
      payment: {
        method,
        provider: online ? env.paymentProvider : null,
        status: online ? 'pending' : 'cod_pending',
        attempts: [],
        refunds: [],
        refundedTotal: 0,
      },
      status: online ? 'pending_payment' : 'confirmed',
      statusHistory: [
        history(
          online ? 'pending_payment' : 'confirmed',
          online ? 'Order placed — waiting for payment' : 'Order placed (cash on delivery)',
          'customer'
        ),
      ],
      stockState: 'reserved',
      reservationExpiresAt: online ? new Date(Date.now() + shop.reservationMinutes * 60 * 1000) : undefined,
      cartLines: body.source === 'cart' ? holds.map(({ productId, size, qty }) => ({ productId, size, qty })) : [],
      couponCounted: Boolean(q.pricing.couponCode),
      placedAt: new Date(),
    });
  } catch (e) {
    await releaseLines(holds);
    if (e?.code === 11000 && e.keyPattern?.idempotencyKey) {
      const dup = await Order.findOne({ userId: user._id, idempotencyKey: key });
      if (dup) return responseFor(dup, user);
    }
    throw e;
  }
  if (order.pricing.couponCode) await countUse(order.pricing.couponCode, 1);

  if (!online) {
    await removeOrderedLines(user._id, order.cartLines);
    emails.orderConfirmed(order);
    return { order: publicOrder(order) };
  }
  try {
    const payment = await payments.startPayment(order);
    return { order: publicOrder(await Order.findById(order._id).lean()), payment };
  } catch (e) {
    await cancelOrder(order, { reason: 'Payment could not be started.', by: 'system', notify: false });
    throw e;
  }
}

async function responseFor(order, user) {
  if (order.status === 'pending_payment' && order.reservationExpiresAt > new Date()) {
    return { order: publicOrder(order), payment: await payments.paymentPayload(order, user) };
  }
  return { order: publicOrder(order) };
}

/* ── payment outcome ───────────────────────────────────── */

/**
 * Called when a payment is confirmed (checkout callback, webhook, mock screen or the expiry job). Idempotent.
 * If the order was already cancelled for taking too long, stock is re-held; if it sold out meanwhile, the
 * payment is refunded automatically.
 */
export async function markPaid(orderId, { paymentId, amountPaise }) {
  const order = await Order.findById(orderId);
  if (!order) return null;
  if (['paid', 'refund_pending', 'refunded', 'partially_refunded'].includes(order.payment.status)) return order;
  if (amountPaise !== Math.round(order.pricing.total * 100)) {
    logger.error({ orderNumber: order.orderNumber, amountPaise }, 'Paid amount does not match the order total');
    await Order.updateOne(
      { _id: order._id },
      {
        $push: {
          'payment.attempts': { providerOrderId: order.payment.providerOrderId, status: 'amount_mismatch', error: String(amountPaise) },
        },
      }
    );
    throw new HttpError(409, 'The payment amount does not match this order. Contact us and we will sort it out.');
  }
  const paidSet = { 'payment.status': 'paid', 'payment.paymentId': paymentId, 'payment.paidAt': new Date() };

  if (order.status === 'pending_payment') {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending_payment' },
      {
        $set: { ...paidSet, status: 'confirmed', invoiceNumber: await nextNumber('SWI') },
        $unset: { reservationExpiresAt: '' },
        $push: { statusHistory: history('confirmed', 'Payment received', 'system') },
      },
      { new: true }
    );
    if (!updated) return markPaid(orderId, { paymentId, amountPaise }); // changed underneath us: re-evaluate
    await removeOrderedLines(updated.userId, updated.cartLines);
    emails.orderConfirmed(updated);
    return updated;
  }

  if (order.status === 'cancelled' && order.stockState === 'released') {
    try {
      await reserveLines(stockLinesOf(order));
      const restored = await Order.findOneAndUpdate(
        { _id: order._id, status: 'cancelled' },
        {
          $set: {
            ...paidSet,
            status: 'confirmed',
            stockState: 'reserved',
            invoiceNumber: order.invoiceNumber || (await nextNumber('SWI')),
          },
          $unset: { cancel: '' },
          $push: { statusHistory: history('confirmed', 'Payment arrived after the time limit — order restored', 'system') },
        },
        { new: true }
      );
      if (restored) {
        if (restored.pricing.couponCode && !restored.couponCounted) await countUse(restored.pricing.couponCode, 1);
        await removeOrderedLines(restored.userId, restored.cartLines);
        emails.orderConfirmed(restored);
        return restored;
      }
      await releaseLines(stockLinesOf(order));
    } catch (e) {
      logger.warn({ orderNumber: order.orderNumber, reason: e.message }, 'Late payment: stock gone, refunding');
    }
    const paid = await Order.findOneAndUpdate({ _id: order._id }, { $set: paidSet }, { new: true });
    await payments.refund(paid, paid.pricing.total, { reason: 'Items sold out before the payment completed', by: 'system' });
    return Order.findById(order._id);
  }

  // Any other state (shouldn't happen): record the payment for the admin to see.
  return Order.findOneAndUpdate({ _id: order._id }, { $set: paidSet }, { new: true });
}

/** Unpaid online orders past their time limit: check the gateway one last time, then cancel and release stock. */
export async function expireUnpaidOrders(now = new Date()) {
  const stale = await Order.find({ status: 'pending_payment', reservationExpiresAt: { $lt: now } }).limit(50);
  let cancelled = 0;
  for (const order of stale) {
    try {
      const settled = await payments.settleWithProvider(order);
      if (settled) continue;
      await cancelOrder(order, { reason: 'Payment was not completed in time.', by: 'system', notify: false });
      cancelled++;
    } catch (e) {
      logger.warn({ orderNumber: order.orderNumber, reason: e.message }, 'Could not expire order yet');
    }
  }
  return { checked: stale.length, cancelled };
}

/* ── status changes ────────────────────────────────────── */

export async function cancelOrder(order, { reason, by, notify = true }) {
  if (!TRANSITIONS[order.status]?.includes('cancelled'))
    throw new HttpError(409, `This order can't be cancelled now (${STATUS_WORDS[order.status].toLowerCase()}).`);
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: { status: 'cancelled', cancel: { reason: reason || 'Cancelled', by, at: new Date() }, couponCounted: false },
      $unset: { reservationExpiresAt: '' },
      $push: { statusHistory: history('cancelled', reason || 'Cancelled', by) },
    },
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'This order just changed. Reload and try again.');
  if (order.stockState === 'reserved') {
    await releaseLines(stockLinesOf(order));
    await Order.updateOne({ _id: order._id }, { $set: { stockState: 'released' } });
  }
  if (order.couponCounted && order.pricing.couponCode) await countUse(order.pricing.couponCode, -1);
  let final = updated;
  if (updated.payment.status === 'paid') {
    final = await payments.refund(updated, updated.pricing.total, { reason: reason || 'Order cancelled', by });
  }
  final = await Order.findById(order._id);
  if (notify) emails.orderCancelled(final);
  return final;
}

/** Moves an order to `next` if allowed, applying stock/payment side effects exactly once. */
export async function transition(order, next, { by, note, set = {}, event } = {}) {
  if (order.status === next) return order;
  if (!TRANSITIONS[order.status]?.includes(next)) {
    throw new HttpError(409, `Can't move this order from “${STATUS_WORDS[order.status]}” to “${STATUS_WORDS[next]}”.`);
  }
  if (next === 'cancelled') return cancelOrder(order, { reason: note, by });
  const $set = { status: next, ...set };
  if (next === 'delivered') {
    $set.deliveredAt = new Date();
    if (order.payment.method === 'cod') $set['payment.status'] = 'cod_collected';
  }
  const push = { statusHistory: history(next, note, by) };
  if (event || ['shipped', 'out_for_delivery', 'delivered', 'rto'].includes(next)) {
    const ev = { status: next, at: new Date(), location: event?.location || '', note: event?.note || note || STATUS_WORDS[next] };
    // One update can't both replace `shipment` and push into it: add the event to the new shipment instead.
    if ($set.shipment) $set.shipment = { ...$set.shipment, events: [...($set.shipment.events || []), ev] };
    else push['shipment.events'] = ev;
  }
  const updated = await Order.findOneAndUpdate({ _id: order._id, status: order.status }, { $set, $push: push }, { new: true });
  if (!updated) throw new HttpError(409, 'This order just changed. Reload and try again.');

  if (next === 'shipped' && order.stockState === 'reserved') {
    await commitLines(stockLinesOf(order));
    await Order.updateOne({ _id: order._id }, { $set: { stockState: 'committed' } });
    emails.orderShipped(updated);
  }
  if (next === 'rto') {
    if (order.stockState === 'committed') await restockLines(stockLinesOf(order));
    else if (order.stockState === 'reserved') await releaseLines(stockLinesOf(order));
    await Order.updateOne(
      { _id: order._id },
      { $set: { stockState: 'restocked', ...(order.payment.method === 'cod' ? { 'payment.status': 'failed' } : {}) } }
    );
  }
  if (next === 'delivered') emails.orderDelivered(updated);
  return Order.findById(order._id);
}

/* ── customer views ────────────────────────────────────── */

const returnDeadline = (o, shop) => (o.deliveredAt ? new Date(new Date(o.deliveredAt).getTime() + shop.returnWindowDays * 86400000) : null);

export function publicOrder(o, shop) {
  if (!o) return null;
  const obj = typeof o.toObject === 'function' ? o.toObject() : o;
  const { idempotencyKey, cartLines, couponCounted, ...rest } = obj;
  const now = new Date();
  const deadline = shop ? returnDeadline(obj, shop) : null;
  const canReturn =
    Boolean(shop) &&
    obj.status === 'delivered' &&
    !obj.returnRequest?.status &&
    deadline > now &&
    obj.items.some((i) => i.isReturnable !== false);
  return {
    ...rest,
    _id: String(obj._id),
    payment: {
      method: obj.payment.method,
      provider: obj.payment.provider,
      status: obj.payment.status,
      paidAt: obj.payment.paidAt,
      refundedTotal: obj.payment.refundedTotal || 0,
      refunds: (obj.payment.refunds || []).map((r) => ({ amount: r.amount, status: r.status, at: r.at, method: r.method })),
    },
    canCancel: CUSTOMER_CANCELLABLE.includes(obj.status),
    canPay: obj.status === 'pending_payment' && obj.reservationExpiresAt > now,
    canReturn,
    returnDeadline: deadline,
    invoiceAvailable: Boolean(obj.invoiceNumber) && !['pending_payment'].includes(obj.status),
  };
}

export async function listMyOrders(userId, { page = 1, limit = 10 }) {
  const filter = { userId };
  const [rows, total] = await Promise.all([
    Order.find(filter, {
      orderNumber: 1,
      placedAt: 1,
      status: 1,
      'pricing.total': 1,
      items: { $slice: 4 },
      'payment.method': 1,
      'payment.status': 1,
      reservationExpiresAt: 1,
    })
      .sort({ placedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  const counts = await Order.aggregate([{ $match: filter }, { $project: { n: { $size: '$items' } } }]);
  const itemCount = new Map(counts.map((c) => [String(c._id), c.n]));
  return {
    items: rows.map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      status: o.status,
      total: o.pricing.total,
      payment: o.payment,
      itemCount: itemCount.get(String(o._id)) || o.items.length,
      items: o.items.map((i) => ({ name: i.name, image: i.image, size: i.size, qty: i.qty })),
      canPay: o.status === 'pending_payment' && o.reservationExpiresAt > new Date(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findMyOrder(userId, orderNumber) {
  const order = await Order.findOne({ userId, orderNumber: String(orderNumber).toUpperCase() });
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}

export async function myOrder(userId, orderNumber) {
  return publicOrder(await findMyOrder(userId, orderNumber), await getShop());
}

export async function cancelMyOrder(userId, orderNumber, reason) {
  const order = await findMyOrder(userId, orderNumber);
  if (!CUSTOMER_CANCELLABLE.includes(order.status))
    throw new HttpError(409, 'This order has shipped and can no longer be cancelled. You can request a return after delivery.');
  const done = await cancelOrder(order, { reason: reason ? `Cancelled by you: ${reason}` : 'Cancelled by you', by: 'customer' });
  return publicOrder(done, await getShop());
}

/** Return or size exchange, within the return window, for returnable items. */
export async function requestReturn(userId, orderNumber, body) {
  const order = await findMyOrder(userId, orderNumber);
  const shop = await getShop();
  if (order.status !== 'delivered') throw new HttpError(409, 'You can request a return after the order is delivered.');
  if (order.returnRequest?.status) throw new HttpError(409, 'A return has already been requested for this order.');
  const deadline = returnDeadline(order, shop);
  if (!deadline || deadline < new Date())
    throw new HttpError(409, `Returns are accepted within ${shop.returnWindowDays} days of delivery.`);
  const chosen = [];
  let amount = 0;
  for (const r of body.items) {
    const item = order.items.id(r.itemId);
    if (!item) throw new HttpError(400, 'Choose items from this order.');
    if (item.isReturnable === false) throw new HttpError(400, `${item.name} can't be returned.`);
    if (r.qty < 1 || r.qty > item.qty) throw new HttpError(400, `You can return up to ${item.qty} of ${item.name}.`);
    chosen.push({ itemId: item._id, qty: r.qty });
    amount += Math.round(((item.lineTotal - (item.discountShare || 0)) / item.qty) * r.qty);
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'returnRequest.status': { $exists: false } },
    {
      $set: {
        returnRequest: {
          status: 'requested',
          type: body.type,
          reason: body.reason,
          note: body.note || '',
          items: chosen,
          amount,
          requestedAt: new Date(),
          history: [history('requested', `Return requested: ${body.reason}`, 'customer')],
        },
      },
    },
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'A return has already been requested for this order.');
  emails.returnUpdate(updated);
  return publicOrder(updated, shop);
}

export const statusWords = STATUS_WORDS;
