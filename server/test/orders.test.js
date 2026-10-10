import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';
import { addAddress, key, place, sizedProduct, stockOf } from './commerceHelpers.js';

let ctx;
let staff;
let admin;
let ana;
let ben;
let addr;
let benAddr;
let ids;
let Cart;
let Order;
let Coupon;

beforeAll(async () => {
  ctx = await startTestApp();
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  admin = (await ctx.signIn('owner@swechha.test')).agent;
  ana = (await ctx.signIn('ana@example.com')).agent;
  ben = (await ctx.signIn('ben@example.com')).agent;
  addr = await addAddress(ana);
  benAddr = await addAddress(ben, { state: 'Karnataka', city: 'Bengaluru', pincode: '560001' });
  Cart = (await import('../src/models/Cart.js')).Cart;
  Order = (await import('../src/models/Order.js')).Order;
  Coupon = (await import('../src/models/Coupon.js')).Coupon;
});
afterAll(() => ctx?.stop());

beforeEach(async () => {
  await Promise.all([Cart.deleteMany({}), Order.deleteMany({}), Coupon.deleteMany({}), ctx.Product.deleteMany({})]);
  await admin.put('/api/admin/shop-settings').set(XRW).send({}); // defaults: ₹99 delivery under ₹1,999, COD fee ₹49, COD up to ₹10,000
  const make = async (o) => (await staff.post('/api/products').set(XRW).send(sizedProduct(o))).body._id;
  ids = {
    kurti: await make({ code: 'K1', name: 'Kurti One', category: 'Kurti', price: 1000, mrp: 1500, taxRatePercent: 5 }),
    saree: await make({ code: 'S1', name: 'Saree One', price: 12000, mrp: 15000, sizeType: 'free', sizes: [{ label: 'FREE', stock: 2 }] }),
  };
});

const addToBag = (agent, productId, size, qty = 1) => agent.post('/api/cart/items').set(XRW).send({ productId, size, qty });
const quote = (agent, body) =>
  agent
    .post('/api/checkout/quote')
    .set(XRW)
    .send({ source: 'cart', ...body });

describe('checkout quote', () => {
  it('prices the bag with delivery, COD fee, GST split and delivery estimate', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const q = (await quote(ana, { addressId: addr, paymentMethod: 'cod' }).expect(200)).body;
    expect(q.pricing).toMatchObject({
      subtotal: 1000,
      shipping: 99,
      codFee: 49,
      total: 1148,
      discount: 0,
      interState: false,
      amountToFreeShipping: 999,
    });
    expect(q.lines[0]).toMatchObject({ taxableValue: 952.38, taxAmount: 47.62 });
    expect(q.delivery).toMatchObject({ serviceable: true, cod: true });
    expect(q.payment.cod.available).toBe(true);
    expect(q.canPlace).toBe(true);
    await addToBag(ana, ids.kurti, 'S', 1);
    const free = (await quote(ana, { addressId: addr, paymentMethod: 'online' })).body;
    expect(free.pricing).toMatchObject({ subtotal: 2000, shipping: 0, codFee: 0, total: 2000 });
  });

  it('checks COD limits and blocked PIN codes', async () => {
    await addToBag(ana, ids.saree, 'FREE', 1);
    const q = (await quote(ana, { addressId: addr, paymentMethod: 'cod' })).body;
    expect(q.payment.cod).toMatchObject({ available: false, reason: 'Cash on delivery is available on orders up to ₹10,000.' });
    expect(q.canPlace).toBe(false);
    await admin.put('/api/admin/shop-settings').set(XRW).send({ codMaxOrderValue: 0, codBlockedPincodePrefixes: '5000' });
    const blocked = (await quote(ana, { addressId: addr, paymentMethod: 'cod' })).body;
    expect(blocked.payment.cod.reason).toBe('Cash on delivery is not available for this PIN code.');
  });

  it('applies coupons with clear messages', async () => {
    await admin
      .post('/api/admin/coupons')
      .set(XRW)
      .send({ code: 'fest10', type: 'percent', value: 10, minOrder: 1500, maxDiscount: 150 })
      .expect(201);
    await addToBag(ana, ids.kurti, 'S', 1);
    expect((await quote(ana, { couponCode: 'FEST10' })).body.coupon).toMatchObject({
      valid: false,
      message: 'Add ₹500 more to use FEST10.',
    });
    expect((await quote(ana, { couponCode: 'NOPE' })).body.coupon.message).toBe('This coupon code is not valid.');
    await addToBag(ana, ids.kurti, 'S', 1);
    const q = (await quote(ana, { couponCode: ' fest10 ', addressId: addr, paymentMethod: 'cod' })).body;
    expect(q.coupon).toMatchObject({ valid: true, discount: 150 });
    expect(q.pricing).toMatchObject({ subtotal: 2000, discount: 150, shipping: 99, total: 1998, couponCode: 'FEST10' });
  });

  it('lists every problem before an order can be placed', async () => {
    await addToBag(ana, ids.kurti, 'M', 1);
    await staff
      .patch(`/api/admin/products/${ids.kurti}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'M', stock: 0 }] });
    const q = (await quote(ana, { addressId: addr, paymentMethod: 'cod' })).body;
    expect(q.canPlace).toBe(false);
    expect(q.problems.map((p) => p.message)).toEqual(['Kurti One (M): Sold out.', 'Nothing in this order is available right now.']);
    expect((await ana.post('/api/checkout/quote').set(XRW).send({ source: 'cart' })).status).toBe(200);
    await Cart.deleteMany({});
    expect((await quote(ana, {})).body).toMatchObject({ error: 'Your bag is empty.', code: 'EMPTY_BAG' });
  });
});

describe('placing orders', () => {
  it('COD: confirms, holds stock, empties the bag, emails, and numbers the order and invoice', async () => {
    await addToBag(ana, ids.kurti, 'S', 2);
    ctx.testOutbox.length = 0;
    const res = await place(ana, { addressId: addr }).expect(201);
    const o = res.body.order;
    expect(o).toMatchObject({ status: 'confirmed', canCancel: true, invoiceAvailable: true });
    expect(o.orderNumber).toMatch(/^SW-\d{4}-\d{6}$/);
    expect(o.invoiceNumber).toMatch(/^SWI-\d{4}-\d{6}$/);
    expect(o.payment).toMatchObject({ method: 'cod', status: 'cod_pending' });
    expect(o.pricing.total).toBe(2000 + 49);
    expect(o).not.toHaveProperty('idempotencyKey');
    expect(await stockOf(ctx.Product, ids.kurti, 'S')).toMatchObject({ stock: 3, reserved: 2 });
    const pub = (await request(ctx.app).get('/api/products/kurti-one')).body;
    expect(pub.sizes.find((s) => s.label === 'S').available).toBe(1);
    expect((await ana.get('/api/cart')).body.items).toHaveLength(0);
    expect(ctx.testOutbox.find((m) => m.to === 'ana@example.com' && m.subject === `Order ${o.orderNumber} confirmed`)).toBeTruthy();
  });

  it('is idempotent: the same key never creates a second order or a second hold', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const k = key();
    const a = (await place(ana, { addressId: addr, idempotencyKey: k })).body.order;
    await addToBag(ana, ids.kurti, 'S', 1);
    const b = (await place(ana, { addressId: addr, idempotencyKey: k })).body.order;
    expect(b.orderNumber).toBe(a.orderNumber);
    expect(await Order.countDocuments()).toBe(1);
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).reserved).toBe(1);
  });

  it('never sells the last piece twice', async () => {
    await addToBag(ana, ids.kurti, 'M', 1);
    await addToBag(ben, ids.kurti, 'M', 1);
    const results = await Promise.all([place(ana, { addressId: addr }), place(ben, { addressId: benAddr })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409).body.error).toMatch(/Kurti One \(M\)/);
    expect(await stockOf(ctx.Product, ids.kurti, 'M')).toMatchObject({ stock: 1, reserved: 1 });
    expect(await Order.countDocuments()).toBe(1);
  });

  it('Buy Now orders one item and leaves the bag alone; client prices are ignored', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const res = await place(ana, {
      source: 'buy_now',
      item: { productId: ids.saree, size: 'free', qty: 1 },
      addressId: addr,
      paymentMethod: 'online',
      price: 1,
      total: 1,
    }).expect(201);
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.pricing.total).toBe(12000);
    expect((await ana.get('/api/cart')).body.items).toHaveLength(1);
  });

  it('requires an address of your own and a payment method', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    expect((await place(ana, { addressId: benAddr })).body).toMatchObject({ error: 'Choose a delivery address.' });
    expect((await place(ana, { addressId: addr, paymentMethod: 'upi' })).body.error).toBe('Choose how you want to pay.');
  });
});

describe('online payment (built-in test screen)', () => {
  it('waits for payment, then confirms and clears the bag', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const res = await place(ana, { addressId: addr, paymentMethod: 'online' }).expect(201);
    expect(res.body.order).toMatchObject({ status: 'pending_payment', canPay: true, invoiceAvailable: false });
    expect(res.body.payment).toMatchObject({ provider: 'mock', amount: 109900, currency: 'INR', testMode: true });
    expect((await ana.get('/api/cart')).body.items).toHaveLength(1);
    const n = res.body.order.orderNumber;
    const failed = (await ana.post(`/api/payments/${n}/mock`).set(XRW).send({ outcome: 'failure' }).expect(200)).body;
    expect(failed.status).toBe('pending_payment');
    const paid = (await ana.post(`/api/payments/${n}/mock`).set(XRW).send({ outcome: 'success' }).expect(200)).body;
    expect(paid).toMatchObject({ status: 'confirmed', payment: { status: 'paid' }, invoiceAvailable: true });
    expect((await ana.get('/api/cart')).body.items).toHaveLength(0);
    expect((await ben.post(`/api/payments/${n}/mock`).set(XRW).send({ outcome: 'success' })).status).toBe(404);
  });

  it('releases stock when payment is not completed in time, and restores the order if the payment lands late', async () => {
    const { expireUnpaidOrders, markPaid } = await import('../src/services/orderService.js');
    await addToBag(ana, ids.kurti, 'M', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    expect((await stockOf(ctx.Product, ids.kurti, 'M')).reserved).toBe(1);
    await Order.updateOne({ orderNumber: n }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireUnpaidOrders()).toMatchObject({ cancelled: 1 });
    expect((await stockOf(ctx.Product, ids.kurti, 'M')).reserved).toBe(0);
    expect((await ana.post(`/api/payments/${n}/retry`).set(XRW)).body.error).toBe('This order is no longer waiting for payment.');
    const order = await Order.findOne({ orderNumber: n });
    const restored = await markPaid(order._id, { paymentId: 'pay_late', amountPaise: 100000 + 9900 });
    expect(restored.status).toBe('confirmed');
    expect((await stockOf(ctx.Product, ids.kurti, 'M')).reserved).toBe(1);
  });

  it('refunds automatically when a late payment arrives after the item sold out', async () => {
    const { expireUnpaidOrders, markPaid } = await import('../src/services/orderService.js');
    await addToBag(ana, ids.kurti, 'M', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await Order.updateOne({ orderNumber: n }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireUnpaidOrders();
    await addToBag(ben, ids.kurti, 'M', 1);
    await place(ben, { addressId: benAddr }).expect(201);
    const order = await Order.findOne({ orderNumber: n });
    await markPaid(order._id, { paymentId: 'pay_late2', amountPaise: 109900 });
    const after = await Order.findOne({ orderNumber: n }).lean();
    expect(after.status).toBe('cancelled');
    expect(after.payment).toMatchObject({ status: 'refunded', refundedTotal: 1099 });
  });

  it('rejects a payment whose amount does not match', async () => {
    const { markPaid } = await import('../src/services/orderService.js');
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    const order = await Order.findOne({ orderNumber: n });
    await expect(markPaid(order._id, { paymentId: 'x', amountPaise: 100 })).rejects.toThrow(/does not match/);
    expect((await Order.findById(order._id).lean()).status).toBe('pending_payment');
  });
});

describe('Razorpay webhook and checkout signature', () => {
  const sign = async (body) =>
    (await import('node:crypto')).createHmac('sha256', 'test-razorpay-webhook-secret').update(body).digest('hex');

  it('confirms the order once from a signed payment.captured event', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await Order.updateOne({ orderNumber: n }, { $set: { 'payment.providerOrderId': 'order_TEST123', 'payment.provider': 'razorpay' } });
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_TEST123', amount: 109900 } } },
    });
    const send = (sig) =>
      request(ctx.app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', sig)
        .set('X-Razorpay-Event-Id', 'evt_1')
        .send(body);
    expect((await send('bad')).status).toBe(400);
    expect((await send(await sign(body))).body).toMatchObject({ ok: true, handled: 'payment.captured' });
    expect((await send(await sign(body))).body).toMatchObject({ ok: true, duplicate: true });
    expect((await Order.findOne({ orderNumber: n }).lean()).payment).toMatchObject({ status: 'paid', paymentId: 'pay_1' });
  });

  it('processes a retried event when the first delivery failed part-way', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await Order.updateOne({ orderNumber: n }, { $set: { 'payment.providerOrderId': 'order_RETRY', 'payment.provider': 'razorpay' } });
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_r', order_id: 'order_RETRY', amount: 109900 } } },
    });
    const send = async () =>
      request(ctx.app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', await sign(body))
        .set('X-Razorpay-Event-Id', 'evt_retry')
        .send(body);
    const spy = vi.spyOn(Order, 'findOne').mockRejectedValueOnce(new Error('db blip'));
    expect((await send()).status).toBe(500);
    spy.mockRestore();
    expect((await send()).body).toMatchObject({ ok: true, handled: 'payment.captured' });
    expect((await Order.findOne({ orderNumber: n }).lean()).payment).toMatchObject({ status: 'paid', paymentId: 'pay_r' });
  });

  it('answers 200 (no endless retries) when the paid amount does not match', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await Order.updateOne({ orderNumber: n }, { $set: { 'payment.providerOrderId': 'order_MISMATCH', 'payment.provider': 'razorpay' } });
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_m', order_id: 'order_MISMATCH', amount: 100 } } },
    });
    const res = await request(ctx.app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', await sign(body))
      .set('X-Razorpay-Event-Id', 'evt_mismatch')
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.refused).toMatch(/does not match/);
    expect((await Order.findOne({ orderNumber: n }).lean()).status).toBe('pending_payment');
  });

  it('rejects a checkout callback with a bad signature', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await Order.updateOne({ orderNumber: n }, { $set: { 'payment.providerOrderId': 'order_X' } });
    const res = await ana
      .post('/api/payments/razorpay/verify')
      .set(XRW)
      .send({ orderNumber: n, razorpay_order_id: 'order_X', razorpay_payment_id: 'pay_X', razorpay_signature: 'nope' });
    expect(res.body.code).toBe('BAD_SIGNATURE');
  });
});

describe('customer orders', () => {
  it('lists, shows, cancels (releasing stock) and hides other people’s orders', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr })).body.order.orderNumber;
    const list = (await ana.get('/api/orders')).body;
    expect(list).toMatchObject({ total: 1, items: [{ orderNumber: n, itemCount: 1, status: 'confirmed' }] });
    expect((await ben.get(`/api/orders/${n}`)).status).toBe(404);
    const cancelled = (await ana.post(`/api/orders/${n}/cancel`).set(XRW).send({ reason: 'Ordered by mistake' }).expect(200)).body;
    expect(cancelled).toMatchObject({ status: 'cancelled', canCancel: false });
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).reserved).toBe(0);
    expect((await ana.post(`/api/orders/${n}/cancel`).set(XRW).send({})).status).toBe(409);
  });

  it('refunds a paid online order when it is cancelled', async () => {
    await addToBag(ana, ids.kurti, 'S', 1);
    const n = (await place(ana, { addressId: addr, paymentMethod: 'online' })).body.order.orderNumber;
    await ana.post(`/api/payments/${n}/mock`).set(XRW).send({ outcome: 'success' });
    const out = (await ana.post(`/api/orders/${n}/cancel`).set(XRW).send({}).expect(200)).body;
    expect(out.payment).toMatchObject({ status: 'refunded', refundedTotal: 1099 });
  });

  it('serves a GST invoice for your own confirmed order (IGST outside the business state)', async () => {
    await addToBag(ben, ids.kurti, 'S', 1);
    const n = (await place(ben, { addressId: benAddr })).body.order.orderNumber;
    const res = await ben.get(`/api/orders/${n}/invoice`).expect(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('IGST');
    expect(res.text).toContain(n);
    expect((await ana.get(`/api/orders/${n}/invoice`)).status).toBe(404);
  });
});
