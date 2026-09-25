// Not routed yet (visiting /saved shows the 404 page). Wishlist sync arrives in Phase 2.
import { Link } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import { CardSkeleton, GridCard } from '../../components/public/ProductCards';
import { EmptyState, PageContainer } from '../../components/ui';
import { useProducts } from '../../lib/api';
import { useSaved } from '../../lib/wishlist';

export default function Saved() {
  const saved = useSaved();
  const { data: products, loading } = useProducts();
  const items = saved.map((slug) => products?.find((p) => p.slug === slug)).filter(Boolean);
  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="Saved Designs" subtitle={`${items.length} saved`} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Saved Designs</h1>
        <span className="font-label-lg text-label-lg text-secondary">{items.length} saved</span>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1">
        {loading && !products ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {[0, 1].map((i) => (
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
          <EmptyState icon="favorite" title="Nothing saved yet" body="Tap the heart on any design to keep it here for later." bodyClassName="max-w-[260px]">
            <Link to="/collection" className="mt-4 bg-primary-container text-white px-5 py-2.5 rounded-xl font-label-lg text-label-lg tracking-wide active:scale-95 transition-all">
              Browse designs
            </Link>
          </EmptyState>
        )}
      </PageContainer>
      <BottomNav />
    </div>
  );
}
