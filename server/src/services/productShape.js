// The ONE place that shapes a product's sizes and derived fields. Create, update, stock updates, the migration and
// the seed all call shapeProduct() — never compute totalStock / inStock / availableSizes / discountPercent elsewhere.

export const FREE_LABEL = 'FREE';

/** "SC-2025-037" + "XL" → "SC-2025-037-XL"; spaces become dashes, anything else odd is dropped. */
export function makeSku(code, label) {
  if (!code) return ''; // no code yet: validation reports the missing code instead
  return `${code}-${label}`
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/** Units that can still be sold for one size. */
export const available = (s) => Math.max(0, (Number(s?.stock) || 0) - (Number(s?.reserved) || 0));

/**
 * Returns the stored `sizes` array.
 *  - free size → exactly one { label: 'FREE' } row (from an existing FREE row, the first row, or legacy freeSizeStock)
 *  - sized     → one row per label, FREE rows dropped
 * `previous` (the stored sizes) keeps `reserved` and existing SKUs: changing the product code never rewrites a SKU.
 */
export function normalizeSizes(p, previous = []) {
  const prev = new Map((previous || []).map((s) => [s.label, s]));
  const row = (s, label) => {
    const old = prev.get(label);
    return {
      label,
      sku: s?.sku || old?.sku || makeSku(p.code || '', label),
      stock: Math.max(0, Math.round(Number(s?.stock) || 0)),
      reserved: Math.max(0, Math.round(Number(old?.reserved ?? s?.reserved) || 0)),
    };
  };
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  if (p.sizeType !== 'sized') {
    const src = sizes.find((s) => s.label === FREE_LABEL) || sizes[0];
    const legacy = src ? src.stock : p.freeSizeStock;
    return [row({ ...src, stock: legacy }, FREE_LABEL)];
  }
  return sizes.filter((s) => s.label && s.label !== FREE_LABEL).map((s) => row(s, s.label));
}

export function discountPercent(mrp, price) {
  return mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
}

/** Denormalised fields kept on every product document (used by list queries and indexes). */
export function derive(p) {
  const sizes = p.sizes || [];
  const totalStock = sizes.reduce((sum, s) => sum + available(s), 0);
  return {
    totalStock,
    inStock: totalStock > 0,
    availableSizes: sizes.filter((s) => available(s) > 0).map((s) => s.label),
    discountPercent: discountPercent(Number(p.mrp) || 0, Number(p.price) || 0),
  };
}

/** Full shape: normalised sizes + derived fields. */
export function shapeProduct(p, previousSizes = []) {
  const sizes = normalizeSizes(p, previousSizes);
  return { sizes, ...derive({ ...p, sizes }) };
}

/** Low-stock rule shared with client/src/lib/stock.js: available units at or below the product's threshold. */
export const lowStockLimit = (p) => (p?.lowStockThreshold > 0 ? p.lowStockThreshold : 2);
