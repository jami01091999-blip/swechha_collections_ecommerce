// Small building blocks shared by the bag, checkout and order pages (Stitch tokens only).
import { Link } from 'react-router-dom';
import { formatINR } from '../../lib/format';
import { Card, cx } from '../ui';
import Img from '../shared/Img';

export const sizeName = (s) => (s === 'FREE' ? 'Free Size' : s);

/** Label/value rows for money. `rows`: [label, amount | string, { strong, tone }]. */
export function PriceRows({ rows }) {
  return (
    <dl className="space-y-1.5 font-body-sm text-[13px]">
      {rows.filter(Boolean).map(([label, value, opts = {}]) => (
        <div
          key={label}
          className={cx(
            'flex items-baseline justify-between gap-3',
            opts.strong && 'pt-2 mt-1 border-t border-outline-variant/30 text-[15px] font-semibold text-primary'
          )}
        >
          <dt className={opts.strong ? '' : 'text-on-surface-variant'}>{label}</dt>
          <dd className={cx(opts.tone === 'green' && 'text-emerald-700 font-medium', !opts.strong && !opts.tone && 'text-on-surface')}>
            {typeof value === 'number' ? formatINR(value) : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Order price breakdown from a quote/order `pricing` object. */
export function OrderTotals({ pricing, title = 'Price details' }) {
  if (!pricing) return null;
  return (
    <Card>
      <h2 className="font-headline-sm text-[17px] text-primary mb-2">{title}</h2>
      <PriceRows
        rows={[
          ['Items (MRP)', pricing.mrpTotal ?? pricing.subtotal],
          pricing.mrpTotal > pricing.subtotal && [
            'Discount on MRP',
            `−${formatINR(pricing.mrpTotal - pricing.subtotal)}`,
            { tone: 'green' },
          ],
          pricing.discount > 0 && [
            `Coupon${pricing.couponCode ? ` ${pricing.couponCode}` : ''}`,
            `−${formatINR(pricing.discount)}`,
            { tone: 'green' },
          ],
          ['Delivery', pricing.shipping ? formatINR(pricing.shipping) : 'Free', pricing.shipping ? {} : { tone: 'green' }],
          pricing.codFee > 0 && ['Cash on delivery fee', pricing.codFee],
          ['Total', pricing.total, { strong: true }],
        ]}
      />
      {pricing.savings > 0 && (
        <p className="mt-2 font-label-md text-label-md text-emerald-700 font-semibold">
          You save {formatINR(pricing.savings)} on this order
        </p>
      )}
    </Card>
  );
}

/** Phone: bar pinned to the bottom (replaces the tab bar on bag/checkout). Laptop: nothing (actions sit in the page). */
export function StickyBar({ children }) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 w-full max-w-[480px] mx-auto z-50 bg-surface/95 backdrop-blur-md px-margin-mobile py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-outline-variant/30 shadow-[0_-6px_20px_rgba(78,5,26,0.08)]">
      {children}
    </div>
  );
}

/** Thumbnail + name + size × qty, used in checkout and order pages. */
export function ItemRow({ item, right }) {
  const body = (
    <>
      <div className="w-14 h-[74px] rounded-lg overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30">
        <Img src={item.image} alt={item.name} width={160} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-title-md text-[14px] text-on-surface leading-tight line-clamp-2">{item.name}</p>
        <p className="font-label-md text-label-md text-on-surface-variant mt-1">
          {sizeName(item.size)} · Qty {item.buyQty ?? item.qty}
        </p>
      </div>
      {right}
    </>
  );
  return item.slug ? (
    <Link to={`/product/${item.slug}`} className="flex items-start gap-3">
      {body}
    </Link>
  ) : (
    <div className="flex items-start gap-3">{body}</div>
  );
}

/** Customer-facing order status words and chip tones. */
export const ORDER_STATUS = {
  pending_payment: ['Awaiting payment', 'amber'],
  confirmed: ['Confirmed', 'green'],
  packed: ['Packed', 'green'],
  shipped: ['Shipped', 'green'],
  out_for_delivery: ['Out for delivery', 'green'],
  delivered: ['Delivered', 'green'],
  cancelled: ['Cancelled', 'grey'],
  rto: ['Returned to us', 'grey'],
};
export const PAYMENT_STATUS = {
  pending: 'Awaiting payment',
  paid: 'Paid online',
  failed: 'Payment failed',
  refund_pending: 'Refund on its way',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
  cod_pending: 'Pay on delivery',
  cod_collected: 'Paid on delivery',
};
export const RETURN_STATUS = {
  requested: 'Return requested',
  approved: 'Return approved — pickup soon',
  rejected: 'Return not approved',
  picked_up: 'Return picked up',
  received: 'Return received',
  refunded: 'Refund issued',
  exchanged: 'Exchange arranged',
  closed: 'Return closed',
};

export const formatDate = (d, opts = {}) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...opts }) : '';
export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
export const etaText = (delivery) =>
  delivery?.etaDate
    ? `Delivery by ${new Date(delivery.etaDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
    : '';
