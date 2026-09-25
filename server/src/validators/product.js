import { z } from 'zod';
import { HttpError } from '../utils/HttpError.js';

// Keep in step with client/src/lib/constants.js CATEGORIES.
export const CATEGORIES = [
  'Sarees',
  'Lehengas',
  'Kurti',
  'Leggings',
  'Tops',
  'Co-Ord sets',
  'Dresses(3-pcs)',
  'Frocks',
  'Night dresses',
  'Bamboo night dresses',
];

/** Package defaults per category (grams / cm); editable per product. */
export const CATEGORY_DEFAULTS = {
  Sarees: { weightGrams: 700 },
  Lehengas: { weightGrams: 1500 },
  Kurti: { weightGrams: 400 },
  Leggings: { weightGrams: 250 },
  Tops: { weightGrams: 250 },
  'Co-Ord sets': { weightGrams: 500 },
  'Dresses(3-pcs)': { weightGrams: 600 },
  Frocks: { weightGrams: 400 },
  'Night dresses': { weightGrams: 350 },
  'Bamboo night dresses': { weightGrams: 350 },
};
export const DEFAULT_WEIGHT_GRAMS = 500;
export const DEFAULT_DIMENSIONS_CM = { l: 30, b: 25, h: 5 };
export const DEFAULT_TAX_RATE_PERCENT = 5;

/** Shipping/tax defaults for a new product in this category. */
export function commerceDefaults(category, taxRatePercent = DEFAULT_TAX_RATE_PERCENT) {
  return {
    weightGrams: CATEGORY_DEFAULTS[category]?.weightGrams ?? DEFAULT_WEIGHT_GRAMS,
    dimensionsCm: { ...DEFAULT_DIMENSIONS_CM },
    hsnCode: '',
    taxRatePercent,
    isCodAllowed: true,
    isReturnable: true,
    maxQtyPerOrder: 5,
  };
}
export const BLOUSE_PIECE_OPTIONS = ['Included (Unstitched)', 'Included (Stitched)', 'Not included'];

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).trim().slice(0, max));
const int = (v, { min = 0, max = 10_000_000 } = {}) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};
const bool = (v) => v === true || v === 'true';
const num = (v, { min = 0, max = 100 } = {}) => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const strList = (v, maxItems = 12, maxLen = 200) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [])
    .map((s) => str(s, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

const FIELD_SANITIZERS = {
  name: (v) => str(v, 120),
  code: (v) => str(v, 40).toUpperCase(),
  category: (v) => str(v, 120),
  fabric: (v) => str(v, 120),
  badge: (v) => str(v, 40),
  mrp: (v) => int(v),
  price: (v) => int(v),
  images: (v) =>
    (Array.isArray(v) ? v : [])
      .map((img) => ({ url: str(img?.url, 1000), publicId: str(img?.publicId, 300) }))
      .filter((img) => /^https:\/\//i.test(img.url))
      .slice(0, 12),
  colors: (v) =>
    (Array.isArray(v) ? v : [])
      .map((c) => ({
        name: str(c?.name, 60),
        hex: /^#[0-9a-f]{6}$/i.test(c?.hex) ? c.hex.toLowerCase() : '#6b1d2f',
        productSlug: str(c?.productSlug, 80),
      }))
      .filter((c) => c.name)
      .slice(0, 12),
  sizeType: (v) => (v === 'sized' ? 'sized' : 'free'),
  // Legacy input (before Phase 2): still accepted and turned into the FREE size row; never stored.
  freeSizeStock: (v) => int(v, { max: 100000 }),
  // `reserved` is never accepted from a request: checkout manages it.
  sizes: (v) => {
    const seen = new Set();
    return (Array.isArray(v) ? v : [])
      .map((s) => ({
        label: str(s?.label, 12).toUpperCase(),
        sku: str(s?.sku, 60).toUpperCase().replace(/\s+/g, '-'),
        stock: int(s?.stock, { max: 100000 }),
      }))
      .filter((s) => s.label && !seen.has(s.label) && seen.add(s.label))
      .slice(0, 20);
  },
  lowStockThreshold: (v) => int(v, { min: 1, max: 100 }),
  sareeDetails: (v) => ({
    sareeLength: str(v?.sareeLength, 40),
    blousePiece: BLOUSE_PIECE_OPTIONS.includes(v?.blousePiece) ? v.blousePiece : '',
    blouseLength: str(v?.blouseLength, 40),
    blouseFabric: str(v?.blouseFabric, 80),
  }),
  description: (v) => str(v, 2000),
  fabricDetails: (v) => strList(v),
  occasion: (v) => str(v, 1000),
  care: (v) => strList(v),
  status: (v) => (v === 'published' ? 'published' : 'draft'),
  isNewArrival: bool,
  isFeatured: bool,
  displayOrder: (v) => int(v, { max: 9999 }),
  weightGrams: (v) => int(v, { min: 1, max: 50000 }),
  dimensionsCm: (v) => ({
    l: int(v?.l, { min: 1, max: 500 }),
    b: int(v?.b, { min: 1, max: 500 }),
    h: int(v?.h, { min: 1, max: 500 }),
  }),
  hsnCode: (v) => str(v, 8).replace(/\s/g, ''),
  taxRatePercent: (v) => num(v, { min: 0, max: 28 }),
  isCodAllowed: bool,
  isReturnable: bool,
  maxQtyPerOrder: (v) => int(v, { min: 1, max: 20 }),
};

/** Whitelist + coerce fields. Only keys present in the body are returned (defaults fill the rest on create). */
export function sanitizeProduct(body) {
  const out = {};
  for (const [key, fn] of Object.entries(FIELD_SANITIZERS)) {
    if (body && key in body) out[key] = fn(body[key]);
  }
  return out;
}

export const PRODUCT_DEFAULTS = {
  badge: '',
  mrp: 0,
  images: [],
  colors: [],
  sizeType: 'free',
  sizes: [],
  lowStockThreshold: 2,
  sareeDetails: { sareeLength: '', blousePiece: '', blouseLength: '', blouseFabric: '' },
  description: '',
  fabricDetails: [],
  occasion: '',
  care: [],
  status: 'draft',
  isNewArrival: false,
  isFeatured: false,
  displayOrder: 0,
};

/** Validate a complete (merged) product before it is written. */
export function validateProduct(p) {
  const problems = [];
  if (!p.name) problems.push('Product name is required.');
  if (!p.code) problems.push('Product code is required.');
  if (!p.category) problems.push('Category is required.');
  if (!p.fabric) problems.push('Fabric line is required.');
  if (!p.price || p.price <= 0) problems.push('Selling price must be more than 0.');
  if (p.mrp && p.mrp < p.price) problems.push('MRP cannot be lower than the selling price.');
  if (p.sizeType === 'sized' && (!p.sizes || p.sizes.length === 0)) problems.push('Add at least one size, or switch to Free Size.');
  if (p.status === 'published' && (!p.images || p.images.length === 0)) problems.push('Add at least one photo before publishing.');
  if (p.hsnCode && !/^\d{4,8}$/.test(p.hsnCode)) problems.push('HSN code has 4 to 8 digits.');
  const skus = (p.sizes || []).map((s) => s.sku).filter(Boolean);
  if (skus.some((s) => !/^[A-Z0-9][A-Z0-9-]{0,59}$/.test(s))) problems.push('SKUs can use letters, numbers and dashes.');
  if (new Set(skus).size !== skus.length) problems.push('Each size needs its own SKU.');
  const underReserved = (p.sizes || []).filter((s) => s.stock < (s.reserved || 0));
  for (const s of underReserved)
    problems.push(`${s.label === 'FREE' ? 'Free Size' : s.label}: stock can't be below the ${s.reserved} reserved for orders.`);
  if (problems.length) throw new HttpError(400, problems.join(' '));
}

/** Route params / query shapes (bodies keep the field sanitisers above). */
export const productIdParams = z.object({ id: z.string().min(1).max(200) });
export const productListQuery = z.object({ all: z.string().optional() }).passthrough();
