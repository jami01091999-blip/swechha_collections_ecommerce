// Prices every bag/checkout line from the database and computes totals. Nothing here trusts the client.
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { MAX_LINE_QTY } from '../models/Cart.js';
import { available, FREE_LABEL, lowStockLimit } from './productShape.js';
import { round2, rupees } from '../utils/money.js';

const LINE_FIELDS = {
  name: 1,
  slug: 1,
  fabric: 1,
  category: 1,
  price: 1,
  mrp: 1,
  images: 1,
  sizes: 1,
  status: 1,
  maxQtyPerOrder: 1,
  isCodAllowed: 1,
  isReturnable: 1,
  taxRatePercent: 1,
  hsnCode: 1,
  weightGrams: 1,
  lowStockThreshold: 1,
};

export const sizeLabel = (label) => (label === FREE_LABEL ? 'Free Size' : label);
export const BUYABLE = new Set(['ok', 'qty_reduced']);

/**
 * rawLines: [{ _id?, productId, size, qty }] → priced lines with live price, stock and a status:
 * ok · qty_reduced (fewer left than asked) · out_of_stock · unavailable (deleted/unpublished/size gone).
 */
export async function priceLines(rawLines) {
  const ids = [...new Set(rawLines.map((l) => String(l.productId)).filter((id) => mongoose.isValidObjectId(id)))];
  const products = ids.length ? await Product.find({ _id: { $in: ids } }, LINE_FIELDS).lean() : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return rawLines.map((l) => {
    const p = byId.get(String(l.productId));
    const base = {
      _id: l._id ? String(l._id) : undefined,
      productId: String(l.productId),
      size: l.size,
      sizeLabel: sizeLabel(l.size),
      qty: l.qty,
    };
    if (!p || p.status !== 'published') {
      return {
        ...base,
        name: p?.name || 'This design',
        slug: p?.slug,
        image: p?.images?.[0]?.url || '',
        status: 'unavailable',
        message: 'No longer available',
        buyQty: 0,
        price: p?.price || 0,
        lineTotal: 0,
      };
    }
    const common = {
      ...base,
      slug: p.slug,
      name: p.name,
      fabric: p.fabric,
      category: p.category,
      image: p.images?.[0]?.url || '',
      price: p.price,
      mrp: p.mrp > p.price ? p.mrp : p.price,
      isCodAllowed: p.isCodAllowed !== false,
      isReturnable: p.isReturnable !== false,
      taxRatePercent: Number.isFinite(p.taxRatePercent) ? p.taxRatePercent : 5,
      hsnCode: p.hsnCode || '',
      weightGrams: p.weightGrams || 500,
      sizes: (p.sizes || []).map((s) => ({ label: s.label, sizeLabel: sizeLabel(s.label), available: available(s) })),
    };
    const row = (p.sizes || []).find((s) => s.label === l.size);
    if (!row)
      return {
        ...common,
        status: 'unavailable',
        message: 'This size is no longer offered',
        buyQty: 0,
        lineTotal: 0,
        available: 0,
        maxQty: 0,
      };
    const left = available(row);
    const perOrder = Math.min(p.maxQtyPerOrder > 0 ? p.maxQtyPerOrder : 5, MAX_LINE_QTY);
    const maxQty = Math.min(perOrder, left);
    const sku = row.sku;
    if (left <= 0) return { ...common, sku, status: 'out_of_stock', message: 'Sold out', buyQty: 0, lineTotal: 0, available: 0, maxQty: 0 };
    let status = 'ok';
    let message = left <= lowStockLimit(p) ? `Only ${left} left` : '';
    let buyQty = l.qty;
    if (l.qty > maxQty) {
      status = 'qty_reduced';
      buyQty = maxQty;
      message = maxQty < perOrder ? `Only ${left} left` : `Up to ${perOrder} per order`;
    }
    return { ...common, sku, status, message, buyQty, available: left, maxQty, lineTotal: p.price * buyQty };
  });
}

export function bagSummary(lines) {
  const buyable = lines.filter((l) => BUYABLE.has(l.status));
  const subtotal = buyable.reduce((s, l) => s + l.price * l.buyQty, 0);
  const mrpTotal = buyable.reduce((s, l) => s + l.mrp * l.buyQty, 0);
  return {
    itemCount: buyable.reduce((s, l) => s + l.buyQty, 0),
    lineCount: lines.length,
    subtotal,
    mrpTotal,
    savings: mrpTotal - subtotal,
  };
}

/**
 * Checkout totals. Prices include GST, so tax is carved out of each line (after its share of the coupon discount)
 * for the invoice: CGST+SGST when the delivery state is the business state, IGST otherwise.
 */
export function orderTotals(lines, { shop, discount = 0, paymentMethod, address }) {
  const buyable = lines.filter((l) => BUYABLE.has(l.status));
  const subtotal = buyable.reduce((s, l) => s + l.price * l.buyQty, 0);
  const mrpTotal = buyable.reduce((s, l) => s + l.mrp * l.buyQty, 0);
  const disc = Math.min(rupees(discount), subtotal);
  const afterDiscount = subtotal - disc;
  const freeAbove = shop.freeShippingAbove;
  const shipping = !buyable.length || freeAbove === 0 || afterDiscount >= freeAbove ? 0 : shop.shippingFee;
  const codFee = paymentMethod === 'cod' ? shop.codFee : 0;
  const total = afterDiscount + shipping + codFee;

  let allocated = 0;
  const taxed = buyable.map((l, i) => {
    const lineTotal = l.price * l.buyQty;
    const share = i === buyable.length - 1 ? disc - allocated : subtotal ? Math.round((disc * lineTotal) / subtotal) : 0;
    allocated += share;
    const net = lineTotal - share;
    const rate = l.taxRatePercent || 0;
    const taxableValue = round2(net / (1 + rate / 100));
    return { ...l, lineTotal, discountShare: share, taxableValue, taxAmount: round2(net - taxableValue) };
  });
  return {
    lines: taxed,
    pricing: {
      subtotal,
      mrpTotal,
      discount: disc,
      shipping,
      codFee,
      total,
      taxTotal: round2(taxed.reduce((s, l) => s + l.taxAmount, 0)),
      savings: mrpTotal - subtotal + disc,
      interState: Boolean(address && shop.businessState && address.state !== shop.businessState),
      amountToFreeShipping: shipping > 0 && freeAbove > 0 ? freeAbove - afterDiscount : 0,
    },
  };
}
