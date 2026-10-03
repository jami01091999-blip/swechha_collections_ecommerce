import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import { Button, Card, EmptyState, PageContainer, Select, Skeleton, Stepper, cx } from '../../components/ui';
import Img from '../../components/shared/Img';
import Icon from '../../components/shared/Icon';
import { OrderTotals, StickyBar, sizeName } from '../../components/shop/ShopBits';
import { useBag } from '../../lib/bag';
import { useSaved } from '../../lib/wishlist';
import { useAuth } from '../../lib/auth';
import { useSettings } from '../../lib/api';
import { formatINR } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { LoadError } from './Home';

const TONE = { ok: 'text-primary', qty_reduced: 'text-secondary', out_of_stock: 'text-error', unavailable: 'text-error' };

function BagLine({ line, bag, onSave }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const dead = line.status === 'unavailable' || line.status === 'out_of_stock';
  const sizes = (line.sizes || []).filter((s) => s.available > 0 || s.label === line.size);
  return (
    <Card className={cx('flex gap-3', busy && 'opacity-60')}>
      <Link
        to={line.slug ? `/product/${line.slug}` : '#'}
        className="w-20 md:w-24 aspect-[3/4] rounded-lg overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30"
      >
        <Img src={line.image} alt={line.name} width={240} className={cx('w-full h-full object-cover', dead && 'grayscale')} />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.fabric && <p className="font-label-md text-[10px] text-secondary line-clamp-1">{line.fabric}</p>}
            <Link
              to={line.slug ? `/product/${line.slug}` : '#'}
              className="font-title-md text-[14px] leading-tight text-on-surface line-clamp-2 hover:text-primary"
            >
              {line.name}
            </Link>
          </div>
          <button
            type="button"
            aria-label={`Remove ${line.name}`}
            onClick={() => run(() => bag.remove(line))}
            className="p-1 -mr-1 text-on-surface-variant hover:text-error"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-title-md text-[15px] text-primary font-semibold">{formatINR(line.price)}</span>
          {line.mrp > line.price && <span className="font-body-sm text-[12px] text-outline line-through">{formatINR(line.mrp)}</span>}
        </div>
        {line.message && <p className={cx('font-label-md text-label-md font-semibold mt-1', TONE[line.status])}>{line.message}</p>}
        {!dead ? (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {sizes.length > 1 ? (
              <label className="flex items-center gap-1.5">
                <span className="font-label-md text-label-md text-on-surface-variant">Size</span>
                <Select
                  value={line.size}
                  onChange={(e) => run(() => bag.setSize(line, e.target.value))}
                  className="w-auto py-1.5 pr-8 text-[13px]"
                  aria-label={`Size for ${line.name}`}
                >
                  {sizes.map((s) => (
                    <option key={s.label} value={s.label} disabled={s.available <= 0}>
                      {s.sizeLabel}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <span className="font-label-md text-label-md text-on-surface-variant">Size {sizeName(line.size)}</span>
            )}
            <Stepper
              label={line.name}
              min={1}
              value={line.qty}
              onChange={(q) => {
                if (q > line.maxQty) return toast(line.maxQty < line.qty ? line.message : `Only ${line.maxQty} can be ordered`);
                run(() => bag.setQty(line, q));
              }}
            />
          </div>
        ) : (
          <div className="flex gap-3 mt-2">
            <Button variant="ghost" onClick={() => run(() => bag.remove(line))}>
              Remove
            </Button>
          </div>
        )}
        {!dead && (
          <button
            type="button"
            onClick={() => run(() => onSave(line))}
            className="self-start mt-2 font-label-md text-label-md text-secondary hover:text-primary flex items-center gap-1"
          >
            <Icon name="favorite" className="text-[16px]" /> Move to saved
          </button>
        )}
      </div>
    </Card>
  );
}

export default function Bag() {
  const bag = useBag();
  const saved = useSaved();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const shop = settings?.shop;
  const needsFix = bag.items.some((l) => l.status !== 'ok');
  const buyable = bag.summary.itemCount > 0;
  const toFree = shop && shop.freeShippingAbove > 0 ? shop.freeShippingAbove - bag.summary.subtotal : 0;

  const moveToSaved = async (line) => {
    if (!saved.isSaved({ _id: line.productId, slug: line.slug }))
      await saved.toggle({
        _id: line.productId,
        slug: line.slug,
        name: line.name,
        price: line.price,
        mrp: line.mrp,
        images: [{ url: line.image }],
      });
    await bag.remove(line);
    toast('Moved to saved designs');
  };
  const checkout = () => {
    if (needsFix) return toast('Fix the items marked in your bag first.');
    navigate(user ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`);
  };

  const count = bag.count;
  return (
    <div className="w-full flex flex-col pb-28 md:pb-16 min-h-screen">
      <SubHeader title="Your bag" subtitle={`${count} item${count === 1 ? '' : 's'}`} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Your bag</h1>
        <span className="font-label-lg text-label-lg text-secondary">
          {count} item{count === 1 ? '' : 's'}
        </span>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1">
        {bag.error && !bag.items.length ? (
          <LoadError error={bag.error} onRetry={bag.reload} />
        ) : bag.loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : !bag.items.length ? (
          <EmptyState
            icon="shopping_bag"
            title="Your bag is empty"
            body="Designs you add will wait here until you check out."
            bodyClassName="max-w-[260px]"
          >
            <div className="flex gap-2.5 mt-4">
              <Button as={Link} to="/collection" size="sm" className="px-5">
                Browse designs
              </Button>
              {saved.count > 0 && (
                <Button as={Link} to="/saved" variant="secondary" size="sm" className="px-5">
                  Saved ({saved.count})
                </Button>
              )}
            </div>
          </EmptyState>
        ) : (
          <div className="md:grid md:grid-cols-[1fr_340px] md:gap-6 md:items-start space-y-4 md:space-y-0">
            <div className="space-y-3">
              {toFree > 0 && buyable && (
                <p className="rounded-xl bg-secondary-fixed/40 border border-secondary/20 px-3 py-2 font-body-sm text-[13px] text-on-secondary-container flex items-center gap-2">
                  <Icon name="local_shipping" className="text-[18px]" />
                  Add {formatINR(toFree)} more for free delivery.
                </p>
              )}
              {bag.items.map((line) => (
                <BagLine key={line._id} line={line} bag={bag} onSave={moveToSaved} />
              ))}
            </div>
            <div className="space-y-3 md:sticky md:top-24">
              <OrderTotals
                title="Bag total"
                pricing={{
                  mrpTotal: bag.summary.mrpTotal,
                  subtotal: bag.summary.subtotal,
                  shipping: toFree > 0 ? shop?.shippingFee : 0,
                  total: bag.summary.subtotal + (toFree > 0 ? shop?.shippingFee || 0 : 0),
                  savings: bag.summary.savings,
                }}
              />
              <p className="font-body-sm text-[12px] text-on-surface-variant px-1">
                Coupons, delivery date and payment options are on the next step.
              </p>
              <Button size="lg" className="hidden md:block w-full" onClick={checkout} disabled={!buyable}>
                Checkout
              </Button>
            </div>
          </div>
        )}
      </PageContainer>
      {bag.items.length > 0 && (
        <StickyBar>
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <p className="font-title-md text-[16px] text-primary font-semibold">{formatINR(bag.summary.subtotal)}</p>
              <p className="font-label-md text-[10px] text-on-surface-variant">
                {bag.summary.itemCount} item{bag.summary.itemCount === 1 ? '' : 's'}
              </p>
            </div>
            <Button size="lg" className="flex-1" onClick={checkout} disabled={!buyable}>
              Checkout
            </Button>
          </div>
        </StickyBar>
      )}
    </div>
  );
}
