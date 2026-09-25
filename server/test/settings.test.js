import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';

let ctx;
let app;
let admin;
let staff;

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  admin = (await ctx.signIn('owner@swechha.test', { role: 'admin' })).agent;
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
});
afterAll(() => ctx?.stop());
beforeEach(() => ctx.Setting.deleteMany({}));

const banner = { title: 'The Festive Edit', image: 'https://example.com/b.jpg', tag: 'NEW' };

describe('/api/settings', () => {
  it('GET returns the design defaults when nothing is saved, cached for 60s', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.collectionName).toBe("Spring/Summer '25 Bridal Edit");
    expect(res.body.whatsapp).toBe('9154246254');
    expect(res.body.banners).toHaveLength(1);
    expect(res.body).not.toHaveProperty('_id');
    expect(res.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=300');
  });

  it('PUT is admin only (403 staff)', async () => {
    expect(
      (
        await staff
          .put('/api/settings')
          .set(XRW)
          .send({ banners: [banner] })
      ).status
    ).toBe(403);
    const res = await request(app)
      .put('/api/settings')
      .set(XRW)
      .send({ banners: [banner] });
    expect(res.status).toBe(401);
  });

  it('PUT sanitises: WhatsApp digits only, @handle → Instagram URL, bad banners dropped', async () => {
    const res = await admin
      .put('/api/settings')
      .set(XRW)
      .send({
        collectionName: '  Winter Edit  ',
        whatsapp: '+91 98765-43210',
        instagram: '@swechha.collections',
        banners: [banner, { title: 'No image' }, { title: 'Insecure', image: 'http://x.com/a.jpg' }],
        extra: 'ignored',
      });
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({
      collectionName: 'Winter Edit',
      banners: [{ tag: 'NEW', title: 'The Festive Edit', subtitle: '', image: 'https://example.com/b.jpg', ctaLabel: '', ctaLink: '' }],
      whatsapp: '919876543210',
      email: '',
      locations: '',
      instagram: 'https://instagram.com/swechha.collections',
      defaultTaxRatePercent: 5,
    });

    const doc = await ctx.Setting.collection.findOne({ _id: 'site' });
    expect(doc.updatedAt).toBeInstanceOf(Date);
    expect(doc).not.toHaveProperty('__v');
    expect(doc).not.toHaveProperty('createdAt');

    const get = await request(app).get('/api/settings');
    expect(get.body.whatsapp).toBe('919876543210');
    expect(get.body).toHaveProperty('updatedAt');
  });

  it('keeps a full Instagram URL as is', async () => {
    const res = await admin
      .put('/api/settings')
      .set(XRW)
      .send({ banners: [banner], instagram: 'https://www.instagram.com/x' });
    expect(res.body.instagram).toBe('https://www.instagram.com/x');
  });

  it('needs at least one banner', async () => {
    const res = await admin
      .put('/api/settings')
      .set(XRW)
      .send({ banners: [{ title: 'No image' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Keep at least one banner with a title and an image.');
  });

  it('rejects a WhatsApp number without a country code', async () => {
    const res = await admin
      .put('/api/settings')
      .set(XRW)
      .send({ banners: [banner], whatsapp: '98765' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('WhatsApp number needs the country code, e.g. 919876543210.');
  });
});
