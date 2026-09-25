import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import { CardSkeleton, GridCard } from '../../components/public/ProductCards';
import { Button, Card, EmptyState, PageContainer } from '../../components/ui';
import { api, keys } from '../../lib/api';
import { removeSaved, useSaved } from '../../lib/wishlist';
import { useToast } from '../../context/Toast';
import { LoadError } from './Home';

const GRID = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4';

/** A saved design that was deleted or hidden by the shop. */
function Unavailable({ item, onRemove }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-outline-variant/25 bg-surface-container-low p-3 min-h-[200px]">
      <div>
        <p className="font-title-md text-[14px] text-on-surface line-clamp-2">{item.name || 'Saved design'}</p>
        <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">No longer available</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRemove} className="w-full mt-3">
        Remove
      </Button>
    </div>
  );
}

/** Guests: saved slugs live on this phone; load each design (cached, shared with the product page). */
function useGuestItems(slugs) {
  const results = useQueries({
    queries: slugs.slice(0, 60).map((slug) => ({
      queryKey: keys.product(slug),
      queryFn: () => api(`/products/${encodeURIComponent(slug)}`),
      retry: false,
    })),
  });
  return {
    loading: results.some((r) => r.isPending),
    items: results.map((r, i) => (r.data ? r.data : r.isError ? { slug: slugs[i], unavailable: true } : null)).filter(Boolean),
  };
}

export default function Saved() {
  const toast = useToast();
  const saved = useSaved();
  const guest = useGuestItems(saved.signedIn ? [] : saved.localSlugs);
  const items = saved.signedIn ? saved.items : guest.items;
  const loading = saved.signedIn ? saved.loading : guest.loading;
  const count = saved.count;

  const remove = async (item) => {
    if (!saved.signedIn) return saved.toggle(item);
    try {
      await removeSaved(item._id);
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="Saved Designs" subtitle={`${count} saved`} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Saved Designs</h1>
        <span className="font-label-lg text-label-lg text-secondary">{count} saved</span>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1 space-y-4">
        {!saved.signedIn && count > 0 && (
          <Card className="flex items-center justify-between gap-3">
            <p className="font-body-sm text-body-sm text-on-surface">Log in to keep your saved designs on every device.</p>
            <Button as={Link} to="/login?next=%2Fsaved" size="sm" className="px-4 shrink-0">
              Log in
            </Button>
          </Card>
        )}
        {saved.error && !items.length ? (
          <LoadError error={saved.error} onRetry={saved.reload} />
        ) : loading ? (
          <div className={GRID}>
            {[0, 1].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : items.length ? (
          <div className={GRID}>
            {items.map((p) =>
              p.unavailable ? <Unavailable key={p._id || p.slug} item={p} onRemove={() => remove(p)} /> : <GridCard key={p._id} p={p} />
            )}
          </div>
        ) : (
          <EmptyState
            icon="favorite"
            title="Nothing saved yet"
            body="Tap the heart on any design to keep it here for later."
            bodyClassName="max-w-[260px]"
          >
            <Link
              to="/collection"
              className="mt-4 bg-primary-container text-white px-5 py-2.5 rounded-xl font-label-lg text-label-lg tracking-wide active:scale-95 transition-all"
            >
              Browse designs
            </Link>
          </EmptyState>
        )}
      </PageContainer>
      <BottomNav />
    </div>
  );
}
