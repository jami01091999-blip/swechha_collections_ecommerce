import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp, validProduct } from './helpers.js';

let ctx;
let app;
const who = {};

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  who.customer = await ctx.signIn('shopper@example.com');
  who.staff = await ctx.signIn('staff@example.com', { role: 'staff' });
  who.admin = await ctx.signIn('owner@swechha.test'); // ADMIN_EMAILS → admin
});
afterAll(() => ctx?.stop());

const BANNERS = { banners: [{ title: 'T', image: 'https://example.com/a.jpg' }] };
let n = 0;

/** Each case returns a fresh request for an agent (or plain supertest for guests). */
const STAFF_ENDPOINTS = [
  ['GET /api/admin/products', (a) => a.get('/api/admin/products'), 200],
  ['GET /api/admin/stats', (a) => a.get('/api/admin/stats'), 200],
  [
    'POST /api/products',
    (a) =>
      a
        .post('/api/products')
        .set(XRW)
        .send(validProduct({ code: `R${++n}` })),
    201,
  ],
  ['PATCH /api/products/:id', async (a, p) => a.patch(`/api/products/${p._id}`).set(XRW).send({ price: 999 }), 200],
  ['POST /api/upload-signature', (a) => a.post('/api/upload-signature').set(XRW), 503], // 503 = allowed, Cloudinary not configured
];
const ADMIN_ENDPOINTS = [
  ['PUT /api/settings', (a) => a.put('/api/settings').set(XRW).send(BANNERS), 200],
  ['GET /api/admin/team', (a) => a.get('/api/admin/team'), 200],
  [
    'POST /api/admin/team',
    (a) =>
      a
        .post('/api/admin/team')
        .set(XRW)
        .send({ email: `new${++n}@example.com`, role: 'staff' }),
    201,
  ],
];

describe('role matrix', () => {
  let product;
  beforeAll(async () => {
    product = (
      await who.admin.agent
        .post('/api/products')
        .set(XRW)
        .send(validProduct({ code: 'MATRIX' }))
    ).body;
  });

  for (const [name, call, ok] of STAFF_ENDPOINTS) {
    it(`${name}: 401 guest, 403 customer, allowed for staff and admin`, async () => {
      expect((await call(request(app), product)).status).toBe(401);
      expect((await call(who.customer.agent, product)).status).toBe(403);
      expect((await call(who.staff.agent, product)).status).toBe(ok);
      expect((await call(who.admin.agent, product)).status).toBe(ok);
    });
  }

  it('DELETE /api/products/:id: 401 guest, 403 customer, 200 staff', async () => {
    const p = (
      await who.admin.agent
        .post('/api/products')
        .set(XRW)
        .send(validProduct({ code: 'DEL-ME' }))
    ).body;
    expect((await request(app).delete(`/api/products/${p._id}`).set(XRW)).status).toBe(401);
    expect((await who.customer.agent.delete(`/api/products/${p._id}`).set(XRW)).status).toBe(403);
    expect((await who.staff.agent.delete(`/api/products/${p._id}`).set(XRW)).status).toBe(200);
  });

  for (const [name, call, ok] of ADMIN_ENDPOINTS) {
    it(`${name}: 401 guest, 403 customer, 403 staff, allowed for admin`, async () => {
      expect((await call(request(app))).status).toBe(401);
      expect((await call(who.customer.agent)).status).toBe(403);
      expect((await call(who.staff.agent)).status).toBe(403);
      expect((await call(who.admin.agent)).status).toBe(ok);
    });
  }
});

describe('team', () => {
  const team = () => who.admin.agent.get('/api/admin/team');

  it('lists staff and admins only', async () => {
    const res = await team();
    const emails = res.body.team.map((m) => m.email);
    expect(emails).toEqual(expect.arrayContaining(['owner@swechha.test', 'staff@example.com']));
    expect(emails).not.toContain('shopper@example.com');
    expect(Object.keys(res.body.team[0]).sort()).toEqual(['_id', 'createdAt', 'email', 'lastLoginAt', 'name', 'phone', 'role']);
  });

  it('adds by email (creating the account) and validates role and email', async () => {
    const res = await who.admin.agent.post('/api/admin/team').set(XRW).send({ email: ' New.Helper@Example.com ', role: 'staff' });
    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ email: 'new.helper@example.com', role: 'staff' });
    const badRole = await who.admin.agent.post('/api/admin/team').set(XRW).send({ email: 'x@example.com', role: 'owner' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error).toBe('Choose a role: staff or admin.');
    const badEmail = await who.admin.agent.post('/api/admin/team').set(XRW).send({ email: 'nope', role: 'staff' });
    expect(badEmail.body.error).toBe('Enter a valid email address.');
  });

  it('change role applies on the next request', async () => {
    const helper = await ctx.signIn('helper2@example.com');
    const added = (await who.admin.agent.post('/api/admin/team').set(XRW).send({ email: 'helper2@example.com', role: 'staff' })).body
      .member;
    expect((await helper.agent.get('/api/admin/team')).status).toBe(403);
    await who.admin.agent.patch(`/api/admin/team/${added._id}`).set(XRW).send({ role: 'admin' }).expect(200);
    expect((await helper.agent.get('/api/admin/team')).status).toBe(200);
    await who.admin.agent.delete(`/api/admin/team/${added._id}`).set(XRW).expect(200);
    expect((await helper.agent.get('/api/admin/products')).status).toBe(403);
  });

  it('cannot remove or re-role yourself', async () => {
    const me = who.admin.user;
    const self = await who.admin.agent.delete(`/api/admin/team/${me._id}`).set(XRW);
    expect(self.status).toBe(400);
    expect(self.body.error).toBe("You can't remove yourself.");
    const selfRole = await who.admin.agent.patch(`/api/admin/team/${me._id}`).set(XRW).send({ role: 'staff' });
    expect(selfRole.status).toBe(400);
    expect(selfRole.body.error).toBe("You can't change your own role.");
  });

  it('keeps at least one admin (service guard)', async () => {
    const team = await import('../src/services/teamService.js');
    await ctx.User.updateMany({ role: 'admin', email: { $ne: 'owner@swechha.test' } }, { $set: { role: 'staff' } });
    const owner = await ctx.User.findOne({ email: 'owner@swechha.test' }).lean();
    const someoneElse = { _id: '000000000000000000000001' };
    await expect(team.removeMember(someoneElse, String(owner._id))).rejects.toThrow('Keep at least one admin.');
    await expect(team.changeRole(someoneElse, String(owner._id), 'staff')).rejects.toThrow('Keep at least one admin.');
    expect((await ctx.User.findById(owner._id).lean()).role).toBe('admin');
  });

  it('removing an unknown or non-team user → 404', async () => {
    const res = await who.admin.agent.delete(`/api/admin/team/${who.customer.user._id}`).set(XRW);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Team member not found.');
  });
});
