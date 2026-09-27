// Stock holds for orders. Every change is a compare-and-set on the product's `rev`, so two customers buying the last
// piece at the same moment can never both succeed. No multi-document transaction is needed (works on every Atlas tier):
// a multi-item hold that fails part-way is undone item by item.
//
//   reserve  → reserved += qty            (order placed; hidden from other customers via available = stock − reserved)
//   release  → reserved −= qty            (order cancelled / payment not completed)
//   commit   → stock −= qty, reserved −= qty   (order shipped: the pieces left the shop)
//   restock  → stock += qty               (return received / returned by courier)
import { Product } from '../models/Product.js';
import { HttpError } from '../utils/HttpError.js';
import { available, FREE_LABEL, shapeProduct } from './productShape.js';

const MAX_ATTEMPTS = 8;
const pause = (attempt) => new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * attempt));
export const sizeName = (label) => (label === FREE_LABEL ? 'Free Size' : label);

class StockError extends HttpError {
  constructor(message, detail) {
    super(409, message, { code: 'OUT_OF_STOCK', ...detail });
  }
}

/** Applies `change(row)` → { stock, reserved } to one size of one product, retrying on concurrent writes. */
async function adjust(productId, size, change, { mustExist = true } = {}) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const doc = await Product.findById(productId).lean();
    if (!doc) {
      if (mustExist) throw new StockError('This design is no longer available.', { productId: String(productId), size });
      return null;
    }
    const row = (doc.sizes || []).find((s) => s.label === size);
    if (!row) {
      if (mustExist)
        throw new StockError(`Size ${sizeName(size)} is no longer available for ${doc.name}.`, { productId: String(productId), size });
      return null;
    }
    const next = change(row, doc);
    const sizes = doc.sizes.map((s) => (s.label === size ? { ...s, stock: next.stock, reserved: next.reserved } : s));
    // No `previous` sizes: reserved comes from the rows we just computed.
    const shaped = shapeProduct({ ...doc, sizes }, []);
    const res = await Product.updateOne({ _id: doc._id, rev: doc.rev ?? null }, { $set: shaped, $inc: { rev: 1 } });
    if (res.modifiedCount === 1) return shaped;
    await pause(attempt + 1);
  }
  throw new HttpError(503, 'The shop is very busy right now. Please try again.', { code: 'STOCK_BUSY' });
}

const clampInt = (n) => Math.max(0, Math.round(Number(n) || 0));

/** Holds stock for every line or none of them. Lines: [{ productId, size, qty, name? }]. */
export async function reserveLines(lines) {
  const done = [];
  try {
    for (const line of lines) {
      await adjust(line.productId, line.size, (row, doc) => {
        const left = available(row);
        if (doc.status !== 'published')
          throw new StockError(`${doc.name} is no longer available.`, { productId: String(doc._id), size: line.size });
        if (left < line.qty) {
          const msg =
            left > 0 ? `Only ${left} left of ${doc.name} (${sizeName(line.size)}).` : `${doc.name} (${sizeName(line.size)}) just sold out.`;
          throw new StockError(msg, { productId: String(doc._id), size: line.size, available: left });
        }
        return { stock: row.stock, reserved: clampInt(row.reserved) + line.qty };
      });
      done.push(line);
    }
  } catch (e) {
    await releaseLines(done);
    throw e;
  }
}

export async function releaseLines(lines) {
  for (const line of lines) {
    await adjust(line.productId, line.size, (row) => ({ stock: row.stock, reserved: clampInt(row.reserved - line.qty) }), {
      mustExist: false,
    });
  }
}

export async function commitLines(lines) {
  for (const line of lines) {
    await adjust(
      line.productId,
      line.size,
      (row) => ({ stock: clampInt(row.stock - line.qty), reserved: clampInt(row.reserved - line.qty) }),
      { mustExist: false }
    );
  }
}

export async function restockLines(lines) {
  for (const line of lines) {
    await adjust(line.productId, line.size, (row) => ({ stock: clampInt(row.stock) + line.qty, reserved: clampInt(row.reserved) }), {
      mustExist: false,
    });
  }
}
