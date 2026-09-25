import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import Drawer from '../../components/public/Drawer';
import HeroCarousel from '../../components/public/HeroCarousel';
import CategoryTiles from '../../components/public/CategoryTiles';
import Footer from '../../components/public/Footer';
import { CardSkeleton, GridCard, RailCard } from '../../components/public/ProductCards';
import Icon from '../../components/shared/Icon';
import ScrollToHash from '../../components/shared/ScrollToHash';
import { useProducts, useSettings } from '../../lib/api';
import { DESK } from '../../lib/constants';

export function LoadError({ error, onRetry }) {
  return (
    <div className="mx-margin-mobile md:mx-auto md:max-w-md rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
      <p className="font-body-sm text-body-sm text-on-surface">{error?.message || 'The catalogue could not load.'}</p>
      <button onClick={onRetry} className="mt-2 font-label-lg text-label-lg text-primary underline" type="button">
        Try again
      </button>
    </div>
  );
}

export default function Home() {
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  const { data: products, loading, error, reload } = useProducts();
  const { data: settings } = useSettings();
  const list = products || [];
  const newArrivals = (list.some((p) => p.isNewArrival) ? list.filter((p) => p.isNewArrival) : list).slice(0, 8);
  const featured = (list.some((p) => p.isFeatured) ? list.filter((p) => p.isFeatured) : list).slice(0, 8);

  return (
    <div className="w-full flex flex-col pb-24 md:pb-0">
      <ScrollToHash ready={!loading} />
      <Header onMenu={() => setDrawer(true)} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} />
      <main className="flex-1 flex flex-col w-full">
        <HeroCarousel banners={settings?.banners} />

        {/* New Arrivals */}
        <section className="mt-space-lg md:mt-space-xl">
          <div className={`flex items-baseline justify-between px-margin-mobile mb-space-sm md:mb-space-md ${DESK}`}>
            <div>
              <h2 className="font-headline-sm text-headline-sm md:text-headline-md text-primary font-medium">New Arrivals</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant -mt-0.5">Fresh artisanal weavings from Varanasi &amp; Chanderi</p>
            </div>
            <Link to="/collection?filter=new" className="flex items-center gap-0.5 text-secondary hover:text-primary font-label-md text-label-md font-semibold transition-colors shrink-0">
              <span>View all</span>
              <Icon name="chevron_right" className="text-sm font-semibold" />
            </Link>
          </div>
          {error && !products ? (
            <LoadError error={error} onRetry={reload} />
          ) : (
            <div className={`flex gap-3 md:gap-4 px-margin-mobile overflow-x-auto no-scrollbar scroll-smooth pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible ${DESK}`}>
              {loading && !products
                ? [0, 1, 2].map((i) => <CardSkeleton key={i} rail />)
                : newArrivals.map((p) => <RailCard key={p._id} p={p} />)}
              {!loading && products && !list.length && (
                <p className="font-body-sm text-body-sm text-on-surface-variant py-6">New designs are on their way. Check back soon.</p>
              )}
            </div>
          )}
        </section>

        <CategoryTiles products={list} />

        <Footer settings={settings || {}} />
      </main>
      <BottomNav />
    </div>
  );
}
