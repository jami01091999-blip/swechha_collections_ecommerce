import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';

let ctx;
let ana;
let ben;

beforeAll(async () => {
  ctx = await startTestApp();
});
afterAll(() => ctx?.stop());
beforeEach(async () => {
  await Promise.all([ctx.User.deleteMany({}), ctx.OtpCode.deleteMany({}), ctx.Session.deleteMany({})]);
  ana = await ctx.signIn('ana@example.com');
  ben = await ctx.signIn('ben@example.com');
});

const HOME = {
  fullName: 'Ana Rao',
  phone: '+91 98765 43210',
  line1: '12 Road No 3',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500034',
  type: 'home',
};
const add = (who, body) => who.agent.post('/api/users/me/addresses').set(XRW).send(body);

describe('PATCH /api/users/me', () => {
  it('updates name and phone, never email', async () => {
    const res = await ana.agent
      .patch('/api/users/me')
      .set(XRW)
      .send({ name: '  Ana   Rao ', phone: '09876543210', email: 'x@y.com', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Ana Rao', phone: '9876543210', email: 'ana@example.com', role: 'customer' });
  });

  it('validates the phone and name length', async () => {
    const res = await ana.agent
      .patch('/api/users/me')
      .set(XRW)
      .send({ phone: '12345', name: 'x'.repeat(61) });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({ name: 'Name can be up to 60 characters.', phone: 'Enter a 10-digit mobile number.' });
  });

  it('requires sign-in', async () => {
    expect((await request(ctx.app).patch('/api/users/me').set(XRW).send({ name: 'x' })).status).toBe(401);
    expect((await request(ctx.app).get('/api/users/me/addresses')).status).toBe(401);
  });
});

describe('addresses', () => {
  it('validation messages for every field', async () => {
    const res = await add(ana, { state: 'Atlantis', pincode: '012345', phone: '5555555555' });
    expect(res.status).toBe(400);
    expect(res.body.fields).toEqual({
      fullName: 'Enter the full name.',
      phone: 'Enter a 10-digit mobile number.',
      line1: 'Enter the house number and street.',
      city: 'Enter the city.',
      state: 'Choose a state.',
      pincode: 'Enter a 6-digit PIN code.',
    });
    expect(res.body.error).toContain('Enter the full name.');
  });

  it('first address becomes the default; list puts the default first', async () => {
    const first = await add(ana, HOME);
    expect(first.status).toBe(201);
    expect(first.body.address).toMatchObject({ fullName: 'Ana Rao', phone: '9876543210', isDefault: true, line2: '', landmark: '' });
    await add(ana, { ...HOME, line1: 'Office, Hitech City', type: 'work' });
    const list = (await ana.agent.get('/api/users/me/addresses')).body.addresses;
    expect(list).toHaveLength(2);
    expect(list[0].isDefault).toBe(true);
    expect(list[0].line1).toBe('12 Road No 3');
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('adding with isDefault moves the default; make-default endpoint too', async () => {
    await add(ana, HOME);
    const second = await add(ana, { ...HOME, line1: 'Second', isDefault: true });
    expect(second.body.addresses.filter((a) => a.isDefault).map((a) => a.line1)).toEqual(['Second']);
    const firstId = second.body.addresses.find((a) => a.line1 === '12 Road No 3')._id;
    const res = await ana.agent.post(`/api/users/me/addresses/${firstId}/default`).set(XRW);
    expect(res.body.addresses[0]).toMatchObject({ _id: firstId, isDefault: true });
    expect(res.body.addresses.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it('PATCH is partial and re-validates', async () => {
    const { address } = (await add(ana, HOME)).body;
    const ok = await ana.agent.patch(`/api/users/me/addresses/${address._id}`).set(XRW).send({ landmark: 'Near the park' });
    expect(ok.body.address).toMatchObject({ landmark: 'Near the park', city: 'Hyderabad' });
    const bad = await ana.agent.patch(`/api/users/me/addresses/${address._id}`).set(XRW).send({ pincode: '12' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual({ pincode: 'Enter a 6-digit PIN code.' });
    const off = await ana.agent.patch(`/api/users/me/addresses/${address._id}`).set(XRW).send({ isDefault: false });
    expect(off.body.address.isDefault).toBe(true); // there must always be one default
  });

  it('deleting the default promotes the most recent remaining address', async () => {
    const a = (await add(ana, { ...HOME, line1: 'A' })).body.address;
    await add(ana, { ...HOME, line1: 'B' });
    await new Promise((r) => setTimeout(r, 5));
    await add(ana, { ...HOME, line1: 'C' });
    const res = await ana.agent.delete(`/api/users/me/addresses/${a._id}`).set(XRW);
    expect(res.status).toBe(200);
    expect(res.body.addresses).toHaveLength(2);
    expect(res.body.addresses[0]).toMatchObject({ line1: 'C', isDefault: true });
  });

  it('max 10 addresses', async () => {
    for (let i = 0; i < 10; i++) await add(ana, { ...HOME, line1: `Flat ${i}` }).expect(201);
    const res = await add(ana, HOME);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You can save up to 10 addresses.');
  });

  it("cannot read or change another user's address (404)", async () => {
    const { address } = (await add(ana, HOME)).body;
    expect((await ben.agent.patch(`/api/users/me/addresses/${address._id}`).set(XRW).send({ city: 'X' })).status).toBe(404);
    expect((await ben.agent.delete(`/api/users/me/addresses/${address._id}`).set(XRW)).status).toBe(404);
    expect((await ben.agent.post(`/api/users/me/addresses/${address._id}/default`).set(XRW)).status).toBe(404);
    expect((await ben.agent.get('/api/users/me/addresses')).body.addresses).toEqual([]);
    expect((await ana.agent.delete('/api/users/me/addresses/not-an-id').set(XRW)).status).toBe(404);
  });
});
