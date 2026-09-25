import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { MAX_WISHLIST, Wishlist } from '../models/Wishlist.js';
import { HttpError } from '../utils/HttpError.js';
import { CARD_FIELDS } from './catalogService.js';

const toId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid product.');
  return new mongoose.Types.ObjectId(String(id));
};

/** Makes sure the user's (empty) wishlist exists. */
const ensure = (userId) => Wishlist.updateOne({ userId }, { $setOnInsert: { items: [] } }, { upsert: true });

/**
 * Saved designs as product cards, newest first. Deleted or unpublished products stay in the list with
 * `unavailable: true` so the customer sees "No longer available" and can remove them.
 */
export async function getWishlist(userId) {
  const doc = await Wishlist.findOne({ userId }).lean();
  const items = [...(doc?.items || [])].sort((a, b) => b.addedAt - a.addedAt);
  if (!items.length) return { items: [], count: 0 };
  const products = await Product.find({ _id: { $in: items.map((i) => i.productId) } }, { ...CARD_FIELDS, status: 1 }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const out = items.map(({ productId, addedAt }) => {
    const p = byId.get(String(productId));
    if (!p) return { _id: String(productId), unavailable: true, addedAt };
    const { status, ...card } = p;
    return status === 'published' ? { ...card, addedAt } : { ...card, addedAt, unavailable: true };
  });
  return { items: out, count: out.length };
}

/** Idempotent: saving twice keeps one entry. */
export async function addItem(userId, rawProductId) {
  const productId = toId(rawProductId);
  if (!(await Product.exists({ _id: productId, status: 'published' }))) throw new HttpError(404, 'Product not found.');
  await ensure(userId);
  const pushed = await Wishlist.updateOne(
    { userId, 'items.productId': { $ne: productId }, [`items.${MAX_WISHLIST - 1}`]: { $exists: false } },
    { $push: { items: { productId, addedAt: new Date() } } }
  );
  if (!pushed.modifiedCount) {
    const already = await Wishlist.exists({ userId, 'items.productId': productId });
    if (!already) throw new HttpError(400, `You can save up to ${MAX_WISHLIST} designs.`);
  }
  return getWishlist(userId);
}

/** Idempotent: removing something that isn't saved is fine. */
export async function removeItem(userId, rawProductId) {
  const productId = toId(rawProductId);
  await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });
  return getWishlist(userId);
}

/**
 * Adds a guest's saved slugs (newest first, as stored on the phone) to the account.
 * Unknown/unpublished slugs are skipped, duplicates ignored, and the list is capped at MAX_WISHLIST (oldest dropped).
 */
export async function mergeSlugs(userId, rawSlugs) {
  const slugs = [
    ...new Set((Array.isArray(rawSlugs) ? rawSlugs : []).filter((s) => typeof s === 'string' && s).map((s) => s.slice(0, 200))),
  ].slice(0, MAX_WISHLIST);
  await ensure(userId);
  if (slugs.length) {
    const products = await Product.find({ slug: { $in: slugs }, status: 'published' }, { slug: 1 }).lean();
    const idBySlug = new Map(products.map((p) => [p.slug, p._id]));
    const doc = await Wishlist.findOne({ userId }).lean();
    const have = new Set(doc.items.map((i) => String(i.productId)));
    const now = Date.now();
    // Keep the phone's order: the first slug is the most recent save.
    const incoming = slugs
      .map((slug, i) => ({ productId: idBySlug.get(slug), addedAt: new Date(now - i) }))
      .filter((i) => i.productId && !have.has(String(i.productId)));
    if (incoming.length) {
      const merged = [...incoming, ...doc.items].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX_WISHLIST);
      await Wishlist.updateOne({ userId }, { $set: { items: merged } });
    }
  }
  return getWishlist(userId);
}
