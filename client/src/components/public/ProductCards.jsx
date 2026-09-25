import { Link } from 'react-router-dom';
import Img from '../shared/Img';
import { coverImage, formatINR } from '../../lib/format';
import { PriceBlock, Skeleton } from '../ui';
import { isOutOfStock } from '../../lib/stock';

function OutOfStockOverlay() {
  return (
    <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px] flex items-center justify-center p-2 z-10">
      <span className="bg-surface-container-lowest/90 text-on-surface font-label-md text-label-md px-3 py-1 rounded-full uppercase tracking-wider font-semibold shadow-sm border border-outline-variant/40">
        Out of Stock
      </span>
    </div>
  );
}

/** New Arrivals rail card (200px wide, 3:4 image) — Stitch "Card 1" markup. */
export function RailCard({ p }) {
  const out = isOutOfStock(p);
  return (
    <Link
      to={`/product/${p.slug}`}
      className="shrink-0 w-[200px] md:w-[230px] lg:w-auto flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer relative group"
    >
      <div className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden">
        <Img
          src={coverImage(p)}
          alt={p.name}
          width={420}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {out ? (
          <OutOfStockOverlay />
        ) : (
          p.isNewArrival && (
            <span className="absolute top-2 left-2 bg-secondary text-surface-container-lowest font-label-md text-label-md px-2 py-0.5 rounded-full tracking-wide">
              New
            </span>
          )
        )}
      </div>
      <div className={`p-2.5 flex flex-col flex-1 justify-between ${out ? 'opacity-80' : ''}`}>
        <div>
          <span className="font-label-md text-label-md text-secondary block font-medium line-clamp-1">{p.fabric}</span>
          <h3 className="font-title-md text-title-md text-on-surface mt-0.5 line-clamp-1 group-hover:text-primary transition-colors">
            {p.name}
          </h3>
        </div>
        <PriceBlock variant="rail" price={p.price} mrp={p.mrp} />
      </div>
    </Link>
  );
}

/** Featured Masterpieces grid card — Stitch "Card A" markup. */
export function GridCard({ p }) {
  const out = isOutOfStock(p);
  return (
    <Link
      to={`/product/${p.slug}`}
      className="flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group"
    >
      <div className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden">
        <Img
          src={coverImage(p)}
          alt={p.name}
          width={400}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {out && <OutOfStockOverlay />}
      </div>
      <div className={`p-2.5 flex flex-col flex-1 justify-between ${out ? 'opacity-80' : ''}`}>
        <div>
          <span className="font-label-md text-[10px] text-secondary block font-medium line-clamp-1">{p.fabric}</span>
          <h3 className="font-title-md text-[14px] leading-tight text-on-surface mt-0.5 line-clamp-1 group-hover:text-primary transition-colors">
            {p.name}
          </h3>
        </div>
        <PriceBlock variant="grid" price={p.price} mrp={p.mrp} />
      </div>
    </Link>
  );
}

/** "You May Also Like" mini card (140px). */
export function MiniCard({ p }) {
  return (
    <Link
      to={`/product/${p.slug}`}
      className="shrink-0 w-[140px] md:w-[180px] flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-sm active:scale-95 transition-all cursor-pointer"
    >
      <div className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden">
        <Img src={coverImage(p)} alt={p.name} width={300} className="w-full h-full object-cover" />
      </div>
      <div className="p-2 flex flex-col justify-between flex-1">
        <h4 className="font-title-md text-[12px] text-on-surface line-clamp-1">{p.name}</h4>
        <span className="font-label-md text-[12px] font-semibold text-primary mt-1">{formatINR(p.price)}</span>
      </div>
    </Link>
  );
}

export function CardSkeleton({ rail = false }) {
  return (
    <div
      className={`${rail ? 'shrink-0 w-[200px] md:w-[230px] lg:w-auto' : ''} flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden`}
    >
      <Skeleton tone="low" className="w-full aspect-[3/4]" />
      <div className="p-2.5 space-y-2">
        <Skeleton className="h-2.5 w-2/3 rounded" />
        <Skeleton className="h-3.5 w-4/5 rounded" />
        <Skeleton className="h-3.5 w-1/2 rounded mt-3" />
      </div>
    </div>
  );
}
