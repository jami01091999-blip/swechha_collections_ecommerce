import { Link } from 'react-router-dom';
import Img from '../shared/Img';
import { coverImage, discountPercent, formatINR } from '../../lib/format';
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
  const off = discountPercent(p.mrp, p.price);
  const out = isOutOfStock(p);
  return (
    <Link
      to={`/product/${p.slug}`}
      className="shrink-0 w-[200px] md:w-[230px] lg:w-auto flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer relative group"
    >
      <div className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden">
        <Img src={coverImage(p)} alt={p.name} width={420} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {out ? (
          <OutOfStockOverlay />
        ) : (
          p.isNewArrival && (
            <span className="absolute top-2 left-2 bg-secondary text-surface-container-lowest font-label-md text-label-md px-2 py-0.5 rounded-full tracking-wide">New</span>
          )
        )}
      </div>
      <div className={`p-2.5 flex flex-col flex-1 justify-between ${out ? 'opacity-80' : ''}`}>
        <div>
          <span className="font-label-md text-label-md text-secondary block font-medium line-clamp-1">{p.fabric}</span>
          <h3 className="font-title-md text-title-md text-on-surface mt-0.5 line-clamp-1 group-hover:text-primary transition-colors">{p.name}</h3>
        </div>
        <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between">
          <div>
            <span className="font-title-md text-title-md text-primary font-semibold">{formatINR(p.price)}</span>
            {off > 0 && <span className="font-body-sm text-body-sm text-outline line-through ml-1">{formatINR(p.mrp)}</span>}
          </div>
          {off > 0 && <span className="bg-primary/10 text-primary font-label-md text-label-md font-semibold px-1.5 py-0.5 rounded">{off}% OFF</span>}
        </div>
      </div>
    </Link>
  );
}

/** Featured Masterpieces grid card — Stitch "Card A" markup. */
export function GridCard({ p }) {
  const off = discountPercent(p.mrp, p.price);
  const out = isOutOfStock(p);
  return (
    <Link
      to={`/product/${p.slug}`}
      className="flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group"
    >
      <div className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden">
        <Img src={coverImage(p)} alt={p.name} width={400} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {out && <OutOfStockOverlay />}
      </div>
      <div className={`p-2.5 flex flex-col flex-1 justify-between ${out ? 'opacity-80' : ''}`}>
        <div>
          <span className="font-label-md text-[10px] text-secondary block font-medium line-clamp-1">{p.fabric}</span>
          <h3 className="font-title-md text-[14px] leading-tight text-on-surface mt-0.5 line-clamp-1 group-hover:text-primary transition-colors">{p.name}</h3>
        </div>
        <div className="mt-2 pt-2 border-t border-outline-variant/20 flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between">
            <span className="font-title-md text-[15px] text-primary font-semibold">{formatINR(p.price)}</span>
            {off > 0 && <span className="bg-primary/10 text-primary font-label-md text-[9px] font-semibold px-1 rounded">{off}% OFF</span>}
          </div>
          {off > 0 && <span className="font-body-sm text-[11px] text-outline line-through">MRP {formatINR(p.mrp)}</span>}
        </div>
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
    <div className={`${rail ? 'shrink-0 w-[200px] md:w-[230px] lg:w-auto' : ''} flex flex-col bg-surface-container-lowest rounded-xl border border-outline-variant/25 overflow-hidden`}>
      <div className="w-full aspect-[3/4] bg-surface-container-low animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-2.5 w-2/3 rounded bg-surface-container animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-surface-container animate-pulse" />
        <div className="h-3.5 w-1/2 rounded bg-surface-container animate-pulse mt-3" />
      </div>
    </div>
  );
}
