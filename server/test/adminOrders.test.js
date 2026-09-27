import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';
import { addAddress, place, sizedProduct, stockOf } from './commerceHelpers.js';

let ctx;
let staff;
let admin;
let ana;
let addr;
let ids;
let Order;
let Cart;
let AuditLog;

beforeAll(async () => {
  ctx = await startTestApp();
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  admin = (await ctx.signIn('owner@swechha.test')).agent;
  ana = (await ctx.signIn('ana@example.com')).agent;
  addr = await addAddress(ana);
  Order = (await import('../src/models/Order.js')).Order;
  Cart = (await import('../src/models/Cart.js')).Cart;
  AuditLog = (await import('../src/models/AuditLog.js')).AuditLog;
});
afterAll(() => ctx?.stop());

beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), Cart.deleteMany({}), ctx.Product.deleteMany({})]);
  await admin.put('/api/admin/shop-settings').set(XRW).send({});
  ids = {
    kurti: (
      await staff
        .post('/api/products')
        .set(XRW)
        .send(sizedProduct({ code: 'K1', name: 'Kurti One', price: 1000, mrp: 1500 }))
    ).body._id,
  };
});

async function codOrder(qty = 1) {
  await ana.post('/api/cart/items').set(XRW).send({ productId: ids.kurti, size: 'S', qty });
  return (await place(ana, { addressId: addr })).body.order;
}
const act = (agent, id, action, extra = {}) =>
  agent
    .post(`/api/admin/orders/${id}/status`)
    .set(XRW)
    .send({ action, ...extra });

describe('orders board and fulfilment', () => {
  it('lists orders by tab with counts and search', async () => {
    const o = await codOrder();
    const res = (await staff.get('/api/admin/orders?tab=new').expect(200)).body;
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({ orderNumber: o.orderNumber, customerName: 'Ana Rao', total: 1148, itemCount: 1 });
    expect(res.counts).toMatchObject({ new: 1, packed: 0 });
    expect((await staff.get(`/api/admin/orders?q=${o.orderNumber.slice(-6)}`)).body.total).toBe(1);
    expect((await staff.get('/api/admin/orders?q=nobody')).body.total).toBe(0);
    const detail = (await staff.get(`/api/admin/orders/${o.orderNumber}`).expect(200)).body;
    expect(detail.customer).toMatchObject({ email: 'ana@example.com', previousOrders: 0 });
    expect(detail.allowedNext).toEqual(['pack', 'ship', 'cancel']);
  });

  it('pack → ship (stock leaves the shop) → out for delivery → delivered (cash collected)', async () => {
    const o = await codOrder(2);
    expect((await act(staff, o._id, 'pack').expect(200)).body.status).toBe('packed');
    const shipped = (await staff.post(`/api/admin/orders/${o._id}/ship`).set(XRW).send({}).expect(200)).body;
    expect(shipped.status).toBe('shipped');
    expect(shipped.shipment).toMatchObject({ provider: 'manual', courier: 'Test courier' });
    expect(shipped.shipment.awb).toMatch(/^TEST\d+/);
    expect(await stockOf(ctx.Product, ids.kurti, 'S')).toMatchObject({ stock: 1, reserved: 0 });
    expect((await act(staff, o._id, 'pack')).status).toBe(409);
    await act(staff, o._id, 'out_for_delivery').expect(200);
    const delivered = (await act(staff, o._id, 'delivered').expect(200)).body;
    expect(delivered).toMatchObject({ status: 'delivered', payment: { status: 'cod_collected' } });
    expect(delivered.deliveredAt).toBeTruthy();
    const mine = (await ana.get(`/api/orders/${o.orderNumber}`)).body;
    expect(mine.shipment.events.map((e) => e.status)).toEqual(['shipped', 'out_for_delivery', 'delivered']);
    expect(mine.canReturn).toBe(true);
    expect(mine.canCancel).toBe(false);
  });

  it('returned by the courier puts stock back', async () => {
    const o = await codOrder(1);
    await staff.post(`/api/admin/orders/${o._id}/ship`).set(XRW).send({ courier: 'Delhivery', awb: 'DL123' });
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).stock).toBe(2);
    await act(staff, o._id, 'rto').expect(200);
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).stock).toBe(3);
  });

  it('staff cannot move money; admins cancel and refund', async () => {
    const o = await codOrder();
    expect((await staff.post(`/api/admin/orders/${o._id}/cancel`).set(XRW).send({ reason: 'x' })).status).toBe(403);
    expect((await ana.get('/api/admin/orders')).status).toBe(403);
    const out = (await admin.post(`/api/admin/orders/${o._id}/cancel`).set(XRW).send({ reason: 'Out of fabric' }).expect(200)).body;
    expect(out.status).toBe('cancelled');
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).reserved).toBe(0);
  });
});

describe('returns', () => {
  async function deliveredOrder() {
    const o = await codOrder(2);
    await staff.post(`/api/admin/orders/${o._id}/ship`).set(XRW).send({});
    await act(staff, o._id, 'delivered');
    return (await ana.get(`/api/orders/${o.orderNumber}`)).body;
  }

  it('customer requests, staff receives (restocks), admin refunds manually for COD', async () => {
    const o = await deliveredOrder();
    const itemId = o.items[0]._id;
    const bad = await ana
      .post(`/api/orders/${o.orderNumber}/returns`)
      .set(XRW)
      .send({ type: 'refund', reason: 'Size does not fit', items: [{ itemId, qty: 3 }] });
    expect(bad.body.error).toBe('You can return up to 2 of Kurti One.');
    const req = (
      await ana
        .post(`/api/orders/${o.orderNumber}/returns`)
        .set(XRW)
        .send({ type: 'refund', reason: 'Size does not fit', items: [{ itemId, qty: 1 }] })
        .expect(200)
    ).body;
    expect(req.returnRequest).toMatchObject({ status: 'requested', amount: 1000 });
    expect(
      (
        await ana
          .post(`/api/orders/${o.orderNumber}/returns`)
          .set(XRW)
          .send({ type: 'refund', reason: 'Size does not fit', items: [{ itemId, qty: 1 }] })
      ).status
    ).toBe(409);
    const ret = (a, body) => a.post(`/api/admin/orders/${o._id}/return`).set(XRW).send(body);
    expect((await ret(staff, { action: 'received' })).status).toBe(409);
    await ret(staff, { action: 'approve' }).expect(200);
    await ret(staff, { action: 'received', restock: true }).expect(200);
    expect((await stockOf(ctx.Product, ids.kurti, 'S')).stock).toBe(2);
    expect((await ret(staff, { action: 'refund' })).status).toBe(403);
    expect((await ret(admin, { action: 'refund' })).body.error).toBe('Add the UPI/bank reference for this refund.');
    const done = (await ret(admin, { action: 'refund', note: 'UPI ref 1234' }).expect(200)).body;
    expect(done.returnRequest.status).toBe('refunded');
    expect(done.payment).toMatchObject({ status: 'partially_refunded', refundedTotal: 1000 });
  });

  it('closes the return window', async () => {
    const o = await deliveredOrder();
    await Order.updateOne({ orderNumber: o.orderNumber }, { $set: { deliveredAt: new Date(Date.now() - 8 * 86400000) } });
    const res = await ana
      .post(`/api/orders/${o.orderNumber}/returns`)
      .set(XRW)
      .send({ type: 'exchange', reason: 'Size does not fit', items: [{ itemId: o.items[0]._id, qty: 1 }] });
    expect(res.body.error).toBe('Returns are accepted within 7 days of delivery.');
  });
});

describe('coupons, customers, sales, export, audit', () => {
  it('coupon CRUD is admin only and validated', async () => {
    expect((await staff.get('/api/admin/coupons')).status).toBe(403);
    expect((await admin.post('/api/admin/coupons').set(XRW).send({ code: 'x', type: 'flat', value: 100 })).body.error).toBe(
      'Code must be 3–20 letters or numbers.'
    );
    expect((await admin.post('/api/admin/coupons').set(XRW).send({ code: 'BIG', type: 'percent', value: 95 })).body.error).toBe(
      'Percent discount can be at most 90%.'
    );
    const c = (
      await admin.post('/api/admin/coupons').set(XRW).send({ code: 'welcome200', type: 'flat', value: 200, minOrder: 1000 }).expect(201)
    ).body;
    expect(c.code).toBe('WELCOME200');
    expect((await admin.post('/api/admin/coupons').set(XRW).send({ code: 'WELCOME200', type: 'flat', value: 1 })).status).toBe(409);
    expect((await admin.patch(`/api/admin/coupons/${c._id}`).set(XRW).send({ active: false })).body.active).toBe(false);
    expect((await admin.patch('/api/admin/coupons/nope').set(XRW).send({ active: true })).status).toBe(404);
    await admin.delete(`/api/admin/coupons/${c._id}`).set(XRW).expect(200);
  });

  it('customers with order totals; blocking stops sign-in use', async () => {
    await codOrder();
    const list = (await admin.get('/api/admin/customers').expect(200)).body;
    const anaRow = list.items.find((u) => u.email === 'ana@example.com');
    expect(anaRow).toMatchObject({ orders: 1, spent: 1148 });
    const detail = (await admin.get(`/api/admin/customers/${anaRow._id}`)).body;
    expect(detail.orders).toHaveLength(1);
    await admin.patch(`/api/admin/customers/${anaRow._id}`).set(XRW).send({ isBlocked: true }).expect(200);
    expect((await ana.get('/api/cart')).body.code).toBe('BLOCKED');
    await admin.patch(`/api/admin/customers/${anaRow._id}`).set(XRW).send({ isBlocked: false }).expect(200);
  });

  it('sales summary, CSV export (formula-safe) and the audit trail', async () => {
    await Order.deleteMany({});
    const o = await codOrder();
    const s = (await admin.get('/api/admin/sales?range=7d').expect(200)).body;
    expect(s).toMatchObject({ orders: 1, revenue: 1148, cod: 1, online: 0, queue: { toPack: 1 } });
    expect(s.series).toHaveLength(7);
    expect(s.topProducts[0]).toMatchObject({ name: 'Kurti One', qty: 1 });
    await Order.updateOne({ _id: o._id }, { $set: { 'address.fullName': '=HYPERLINK("x")' } });
    const csv = await admin.get('/api/admin/orders/export.csv').expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain(o.orderNumber);
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
    await AuditLog.deleteMany({ action: 'order.pack' });
    await act(staff, o._id, 'pack');
    const log = (await admin.get('/api/admin/audit').expect(200)).body;
    expect(log.items.map((e) => e.action)).toEqual(expect.arrayContaining(['order.pack', 'product.create', 'auth.staff_sign_in']));
    expect(await AuditLog.countDocuments({ action: 'order.pack', actorEmail: 'staff@example.com' })).toBe(1);
  });

  it('shop rules are validated and admin only', async () => {
    expect((await staff.put('/api/admin/shop-settings').set(XRW).send({})).status).toBe(403);
    expect((await admin.put('/api/admin/shop-settings').set(XRW).send({ gstin: 'BAD' })).body.error).toBe(
      'GSTIN should look like 36ABCDE1234F1Z5.'
    );
    expect((await admin.put('/api/admin/shop-settings').set(XRW).send({ deliveryDaysMin: 5, deliveryDaysMax: 2 })).body.error).toBe(
      'Slowest delivery days must be at least the fastest.'
    );
    const saved = (await admin.put('/api/admin/shop-settings').set(XRW).send({ shippingFee: 79, gstin: '36ABCDE1234F1Z5' }).expect(200))
      .body;
    expect(saved).toMatchObject({ shippingFee: 79, gstin: '36ABCDE1234F1Z5' });
    expect((await request(ctx.app).get('/api/settings')).body.shop.shippingFee).toBe(79);
  });

  it('packing slip shows what to collect', async () => {
    const o = await codOrder();
    const slip = await staff.get(`/api/admin/orders/${o._id}/packing-slip`).expect(200);
    expect(slip.text).toContain('COLLECT CASH');
    expect(slip.text).toContain('K1-S');
  });
});

describe('server-to-server endpoints', () => {
  it('courier webhook needs the token and moves the order along', async () => {
    const o = await codOrder();
    await staff.post(`/api/admin/orders/${o._id}/ship`).set(XRW).send({ courier: 'Delhivery', awb: 'AWB777' });
    const send = (token, body) =>
      request(ctx.app)
        .post('/api/webhooks/courier')
        .set('x-api-key', token)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(body));
    expect((await send('wrong', {})).status).toBe(401);
    expect(
      (
        await send('test-courier-token', {
          awb: 'AWB777',
          current_status: 'OUT FOR DELIVERY',
          scans: [{ location: 'Hyderabad hub', activity: 'Out for delivery' }],
        })
      ).body
    ).toEqual({ status: 'out_for_delivery' });
    expect((await send('test-courier-token', { awb: 'AWB777', current_status: 'DELIVERED' })).body).toEqual({ status: 'delivered' });
    expect((await send('test-courier-token', { awb: 'NOPE', current_status: 'DELIVERED' })).body).toEqual({ ignored: 'unknown awb' });
  });

  it('jobs endpoint needs the cron secret', async () => {
    expect((await request(ctx.app).post('/api/internal/jobs')).status).toBe(401);
    const ok = await request(ctx.app).post('/api/internal/jobs').set('x-cron-secret', 'test-cron-secret-0123456789').expect(200);
    expect(ok.body.expired).toMatchObject({ checked: 0 });
  });

  it('PIN code check and sitemap', async () => {
    expect((await request(ctx.app).get('/api/shipping/serviceability?pincode=560001')).body).toMatchObject({
      serviceable: true,
      cod: true,
      etaDays: { min: 4, max: 7 },
    });
    expect((await request(ctx.app).get('/api/shipping/serviceability?pincode=012345')).body).toMatchObject({
      serviceable: false,
      message: 'Enter a valid 6-digit PIN code.',
    });
    const map = await request(ctx.app).get('/api/sitemap.xml').expect(200);
    expect(map.text).toContain('https://swechha.example/product/kurti-one');
    expect(map.text).toContain('/policies/returns');
  });
});
