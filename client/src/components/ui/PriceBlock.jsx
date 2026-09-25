import { discountPercent, formatINR } from '../../lib/format';

/**
 * Price, struck-through MRP and "% OFF" badge. The discount is only shown when MRP is above the price.
 *  - rail: New Arrivals rail card   - grid: collection grid card   - pdp: product page
 */
export default function PriceBlock({ price, mrp, variant = 'grid' }) {
  const off = discountPercent(mrp, price);

  if (variant === 'rail') {
    return (
      <div className="mt-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between">
        <div>
          <span className="font-title-md text-title-md text-primary font-semibold">{formatINR(price)}</span>
          {off > 0 && <span className="font-body-sm text-body-sm text-outline line-through ml-1">{formatINR(mrp)}</span>}
        </div>
        {off > 0 && (
          <span className="bg-primary/10 text-primary font-label-md text-label-md font-semibold px-1.5 py-0.5 rounded">{off}% OFF</span>
        )}
      </div>
    );
  }

  if (variant === 'pdp') {
    return (
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-headline-sm text-[22px] font-semibold text-primary">{formatINR(price)}</span>
        {off > 0 && (
          <>
            <span className="font-body-sm text-[13px] text-outline line-through">MRP {formatINR(mrp)}</span>
            <span className="bg-primary/10 text-primary font-label-md text-[11px] font-semibold px-2 py-0.5 rounded">{off}% OFF</span>
          </>
        )}
        <span className="text-[10px] text-outline ml-auto">Inclusive of all taxes</span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-outline-variant/20 flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between">
        <span className="font-title-md text-[15px] text-primary font-semibold">{formatINR(price)}</span>
        {off > 0 && <span className="bg-primary/10 text-primary font-label-md text-[9px] font-semibold px-1 rounded">{off}% OFF</span>}
      </div>
      {off > 0 && <span className="font-body-sm text-[11px] text-outline line-through">MRP {formatINR(mrp)}</span>}
    </div>
  );
}
