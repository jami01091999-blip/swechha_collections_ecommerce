const TONES = {
  red: 'bg-error-container/70 text-error font-semibold',
  amber: 'bg-secondary-fixed/60 text-on-secondary-container font-semibold',
  green: 'text-emerald-800 bg-emerald-50 border border-emerald-200/60',
  grey: 'text-on-surface-variant bg-surface-container-high border border-outline-variant/40',
};
const DOTS = { red: 'bg-error', amber: 'bg-secondary', green: 'bg-emerald-600', grey: 'bg-outline' };

/** Dot + label chip (Needs Attention / Recently Added rows). Tones: red · amber · green · grey. */
export function ToneChip({ tone = 'grey', children }) {
  return (
    <span className={`inline-flex items-center gap-1 font-label-md text-label-md px-2 py-0.5 rounded-full ${TONES[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

/** Published / Draft. */
export function StatusChip({ status }) {
  return status === 'published' ? <ToneChip tone="green">Published</ToneChip> : <ToneChip tone="grey">Draft</ToneChip>;
}

/** Available / Low Stock / Not Available for one size row. */
export function StockStateChip({ stock, limit }) {
  if (stock <= 0) return <ToneChip tone="red">Not Available</ToneChip>;
  if (stock <= limit) return <ToneChip tone="amber">Low Stock</ToneChip>;
  return <ToneChip tone="green">Available</ToneChip>;
}
