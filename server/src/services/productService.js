import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { slugify } from '../utils/slugify.js';
import { PRODUCT_DEFAULTS, commerceDefaults, sanitizeProduct, validateProduct } from '../validators/product.js';
import { shapeProduct } from './productShape.js';
import { getSettings } from './settingsService.js';
import { destroyImages } from '../integrations/cloudinary.js';

const SORT = { displayOrder: 1, createdAt: -1 };

// Accepts a Mongo _id (admin screens) or a slug (public URLs).
const byIdOrSlug = (id) => (/^[a-f0-9]{24}$/i.test(id) ? { _id: new mongoose.Types.ObjectId(id) } : { slug: String(id) });

export function listProducts({ includeDrafts }) {
  return Product.find(includeDrafts ? {} : { status: 'published' })
    .sort(SORT)
    .limit(500)
    .lean();
}

export async function findProductOr404(id) {
  const doc = await Product.findOne(byIdOrSlug(id)).lean();
  if (!doc) throw new HttpError(404, 'Product not found.');
  return doc;
}

async function uniqueSlug(base) {
  let slug = base;
  for (let i = 2; await Product.exists({ slug }); i++) slug = `${base}-${i}`;
  return slug;
}

/** Same message as the unique index would give, checked first so it wins over SKU clashes. */
async function assertCodeFree(code, exceptId) {
  const clash = await Product.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (clash) throw new HttpError(409, 'Another product already uses this product code.');
}

/** 409 with the clashing SKUs when another product already uses one of them (the unique index is the backstop). */
async function assertSkusFree(sizes, exceptId) {
  const skus = sizes.map((s) => s.sku).filter(Boolean);
  if (!skus.length) return;
  const clash = await Product.findOne({ 'sizes.sku': { $in: skus }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .select('code sizes.sku')
    .lean();
  if (!clash) return;
  const taken = clash.sizes.map((s) => s.sku).filter((s) => skus.includes(s));
  throw new HttpError(409, `Another product (${clash.code}) already uses SKU ${taken.join(', ')}.`, { code: 'SKU_TAKEN', skus: taken });
}

/** Drops request-only fields before writing. */
const storable = ({ freeSizeStock: _legacy, ...rest }) => rest;

export async function createProduct(body) {
  const input = sanitizeProduct(body);
  const { defaultTaxRatePercent } = await getSettings();
  const data = { ...PRODUCT_DEFAULTS, ...commerceDefaults(input.category, defaultTaxRatePercent), ...input };
  const shaped = { ...data, ...shapeProduct(data) };
  validateProduct(shaped);
  await assertCodeFree(shaped.code);
  await assertSkusFree(shaped.sizes);
  const doc = await Product.create({ ...storable(shaped), slug: await uniqueSlug(slugify(data.name)) });
  return doc.toObject();
}

export async function updateProduct(id, body) {
  const existing = await findProductOr404(id);
  const changes = sanitizeProduct(body);
  const merged = { ...existing, ...changes };
  // Sizes and derived fields are recomputed on every update (price changes move discountPercent, etc.).
  // Stored `reserved` and SKUs are kept; changing the code never rewrites an existing SKU.
  const shaped = { ...merged, ...shapeProduct(merged, existing.sizes) };
  validateProduct(shaped);
  await assertCodeFree(shaped.code, existing._id);
  await assertSkusFree(shaped.sizes, existing._id);
  const { _id, createdAt, updatedAt, slug, ...set } = storable(shaped);
  const updated = await Product.findOneAndUpdate(
    { _id: existing._id },
    { $set: set, $unset: { freeSizeStock: '' } },
    { new: true, lean: true }
  );
  // Remove photos that were taken off the product from Cloudinary (fire and forget).
  if (changes.images) {
    const kept = new Set(changes.images.map((i) => i.publicId));
    destroyImages((existing.images || []).map((i) => i.publicId).filter((pid) => pid && !kept.has(pid)));
  }
  return updated;
}

export async function deleteProduct(id) {
  const existing = await findProductOr404(id);
  await Product.deleteOne({ _id: existing._id });
  await destroyImages((existing.images || []).map((i) => i.publicId));
}
