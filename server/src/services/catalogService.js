// Public catalogue: list with filters/facets/pagination, home, product, related, suggestions, categories.
// Lists always use the CARD projection — never full descriptions.
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { escapeRegex } from '../validators/catalog.js';
import { CATEGORIES } from '../validators/product.js';
import { available } from './productShape.js';

const PUBLISHED = { status: 'published' };

/** Fields a product card needs. `images` is sliced to the cover only. */
export const CARD_FIELDS = {
  slug: 1,
  name: 1,
  fabric: 1,
  price: 1,
  mrp: 1,
  discountPercent: 1,
  badge: 1,
  isNewArrival: 1,
  isFeatured: 1,
  inStock: 1,
  availableSizes: 1,
  category: 1,
  images: { $slice: 1 },
};
const SORTS = {
  recommended: { displayOrder: 1, createdAt: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  discount: { discountPercent: -1, createdAt: -1, _id: 1 },
};

export const PRICE_BUCKETS = [
  { key: 'under-5000', label: 'Under ₹5,000', max: 4999 },
  { key: '5000-10000', label: '₹5,000–10,000', min: 5000, max: 9999 },
  { key: '10000-20000', label: '₹10,000–20,000', min: 10000, max: 19999 },
  { key: '20000-plus', label: 'Above ₹20,000', min: 20000 },
];

/** Word-prefix match: "kanj" finds "Kanjivaram", "silk" finds "Tussar Silk". */
const wordPrefix = (q) => new RegExp(`(^|[\\s\\-(/,])${escapeRegex(q)}`, 'i');

/** Each filter separately, so facets can drop "their own" filter. */
function filterParts(query) {
  const parts = {};
  if (query.category) parts.category = { category: query.category };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const price = {};
    if (query.minPrice !== undefined) price.$gte = query.minPrice;
    if (query.maxPrice !== undefined) price.$lte = query.maxPrice;
    parts.price = { price };
  }
  if (query.sizes?.length) parts.sizes = { availableSizes: { $in: query.sizes } };
  if (query.inStock) parts.inStock = { inStock: true };
  if (query.filter === 'new') parts.filter = { isNewArrival: true };
  if (query.filter === 'featured') parts.filter = { isFeatured: true };
  if (query.minDiscount) parts.discount = { discountPercent: { $gte: query.minDiscount } };
  return parts;
}

const merge = (...objs) => Object.assign({}, ...objs);

/** Base match for the search words: text index first, escaped regex fallback when the text search finds nothing. */
async function searchMatch(q) {
  if (!q) return { match: {}, text: false };
  const textMatch = { $text: { $search: q } };
  if (await Product.exists({ ...PUBLISHED, ...textMatch })) return { match: textMatch, text: true };
  const re = new RegExp(escapeRegex(q), 'i');
  return { match: { $or: [{ name: re }, { fabric: re }, { 'colors.name': re }, { code: re }, { category: re }] }, text: false };
}

export async function listProducts(query) {
  const { match: search, text } = await searchMatch(query.q);
  const parts = filterParts(query);
  const filter = merge(PUBLISHED, search, ...Object.values(parts));
  const without = (key) =>
    merge(
      ...Object.entries(parts)
        .filter(([k]) => k !== key)
        .map(([, v]) => v)
    );

  const sortKey = query.sort || (text ? 'relevance' : 'recommended');
  const sort = sortKey === 'relevance' ? { score: { $meta: 'textScore' }, displayOrder: 1, _id: 1 } : SORTS[sortKey];
  const projection = text && sortKey === 'relevance' ? { ...CARD_FIELDS, score: { $meta: 'textScore' } } : CARD_FIELDS;
  const skip = (query.page - 1) * query.limit;

  const [items, total, facetRows] = await Promise.all([
    Product.find(filter, projection).sort(sort).skip(skip).limit(query.limit).lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      // $text has to be the first stage; the remaining filters are applied per facet.
      { $match: merge(PUBLISHED, search) },
      {
        $facet: {
          sizes: [{ $match: without('sizes') }, { $unwind: '$availableSizes' }, { $group: { _id: '$availableSizes', count: { $sum: 1 } } }],
          categories: [{ $match: without('category') }, { $group: { _id: '$category', count: { $sum: 1 } } }],
          prices: [
            { $match: without('price') },
            {
              $bucket: {
                groupBy: '$price',
                boundaries: [0, 5000, 10000, 20000, Number.MAX_SAFE_INTEGER],
                default: 'other',
                output: { count: { $sum: 1 } },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const f = facetRows[0] || { sizes: [], categories: [], prices: [] };
  const bucketCount = Object.fromEntries(f.prices.map((b) => [b._id, b.count]));
  const facets = {
    sizes: f.sizes.map((s) => ({ label: s._id, count: s.count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    categories: f.categories.map((c) => ({ key: c._id, count: c.count })).sort((a, b) => b.count - a.count),
    prices: PRICE_BUCKETS.map((b, i) => ({ ...b, count: bucketCount[[0, 5000, 10000, 20000][i]] || 0 })),
  };
  for (const item of items) delete item.score;
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    facets,
  };
}

/** New arrivals / featured (8 each, falling back to the normal order when none are flagged) and category counts. */
export async function home() {
  const pick = async (flag) => {
    const flagged = await Product.find({ ...PUBLISHED, [flag]: true }, CARD_FIELDS)
      .sort(SORTS.recommended)
      .limit(8)
      .lean();
    if (flagged.length) return flagged;
    return Product.find(PUBLISHED, CARD_FIELDS).sort(SORTS.recommended).limit(8).lean();
  };
  const [newArrivals, featured, categories] = await Promise.all([pick('isNewArrival'), pick('isFeatured'), categoryCounts()]);
  return { newArrivals, featured, categories };
}

/** Published count and cover photo per category (cover = first product in the normal order). */
export async function categoryCounts() {
  const rows = await Product.aggregate([
    { $match: PUBLISHED },
    { $sort: SORTS.recommended },
    { $group: { _id: '$category', count: { $sum: 1 }, cover: { $first: { $arrayElemAt: ['$images.url', 0] } } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  return rows.map((r) => ({ key: r._id, count: r.count, cover: r.cover || '' }));
}

/** Fields customers never see on the full product. */
const HIDDEN = { weightGrams: 0, dimensionsCm: 0, hsnCode: 0, taxRatePercent: 0 };

const byIdOrSlug = (id) => (/^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { slug: String(id) });

/** Full published product; sizes carry `available` (stock − reserved), never raw stock or reserved. */
export async function publicProduct(slug) {
  const doc = await Product.findOne({ ...PUBLISHED, ...byIdOrSlug(slug) }, HIDDEN).lean();
  if (!doc) throw new HttpError(404, 'Product not found.');
  // lowStockThreshold stays: the product page needs it for "Only N left".
  return {
    ...doc,
    sizes: (doc.sizes || []).map((s) => ({ label: s.label, sku: s.sku, available: available(s) })),
  };
}

/** Same category first, in-stock first, never the product itself; up to 8. */
export async function related(slug) {
  const p = await Product.findOne({ ...PUBLISHED, slug }, { category: 1 }).lean();
  if (!p) throw new HttpError(404, 'Product not found.');
  const order = { inStock: -1, ...SORTS.recommended };
  const same = await Product.find({ ...PUBLISHED, category: p.category, _id: { $ne: p._id } }, CARD_FIELDS)
    .sort(order)
    .limit(8)
    .lean();
  if (same.length >= 8) return same;
  const others = await Product.find({ ...PUBLISHED, category: { $ne: p.category } }, CARD_FIELDS)
    .sort(order)
    .limit(8 - same.length)
    .lean();
  return [...same, ...others];
}

/** Up to 6 products + matching categories for the search box (min 2 characters). */
export async function suggest(q) {
  if (!q || q.length < 2) return { products: [], categories: [] };
  const re = wordPrefix(q);
  const [rows, counts] = await Promise.all([
    Product.find({ ...PUBLISHED, $or: [{ name: re }, { code: re }, { fabric: re }] }, { name: 1, slug: 1, price: 1, images: { $slice: 1 } })
      .sort(SORTS.recommended)
      .limit(6)
      .lean(),
    categoryCounts(),
  ]);
  const known = new Map(counts.map((c) => [c.key, c.count]));
  const categories = [...new Set([...CATEGORIES, ...known.keys()])]
    .filter((c) => re.test(c) && known.get(c))
    .slice(0, 4)
    .map((key) => ({ key, count: known.get(key) }));
  return {
    products: rows.map((r) => ({ name: r.name, slug: r.slug, price: r.price, image: r.images?.[0]?.url || '' })),
    categories,
  };
}
