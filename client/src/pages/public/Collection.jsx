import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import CategoryChips from '../../components/public/CategoryChips';
import { CardSkeleton, GridCard } from '../../components/public/ProductCards';
import Icon from '../../components/shared/Icon';
import { useProducts } from '../../lib/api';
import { categoryMeta } from '../../lib/constants';
import { Chip, EmptyState, PageContainer } from '../../components/ui';
import { isOutOfStock } from '../../lib/stock';
import { LoadError } from './Home';

const SORTS = [
  { key: 'new', label: 'Newest' },
  { key: 'low', label: 'Price: Low to High' },
  { key: 'high', label: 'Price: High to Low' },
];

export default function Collection() {
  const [params, setParams] = useSearchParams();
  const { data: products, loading, error, reload } = useProducts();
  const category = params.get('category') || '';
  const filter = params.get('filter') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'new';
  const inStock = params.get('instock') === '1';
  const searchRef = useRef(null);

  useEffect(() => {
    if (params.get('search') === '1') searchRef.current?.focus();
  }, [params]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.delete('search');
    setParams(next, { replace: true });
  };

  const items = useMemo(() => {
    let list = products || [];
    if (category) list = list.filter((p) => p.category === category);
    if (filter === 'new') list = list.filter((p) => p.isNewArrival);
    if (filter === 'featured') list = list.filter((p) => p.isFeatured);
    if (inStock) list = list.filter((p) => !isOutOfStock(p));
    if (q) {
      const needle = q.toLowerCase();
      list = list.filter((p) =>
        [p.name, p.fabric, p.code, p.category, ...(p.colors || []).map((c) => c.name)].some((s) => s?.toLowerCase().includes(needle))
      );
    }
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, filter, q, sort, inStock]);

  const title = category ? categoryMeta(category).label : filter === 'new' ? 'New Arrivals' : filter === 'featured' ? 'Featured Masterpieces' : 'All Designs';

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title={title} subtitle={products ? `${items.length} design${items.length === 1 ? '' : 's'}` : 'Lookbook'} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">{title}</h1>
        {products && <span className="font-label-lg text-label-lg text-secondary">{items.length} design{items.length === 1 ? '' : 's'}</span>}
      </PageContainer>
      <PageContainer className="px-margin-mobile pt-3">
        <label className="relative block md:max-w-md">
          <span className="sr-only">Search the catalogue</span>
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl" />
          <input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search by name, fabric or colour"
            className="w-full rounded-xl border border-[#EBE5DD] bg-[#FAF6F0] pl-10 pr-3 py-2.5 font-body-sm text-[14px] text-on-surface placeholder:text-outline/70 focus:border-[#C59B6A] focus:ring-0"
          />
        </label>
      </PageContainer>
      <div className="pt-2 md:[&_div]:justify-start">
        <CategoryChips value={category} onChange={(c) => update({ category: c })} />
      </div>
      <PageContainer className="flex items-center gap-2 px-margin-mobile pt-1 pb-3 md:pb-5 overflow-x-auto no-scrollbar">
        <label className="relative shrink-0">
          <span className="sr-only">Sort</span>
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value === 'new' ? '' : e.target.value })}
            className="appearance-none bg-none rounded-full border border-outline-variant/30 bg-surface-container-lowest pl-3 pr-8 py-1.5 font-label-md text-label-md text-on-surface focus:border-[#C59B6A] focus:ring-0"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-base text-outline" />
        </label>
        <Chip kind="toggle" active={inStock} onClick={() => update({ instock: inStock ? '' : '1' })} aria-pressed={inStock}>
          In stock only
        </Chip>
        {filter && (
          <Chip kind="toggle" active onClick={() => update({ filter: '' })}>
            {filter === 'new' ? 'New' : 'Featured'} ✕
          </Chip>
        )}
      </PageContainer>

      <PageContainer as="main" className="px-margin-mobile flex-1">
        {error && !products ? (
          <LoadError error={error} onRetry={reload} />
        ) : loading && !products ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {items.map((p) => (
              <GridCard key={p._id} p={p} />
            ))}
          </div>
        ) : (
          <EmptyState icon="search_off" title="No designs match" body="Try another word or clear the filters.">
            <button onClick={() => setParams({}, { replace: true })} className="mt-3 font-label-lg text-label-lg text-secondary underline" type="button">
              Clear filters
            </button>
          </EmptyState>
        )}
      </PageContainer>
      <BottomNav />
    </div>
  );
}
