import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { slugify } from '../utils/slugify.js';
import { PRODUCT_DEFAULTS, sanitizeProduct, validateProduct } from '../validators/product.js';
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

export async function createProduct(body) {
  const data = { ...PRODUCT_DEFAULTS, ...sanitizeProduct(body) };
  validateProduct(data);
  const doc = await Product.create({ ...data, slug: await uniqueSlug(slugify(data.name)) });
  return doc.toObject();
}

export async function updateProduct(id, body) {
  const existing = await findProductOr404(id);
  const changes = sanitizeProduct(body);
  validateProduct({ ...existing, ...changes });
  const updated = await Product.findOneAndUpdate({ _id: existing._id }, { $set: changes }, { new: true, lean: true });
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
