import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp, validProduct } from './helpers.js';

let ctx;
let ana;
let ben;
let staff;
const ids = {};

beforeAll(async () => {
  ctx = await startTestApp();
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  ana = await ctx.signIn('ana@example.com');
  ben = await ctx.signIn('ben@example.com');
  await ctx.Product.deleteMany({});
  for (const [key, name] of [
    ['a', 'Alpha Saree'],
    ['b', 'Beta Frock'],
    ['c', 'Gamma Top'],
  ]) {
    ids[key] = (
      await staff
        .post('/api/products')
        .set(XRW)
        .send(validProduct({ code: key.toUpperCase(), name }))
    ).body._id;
  }
});
afterAll(() => ctx?.stop());

let Wishlist;
beforeEach(async () => {
  Wishlist ??= (await import('../src/models/Wishlist.js')).Wishlist;
  await Wishlist.deleteMany({});
  await ctx.Product.collection.updateMany({}, { $set: { status: 'published' } });
});

const add = (who, productId) => who.agent.post('/api/wishlist/items').set(XRW).send({ productId });
const listOf = async (who) => (await who.agent.get('/api/wishlist')).body;

describe('wishlist', () => {
  it('requires sign-in', async () => {
    expect((await request(ctx.app).get('/api/wishlist')).status).toBe(401);
    expect((await request(ctx.app).post('/api/wishlist/items').set(XRW).send({ productId: ids.a })).status).toBe(401);
  });

  it('add is idempotent; newest first; card projection', async () => {
    await add(ana, ids.a).expect(200);
    await new Promise((r) => setTimeout(r, 5));
    await add(ana, ids.b).expect(200);
    const again = await add(ana, ids.a);
    expect(again.body.count).toBe(2);
    expect(again.body.items.map((i) => i.name)).toEqual(['Beta Frock', 'Alpha Saree']);
    expect(again.body.items[0]).not.toHaveProperty('description');
    expect(again.body.items[0]).toHaveProperty('addedAt');
  });

  it('remove is idempotent', async () => {
    await add(ana, ids.a);
    const first = await ana.agent.delete(`/api/wishlist/items/${ids.a}`).set(XRW);
    expect(first.body.count).toBe(0);
    expect((await ana.agent.delete(`/api/wishlist/items/${ids.a}`).set(XRW)).status).toBe(200);
  });

  it('validates ids and existence', async () => {
    expect((await add(ana, 'nope')).status).toBe(400);
    expect((await add(ana, '64b000000000000000000099')).status).toBe(404);
    expect((await ana.agent.delete('/api/wishlist/items/nope').set(XRW)).status).toBe(400);
  });

  it('unpublished and deleted products are flagged unavailable', async () => {
    await add(ana, ids.a);
    await add(ana, ids.b);
    await ctx.Product.collection.updateOne({ code: 'A' }, { $set: { status: 'draft' } });
    const list = await listOf(ana);
    const alpha = list.items.find((i) => i._id === ids.a);
    expect(alpha).toMatchObject({ name: 'Alpha Saree', unavailable: true });
    expect(list.items.find((i) => i._id === ids.b).unavailable).toBeUndefined();
    // Can't add an unpublished product.
    expect((await add(ben, ids.a)).status).toBe(404);
  });

  it('merge adds guest slugs once, skips unknown ones, keeps order', async () => {
    await add(ana, ids.c);
    const res = await ana.agent
      .post('/api/wishlist/merge')
      .set(XRW)
      .send({ slugs: ['beta-frock', 'alpha-saree', 'beta-frock', 'no-such-thing', 'gamma-top'] });
    expect(res.body.items.map((i) => i.name)).toEqual(['Beta Frock', 'Alpha Saree', 'Gamma Top']);
    const again = await ana.agent
      .post('/api/wishlist/merge')
      .set(XRW)
      .send({ slugs: ['beta-frock'] });
    expect(again.body.count).toBe(3);
    expect((await ana.agent.post('/api/wishlist/merge').set(XRW).send({ slugs: 'nope' })).body.count).toBe(3);
  });

  it('caps at 200 items', async () => {
    const fake = Array.from({ length: 200 }, (_, i) => ({
      productId: `64b0000000000000000${String(i).padStart(5, '0')}`,
      addedAt: new Date(2020, 0, 1, 0, 0, i),
    }));
    await Wishlist.create({ userId: ana.user._id, items: fake });
    const full = await add(ana, ids.a);
    expect(full.status).toBe(400);
    expect(full.body.error).toBe('You can save up to 200 designs.');
    const merged = await ana.agent
      .post('/api/wishlist/merge')
      .set(XRW)
      .send({ slugs: ['alpha-saree'] });
    expect(merged.body.count).toBe(200);
    expect(merged.body.items[0].name).toBe('Alpha Saree'); // newest kept, oldest dropped
  });

  it('each user only ever sees their own list', async () => {
    await add(ana, ids.a);
    expect((await listOf(ben)).items).toEqual([]);
    await ben.agent.delete(`/api/wishlist/items/${ids.a}`).set(XRW);
    expect((await listOf(ana)).count).toBe(1);
  });
});
