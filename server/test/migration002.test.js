import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startTestApp } from './helpers.js';
import { migrate002 } from '../src/scripts/migrations/002-sizes-sku.js';

let ctx;
let db;
let col;
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swechha-backup-'));
const quiet = () => {};

beforeAll(async () => {
  ctx = await startTestApp();
  db = mongoose.connection.db;
  col = db.collection('products');
});
afterAll(async () => {
  fs.rmSync(backupDir, { recursive: true, force: true });
  await ctx?.stop();
});

// Documents exactly as the pre-Phase-2 app stored them.
const legacy = () => [
  {
    name: 'Free Saree',
    slug: 'free-saree',
    code: 'SC-1',
    category: 'Sarees',
    price: 1000,
    mrp: 2000,
    sizeType: 'free',
    freeSizeStock: 4,
    sizes: [],
    status: 'published',
    createdAt: new Date('2025-01-01'),
  },
  {
    name: 'Sized Night Dress',
    slug: 'sized-night-dress',
    code: 'SC-2',
    category: 'Night dresses',
    price: 900,
    mrp: 0,
    sizeType: 'sized',
    freeSizeStock: 1, // stale form default
    sizes: [
      { label: 'M', stock: 2 },
      { label: 'L', stock: 0 },
    ],
    status: 'published',
    createdAt: new Date('2025-01-02'),
  },
  // "AB" + "C-D" and "AB-C" + "D" both generate AB-C-D.
  {
    name: 'Older',
    slug: 'older',
    code: 'AB',
    category: 'Frocks',
    price: 500,
    sizeType: 'sized',
    sizes: [{ label: 'C-D', stock: 1 }],
    createdAt: new Date('2025-01-03'),
  },
  {
    name: 'Newer',
    slug: 'newer',
    code: 'AB-C',
    category: 'Frocks',
    price: 500,
    sizeType: 'sized',
    sizes: [{ label: 'D', stock: 1 }],
    createdAt: new Date('2025-01-04'),
  },
];

beforeEach(async () => {
  await col.deleteMany({});
  await col.insertMany(legacy());
  fs.readdirSync(backupDir).forEach((f) => fs.rmSync(path.join(backupDir, f)));
});

describe('migration 002', () => {
  it('dry run changes nothing and writes no backup', async () => {
    const before = await col.find({}).toArray();
    const report = await migrate002({ db, apply: false, backupDir, log: quiet });
    expect(report).toMatchObject({ total: 4, toChange: 4, applied: false, backupFile: null });
    expect(await col.find({}).toArray()).toEqual(before);
    expect(fs.readdirSync(backupDir)).toEqual([]);
  });

  it('apply converts free and sized products, fills defaults and derived fields, backs up first', async () => {
    const lines = [];
    const report = await migrate002({ db, apply: true, backupDir, log: (l) => lines.push(l) });
    expect(report.toChange).toBe(4);
    expect(fs.existsSync(report.backupFile)).toBe(true);
    const backup = mongoose.mongo.BSON.EJSON.parse(fs.readFileSync(report.backupFile, 'utf8'));
    expect(backup).toHaveLength(4);
    expect(backup[0].freeSizeStock).toBe(4); // original data preserved in the backup

    const free = await col.findOne({ code: 'SC-1' });
    expect(free.sizes).toEqual([{ label: 'FREE', sku: 'SC-1-FREE', stock: 4, reserved: 0 }]);
    expect(free).not.toHaveProperty('freeSizeStock');
    expect(free).toMatchObject({ totalStock: 4, inStock: true, availableSizes: ['FREE'], discountPercent: 50, weightGrams: 700 });
    expect(free.dimensionsCm).toEqual({ l: 30, b: 25, h: 5 });
    expect(free).toMatchObject({ taxRatePercent: 5, isCodAllowed: true, isReturnable: true, maxQtyPerOrder: 5, hsnCode: '' });

    const sized = await col.findOne({ code: 'SC-2' });
    expect(sized.sizes).toEqual([
      { label: 'M', sku: 'SC-2-M', stock: 2, reserved: 0 },
      { label: 'L', sku: 'SC-2-L', stock: 0, reserved: 0 },
    ]);
    expect(sized).not.toHaveProperty('freeSizeStock');
    expect(sized).toMatchObject({ totalStock: 2, availableSizes: ['M'], weightGrams: 350 });
    expect(lines.join('\n')).toContain('dropped stale freeSizeStock 1 (sized product)');
  });

  it('SKU collisions: the older product keeps the SKU, the newer gets -2', async () => {
    const report = await migrate002({ db, apply: true, backupDir, log: quiet });
    expect((await col.findOne({ code: 'AB' })).sizes[0].sku).toBe('AB-C-D');
    expect((await col.findOne({ code: 'AB-C' })).sizes[0].sku).toBe('AB-C-D-2');
    expect(report.collisions).toEqual(['SKU collision: AB-C-D → AB-C-D-2']);
  });

  it('running twice changes nothing the second time', async () => {
    await migrate002({ db, apply: true, backupDir, log: quiet });
    const after = await col.find({}).toArray();
    const lines = [];
    const second = await migrate002({ db, apply: true, backupDir, log: (l) => lines.push(l) });
    expect(second.toChange).toBe(0);
    expect(second.backupFile).toBeNull();
    expect(lines[0]).toBe('Products: 4 · to change: 0');
    expect(await col.find({}).toArray()).toEqual(after);
  });

  it('migrated data satisfies the new unique SKU index and the app reads it', async () => {
    await migrate002({ db, apply: true, backupDir, log: quiet });
    await ctx.Product.syncIndexes();
    const res = await (await import('supertest')).default(ctx.app).get('/api/products/free-saree');
    expect(res.status).toBe(200);
    expect(res.body.sizes[0].label).toBe('FREE');
  });
});
