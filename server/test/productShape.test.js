import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeSku, normalizeSizes, derive, shapeProduct, available } from '../src/services/productShape.js';
import { XRW, startTestApp, validProduct } from './helpers.js';

describe('productShape helper', () => {
  it('builds SKUs from code + label', () => {
    expect(makeSku('SC-2025-037', 'XL')).toBe('SC-2025-037-XL');
    expect(makeSku('sc 2025 084', 'free')).toBe('SC-2025-084-FREE');
    expect(makeSku('', 'M')).toBe('');
  });

  it('free size → exactly one FREE row (from legacy freeSizeStock too)', () => {
    expect(normalizeSizes({ code: 'A1', sizeType: 'free', freeSizeStock: 4 })).toEqual([
      { label: 'FREE', sku: 'A1-FREE', stock: 4, reserved: 0 },
    ]);
    expect(normalizeSizes({ code: 'A1', sizeType: 'free', sizes: [{ label: 'FREE', stock: 2 }] })).toEqual([
      { label: 'FREE', sku: 'A1-FREE', stock: 2, reserved: 0 },
    ]);
  });

  it('sized → one row per label, FREE rows dropped; keeps stored reserved and SKUs', () => {
    const previous = [{ label: 'M', sku: 'OLD-M', stock: 5, reserved: 2 }];
    const sizes = normalizeSizes(
      {
        code: 'NEW',
        sizeType: 'sized',
        sizes: [
          { label: 'M', stock: 6 },
          { label: 'L', stock: 1 },
          { label: 'FREE', stock: 9 },
        ],
      },
      previous
    );
    expect(sizes).toEqual([
      { label: 'M', sku: 'OLD-M', stock: 6, reserved: 2 },
      { label: 'L', sku: 'NEW-L', stock: 1, reserved: 0 },
    ]);
  });

  it('derives totals from stock − reserved', () => {
    const sizes = [
      { label: 'S', stock: 3, reserved: 3 },
      { label: 'M', stock: 5, reserved: 1 },
      { label: 'L', stock: 0, reserved: 0 },
    ];
    expect(available(sizes[1])).toBe(4);
    expect(derive({ sizes, mrp: 2000, price: 1500 })).toEqual({ totalStock: 4, inStock: true, availableSizes: ['M'], discountPercent: 25 });
    expect(derive({ sizes: [{ label: 'M', stock: 2, reserved: 2 }], mrp: 0, price: 100 })).toMatchObject({
      inStock: false,
      totalStock: 0,
      discountPercent: 0,
    });
  });

  it('shapeProduct = sizes + derived', () => {
    const shaped = shapeProduct({ code: 'X', sizeType: 'free', freeSizeStock: 0, mrp: 100, price: 100 });
    expect(shaped).toEqual({
      sizes: [{ label: 'FREE', sku: 'X-FREE', stock: 0, reserved: 0 }],
      totalStock: 0,
      inStock: false,
      availableSizes: [],
      discountPercent: 0,
    });
  });
});

describe('products with SKUs (API)', () => {
  let ctx;
  let staff;
  beforeAll(async () => {
    ctx = await startTestApp();
    staff = (await ctx.signIn('staff@example.com', { role: 'staff' })).agent;
  });
  afterAll(() => ctx?.stop());
  beforeEach(() => ctx.Product.deleteMany({}));

  const create = (body) => staff.post('/api/products').set(XRW).send(body);
  const sized = (overrides = {}) =>
    validProduct({
      sizeType: 'sized',
      sizes: [
        { label: 'S', stock: 2 },
        { label: 'M', stock: 0 },
      ],
      ...overrides,
    });

  it('generates SKUs on create and when a size is added', async () => {
    const { body } = await create(sized({ code: 'sc-1' }));
    expect(body.sizes.map((s) => s.sku)).toEqual(['SC-1-S', 'SC-1-M']);
    expect(body).toMatchObject({ totalStock: 2, inStock: true, availableSizes: ['S'] });
    const res = await staff
      .patch(`/api/products/${body._id}`)
      .set(XRW)
      .send({ sizes: [...body.sizes, { label: 'xl', stock: 3 }] });
    expect(res.body.sizes.map((s) => s.sku)).toEqual(['SC-1-S', 'SC-1-M', 'SC-1-XL']);
    expect(res.body).toMatchObject({ totalStock: 5, availableSizes: ['S', 'XL'] });
  });

  it('free-size products store one FREE row (legacy freeSizeStock accepted)', async () => {
    const { body } = await create(validProduct({ code: 'F1', sizeType: 'free', freeSizeStock: 3 }));
    expect(body.sizes).toEqual([{ label: 'FREE', sku: 'F1-FREE', stock: 3, reserved: 0 }]);
    expect(body).not.toHaveProperty('freeSizeStock');
    expect(body.availableSizes).toEqual(['FREE']);
  });

  it('custom SKUs: unique within the product and across products', async () => {
    const same = await create(
      sized({
        code: 'D1',
        sizes: [
          { label: 'S', sku: 'X-1', stock: 1 },
          { label: 'M', sku: 'x-1', stock: 1 },
        ],
      })
    );
    expect(same.status).toBe(400);
    expect(same.body.error).toBe('Each size needs its own SKU.');
    const bad = await create(sized({ code: 'D2', sizes: [{ label: 'S', sku: 'X_1!', stock: 1 }] }));
    expect(bad.body.error).toContain('SKUs can use letters, numbers and dashes.');
    await create(sized({ code: 'D3', sizes: [{ label: 'S', sku: 'SHARED-1', stock: 1 }] })).expect(201);
    const clash = await create(sized({ code: 'D4', name: 'Other', sizes: [{ label: 'S', sku: 'shared-1', stock: 1 }] }));
    expect(clash.status).toBe(409);
    expect(clash.body).toMatchObject({ code: 'SKU_TAKEN', skus: ['SHARED-1'], error: 'Another product (D3) already uses SKU SHARED-1.' });
  });

  it('changing the product code does not rewrite existing SKUs', async () => {
    const { body } = await create(sized({ code: 'OLD' }));
    const res = await staff.patch(`/api/products/${body._id}`).set(XRW).send({ code: 'NEW' });
    expect(res.body.code).toBe('NEW');
    expect(res.body.sizes.map((s) => s.sku)).toEqual(['OLD-S', 'OLD-M']);
  });

  it('derived fields follow price and reserved stock; stock below reserved is refused', async () => {
    const { body } = await create(sized({ code: 'R1', price: 1000, mrp: 2000 }));
    await ctx.Product.collection.updateOne({ _id: ctx.Product.castObject({ _id: body._id })._id }, { $set: { 'sizes.0.reserved': 2 } });
    const priced = await staff.patch(`/api/products/${body._id}`).set(XRW).send({ price: 1500 });
    expect(priced.body).toMatchObject({ discountPercent: 25, totalStock: 0, inStock: false, availableSizes: [] });
    expect(priced.body.sizes[0]).toMatchObject({ label: 'S', stock: 2, reserved: 2 });
    const tooLow = await staff
      .patch(`/api/products/${body._id}`)
      .set(XRW)
      .send({
        sizes: [
          { label: 'S', stock: 1 },
          { label: 'M', stock: 0 },
        ],
      });
    expect(tooLow.status).toBe(400);
    expect(tooLow.body.error).toBe("S: stock can't be below the 2 reserved for orders.");
    // A request can never set `reserved` itself.
    const sneaky = await staff
      .patch(`/api/products/${body._id}`)
      .set(XRW)
      .send({
        sizes: [
          { label: 'S', stock: 5, reserved: 0 },
          { label: 'M', stock: 0 },
        ],
      });
    expect(sneaky.body.sizes[0]).toMatchObject({ stock: 5, reserved: 2 });
    expect(sneaky.body.totalStock).toBe(3);
  });

  it('category defaults for shipping; HSN validation; settings tax rate', async () => {
    await ctx.Setting.updateOne({ _id: 'site' }, { $set: { defaultTaxRatePercent: 12 } }, { upsert: true });
    const { body } = await create(validProduct({ code: 'N1', category: 'Night dresses' }));
    expect(body).toMatchObject({ weightGrams: 350, taxRatePercent: 12, hsnCode: '', isReturnable: true });
    const other = await create(validProduct({ code: 'N2', name: 'Other', category: 'Something new' }));
    expect(other.body.weightGrams).toBe(500);
    const hsn = await staff.patch(`/api/products/${body._id}`).set(XRW).send({ hsnCode: '12' });
    expect(hsn.body.error).toBe('HSN code has 4 to 8 digits.');
    const ok = await staff.patch(`/api/products/${body._id}`).set(XRW).send({ hsnCode: '6204', maxQtyPerOrder: 99, taxRatePercent: 40 });
    expect(ok.body).toMatchObject({ hsnCode: '6204', maxQtyPerOrder: 20, taxRatePercent: 28 });
    await ctx.Setting.deleteMany({});
  });
});
