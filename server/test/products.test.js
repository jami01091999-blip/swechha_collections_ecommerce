import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ADMIN, PHOTO, startTestApp, validProduct } from './helpers.js';

let ctx;
let app;

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
});
afterAll(() => ctx?.stop());
beforeEach(() => ctx.Product.deleteMany({}));

const create = (body) => request(app).post('/api/products').set(ADMIN).send(body);

describe('GET /api/products', () => {
  it('returns published products only, as a plain array, with public cache headers', async () => {
    await create(validProduct({ code: 'A1', name: 'Live one' }));
    await create(validProduct({ code: 'A2', name: 'Hidden one', status: 'draft', images: [] }));
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((p) => p.name)).toEqual(['Live one']);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
  });

  it('sorts by displayOrder, then newest first', async () => {
    await create(validProduct({ code: 'S1', name: 'First', displayOrder: 5 }));
    await create(validProduct({ code: 'S2', name: 'Second' }));
    await create(validProduct({ code: 'S3', name: 'Third' }));
    const res = await request(app).get('/api/products');
    expect(res.body.map((p) => p.name)).toEqual(['Third', 'Second', 'First']);
  });

  it('?all=1 without the admin key → 401', async () => {
    const res = await request(app).get('/api/products?all=1');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Admin key is missing or incorrect.');
  });

  it('?all=1 with a wrong key → 401', async () => {
    const res = await request(app).get('/api/products?all=1').set('x-admin-key', 'nope');
    expect(res.status).toBe(401);
  });

  it('?all=1 with the key includes drafts and is not cached', async () => {
    await create(validProduct({ code: 'B1' }));
    await create(validProduct({ code: 'B2', status: 'draft', images: [] }));
    const res = await request(app).get('/api/products?all=1').set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/products', () => {
  it('requires the admin key', async () => {
    const res = await request(app).post('/api/products').send(validProduct());
    expect(res.status).toBe(401);
    expect(await ctx.Product.countDocuments()).toBe(0);
  });

  it('lists every missing required field in one message', async () => {
    const res = await create({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      'Product name is required. Product code is required. Category is required. Fabric line is required. Selling price must be more than 0.'
    );
  });

  it('rejects MRP below the selling price', async () => {
    const res = await create(validProduct({ mrp: 100 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MRP cannot be lower than the selling price.');
  });

  it('rejects a sized product with no sizes', async () => {
    const res = await create(validProduct({ sizeType: 'sized', sizes: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Add at least one size, or switch to Free Size.');
  });

  it('rejects publishing without a photo → 400', async () => {
    const res = await create(validProduct({ images: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Add at least one photo before publishing.');
  });

  it('creates with defaults, sanitised fields and the same document shape as before', async () => {
    const res = await create(
      validProduct({
        code: ' sc-2025-001 ',
        images: [PHOTO, { url: 'http://insecure.example/x.jpg' }],
        sizes: [
          { label: 'm', stock: '3' },
          { label: 'M', stock: 9 },
        ],
        colors: [{ name: 'Ruby', hex: 'not-a-hex' }],
        isFeatured: 'true',
        hacker: 'ignored',
      })
    );
    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    const p = res.body;
    expect(p._id).toMatch(/^[a-f0-9]{24}$/);
    expect(p.slug).toBe('gulmohar-silk-saree');
    expect(p.code).toBe('SC-2025-001');
    expect(p.images).toEqual([PHOTO]);
    expect(p.sizes).toEqual([{ label: 'M', stock: 3 }]);
    expect(p.colors).toEqual([{ name: 'Ruby', hex: '#6b1d2f', productSlug: '' }]);
    expect(p.isFeatured).toBe(true);
    expect(p.lowStockThreshold).toBe(2);
    expect(p.sareeDetails).toEqual({ sareeLength: '', blousePiece: '', blouseLength: '', blouseFabric: '' });
    expect(p).not.toHaveProperty('hacker');
    expect(p).not.toHaveProperty('__v');
    expect(p.createdAt).toBe(p.updatedAt);

    // Stored document: no Mongoose extras such as __v or subdocument _ids.
    const raw = await ctx.Product.collection.findOne({ _id: ctx.Product.castObject({ _id: p._id })._id });
    expect(raw).not.toHaveProperty('__v');
    expect(Object.keys(raw.images[0]).sort()).toEqual(['publicId', 'url']);
  });

  it('duplicate product code → 409', async () => {
    await create(validProduct({ code: 'DUP-1', name: 'One' }));
    const res = await create(validProduct({ code: 'dup-1', name: 'Two' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Another product already uses this product code.');
  });

  it('same name → unique slug with -2, -3 suffixes', async () => {
    const slugs = [];
    for (const code of ['N1', 'N2', 'N3']) slugs.push((await create(validProduct({ code, name: 'Noor Kurta Set' }))).body.slug);
    expect(slugs).toEqual(['noor-kurta-set', 'noor-kurta-set-2', 'noor-kurta-set-3']);
  });

  it('rejects a body that is not valid JSON', async () => {
    const res = await request(app).post('/api/products').set(ADMIN).set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request body is not valid JSON.');
  });
});

describe('/api/products/:idOrSlug', () => {
  it('public can read a published product by slug, with cache headers', async () => {
    const { body } = await create(validProduct());
    const res = await request(app).get(`/api/products/${body.slug}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(body._id);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
  });

  it('admin can read a draft; public gets 404', async () => {
    const { body } = await create(validProduct({ status: 'draft', images: [] }));
    const admin = await request(app).get(`/api/products/${body._id}`).set(ADMIN);
    expect(admin.status).toBe(200);
    expect(admin.headers['cache-control']).toBe('no-store');
    for (const id of [body._id, body.slug]) {
      const pub = await request(app).get(`/api/products/${id}`);
      expect(pub.status).toBe(404);
      expect(pub.body.error).toBe('Product not found.');
    }
    const wrongKey = await request(app).get(`/api/products/${body._id}`).set('x-admin-key', 'nope');
    expect(wrongKey.status).toBe(404);
  });

  it('unknown id or slug → 404', async () => {
    expect((await request(app).get('/api/products/aaaaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
    expect((await request(app).get('/api/products/no-such-thing')).status).toBe(404);
  });

  it('PATCH is partial and keeps defaults (lowStockThreshold stays 2)', async () => {
    const { body } = await create(validProduct({ description: 'Keep me' }));
    await new Promise((r) => setTimeout(r, 5));
    const res = await request(app).patch(`/api/products/${body._id}`).set(ADMIN).send({ price: 15000 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(15000);
    expect(res.body.lowStockThreshold).toBe(2);
    expect(res.body.description).toBe('Keep me');
    expect(res.body.slug).toBe(body.slug);
    expect(res.body.createdAt).toBe(body.createdAt);
    expect(new Date(res.body.updatedAt) > new Date(body.updatedAt)).toBe(true);
  });

  it('PUT behaves like PATCH', async () => {
    const { body } = await create(validProduct());
    const res = await request(app).put(`/api/products/${body.slug}`).set(ADMIN).send({ isNewArrival: true });
    expect(res.status).toBe(200);
    expect(res.body.isNewArrival).toBe(true);
  });

  it('PATCH validates the merged product', async () => {
    const { body } = await create(validProduct());
    const res = await request(app).patch(`/api/products/${body._id}`).set(ADMIN).send({ images: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Add at least one photo before publishing.');
  });

  it('PATCH to another product’s code → 409', async () => {
    await create(validProduct({ code: 'C1', name: 'One' }));
    const { body } = await create(validProduct({ code: 'C2', name: 'Two' }));
    const res = await request(app).patch(`/api/products/${body._id}`).set(ADMIN).send({ code: 'c1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Another product already uses this product code.');
  });

  it('writes require the admin key', async () => {
    const { body } = await create(validProduct());
    expect((await request(app).patch(`/api/products/${body._id}`).send({ price: 1 })).status).toBe(401);
    expect((await request(app).delete(`/api/products/${body._id}`)).status).toBe(401);
  });

  it('delete, then 404', async () => {
    const { body } = await create(validProduct());
    const del = await request(app).delete(`/api/products/${body._id}`).set(ADMIN);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ deleted: true });
    expect((await request(app).get(`/api/products/${body._id}`).set(ADMIN)).status).toBe(404);
    expect((await request(app).delete(`/api/products/${body._id}`).set(ADMIN)).status).toBe(404);
  });

  it('unsupported method → 405 with Allow header', async () => {
    const res = await request(app).delete('/api/products').set(ADMIN);
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET, POST');
    expect(res.body.error).toBe('Method DELETE not allowed.');
  });
});
