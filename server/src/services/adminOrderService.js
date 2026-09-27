// Admin side of orders: board, fulfilment, cancellations, refunds, returns, customers, sales, export.
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { User, publicUser } from '../models/User.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';
import { escapeRegex } from '../validators/catalog.js';
import { getShop } from './settingsService.js';
import { cancelOrder, publicOrder, statusWords, transition } from './orderService.js';
import { refund } from './paymentService.js';
import { createShipment, mapCourierStatus } from './shippingService.js';
import { restockLines } from './stockService.js';
import * as emails from './orderEmails.js';

const OPEN_RETURNS = ['requested', 'approved', 'picked_up', 'received'];
export const BOARD_TABS = {
  new: { status: 'confirmed' },
  packed: { status: 'packed' },
  shipped: { status: { $in: ['shipped', 'out_for_delivery'] } },
  delivered: { status: 'delivered' },
  returns: { 'returnRequest.status': { $in: OPEN_RETURNS } },
  unpaid: { status: 'pending_payment' },
  cancelled: { status: { $in: ['cancelled', 'rto'] } },
  all: {},
};

async function orderOr404(id) {
  const filter = mongoose.isValidObjectId(id) ? { _id: id } : { orderNumber: String(id).toUpperCase() };
  const order = await Order.findOne(filter);
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}

/** Admin view: everything the customer sees plus internal payment details. */
async function adminView(order) {
  const shop = await getShop();
  const o = typeof order.toObject === 'function' ? order.toObject() : order;
  const customer = await User.findById(o.userId, { email: 1, name: 1, phone: 1, role: 1, createdAt: 1, isBlocked: 1 }).lean();
  const previousOrders = await Order.countDocuments({ userId: o.userId, _id: { $ne: o._id } });
  return {
    ...publicOrder(o, shop),
    payment: { ...o.payment, refunds: o.payment.refunds || [] },
    stockState: o.stockState,
    reservationExpiresAt: o.reservationExpiresAt,
    customer: customer ? { ...publicUser(customer), isBlocked: customer.isBlocked, previousOrders } : null,
    allowedNext: nextActions(o),
    shippingProvider: env.SHIPPING_PROVIDER,
  };
}

function nextActions(o) {
  const a = [];
  if (o.status === 'confirmed') a.push('pack', 'ship', 'cancel');
  if (o.status === 'packed') a.push('ship', 'unpack', 'cancel');
  if (o.status === 'pending_payment') a.push('cancel');
  // With manual delivery the admin moves the parcel along; Shiprocket sends these updates itself.
  if (['shipped', 'out_for_delivery'].includes(o.status)) a.push('out_for_delivery', 'delivered', 'rto');
  if (o.payment.method === 'online' && ['paid', 'partially_refunded'].includes(o.payment.status)) a.push('refund');
  if (o.payment.method === 'cod' && ['cod_collected', 'partially_refunded'].includes(o.payment.status)) a.push('refund');
  return a;
}

export async function listOrders({ tab = 'all', q, from, to, payment, page = 1, limit = 20 }) {
  const filter = { ...(BOARD_TABS[tab] || {}) };
  if (payment) filter['payment.method'] = payment;
  if (from || to) {
    filter.placedAt = {};
    if (from) filter.placedAt.$gte = new Date(from);
    if (to) filter.placedAt.$lte = new Date(new Date(to).getTime() + 86399999);
  }
  if (q) {
    const re = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ orderNumber: re }, { email: re }, { 'address.fullName': re }, { 'address.phone': re }, { 'shipment.awb': re }];
  }
  const [rows, total, counts] = await Promise.all([
    Order.find(filter, {
      orderNumber: 1,
      placedAt: 1,
      status: 1,
      email: 1,
      'address.fullName': 1,
      'address.city': 1,
      'pricing.total': 1,
      'payment.method': 1,
      'payment.status': 1,
      'returnRequest.status': 1,
      items: 1,
    })
      .sort({ placedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    tabCounts(),
  ]);
  return {
    items: rows.map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      status: o.status,
      email: o.email,
      customerName: o.address?.fullName,
      city: o.address?.city,
      total: o.pricing.total,
      payment: o.payment,
      returnStatus: o.returnRequest?.status,
      itemCount: o.items.reduce((s, i) => s + i.qty, 0),
      thumbs: o.items.slice(0, 3).map((i) => i.image),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    counts,
  };
}

async function tabCounts() {
  const entries = await Promise.all(
    Object.entries(BOARD_TABS)
      .filter(([k]) => k !== 'all')
      .map(async ([k, f]) => [k, await Order.countDocuments(f)])
  );
  return Object.fromEntries(entries);
}

export async function getOrder(id) {
  return adminView(await orderOr404(id));
}

const actor = (req) => req.user?.email || 'staff';

/** pack / unpack / out_for_delivery / delivered / rto — manual moves along the delivery path. */
export async function setStatus(id, action, { note } = {}, req) {
  const order = await orderOr404(id);
  const target = { pack: 'packed', unpack: 'confirmed', out_for_delivery: 'out_for_delivery', delivered: 'delivered', rto: 'rto' }[action];
  if (!target) throw new HttpError(400, 'Unknown action.');
  if (['out_for_delivery', 'delivered', 'rto'].includes(action) && order.shipment?.provider === 'shiprocket' && env.isLive) {
    throw new HttpError(409, 'Shiprocket updates this automatically.');
  }
  return adminView(await transition(order, target, { by: actor(req), note }));
}

export async function ship(id, input, req) {
  const order = await orderOr404(id);
  if (!['confirmed', 'packed'].includes(order.status))
    throw new HttpError(409, `This order is ${statusWords[order.status].toLowerCase()} and can't be shipped.`);
  const shipment = await createShipment(order, input);
  const updated = await transition(order, 'shipped', {
    by: actor(req),
    note: `Shipped with ${shipment.courier || 'courier'} · AWB ${shipment.awb}`,
    set: { shipment: { ...shipment, events: order.shipment?.events || [] } },
  });
  return adminView(updated);
}

export async function adminCancel(id, { reason }, req) {
  const order = await orderOr404(id);
  return adminView(await cancelOrder(order, { reason: reason || 'Cancelled by the shop', by: actor(req) }));
}

export async function adminRefund(id, { amount, reason, note }, req) {
  const order = await orderOr404(id);
  const manual = order.payment.method === 'cod';
  if (manual && order.payment.status !== 'cod_collected' && order.payment.status !== 'partially_refunded') {
    throw new HttpError(409, 'Cash on delivery orders can be refunded only after payment was collected.');
  }
  return adminView(await refund(order, amount, { reason, note, by: actor(req), manual }));
}

const RETURN_MOVES = {
  approve: { from: ['requested'], to: 'approved' },
  reject: { from: ['requested'], to: 'rejected' },
  picked_up: { from: ['approved'], to: 'picked_up' },
  received: { from: ['approved', 'picked_up'], to: 'received' },
  refund: { from: ['received'], to: 'refunded' },
  exchange: { from: ['received'], to: 'exchanged' },
  close: { from: ['requested', 'approved', 'picked_up', 'received', 'rejected'], to: 'closed' },
};

export async function updateReturn(id, { action, note, restock = true, amount }, req) {
  const order = await orderOr404(id);
  const r = order.returnRequest;
  const move = RETURN_MOVES[action];
  if (!r?.status) throw new HttpError(404, 'This order has no return request.');
  if (!move) throw new HttpError(400, 'Unknown action.');
  if (!move.from.includes(r.status))
    throw new HttpError(409, `The return is “${r.status.replace('_', ' ')}”, so it can't be ${action.replace('_', ' ')}.`);
  if (action === 'received' && restock) {
    const lines = r.items
      .map((x) => ({ productId: order.items.id(x.itemId)?.productId, size: order.items.id(x.itemId)?.size, qty: x.qty }))
      .filter((l) => l.productId);
    await restockLines(lines);
  }
  if (action === 'refund') {
    const amt = amount ?? r.amount;
    await refund(order, amt, { reason: `Return: ${r.reason}`, note, by: actor(req), manual: order.payment.method === 'cod' });
  }
  const set = { 'returnRequest.status': move.to };
  if (action === 'received') set['returnRequest.restocked'] = Boolean(restock);
  if (note && action === 'reject') set['returnRequest.note'] = note;
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'returnRequest.status': r.status },
    { $set: set, $push: { 'returnRequest.history': { status: move.to, note: note || '', by: actor(req), at: new Date() } } },
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'This return just changed. Reload and try again.');
  emails.returnUpdate(updated);
  return adminView(updated);
}

/** Shiprocket tracking webhook body → status change (ignored when not a valid move). */
export async function courierUpdate(body) {
  const awb = String(body?.awb || body?.awb_code || '').trim();
  if (!awb) return { ignored: 'no awb' };
  const order = await Order.findOne({ 'shipment.awb': awb });
  if (!order) return { ignored: 'unknown awb' };
  const next = mapCourierStatus(body.current_status || body.shipment_status);
  const scan = Array.isArray(body.scans) ? body.scans[body.scans.length - 1] : null;
  const event = { location: scan?.location || '', note: scan?.activity || body.current_status };
  if (!next || next === order.status) {
    await Order.updateOne({ _id: order._id }, { $push: { 'shipment.events': { status: order.status, at: new Date(), ...event } } });
    return { recorded: true };
  }
  try {
    await transition(order, next, { by: 'courier', note: body.current_status, event });
    return { status: next };
  } catch {
    return { ignored: `can't move ${order.status} → ${next}` };
  }
}

/* ── customers ─────────────────────────────────────────── */

export async function listCustomers({ q, page = 1, limit = 20 }) {
  const filter = { role: 'customer' };
  if (q) {
    const re = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ email: re }, { name: re }, { phone: re }];
  }
  const [users, total] = await Promise.all([
    User.find(filter, { email: 1, name: 1, phone: 1, createdAt: 1, lastLoginAt: 1, isBlocked: 1 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  const stats = await Order.aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) }, status: { $nin: ['cancelled', 'pending_payment'] } } },
    { $group: { _id: '$userId', orders: { $sum: 1 }, spent: { $sum: '$pricing.total' }, last: { $max: '$placedAt' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  return {
    items: users.map((u) => {
      const s = byUser.get(String(u._id));
      return {
        ...publicUser(u),
        isBlocked: u.isBlocked,
        lastLoginAt: u.lastLoginAt,
        orders: s?.orders || 0,
        spent: s?.spent || 0,
        lastOrderAt: s?.last || null,
      };
    }),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getCustomer(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Customer not found.');
  const u = await User.findById(id).lean();
  if (!u) throw new HttpError(404, 'Customer not found.');
  const orders = await Order.find({ userId: u._id }, { orderNumber: 1, placedAt: 1, status: 1, 'pricing.total': 1, 'payment.method': 1 })
    .sort({ placedAt: -1 })
    .limit(50)
    .lean();
  return {
    ...publicUser(u),
    isBlocked: u.isBlocked,
    lastLoginAt: u.lastLoginAt,
    addresses: u.addresses || [],
    orders: orders.map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      placedAt: o.placedAt,
      status: o.status,
      total: o.pricing.total,
      method: o.payment.method,
    })),
  };
}

export async function setBlocked(id, isBlocked, req) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Customer not found.');
  if (String(req.user._id) === String(id)) throw new HttpError(400, "You can't block yourself.");
  const u = await User.findOneAndUpdate({ _id: id, role: 'customer' }, { $set: { isBlocked: Boolean(isBlocked) } }, { new: true }).lean();
  if (!u) throw new HttpError(404, 'Customer not found.');
  return getCustomer(id);
}

/* ── sales ─────────────────────────────────────────────── */

const RANGES = { today: 0, '7d': 6, '30d': 29, '90d': 89 };
const IST_OFFSET_MS = 330 * 60 * 1000;
const istDay = (d) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Sales for the range (India time days): sold = not cancelled/unpaid, net of refunds. */
export async function sales(range = '7d') {
  const days = RANGES[range] ?? 6;
  const startIst = new Date(`${istDay(new Date(Date.now() - days * 86400000))}T00:00:00+05:30`);
  const sold = { placedAt: { $gte: startIst }, status: { $nin: ['cancelled', 'pending_payment'] } };
  const orders = await Order.find(sold, { placedAt: 1, pricing: 1, payment: 1, items: 1 }).lean();
  const revenue = orders.reduce((s, o) => s + o.pricing.total - (o.payment.refundedTotal || 0), 0);
  const series = [];
  for (let i = days; i >= 0; i--) {
    const key = istDay(new Date(Date.now() - i * 86400000));
    const dayOrders = orders.filter((o) => istDay(new Date(o.placedAt)) === key);
    series.push({
      date: key,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + o.pricing.total - (o.payment.refundedTotal || 0), 0),
    });
  }
  const products = new Map();
  for (const o of orders)
    for (const i of o.items) {
      const k = String(i.productId);
      const cur = products.get(k) || { productId: k, name: i.name, image: i.image, qty: 0, revenue: 0 };
      cur.qty += i.qty;
      cur.revenue += i.lineTotal - (i.discountShare || 0);
      products.set(k, cur);
    }
  const [toPack, toShip, inTransit, returnsOpen, codOutstanding] = await Promise.all([
    Order.countDocuments({ status: 'confirmed' }),
    Order.countDocuments({ status: 'packed' }),
    Order.countDocuments({ status: { $in: ['shipped', 'out_for_delivery'] } }),
    Order.countDocuments({ 'returnRequest.status': { $in: OPEN_RETURNS } }),
    Order.aggregate([
      { $match: { 'payment.status': 'cod_pending', status: { $in: ['confirmed', 'packed', 'shipped', 'out_for_delivery'] } } },
      { $group: { _id: null, sum: { $sum: '$pricing.total' } } },
    ]),
  ]);
  return {
    range,
    orders: orders.length,
    revenue,
    averageOrder: orders.length ? Math.round(revenue / orders.length) : 0,
    cod: orders.filter((o) => o.payment.method === 'cod').length,
    online: orders.filter((o) => o.payment.method === 'online').length,
    series,
    topProducts: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    queue: { toPack, toShip, inTransit, returnsOpen, codOutstanding: codOutstanding[0]?.sum || 0 },
  };
}

/* ── CSV export ────────────────────────────────────────── */

const csvCell = (v) => {
  const s = String(v ?? '');
  // Leading =,+,-,@ would run as a formula in Excel: prefix with an apostrophe.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportCsv({ from, to }) {
  const filter = {};
  if (from || to) {
    filter.placedAt = {};
    if (from) filter.placedAt.$gte = new Date(from);
    if (to) filter.placedAt.$lte = new Date(new Date(to).getTime() + 86399999);
  }
  const rows = await Order.find(filter).sort({ placedAt: 1 }).limit(10000).lean();
  const head = [
    'Order',
    'Invoice',
    'Placed (IST)',
    'Status',
    'Customer',
    'Email',
    'Phone',
    'City',
    'State',
    'PIN',
    'Items',
    'Subtotal',
    'Discount',
    'Coupon',
    'Delivery',
    'COD fee',
    'Total',
    'GST',
    'Payment',
    'Payment status',
    'Refunded',
    'Courier',
    'AWB',
  ];
  const lines = rows.map((o) =>
    [
      o.orderNumber,
      o.invoiceNumber,
      new Date(o.placedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      o.status,
      o.address?.fullName,
      o.email,
      o.address?.phone,
      o.address?.city,
      o.address?.state,
      o.address?.pincode,
      o.items.map((i) => `${i.sku} x${i.qty}`).join('; '),
      o.pricing.subtotal,
      o.pricing.discount,
      o.pricing.couponCode,
      o.pricing.shipping,
      o.pricing.codFee,
      o.pricing.total,
      o.pricing.taxTotal,
      o.payment.method,
      o.payment.status,
      o.payment.refundedTotal || 0,
      o.shipment?.courier,
      o.shipment?.awb,
    ]
      .map(csvCell)
      .join(',')
  );
  return [head.join(','), ...lines].join('\n');
}
