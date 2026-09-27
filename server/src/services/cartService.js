// The signed-in customer's bag. Guests keep their bag on the device and call previewBag() to price it;
// at sign-in the device bag is merged here with mergeBag().
import mongoose from 'mongoose';
import { Cart, MAX_CART_LINES, MAX_LINE_QTY } from '../models/Cart.js';
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { available } from './productShape.js';
import { bagSummary, priceLines, sizeLabel } from './pricingService.js';

const oid = (id, message = 'Invalid product.') => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, message);
  return new mongoose.Types.ObjectId(String(id));
};

async function loadCart(userId) {
  return (await Cart.findOneAndUpdate({ userId }, { $setOnInsert: { items: [] } }, { upsert: true, new: true })) || null;
}

export async function pricedCart(cartDoc) {
  const items = [...(cartDoc?.items || [])].sort((a, b) => b.addedAt - a.addedAt);
  const lines = await priceLines(items.map((i) => ({ _id: i._id, productId: i.productId, size: i.size, qty: i.qty })));
  return { items: lines, summary: bagSummary(lines) };
}

export async function getCart(userId) {
  return pricedCart(await Cart.findOne({ userId }).lean());
}

/** Product + size must exist, be published and have enough stock for `qty`. Returns the allowed maximum. */
async function checkLine(productId, size, qty) {
  const p = await Product.findOne({ _id: productId }, { name: 1, status: 1, sizes: 1, maxQtyPerOrder: 1 }).lean();
  if (!p || p.status !== 'published') throw new HttpError(404, 'This design is no longer available.');
  const row = (p.sizes || []).find((s) => s.label === size);
  if (!row) throw new HttpError(400, 'Choose a size.', { code: 'SIZE_REQUIRED' });
  const left = available(row);
  const perOrder = Math.min(p.maxQtyPerOrder > 0 ? p.maxQtyPerOrder : 5, MAX_LINE_QTY);
  if (left <= 0) throw new HttpError(409, `${sizeLabel(size)} is sold out.`, { code: 'OUT_OF_STOCK' });
  if (qty > left) throw new HttpError(409, `Only ${left} left in ${sizeLabel(size)}.`, { code: 'OUT_OF_STOCK', available: left });
  if (qty > perOrder) throw new HttpError(400, `You can buy up to ${perOrder} of this design per order.`, { code: 'MAX_QTY' });
  return Math.min(left, perOrder);
}

export async function addItem(userId, { productId, size, qty = 1 }) {
  const pid = oid(productId);
  const cart = await loadCart(userId);
  const existing = cart.items.find((i) => i.productId.equals(pid) && i.size === size);
  const wanted = (existing?.qty || 0) + qty;
  await checkLine(pid, size, wanted);
  if (existing) existing.qty = wanted;
  else {
    if (cart.items.length >= MAX_CART_LINES) throw new HttpError(400, `Your bag can hold up to ${MAX_CART_LINES} different items.`);
    cart.items.push({ productId: pid, size, qty, addedAt: new Date() });
  }
  await cart.save();
  return pricedCart(cart.toObject());
}

export async function updateItem(userId, itemId, { qty, size }) {
  const cart = await loadCart(userId);
  const item = cart.items.id(itemId);
  if (!item) throw new HttpError(404, 'This item is no longer in your bag.');
  const nextSize = size ?? item.size;
  const nextQty = qty ?? item.qty;
  const twin =
    size && size !== item.size ? cart.items.find((i) => i !== item && i.productId.equals(item.productId) && i.size === size) : null;
  const finalQty = twin ? twin.qty + nextQty : nextQty;
  await checkLine(item.productId, nextSize, finalQty);
  if (twin) {
    twin.qty = finalQty;
    item.deleteOne();
  } else {
    item.size = nextSize;
    item.qty = nextQty;
  }
  await cart.save();
  return pricedCart(cart.toObject());
}

export async function removeItem(userId, itemId) {
  await Cart.updateOne({ userId }, { $pull: { items: { _id: oid(itemId, 'Invalid item.') } } });
  return getCart(userId);
}

export async function clearCart(userId) {
  await Cart.updateOne({ userId }, { $set: { items: [] } });
  return getCart(userId);
}

/**
 * Adds the device bag to the account. Quantities are summed with what is already there and trimmed to what is
 * available; lines that can't be bought are skipped. Returns the priced bag and how many lines were added/changed.
 */
export async function mergeBag(userId, lines) {
  const cart = await loadCart(userId);
  let merged = 0;
  for (const l of lines) {
    if (!mongoose.isValidObjectId(l.productId)) continue;
    const pid = new mongoose.Types.ObjectId(String(l.productId));
    const existing = cart.items.find((i) => i.productId.equals(pid) && i.size === l.size);
    let max;
    try {
      max = await checkLine(pid, l.size, 1);
    } catch {
      continue; // sold out / gone: skip quietly, the device bag shows it until cleared
    }
    const qty = Math.min((existing?.qty || 0) + l.qty, max);
    if (existing) {
      if (qty !== existing.qty) merged++;
      existing.qty = qty;
    } else if (cart.items.length < MAX_CART_LINES) {
      cart.items.push({ productId: pid, size: l.size, qty, addedAt: new Date() });
      merged++;
    }
  }
  await cart.save();
  return { ...(await pricedCart(cart.toObject())), merged };
}

/** Prices a guest's device bag (no account needed). */
export async function previewBag(lines) {
  const priced = await priceLines(lines.map((l, i) => ({ _id: l.key || String(i), productId: l.productId, size: l.size, qty: l.qty })));
  return { items: priced, summary: bagSummary(priced) };
}

/** After an order from the bag is confirmed: removes what was bought (quantities subtracted). */
export async function removeOrderedLines(userId, orderedLines = []) {
  if (!orderedLines.length) return;
  const cart = await Cart.findOne({ userId });
  if (!cart) return;
  for (const o of orderedLines) {
    const item = cart.items.find((i) => i.productId.equals(o.productId) && i.size === o.size);
    if (!item) continue;
    if (item.qty <= o.qty) item.deleteOne();
    else item.qty -= o.qty;
  }
  await cart.save();
}
