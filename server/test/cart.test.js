import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';
import { sizedProduct } from './commerceHelpers.js';

let ctx;
let staff;
let ana;
let ids;

beforeAll(async () => {
  ctx = await startTestApp();
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  ana = (await ctx.signIn('ana@example.com')).agent;
  const make = async (o) => (await staff.post('/api/products').set(XRW).send(sizedProduct(o))).body._id;
  ids = {
    kurti: await make({ code: 'K1', name: 'Kurti One', category: 'Kurti', price: 1000, mrp: 1500, maxQtyPerOrder: 3 }),
    saree: await make({ code: 'S1', name: 'Saree One', price: 5000, mrp: 5000, sizeType: 'free', sizes: [{ label: 'FREE', stock: 2 }] }),
    draft: await make({ code: 'D1', name: 'Draft One', status: 'draft' }),
  };
});
afterAll(() => ctx?.stop());

let Cart;
beforeEach(async () => {
  Cart ??= (await import('../src/models/Cart.js')).Cart;
  await Cart.deleteMany({});
});

const add = (body) => ana.post('/api/cart/items').set(XRW).send(body);

describe('bag (signed in)', () => {
  it('needs sign-in', async () => {
    const res = await request(ctx.app).post('/api/cart/items').set(XRW).send({ productId: ids.kurti, size: 'S', qty: 1 });
    expect(res.status).toBe(401);
  });

  it('adds, merges the same size, prices from the database', async () => {
    await add({ productId: ids.kurti, size: 'S', qty: 1, price: 1 }).expect(200);
    const res = await add({ productId: ids.kurti, size: 's', qty: 1 }).expect(200);
    expect(res.body.items).toHaveLength(1);
    const [line] = res.body.items;
    expect(line).toMatchObject({ qty: 2, price: 1000, mrp: 1500, lineTotal: 2000, status: 'ok', sizeLabel: 'S', sku: 'K1-S' });
    expect(res.body.summary).toMatchObject({ itemCount: 2, subtotal: 2000, mrpTotal: 3000, savings: 1000 });
  });

  it('refuses more than is available or allowed per order, and unknown sizes', async () => {
    expect((await add({ productId: ids.kurti, size: 'M', qty: 2 })).body.error).toBe('Only 1 left in M.');
    expect((await add({ productId: ids.kurti, size: 'XL', qty: 1 })).body).toMatchObject({
      error: 'Choose a size.',
      code: 'SIZE_REQUIRED',
    });
    expect((await add({ productId: ids.draft, size: 'S', qty: 1 })).status).toBe(404);
    expect((await add({ productId: ids.kurti, size: 'S', qty: 0 })).body.error).toBe('Quantity must be at least 1.');
    await staff
      .patch(`/api/admin/products/${ids.kurti}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'S', stock: 9 }] })
      .expect(200);
    expect((await add({ productId: ids.kurti, size: 'S', qty: 4 })).body.error).toBe('You can buy up to 3 of this design per order.');
    await staff
      .patch(`/api/admin/products/${ids.kurti}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'S', stock: 3 }] })
      .expect(200);
  });

  it('changes quantity and size (merging into an existing line), removes and clears', async () => {
    await add({ productId: ids.kurti, size: 'S', qty: 1 });
    const two = (await add({ productId: ids.kurti, size: 'M', qty: 1 })).body;
    const mLine = two.items.find((l) => l.size === 'M');
    const merged = (await ana.patch(`/api/cart/items/${mLine._id}`).set(XRW).send({ size: 'S' }).expect(200)).body;
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].qty).toBe(2);
    const id = merged.items[0]._id;
    expect((await ana.patch(`/api/cart/items/${id}`).set(XRW).send({ qty: 3 })).body.items[0].qty).toBe(3);
    expect((await ana.patch(`/api/cart/items/${id}`).set(XRW).send({})).status).toBe(400);
    expect((await ana.delete(`/api/cart/items/${id}`).set(XRW).expect(200)).body.items).toHaveLength(0);
    await add({ productId: ids.saree, size: 'FREE', qty: 1 });
    expect((await ana.delete('/api/cart').set(XRW).expect(200)).body.items).toHaveLength(0);
  });

  it('shows sold-out and unavailable lines instead of dropping them', async () => {
    await add({ productId: ids.saree, size: 'FREE', qty: 2 });
    await staff
      .patch(`/api/admin/products/${ids.saree}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'FREE', stock: 1 }] });
    let bag = (await ana.get('/api/cart')).body;
    expect(bag.items[0]).toMatchObject({ status: 'qty_reduced', buyQty: 1, message: 'Only 1 left', sizeLabel: 'Free Size' });
    await staff
      .patch(`/api/admin/products/${ids.saree}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'FREE', stock: 0 }] });
    bag = (await ana.get('/api/cart')).body;
    expect(bag.items[0]).toMatchObject({ status: 'out_of_stock', buyQty: 0 });
    expect(bag.summary.subtotal).toBe(0);
    await staff
      .patch(`/api/admin/products/${ids.saree}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'FREE', stock: 2 }] });
  });

  it('merges the device bag at sign-in, trimming to stock and skipping what can’t be bought', async () => {
    await add({ productId: ids.kurti, size: 'S', qty: 1 });
    const res = await ana
      .post('/api/cart/merge')
      .set(XRW)
      .send({
        items: [
          { productId: ids.kurti, size: 'S', qty: 5 },
          { productId: ids.kurti, size: 'M', qty: 1 },
          { productId: ids.draft, size: 'S', qty: 1 },
          { productId: 'nope', size: 'S', qty: 1 },
        ],
      })
      .expect(200);
    const bySize = Object.fromEntries(res.body.items.map((l) => [l.size, l.qty]));
    expect(bySize).toEqual({ S: 3, M: 1 });
    expect(res.body.merged).toBe(2);
  });
});

describe('guest bag preview', () => {
  it('prices device lines without an account', async () => {
    const res = await request(ctx.app)
      .post('/api/cart/preview')
      .set(XRW)
      .send({
        items: [
          { key: 'a', productId: ids.kurti, size: 'S', qty: 1 },
          { key: 'b', productId: '0123456789abcdef01234567', size: 'S', qty: 1 },
        ],
      })
      .expect(200);
    expect(res.body.items[0]).toMatchObject({ _id: 'a', price: 1000, status: 'ok' });
    expect(res.body.items[1]).toMatchObject({ _id: 'b', status: 'unavailable' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
