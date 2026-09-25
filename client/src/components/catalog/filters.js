// Collection filters live in the URL so back/forward and shared links work.
// URL params: category, q, sort, min, max, sizes (comma list), instock=1, filter=new|featured, discount=10|20|30
import { categoryMeta } from '../../lib/constants';
import { formatINR } from '../../lib/format';

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Biggest discount' },
];
const SORT_VALUES = new Set(SORT_OPTIONS.map((o) => o.value));
// Links from before Phase 2 used new / low / high.
const OLD_SORTS = { new: 'newest', low: 'price_asc', high: 'price_desc' };

export const PRICE_PRESETS = [
  { key: 'under-5000', label: 'Under ₹5,000', max: 4999 },
  { key: '5000-10000', label: '₹5,000–10,000', min: 5000, max: 9999 },
  { key: '10000-20000', label: '₹10,000–20,000', min: 10000, max: 19999 },
  { key: '20000-plus', label: 'Above ₹20,000', min: 20000 },
];
export const DISCOUNTS = [10, 20, 30];

export const EMPTY_FILTERS = {
  category: '',
  q: '',
  sort: 'recommended',
  min: '',
  max: '',
  sizes: [],
  instock: false,
  filter: '',
  discount: '',
};

const wholeNumber = (v) => (/^\d{1,8}$/.test(String(v ?? '')) ? String(Number(v)) : '');

/** URLSearchParams → filter state (unknown or bad values are dropped). */
export function readFilters(params) {
  const sort = OLD_SORTS[params.get('sort')] || params.get('sort');
  const filter = params.get('filter');
  const discount = Number(params.get('discount'));
  return {
    category: params.get('category') || '',
    q: (params.get('q') || '').slice(0, 80),
    sort: SORT_VALUES.has(sort) ? sort : 'recommended',
    min: wholeNumber(params.get('min')),
    max: wholeNumber(params.get('max')),
    sizes: [
      ...new Set(
        (params.get('sizes') || '')
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      ),
    ],
    instock: params.get('instock') === '1',
    filter: filter === 'new' || filter === 'featured' ? filter : '',
    discount: DISCOUNTS.includes(discount) ? String(discount) : '',
  };
}

/** Filter state → URLSearchParams (defaults left out so URLs stay short). */
export function writeFilters(f) {
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.q) p.set('q', f.q);
  if (f.sort && f.sort !== 'recommended') p.set('sort', f.sort);
  if (f.min) p.set('min', f.min);
  if (f.max) p.set('max', f.max);
  if (f.sizes?.length) p.set('sizes', f.sizes.join(','));
  if (f.instock) p.set('instock', '1');
  if (f.filter) p.set('filter', f.filter);
  if (f.discount) p.set('discount', f.discount);
  return p;
}

/** Filter state → /api/products query object. */
export function toApiParams(f) {
  return {
    category: f.category,
    q: f.q,
    sort: f.sort === 'recommended' ? '' : f.sort,
    minPrice: f.min,
    maxPrice: f.max,
    sizes: f.sizes.join(','),
    inStock: f.instock ? '1' : '',
    filter: f.filter,
    minDiscount: f.discount,
    limit: 24,
  };
}

export const sizeLabel = (s) => (s === 'FREE' ? 'Free Size' : s);

export const presetFor = (f) => PRICE_PRESETS.find((p) => String(p.min ?? '') === f.min && String(p.max ?? '') === f.max);

/** Chips for the "applied filters" row: [{ key, label, clear: (f) => f' }]. Search words and sort are not chips. */
export function appliedFilters(f) {
  const chips = [];
  if (f.category) chips.push({ key: 'category', label: categoryMeta(f.category).label, clear: (x) => ({ ...x, category: '' }) });
  if (f.min || f.max) {
    const preset = presetFor(f);
    const label =
      preset?.label ||
      (f.min && f.max ? `${formatINR(f.min)}–${formatINR(f.max)}` : f.min ? `From ${formatINR(f.min)}` : `Up to ${formatINR(f.max)}`);
    chips.push({ key: 'price', label, clear: (x) => ({ ...x, min: '', max: '' }) });
  }
  for (const s of f.sizes)
    chips.push({ key: `size-${s}`, label: `Size ${sizeLabel(s)}`, clear: (x) => ({ ...x, sizes: x.sizes.filter((y) => y !== s) }) });
  if (f.instock) chips.push({ key: 'instock', label: 'In stock', clear: (x) => ({ ...x, instock: false }) });
  if (f.discount) chips.push({ key: 'discount', label: `${f.discount}%+ off`, clear: (x) => ({ ...x, discount: '' }) });
  if (f.filter)
    chips.push({ key: 'filter', label: f.filter === 'new' ? 'New arrivals' : 'Featured', clear: (x) => ({ ...x, filter: '' }) });
  return chips;
}

/** Everything except the search words and sort order. */
export const clearFilters = (f) => ({ ...EMPTY_FILTERS, q: f.q, sort: f.sort });
