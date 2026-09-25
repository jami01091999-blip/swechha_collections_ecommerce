import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { XRW, startTestApp } from './helpers.js';
import { shapeProduct } from '../src/services/productShape.js';
import { commerceDefaults } from '../src/validators/product.js';

let ctx;
let app;
let staff;
let customer;

const img = (n) => [{ url: `https://res.cloudinary.com/demo/image/upload/${n}.jpg`, publicId: n }];
const day = (n) => new Date(Date.UTC(2025, 0, n));

// P3's L size is fully reserved, so L is not available even though stock is 5.
const FIXTURES = [
  {
    code: 'P1',
    name: 'Gulmohar Silk Saree',
    category: 'Sarees',
    fabric: 'Pure Tussar Silk with Zari',
    price: 14500,
    mrp: 24000,
    sizeType: 'free',
    sizes: [{ label: 'FREE', stock: 4 }],
    isNewArrival: true,
    colors: [{ name: 'Vermilion Crimson', hex: '#8b1e2a' }],
    images: img('p1', 3),
    createdAt: day(1),
  },
  {
    code: 'P2',
    name: 'Kanjivaram Silk Saree',
    category: 'Sarees',
    fabric: 'Pure Silk',
    price: 22000,
    mrp: 25000,
    sizeType: 'free',
    sizes: [{ label: 'FREE', stock: 0 }],
    isFeatured: true,
    images: img('p2'),
    createdAt: day(2),
  },
  {
    code: 'P3',
    name: 'Noor Night Dress',
    category: 'Night dresses',
    fabric: 'Soft Cotton',
    price: 1800,
    mrp: 2400,
    sizeType: 'sized',
    sizes: [
      { label: 'S', stock: 2 },
      { label: 'M', stock: 0 },
      { label: 'L', stock: 5, reserved: 5 },
    ],
    images: img('p3'),
    createdAt: day(3),
  },
  {
    code: 'P4',
    name: 'Cotton Frock',
    category: 'Frocks',
    fabric: 'Cotton',
    price: 900,
    mrp: 0,
    sizeType: 'sized',
    sizes: [
      { label: 'M', stock: 3 },
      { label: 'XL', stock: 1 },
    ],
    isNewArrival: true,
    images: img('p4'),
    createdAt: day(4),
  },
  {
    code: 'P5',
    name: 'Draft Lehenga',
    category: 'Lehengas',
    fabric: 'Raw Silk',
    price: 30000,
    mrp: 0,
    sizeType: 'sized',
    sizes: [{ label: 'M', stock: 3 }],
    status: 'draft',
    images: [],
    createdAt: day(5),
  },
  {
    code: 'P6',
    name: 'Bamboo Night Dress',
    category: 'Night dresses',
    fabric: 'Bamboo',
    price: 6000,
    mrp: 12000,
    sizeType: 'sized',
    sizes: [{ label: 'XL', stock: 2 }],
    description: 'A very long story '.repeat(40),
    images: img('p6'),
    createdAt: day(6),
  },
];

beforeAll(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  customer = (await ctx.signIn('shopper@example.com')).agent;
  await ctx.Product.deleteMany({});
  const docs = FIXTURES.map((f) => {
    const doc = {
      ...commerceDefaults(f.category),
      status: 'published',
      displayOrder: 0,
      badge: '',
      colors: [],
      lowStockThreshold: 2,
      isNewArrival: false,
      isFeatured: false,
      description: '',
      ...f,
      slug: f.name.toLowerCase().replace(/\s+/g, '-'),
      updatedAt: f.createdAt,
    };
    // Keep the fixture's reserved values (a checkout would set these).
    const shaped = shapeProduct(doc, f.sizes);
    return { ...doc, ...shaped };
  });
  await ctx.Product.collection.insertMany(docs);
  await ctx.Product.syncIndexes();
});
afterAll(() => ctx?.stop());

const list = (qs = '') => request(app).get(`/api/products${qs}`);
const names = (res) => res.body.items.map((p) => p.name);

describe('GET /api/products', () => {
  it('published only, recommended order, card projection only', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, s-maxage=30, stale-while-revalidate=300');
    expect(names(res)).toEqual(['Bamboo Night Dress', 'Cotton Frock', 'Noor Night Dress', 'Kanjivaram Silk Saree', 'Gulmohar Silk Saree']);
    expect(res.body).toMatchObject({ page: 1, limit: 24, total: 5, totalPages: 1 });
    const card = res.body.items.find((p) => p.name === 'Gulmohar Silk Saree');
    expect(Object.keys(card).sort()).toEqual(
      [
        '_id',
        'availableSizes',
        'badge',
        'category',
        'discountPercent',
        'fabric',
        'images',
        'inStock',
        'isFeatured',
        'isNewArrival',
        'mrp',
        'name',
        'price',
        'slug',
      ].sort()
    );
    expect(card.images).toHaveLength(1);
    expect(JSON.stringify(res.body.items)).not.toContain('A very long story');
  });

  it('filters: category, price range, sizes, in stock, new/featured, min discount', async () => {
    expect(names(await list('?category=Sarees'))).toEqual(['Kanjivaram Silk Saree', 'Gulmohar Silk Saree']);
    expect(names(await list('?minPrice=1000&maxPrice=15000&sort=price_asc'))).toEqual([
      'Noor Night Dress',
      'Bamboo Night Dress',
      'Gulmohar Silk Saree',
    ]);
    expect(names(await list('?sizes=xl'))).toEqual(['Bamboo Night Dress', 'Cotton Frock']);
    expect(names(await list('?sizes=L'))).toEqual([]); // L is fully reserved
    expect(names(await list('?sizes=S,FREE'))).toEqual(['Noor Night Dress', 'Gulmohar Silk Saree']);
    expect(names(await list('?inStock=1'))).not.toContain('Kanjivaram Silk Saree');
    expect(names(await list('?filter=new'))).toEqual(['Cotton Frock', 'Gulmohar Silk Saree']);
    expect(names(await list('?filter=featured'))).toEqual(['Kanjivaram Silk Saree']);
    expect(names(await list('?minDiscount=30&sort=discount'))).toEqual(['Bamboo Night Dress', 'Gulmohar Silk Saree']);
  });

  it('sorts', async () => {
    expect(names(await list('?sort=price_asc'))[0]).toBe('Cotton Frock');
    expect(names(await list('?sort=price_desc'))[0]).toBe('Kanjivaram Silk Saree');
    expect(names(await list('?sort=discount'))[0]).toBe('Bamboo Night Dress');
    expect(names(await list('?sort=newest'))).toEqual([
      'Bamboo Night Dress',
      'Cotton Frock',
      'Noor Night Dress',
      'Kanjivaram Silk Saree',
      'Gulmohar Silk Saree',
    ]);
    expect(names(await list('?sort=nonsense'))).toEqual(names(await list())); // bad value → default
  });

  it('pagination bounds and clamping; unknown params ignored', async () => {
    const p2 = await list('?limit=2&page=2');
    expect(p2.body).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(names(p2)).toEqual(['Noor Night Dress', 'Kanjivaram Silk Saree']);
    expect((await list('?limit=500')).body.limit).toBe(48);
    expect((await list('?limit=abc')).body.limit).toBe(24);
    expect((await list('?page=-3')).body.page).toBe(1);
    expect((await list('?limit=48')).body.limit).toBe(48);
    expect((await list('?page=0')).body.page).toBe(1);
    expect((await list('?page=99')).body.items).toEqual([]);
    expect((await list('?hack[$ne]=1&status=draft')).body.total).toBe(5);
  });

  it('facets count each group without its own filter', async () => {
    const res = await list('?category=Sarees');
    const { facets } = res.body;
    // Categories ignore the category filter, so other categories still show counts.
    expect(facets.categories).toEqual(
      expect.arrayContaining([
        { key: 'Sarees', count: 2 },
        { key: 'Night dresses', count: 2 },
        { key: 'Frocks', count: 1 },
      ])
    );
    // Sizes and prices respect the category filter.
    expect(facets.sizes).toEqual([{ label: 'FREE', count: 1 }]);
    const byKey = Object.fromEntries(facets.prices.map((p) => [p.key, p.count]));
    expect(byKey).toEqual({ 'under-5000': 0, '5000-10000': 0, '10000-20000': 1, '20000-plus': 1 });
    const priced = (await list('?maxPrice=4999')).body.facets.prices;
    expect(priced.find((p) => p.key === '20000-plus').count).toBe(1); // price facet ignores the price filter (draft excluded)
  });

  it('text search, relevance first, with regex fallback for partial words', async () => {
    const silk = await list('?q=silk');
    expect(names(silk).sort()).toEqual(['Gulmohar Silk Saree', 'Kanjivaram Silk Saree']);
    expect(names(await list('?q=vermilion'))).toEqual(['Gulmohar Silk Saree']); // colour names are searchable
    expect(names(await list('?q=kanj'))).toEqual(['Kanjivaram Silk Saree']); // not a whole word → regex fallback
    expect(names(await list('?q=p4'))).toEqual(['Cotton Frock']); // code
  });

  it('search input is escaped, never a regex', async () => {
    for (const q of ['.*(', '[', '(a+)+$', '\\']) {
      const res = await list(`?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    }
  });
});

describe('product, related, suggest, categories, home', () => {
  it('GET /api/products/:slug: published only, available per size, no admin fields', async () => {
    const res = await request(app).get('/api/products/noor-night-dress');
    expect(res.status).toBe(200);
    expect(res.body.sizes).toEqual([
      { label: 'S', sku: 'P3-S', available: 2 },
      { label: 'M', sku: 'P3-M', available: 0 },
      { label: 'L', sku: 'P3-L', available: 0 },
    ]);
    for (const hidden of ['weightGrams', 'dimensionsCm', 'hsnCode', 'taxRatePercent']) expect(res.body).not.toHaveProperty(hidden);
    expect(res.body).toMatchObject({ isCodAllowed: true, maxQtyPerOrder: 5, lowStockThreshold: 2 });
    expect((await request(app).get('/api/products/draft-lehenga')).status).toBe(404);
  });

  it('related: same category first, in stock first, never itself, max 8', async () => {
    const res = await request(app).get('/api/products/noor-night-dress/related');
    expect(res.body.items[0].name).toBe('Bamboo Night Dress');
    expect(res.body.items.map((p) => p.name)).not.toContain('Noor Night Dress');
    expect(res.body.items.map((p) => p.name)).not.toContain('Draft Lehenga');
    const rest = res.body.items.slice(1);
    expect(rest.findIndex((p) => !p.inStock)).toBe(rest.length - 1); // the out-of-stock saree comes last
    expect(res.body.items.length).toBeLessThanOrEqual(8);
  });

  it('suggest: 2+ characters, word prefixes, products and categories', async () => {
    expect((await request(app).get('/api/search/suggest?q=s')).body).toEqual({ products: [], categories: [] });
    const sil = (await request(app).get('/api/search/suggest?q=sil')).body;
    expect(sil.products.map((p) => p.name).sort()).toEqual(['Gulmohar Silk Saree', 'Kanjivaram Silk Saree']);
    expect(Object.keys(sil.products[0]).sort()).toEqual(['image', 'name', 'price', 'slug']);
    const night = (await request(app).get('/api/search/suggest?q=nigh')).body;
    expect(night.categories).toEqual([{ key: 'Night dresses', count: 2 }]);
    expect((await request(app).get(`/api/search/suggest?q=${encodeURIComponent('.*(')}`)).status).toBe(200);
    expect((await request(app).get('/api/search/suggest?q=draft')).body.products).toEqual([]);
  });

  it('categories: published counts', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.body.items.find((c) => c.key === 'Sarees')).toMatchObject({ count: 2 });
    expect(res.body.items.map((c) => c.key)).not.toContain('Lehengas');
  });

  it('home: new arrivals, featured, category counts in one call', async () => {
    const res = await request(app).get('/api/home');
    expect(res.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect(res.body.newArrivals.map((p) => p.name)).toEqual(['Cotton Frock', 'Gulmohar Silk Saree']);
    expect(res.body.featured.map((p) => p.name)).toEqual(['Kanjivaram Silk Saree']);
    expect(res.body.categories.find((c) => c.key === 'Night dresses')).toMatchObject({ count: 2 });
    expect(res.body.newArrivals[0]).not.toHaveProperty('description');
  });

  it('home falls back to the normal order when nothing is flagged', async () => {
    await ctx.Product.collection.updateMany({}, { $set: { isFeatured: false } });
    const res = await request(app).get('/api/home');
    expect(res.body.featured.map((p) => p.name)).toEqual(names(await list()));
    await ctx.Product.collection.updateOne({ code: 'P2' }, { $set: { isFeatured: true } });
  });
});

describe('admin catalogue', () => {
  it('paginated list with filters and admin fields', async () => {
    const all = await staff.get('/api/admin/products');
    expect(all.body.total).toBe(6);
    expect(all.body.items[0]).toHaveProperty('sizes');
    expect(all.body.items[0]).not.toHaveProperty('description');
    expect((await staff.get('/api/admin/products?status=draft')).body.items.map((p) => p.code)).toEqual(['P5']);
    expect((await staff.get('/api/admin/products?stock=out')).body.items.map((p) => p.code)).toEqual(['P2']);
    const low = (await staff.get('/api/admin/products?stock=low')).body.items.map((p) => p.code).sort();
    expect(low).toEqual(['P3', 'P4', 'P6']); // a size at or below 2 available (P3 M=0, P4 XL=1, P6 XL=2)
    expect((await staff.get('/api/admin/products?q=p3-l')).body.items.map((p) => p.code)).toEqual(['P3']); // by SKU
    expect((await staff.get('/api/admin/products?limit=2&page=3')).body).toMatchObject({ page: 3, totalPages: 3 });
  });

  it('stats match the fixtures', async () => {
    const res = await staff.get('/api/admin/stats');
    expect(res.body).toMatchObject({ total: 6, published: 5, drafts: 1, outOfStock: 1, lowStock: 3, categories: 4 });
    expect(res.body.attention.length).toBe(res.body.attentionCount);
    expect(res.body.attention[0].code).toBe('P2'); // sold out first
    expect(res.body.recent.map((p) => p.code)).toEqual(['P6', 'P5', 'P4']);
  });

  it('stock update: per size, recomputes derived fields, refuses below reserved', async () => {
    const p3 = (await staff.get('/api/admin/products?q=P3')).body.items[0];
    const ok = await staff
      .patch(`/api/admin/products/${p3._id}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'm', stock: 4 }] });
    expect(ok.status).toBe(200);
    expect(ok.body.sizes.find((s) => s.label === 'M').stock).toBe(4);
    expect(ok.body).toMatchObject({ totalStock: 6, availableSizes: ['S', 'M'] });
    const low = await staff
      .patch(`/api/admin/products/${p3._id}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'L', stock: 3 }] });
    expect(low.status).toBe(400);
    expect(low.body).toMatchObject({ code: 'BELOW_RESERVED', error: "L: stock can't be below the 5 reserved for orders." });
    const unknown = await staff
      .patch(`/api/admin/products/${p3._id}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'XXL', stock: 1 }] });
    expect(unknown.body.error).toBe('Unknown size: XXL.');
    const neg = await staff
      .patch(`/api/admin/products/${p3._id}/stock`)
      .set(XRW)
      .send({ sizes: [{ label: 'S', stock: -1 }] });
    expect(neg.status).toBe(400);
    expect(
      (
        await customer
          .patch(`/api/admin/products/${p3._id}/stock`)
          .set(XRW)
          .send({ sizes: [{ label: 'S', stock: 1 }] })
      ).status
    ).toBe(403);
    // Public product page reflects it.
    const pub = await request(app).get('/api/products/noor-night-dress');
    expect(pub.body.sizes.find((s) => s.label === 'M').available).toBe(4);
  });

  it('stock update is safe against concurrent changes', async () => {
    const p4 = (await staff.get('/api/admin/products?q=P4')).body.items[0];
    const [a, b] = await Promise.all([
      staff
        .patch(`/api/admin/products/${p4._id}/stock`)
        .set(XRW)
        .send({ sizes: [{ label: 'M', stock: 7 }] }),
      staff
        .patch(`/api/admin/products/${p4._id}/stock`)
        .set(XRW)
        .send({ sizes: [{ label: 'XL', stock: 9 }] }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const final = (await staff.get(`/api/admin/products/${p4._id}`)).body;
    expect(final.sizes.map((s) => [s.label, s.stock])).toEqual([
      ['M', 7],
      ['XL', 9],
    ]);
    expect(final.totalStock).toBe(16);
  });
});

describe('query plans use indexes', () => {
  const stages = (plan, out = []) => {
    if (!plan) return out;
    out.push(plan.stage);
    stages(plan.inputStage, out);
    (plan.inputStages || []).forEach((p) => stages(p, out));
    return out;
  };
  const planOf = async (filter, sort) => {
    const explained = await ctx.Product.find(filter).sort(sort).limit(24).explain('queryPlanner');
    return stages((explained[0] || explained).queryPlanner.winningPlan);
  };

  it.each([
    ['category + recommended sort', { status: 'published', category: 'Sarees' }, { displayOrder: 1, createdAt: -1 }],
    ['price range', { status: 'published', price: { $gte: 1000, $lte: 15000 } }, { price: 1 }],
    ['in stock', { status: 'published', inStock: true }, { displayOrder: 1 }],
    ['discount sort', { status: 'published' }, { discountPercent: -1 }],
    ['text search', { status: 'published', $text: { $search: 'silk' } }, { _id: 1 }],
  ])('%s', async (_name, filter, sort) => {
    const s = await planOf(filter, sort);
    expect(s).not.toContain('COLLSCAN');
    expect(s.some((x) => x === 'IXSCAN' || x === 'TEXT' || x === 'TEXT_MATCH')).toBe(true);
  });
});
