import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import CategoryChips from '../../components/public/CategoryChips';
import { CardSkeleton, GridCard } from '../../components/public/ProductCards';
import FilterPanel from '../../components/catalog/FilterPanel';
import SearchBox from '../../components/catalog/SearchBox';
import { SORT_OPTIONS, appliedFilters, clearFilters, readFilters, toApiParams, writeFilters } from '../../components/catalog/filters';
import Icon from '../../components/shared/Icon';
import { useCatalog, useCatalogCount } from '../../lib/api';
import { categoryMeta } from '../../lib/constants';
import { Button, Chip, EmptyState, PageContainer, RadioList, Sheet } from '../../components/ui';
import { LoadError } from './Home';

const designs = (n) => `${n} design${n === 1 ? '' : 's'}`;

/** Calls `onVisible` when the element scrolls near the viewport (auto "load more"). */
function useNearBottom(ref, onVisible, enabled) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, onVisible, enabled]);
}

/** Phone: full-height filter sheet with a live "Show N designs" count for the not-yet-applied choices. */
function FilterSheet({ initial, onApply, onClose }) {
  const [draft, setDraft] = useState(initial);
  const { total, facets, loading } = useCatalogCount(toApiParams(draft));
  return (
    <Sheet
      full
      label="Filter"
      onClose={onClose}
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => setDraft(clearFilters(draft))}>
            Clear all
          </Button>
          <Button onClick={() => onApply(draft)} disabled={total === 0}>
            {total === undefined ? 'Show designs' : total === 0 ? 'No designs match' : `Show ${designs(total)}`}
            {loading && total !== undefined ? '…' : ''}
          </Button>
        </div>
      }
    >
      <h2 className="font-headline-sm text-headline-sm text-primary">Filter</h2>
      <FilterPanel value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} facets={facets} />
    </Sheet>
  );
}

export default function Collection() {
  const [params, setParams] = useSearchParams();
  const f = readFilters(params);
  const { items, total, facets, loading, error, reload, fetchNext, hasMore, loadingMore } = useCatalog(toApiParams(f));
  const [sheet, setSheet] = useState(null); // 'sort' | 'filter'
  const searchRef = useRef(null);
  const sentinel = useRef(null);
  useNearBottom(sentinel, fetchNext, hasMore && !loadingMore);

  useEffect(() => {
    if (params.get('search') === '1') searchRef.current?.focus();
  }, [params]);

  // Filters are replaced in history (Back leaves the collection instead of undoing each filter).
  const apply = (next) => setParams(writeFilters(next), { replace: true });
  const update = (patch) => apply({ ...f, ...patch });

  const chips = appliedFilters(f);
  const title = f.category
    ? categoryMeta(f.category).label
    : f.filter === 'new'
      ? 'New Arrivals'
      : f.filter === 'featured'
        ? 'Featured Masterpieces'
        : f.q
          ? `Results for “${f.q}”`
          : 'All Designs';
  const count = total !== undefined ? designs(total) : '';
  const sortLabel = SORT_OPTIONS.find((o) => o.value === f.sort)?.label;

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title={title} subtitle={count || 'Lookbook'} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">{title}</h1>
        {count && <span className="font-label-lg text-label-lg text-secondary">{count}</span>}
      </PageContainer>

      <PageContainer className="px-margin-mobile pt-3">
        <div className="md:max-w-md">
          <SearchBox
            initial={f.q}
            inputRef={searchRef}
            placeholder="Search by name, fabric or colour"
            onSearch={(q) => update({ q })}
            inputClassName="w-full rounded-xl border border-[#EBE5DD] bg-[#FAF6F0] pl-10 pr-3 py-2.5 font-body-sm text-[14px] text-on-surface placeholder:text-outline/70 focus:border-[#C59B6A] focus:ring-0"
          />
        </div>
      </PageContainer>

      {/* Phone: category chips, then a sticky Sort / Filter bar */}
      <div className="md:hidden pt-2">
        <CategoryChips value={f.category} onChange={(c) => update({ category: c })} />
      </div>
      <div className="md:hidden sticky top-[57px] z-30 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-margin-mobile py-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={() => setSheet('sort')} className="flex items-center justify-center gap-1.5">
          <Icon name="swap_vert" className="text-[18px]" /> Sort
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setSheet('filter')} className="flex items-center justify-center gap-1.5">
          <Icon name="tune" className="text-[18px]" /> Filter{chips.length ? ` (${chips.length})` : ''}
        </Button>
      </div>

      <PageContainer
        as="main"
        className="px-margin-mobile flex-1 md:grid md:grid-cols-[13rem_1fr] lg:grid-cols-[15rem_1fr] md:gap-8 md:items-start pt-3 md:pt-4"
      >
        {/* Laptop: filters on the left */}
        <aside className="hidden md:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar pr-1" aria-label="Filters">
          <FilterPanel value={f} onChange={update} facets={facets} />
        </aside>

        <section aria-label="Designs">
          <div className="hidden md:flex items-center justify-between gap-3 pb-3">
            <span className="font-body-sm text-body-sm text-on-surface-variant">{count}</span>
            <label className="relative shrink-0">
              <span className="sr-only">Sort</span>
              <select
                value={f.sort}
                onChange={(e) => update({ sort: e.target.value })}
                className="appearance-none bg-none rounded-full border border-outline-variant/30 bg-surface-container-lowest pl-3 pr-8 py-1.5 font-label-md text-label-md text-on-surface focus:border-[#C59B6A] focus:ring-0"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-base text-outline" />
            </label>
          </div>

          {(chips.length > 0 || f.q) && (
            <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar md:flex-wrap">
              {f.q && (
                <Chip kind="toggle" active onClick={() => update({ q: '' })} aria-label={`Remove search ${f.q}`}>
                  “{f.q}” ✕
                </Chip>
              )}
              {chips.map((c) => (
                <Chip key={c.key} kind="toggle" active onClick={() => apply(c.clear(f))} aria-label={`Remove ${c.label}`}>
                  {c.label} ✕
                </Chip>
              ))}
              {chips.length > 0 && (
                <button
                  type="button"
                  onClick={() => apply(clearFilters(f))}
                  className="shrink-0 font-label-md text-label-md text-secondary underline px-1"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {error && !items.length ? (
            <LoadError error={error} onRetry={reload} />
          ) : loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {[0, 1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : items.length ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {items.map((p) => (
                  <GridCard key={p._id} p={p} />
                ))}
                {loadingMore && [0, 1].map((i) => <CardSkeleton key={`more-${i}`} />)}
              </div>
              <div ref={sentinel} className="h-px" aria-hidden="true" />
              {hasMore && !loadingMore && (
                <div className="flex justify-center pt-5">
                  <Button variant="secondary" size="sm" onClick={() => fetchNext()} className="px-8">
                    Load more designs
                  </Button>
                </div>
              )}
              {!hasMore && total > 24 && (
                <p className="text-center font-body-sm text-[12px] text-on-surface-variant pt-5">You've seen all {designs(total)}.</p>
              )}
            </>
          ) : (
            <EmptyState icon="search_off" title="No designs match" body="Try another word or clear the filters.">
              <button
                onClick={() => apply({ ...clearFilters(f), q: '' })}
                className="mt-3 font-label-lg text-label-lg text-secondary underline"
                type="button"
              >
                Clear filters
              </button>
            </EmptyState>
          )}
        </section>
      </PageContainer>
      <BottomNav />

      {sheet === 'sort' && (
        <Sheet label="Sort" onClose={() => setSheet(null)}>
          <h2 className="font-headline-sm text-headline-sm text-primary">Sort by</h2>
          <RadioList
            label="Sort by"
            value={f.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => {
              update({ sort });
              setSheet(null);
            }}
          />
        </Sheet>
      )}
      {sheet === 'filter' && (
        <FilterSheet
          initial={f}
          onClose={() => setSheet(null)}
          onApply={(next) => {
            apply(next);
            setSheet(null);
          }}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {sortLabel && count ? `${count}, sorted by ${sortLabel}` : ''}
      </span>
    </div>
  );
}
