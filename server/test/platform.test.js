import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';

let ctx;
let app;
let staff;
let customer;

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  customer = (await ctx.signIn('shopper@example.com', { role: 'customer' })).agent;
});
afterAll(() => ctx?.stop());

describe('GET /api/health', () => {
  it('reports ok with the database up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up', mode: 'test' });
    expect(typeof res.body.uptime).toBe('number');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 with db "down" when the database is disconnected', async () => {
    const { connectDb, disconnectDb } = await import('../src/db/mongoose.js');
    await disconnectDb();
    try {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.db).toBe('down');
    } finally {
      await connectDb(process.env.MONGO_URI);
    }
  });
});

describe('POST /api/upload-signature', () => {
  it('requires staff (401 guest, 403 customer)', async () => {
    expect((await request(app).post('/api/upload-signature').set(XRW)).status).toBe(401);
    expect((await customer.post('/api/upload-signature').set(XRW)).status).toBe(403);
  });

  it('→ 503 when Cloudinary keys are not configured', async () => {
    const res = await staff.post('/api/upload-signature').set(XRW);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe(
      'Photo upload is not set up. Add the CLOUDINARY_* keys to your environment, or paste an image link instead.'
    );
  });

  it('signs params the way Cloudinary expects', async () => {
    const { sign } = await import('../src/integrations/cloudinary.js');
    const expected = createHash('sha1').update('folder=f&timestamp=1secret').digest('hex');
    expect(sign({ timestamp: 1, folder: 'f' }, 'secret')).toBe(expected);
  });
});

describe('admin key removed', () => {
  it('/api/admin/verify no longer exists', async () => {
    expect((await request(app).get('/api/admin/verify')).status).toBe(404);
  });
});

describe('platform behaviour', () => {
  it('unknown API route → JSON 404 with the request id', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Unknown API route.');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses a sane incoming X-Request-Id', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'abc12345-from-proxy');
    expect(res.headers['x-request-id']).toBe('abc12345-from-proxy');
  });

  it('allows listed origins with credentials and ignores others', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'https://swechha.example');
    expect(ok.headers['access-control-allow-origin']).toBe('https://swechha.example');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
