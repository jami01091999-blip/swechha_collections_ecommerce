// All stock rules live here so the customer site and admin always agree.

export const threshold = (p) => (p?.lowStockThreshold > 0 ? p.lowStockThreshold : 2);

/** Rows to display: one "Free Size" row, or one row per size. */
export function sizeRows(p) {
  if (!p) return [];
  if (p.sizeType === 'sized') return p.sizes || [];
  return [{ label: 'Free Size', stock: Number(p.freeSizeStock) || 0 }];
}

export function sizeState(stock, limit) {
  if (stock <= 0) return 'out';
  if (stock <= limit) return 'low';
  return 'in';
}

export function totalStock(p) {
  return sizeRows(p).reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
}

export const isOutOfStock = (p) => totalStock(p) <= 0;

export function stockSummary(p) {
  const limit = threshold(p);
  const rows = sizeRows(p);
  const out = rows.filter((s) => s.stock <= 0).map((s) => s.label);
  const low = rows.filter((s) => s.stock > 0 && s.stock <= limit);
  const available = rows.filter((s) => s.stock > 0).map((s) => s.label);
  return { out, low, available, total: totalStock(p), needsAttention: out.length > 0 || low.length > 0 };
}

/**
 * Chip text + tone for the admin "Needs Attention" list, following the design examples:
 *  "S, XXL out of stock" (red) · "XL: Only 1 left · XXL: Out" (amber) · "Free Size · 0 in stock" (red)
 */
export function attentionChip(p) {
  const { out, low, total } = stockSummary(p);
  if (p.sizeType !== 'sized') {
    if (total <= 0) return { tone: 'red', text: 'Free Size · 0 in stock' };
    if (low.length) return { tone: 'amber', text: `Free Size · Only ${total} left` };
    return null;
  }
  if (total <= 0) return { tone: 'red', text: 'All sizes out of stock' };
  if (!low.length && out.length) return { tone: 'red', text: `${out.join(', ')} out of stock` };
  if (low.length) {
    const parts = low.map((s) => `${s.label}: Only ${s.stock} left`);
    if (out.length) parts.push(`${out.join(', ')}: Out`);
    return { tone: 'amber', text: parts.join(' · ') };
  }
  return null;
}
