// Catalogue part of the mock API: same response shapes and rules as server/src/services/catalogService.js.
// Products are shaped with the server's own helper so sizes/SKUs/derived fields match reality.
import { shapeProduct, available } from '../../server/src/services/productShape.js';
import { PRODUCTS } from './fixtures.js';

export const shaped = () => PRODUCTS.map((p) => ({ ...p, ...shapeProduct(p, p.sizes) }));

const CARD = [
  '_id',
  'slug',
  'name',
  'fabric',
  'price',
  'mrp',
  'discountPercent',
  'badge',
  'isNewArrival',
  'isFeatured',
  'inStock',
  'availableSizes',
  'category',
];
export const card = (p) => ({ ...Object.fromEntries(CARD.map((k) => [k, p[k]])), images: (p.images || []).slice(0, 1) });

const recommended = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || new Date(b.createdAt) - new Date(a.createdAt);
const SORTS = {
  recommended,
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  discount: (a, b) => b.discountPercent - a.discountPercent || recommended(a, b),
};
const BUCKETS = [
  { key: 'under-5000', label: 'Under ₹5,000', max: 4999 },
  { key: '5000-10000', label: '₹5,000–10,000', min: 5000, max: 9999 },
  { key: '10000-20000', label: '₹10,000–20,000', min: 10000, max: 19999 },
  { key: '20000-plus', label: 'Above ₹20,000', min: 20000 },
];

export const published = () =>
  shaped()
    .filter((p) => p.status === 'published')
    .sort(recommended);

function tests(sp) {
  const sizes = (sp.get('sizes') || '').split(',').filter(Boolean);
  const q = (sp.get('q') || '').toLowerCase();
  return {
    category: (p) => !sp.get('category') || p.category === sp.get('category'),
    price: (p) => (!sp.get('minPrice') || p.price >= +sp.get('minPrice')) && (!sp.get('maxPrice') || p.price <= +sp.get('maxPrice')),
    sizes: (p) => !sizes.length || p.availableSizes.some((s) => sizes.includes(s)),
    other: (p) =>
      (!sp.get('inStock') || p.inStock) &&
      (sp.get('filter') !== 'new' || p.isNewArrival) &&
      (sp.get('filter') !== 'featured' || p.isFeatured) &&
      (!sp.get('minDiscount') || p.discountPercent >= +sp.get('minDiscount')) &&
      (!q || [p.name, p.fabric, p.code, p.category, ...(p.colors || []).map((c) => c.name)].some((s) => s?.toLowerCase().includes(q))),
  };
}

export function listProducts(sp) {
  const t = tests(sp);
  const pass = (p, skip) => Object.entries(t).every(([k, fn]) => k === skip || fn(p));
  const all = published();
  const matched = all.filter((p) => pass(p)).sort(SORTS[sp.get('sort')] || recommended);
  const limit = Math.min(48, Math.max(1, +sp.get('limit') || 24));
  const page = Math.max(1, +sp.get('page') || 1);
  const count = (skip, fn) => all.filter((p) => pass(p, skip)).reduce(fn, new Map());
  const cats = count('category', (m, p) => m.set(p.category, (m.get(p.category) || 0) + 1));
  const sizes = count('sizes', (m, p) => (p.availableSizes.forEach((s) => m.set(s, (m.get(s) || 0) + 1)), m));
  const inPrice = all.filter((p) => pass(p, 'price'));
  return {
    items: matched.slice((page - 1) * limit, page * limit).map(card),
    page,
    limit,
    total: matched.length,
    totalPages: Math.max(1, Math.ceil(matched.length / limit)),
    facets: {
      sizes: [...sizes].map(([label, c]) => ({ label, count: c })),
      categories: [...cats].map(([key, c]) => ({ key, count: c })),
      prices: BUCKETS.map((b) => ({
        ...b,
        count: inPrice.filter((p) => p.price >= (b.min || 0) && p.price <= (b.max ?? Infinity)).length,
      })),
    },
  };
}

export function home() {
  const all = published();
  const pick = (flag) => (all.some((p) => p[flag]) ? all.filter((p) => p[flag]) : all).slice(0, 8).map(card);
  const cats = new Map();
  for (const p of all) cats.set(p.category, (cats.get(p.category) || 0) + 1);
  return {
    newArrivals: pick('isNewArrival'),
    featured: pick('isFeatured'),
    categories: [...cats].map(([key, count]) => ({ key, count, cover: '' })),
  };
}

export function publicProduct(slug) {
  const p = published().find((x) => x.slug === slug || x._id === slug);
  if (!p) return null;
  const { weightGrams: _w, dimensionsCm: _d, hsnCode: _h, taxRatePercent: _t, ...rest } = p;
  return { ...rest, sizes: p.sizes.map((s) => ({ label: s.label, sku: s.sku, available: available(s) })) };
}

export function related(slug) {
  const all = published();
  const p = all.find((x) => x.slug === slug);
  if (!p) return null;
  const order = (a, b) => Number(b.inStock) - Number(a.inStock) || recommended(a, b);
  const same = all.filter((x) => x.category === p.category && x._id !== p._id).sort(order);
  const others = all.filter((x) => x.category !== p.category).sort(order);
  return [...same, ...others].slice(0, 8).map(card);
}

export function suggest(q) {
  if (!q || q.length < 2) return { products: [], categories: [] };
  const re = new RegExp(`(^|[\\s\\-(/,])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  const all = published();
  const cats = new Map();
  for (const p of all) cats.set(p.category, (cats.get(p.category) || 0) + 1);
  return {
    products: all
      .filter((p) => re.test(p.name) || re.test(p.code) || re.test(p.fabric))
      .slice(0, 6)
      .map((p) => ({ name: p.name, slug: p.slug, price: p.price, image: p.images?.[0]?.url || '' })),
    categories: [...cats].filter(([k]) => re.test(k)).map(([key, count]) => ({ key, count })),
  };
}

/* ── admin ── */
const attention = (p) => p.sizes.some((s) => available(s) <= (p.lowStockThreshold > 0 ? p.lowStockThreshold : 2));

export function adminList(sp) {
  let list = shaped().sort(recommended);
  if (sp.get('status')) list = list.filter((p) => p.status === sp.get('status'));
  if (sp.get('category')) list = list.filter((p) => p.category === sp.get('category'));
  const stock = sp.get('stock');
  if (stock === 'out') list = list.filter((p) => !p.inStock);
  if (stock === 'attention') list = list.filter(attention);
  const q = (sp.get('q') || '').toLowerCase();
  if (q) list = list.filter((p) => [p.name, p.code, p.fabric].some((s) => s?.toLowerCase().includes(q)));
  const limit = Math.min(100, +sp.get('limit') || 24);
  const page = Math.max(1, +sp.get('page') || 1);
  const rows = list.map(({ description: _d, fabricDetails: _f, occasion: _o, care: _c, ...p }) => ({
    ...p,
    images: (p.images || []).slice(0, 1),
  }));
  return {
    items: rows.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: list.length,
    totalPages: Math.max(1, Math.ceil(list.length / limit)),
  };
}

export function adminStats() {
  const all = shaped();
  const needs = all.filter(attention);
  return {
    total: all.length,
    published: all.filter((p) => p.status === 'published').length,
    drafts: all.filter((p) => p.status !== 'published').length,
    outOfStock: all.filter((p) => !p.inStock).length,
    lowStock: needs.filter((p) => p.inStock).length,
    categories: new Set(all.map((p) => p.category)).size,
    attentionCount: needs.length,
    attention: needs.slice(0, 10),
    recent: [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3),
  };
}

export const adminProduct = (id) => shaped().find((p) => p._id === id) || null;
