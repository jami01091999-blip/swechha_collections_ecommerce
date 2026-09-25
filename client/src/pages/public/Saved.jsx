import { Link } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import { CardSkeleton, GridCard } from '../../components/public/ProductCards';
import Icon from '../../components/shared/Icon';
import { useProducts } from '../../lib/api';
import { useSaved } from '../../lib/wishlist';
import { DESK } from '../../lib/constants';

export default function Saved() {
  const saved = useSaved();
  const { data: products, loading } = useProducts();
  const items = saved.map((slug) => products?.find((p) => p.slug === slug)).filter(Boolean);
  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="Saved Designs" subtitle={`${items.length} saved`} />
      <div className={`hidden md:flex items-baseline justify-between pt-8 pb-2 ${DESK}`}>
        <h1 className="font-headline-md text-headline-md text-primary">Saved Designs</h1>
        <span className="font-label-lg text-label-lg text-secondary">{items.length} saved</span>
      </div>
      <main className={`px-margin-mobile pt-4 flex-1 ${DESK}`}>
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
          <div className="flex flex-col items-center text-center py-16 px-6">
            <Icon name="favorite" className="text-4xl text-outline" />
            <p className="font-headline-sm text-[18px] text-primary mt-2">Nothing saved yet</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-[260px]">Tap the heart on any design to keep it here for later.</p>
            <Link to="/collection" className="mt-4 bg-primary-container text-white px-5 py-2.5 rounded-xl font-label-lg text-label-lg tracking-wide active:scale-95 transition-all">
              Browse designs
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
