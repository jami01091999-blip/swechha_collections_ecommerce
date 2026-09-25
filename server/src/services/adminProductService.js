// Admin catalogue: paginated list, dashboard stats, single product, atomic stock updates.
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { escapeRegex } from '../validators/catalog.js';
import { shapeProduct } from './productShape.js';

/** Fields admin lists need (no long texts). */
export const ADMIN_ROW = {
  name: 1,
  code: 1,
  slug: 1,
  price: 1,
  mrp: 1,
  category: 1,
  fabric: 1,
  status: 1,
  sizeType: 1,
  sizes: 1,
  lowStockThreshold: 1,
  totalStock: 1,
  inStock: 1,
  availableSizes: 1,
  discountPercent: 1,
  isNewArrival: 1,
  isFeatured: 1,
  displayOrder: 1,
  images: { $slice: 1 },
  createdAt: 1,
  updatedAt: 1,
};
const ROW_STAGE = { $project: { ...ADMIN_ROW, images: { $slice: ['$images', 1] } } };

/** Any size with (stock − reserved) at or below the product's low-stock limit (default 2) — includes sold-out sizes. */
export const NEEDS_ATTENTION = {
  $expr: {
    $anyElementTrue: [
      {
        $map: {
          input: { $ifNull: ['$sizes', []] },
          as: 's',
          in: {
            $lte: [
              { $subtract: [{ $ifNull: ['$$s.stock', 0] }, { $ifNull: ['$$s.reserved', 0] }] },
              { $cond: [{ $gt: ['$lowStockThreshold', 0] }, '$lowStockThreshold', 2] },
            ],
          },
        },
      },
    ],
  },
};

const STOCK_FILTERS = {
  in: { inStock: true },
  out: { inStock: false },
  low: { inStock: true, ...NEEDS_ATTENTION },
  attention: NEEDS_ATTENTION,
};

const SORTS = {
  recommended: { displayOrder: 1, createdAt: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  stock_asc: { totalStock: 1, _id: 1 },
};

export async function listAdminProducts(q) {
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (q.stock) Object.assign(filter, STOCK_FILTERS[q.stock]);
  if (q.q) {
    const re = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: re }, { code: re }, { fabric: re }, { 'sizes.sku': re }];
  }
  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Product.find(filter, ADMIN_ROW)
      .sort(SORTS[q.sort || 'recommended'])
      .skip(skip)
      .limit(q.limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { items, page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
}

export async function getAdminProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Product not found.');
  const doc = await Product.findById(id).lean();
  if (!doc) throw new HttpError(404, 'Product not found.');
  return doc;
}

/** Dashboard numbers in one aggregation. */
export async function adminStats() {
  const [row] = await Product.aggregate([
    {
      $facet: {
        counts: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
              drafts: { $sum: { $cond: [{ $ne: ['$status', 'published'] }, 1, 0] } },
              outOfStock: { $sum: { $cond: [{ $eq: ['$inStock', false] }, 1, 0] } },
              categories: { $addToSet: '$category' },
            },
          },
        ],
        lowStock: [{ $match: STOCK_FILTERS.low }, { $count: 'n' }],
        attentionCount: [{ $match: NEEDS_ATTENTION }, { $count: 'n' }],
        attention: [{ $match: NEEDS_ATTENTION }, { $sort: { inStock: 1, totalStock: 1, updatedAt: -1 } }, { $limit: 10 }, ROW_STAGE],
        recent: [{ $sort: { createdAt: -1, _id: -1 } }, { $limit: 3 }, ROW_STAGE],
      },
    },
  ]);
  const c = row.counts[0] || { total: 0, published: 0, drafts: 0, outOfStock: 0, categories: [] };
  return {
    total: c.total,
    published: c.published,
    drafts: c.drafts,
    outOfStock: c.outOfStock,
    lowStock: row.lowStock[0]?.n || 0,
    categories: c.categories.filter(Boolean).length,
    attentionCount: row.attentionCount[0]?.n || 0,
    attention: row.attention,
    recent: row.recent,
  };
}

/**
 * Sets stock for the given sizes and recomputes derived fields with the shared helper.
 * Compare-and-set on updatedAt makes it atomic: a concurrent change (e.g. a checkout reserving stock)
 * forces a re-read, so stock can never be set below what is reserved.
 */
export async function updateStock(id, updates, attempt = 0) {
  const doc = await getAdminProduct(id);
  const byLabel = new Map(doc.sizes.map((s) => [s.label, s]));
  const unknown = updates.filter((u) => !byLabel.has(u.label)).map((u) => (u.label === 'FREE' ? 'Free Size' : u.label));
  if (unknown.length) throw new HttpError(400, `Unknown size: ${unknown.join(', ')}.`);
  const tooLow = updates.filter((u) => u.stock < (byLabel.get(u.label).reserved || 0));
  if (tooLow.length) {
    const u = tooLow[0];
    const r = byLabel.get(u.label).reserved;
    throw new HttpError(400, `${u.label === 'FREE' ? 'Free Size' : u.label}: stock can't be below the ${r} reserved for orders.`, {
      code: 'BELOW_RESERVED',
    });
  }
  const wanted = new Map(updates.map((u) => [u.label, u.stock]));
  const sizes = doc.sizes.map((s) => (wanted.has(s.label) ? { ...s, stock: wanted.get(s.label) } : s));
  const shaped = shapeProduct({ ...doc, sizes }, doc.sizes);
  const updated = await Product.findOneAndUpdate(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: shaped },
    { new: true, lean: true, projection: ADMIN_ROW }
  );
  if (updated) return updated;
  if (attempt < 3) return updateStock(id, updates, attempt + 1);
  throw new HttpError(409, 'This product was changed at the same moment. Try again.');
}
