import { Link } from 'react-router-dom';
import Img from '../shared/Img';
import { ALL_COLLECTIONS_TILE, CATEGORIES, DESK } from '../../lib/constants';

/** Shop by Category — 2-column grid of 6 tiles, counts and photos come from real products. */
export default function CategoryTiles({ products = [] }) {
  const total = products.length;
  const allTile = ALL_COLLECTIONS_TILE;

  return (
    <section className={`mt-space-lg md:mt-space-xl px-margin-mobile ${DESK}`}>
      <div className="mb-space-sm">
        <h2 className="font-headline-sm text-headline-sm md:text-headline-md text-primary font-medium">Shop by Category</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Explore our artisanal repertoire &amp; heritage crafts</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <Link
          to="/collection"
          className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 group cursor-pointer shadow-sm"
        >
          <Img src={allTile.img} alt={allTile.label} width={400} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-col">
            <span className="font-headline-sm text-[17px] md:text-[19px] text-surface-container-lowest font-medium">{allTile.label}</span>
            <span className="font-label-md text-[10px] text-secondary-fixed opacity-90 line-clamp-1">{allTile.blurb}</span>
            <span className="mt-1 font-label-md text-[10px] text-surface-container-highest/80">
              {total ? `${total} design${total === 1 ? '' : 's'}` : 'Coming soon'}
            </span>
          </div>
        </Link>

        {CATEGORIES.map((c) => {
          const items = products.filter((p) => p.category === c.key);
          return (
            <Link
              key={c.key}
              to={`/collection?category=${encodeURIComponent(c.key)}`}
              className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30 group cursor-pointer shadow-sm"
            >
              <Img src={c.img} alt={c.label} width={400} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-col">
                <span className="font-headline-sm text-[17px] md:text-[19px] text-surface-container-lowest font-medium">{c.label}</span>
                <span className="font-label-md text-[10px] text-secondary-fixed opacity-90 line-clamp-1">{c.blurb}</span>
                <span className="mt-1 font-label-md text-[10px] text-surface-container-highest/80">
                  {items.length ? `${items.length} design${items.length === 1 ? '' : 's'}` : 'Coming soon'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
