// One-page checkout: address → delivery estimate → payment method → coupon → review → place order.
// Every number shown comes from POST /api/checkout/quote, refreshed whenever a choice changes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SubHeader } from '../../components/public/Header';
import { Button, Card, Input, PageContainer, Sheet, Skeleton, Spinner, cx } from '../../components/ui';
import Icon from '../../components/shared/Icon';
import AddressSheet from '../../components/account/AddressSheet';
import PaymentLauncher from '../../components/shop/PaymentLauncher';
import { ItemRow, OrderTotals, StickyBar, etaText } from '../../components/shop/ShopBits';
import { fetchQuote, placeOrder, useAddresses } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatINR } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { LoadError } from './Home';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Step({ n, title, children, action }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h2 className="font-headline-sm text-[17px] text-primary flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-container text-white font-label-md text-[11px] flex items-center justify-center">
            {n}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function AddressText({ a }) {
  return (
    <div className="font-body-sm text-[13px] text-on-surface leading-relaxed">
      <p className="font-semibold">
        {a.fullName} <span className="font-normal text-on-surface-variant">· {a.phone}</span>
      </p>
      <p className="text-on-surface-variant">
        {a.line1}
        {a.line2 ? `, ${a.line2}` : ''}
        {a.landmark ? `, near ${a.landmark}` : ''}, {a.city}, {a.state} {a.pincode}
      </p>
    </div>
  );
}

function PayOption({ value, current, onPick, title, body, disabled, reason, icon }) {
  const on = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onPick(value)}
      className={cx(
        'w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors',
        on ? 'border-primary-container bg-primary/5' : 'border-outline-variant/50 bg-surface-container-lowest',
        disabled && 'opacity-55 cursor-not-allowed'
      )}
    >
      <Icon name={icon} className={cx('text-[22px] mt-0.5', on ? 'text-primary' : 'text-on-surface-variant')} />
      <span className="flex-1 min-w-0">
        <span className="block font-title-md text-[14px] text-on-surface">{title}</span>
        <span className="block font-body-sm text-[12px] text-on-surface-variant">{disabled ? reason : body}</span>
      </span>
      <span
        className={cx(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
          on ? 'border-primary-container' : 'border-outline-variant'
        )}
      >
        {on && <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />}
      </span>
    </button>
  );
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const buyNow = params.get('buy')
    ? { productId: params.get('buy'), size: params.get('size') || '', qty: Math.max(1, Math.min(10, Number(params.get('qty')) || 1)) }
    : null;
  const { data: addresses, loading: addrLoading } = useAddresses();
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [payment, setPayment] = useState(null);
  const [placed, setPlaced] = useState(null);
  const keyRef = useRef(newKey());

  // Default address once loaded (or the newest after adding one).
  const knownIds = useRef(new Set());
  useEffect(() => {
    if (!addresses) return;
    const fresh = addresses.find((a) => !knownIds.current.has(a._id) && knownIds.current.size > 0);
    addresses.forEach((a) => knownIds.current.add(a._id));
    if (fresh) setAddressId(fresh._id);
    else if (!addressId || !addresses.some((a) => a._id === addressId)) setAddressId(addresses[0]?._id || null);
  }, [addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = useMemo(
    () => ({
      source: buyNow ? 'buy_now' : 'cart',
      item: buyNow || undefined,
      addressId: addressId || undefined,
      paymentMethod: method || undefined,
      couponCode: coupon || undefined,
    }),
    [buyNow?.productId, buyNow?.size, buyNow?.qty, addressId, method, coupon] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const q = useQuery({
    queryKey: ['me', 'quote', body],
    queryFn: () => fetchQuote(body),
    placeholderData: keepPreviousData,
    staleTime: 0,
    retry: false,
  });
  const quote = q.data;

  // Pick a sensible payment method once we know what's available.
  useEffect(() => {
    if (!quote || method) return;
    if (quote.payment.online.available) setMethod('online');
    else if (quote.payment.cod.available) setMethod('cod');
  }, [quote, method]);
  // COD became unavailable (address or total changed): switch to online.
  useEffect(() => {
    if (method === 'cod' && quote && !quote.payment.cod.available && quote.payment.online.available) setMethod('online');
  }, [quote, method]);

  if (placed) return <Navigate to={`/account/orders/${placed}?placed=1`} replace />;

  const address = addresses?.find((a) => a._id === addressId);
  const problems = quote?.problems || [];
  const canPlace = Boolean(quote?.canPlace) && !q.isFetching;

  const place = async () => {
    if (!address) return toast('Add a delivery address first.');
    setPlacing(true);
    try {
      const out = await placeOrder({ ...body, addressId, paymentMethod: method, idempotencyKey: keyRef.current });
      if (out.payment) setPayment(out.payment);
      else setPlaced(out.order.orderNumber);
    } catch (e) {
      toast(e.message);
      q.refetch();
    } finally {
      setPlacing(false);
    }
  };

  const applyCoupon = () => setCoupon(couponInput.trim().toUpperCase());
  const empty = q.error?.code === 'EMPTY_BAG';
  const placeLabel =
    method === 'cod' ? `Place order · ${formatINR(quote?.pricing?.total || 0)}` : `Pay ${formatINR(quote?.pricing?.total || 0)}`;

  return (
    <div className="w-full flex flex-col pb-28 md:pb-16 min-h-screen">
      <SubHeader title="Checkout" subtitle={buyNow ? 'Buy now' : 'From your bag'} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Checkout</h1>
        <Link to="/bag" className="font-label-lg text-label-lg text-secondary hover:text-primary">
          Back to bag
        </Link>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1">
        {empty ? (
          <Navigate to="/bag" replace />
        ) : q.error && !quote ? (
          <LoadError error={q.error} onRetry={q.refetch} />
        ) : !quote || addrLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="md:grid md:grid-cols-[1fr_360px] md:gap-6 md:items-start space-y-4 md:space-y-0">
            <div className="space-y-4">
              {problems.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl border border-error/30 bg-error-container/40 p-3 font-body-sm text-[13px] text-on-error-container"
                >
                  <p className="font-semibold mb-1">Please check before ordering</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {problems.map((p) => (
                      <li key={p.message}>{p.message}</li>
                    ))}
                  </ul>
                  {problems.some((p) => p.type === 'item' || p.type === 'qty') && (
                    <Button
                      as={Link}
                      to={buyNow ? `/product/${quote.lines[0]?.slug || ''}` : '/bag'}
                      variant="ghost"
                      className="mt-1.5 inline-block"
                    >
                      {buyNow ? 'Back to the design' : 'Update your bag'}
                    </Button>
                  )}
                </div>
              )}

              <Step
                n={1}
                title="Delivery address"
                action={
                  addresses?.length > 0 && (
                    <Button variant="ghost" onClick={() => setPicker(true)}>
                      Change
                    </Button>
                  )
                }
              >
                {address ? (
                  <>
                    <AddressText a={address} />
                    {quote.delivery && (
                      <p
                        className={cx(
                          'mt-2 font-label-md text-label-md font-semibold flex items-center gap-1',
                          quote.delivery.serviceable ? 'text-emerald-700' : 'text-error'
                        )}
                      >
                        <Icon name="local_shipping" className="text-[16px]" />
                        {quote.delivery.serviceable ? etaText(quote.delivery) : quote.delivery.message}
                      </p>
                    )}
                  </>
                ) : (
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditing({})}>
                    + Add a delivery address
                  </Button>
                )}
              </Step>

              <Step n={2} title="Payment">
                <div role="radiogroup" aria-label="Payment method" className="space-y-2">
                  <PayOption
                    value="online"
                    current={method}
                    onPick={setMethod}
                    icon="credit_card"
                    title="Pay online"
                    body={
                      quote.payment.online.testMode
                        ? 'UPI, cards, net banking (test mode — no real money)'
                        : 'UPI, cards, net banking, wallets'
                    }
                    disabled={!quote.payment.online.available}
                    reason={quote.payment.online.reason}
                  />
                  <PayOption
                    value="cod"
                    current={method}
                    onPick={setMethod}
                    icon="payments"
                    title="Cash on delivery"
                    body={quote.payment.cod.fee ? `Pay when it arrives · ${formatINR(quote.payment.cod.fee)} extra` : 'Pay when it arrives'}
                    disabled={!quote.payment.cod.available}
                    reason={quote.payment.cod.reason}
                  />
                </div>
              </Step>

              <Step n={3} title={`Review ${quote.lines.length} item${quote.lines.length === 1 ? '' : 's'}`}>
                <div className="space-y-3">
                  {quote.lines.map((l) => (
                    <ItemRow
                      key={l._id || `${l.productId}${l.size}`}
                      item={l}
                      right={
                        <div className="text-right shrink-0">
                          <p className="font-title-md text-[14px] text-primary font-semibold">
                            {formatINR(l.lineTotal || l.price * (l.buyQty || 0))}
                          </p>
                          {l.message && (
                            <p className={cx('font-label-md text-[10px] mt-0.5', l.status === 'ok' ? 'text-secondary' : 'text-error')}>
                              {l.message}
                            </p>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              </Step>
            </div>

            <div className="space-y-3 md:sticky md:top-24">
              <Card>
                <h2 className="font-headline-sm text-[17px] text-primary mb-2">Coupon</h2>
                {quote.coupon?.valid ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <p className="font-body-sm text-[13px] text-emerald-800">{quote.coupon.message}</p>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCoupon('');
                        setCouponInput('');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      applyCoupon();
                    }}
                  >
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      aria-label="Coupon code"
                      className="uppercase"
                      autoCapitalize="characters"
                    />
                    <Button type="submit" variant="secondary" size="sm" className="px-4 shrink-0" disabled={!couponInput.trim()}>
                      Apply
                    </Button>
                  </form>
                )}
                {quote.coupon && !quote.coupon.valid && (
                  <p className="font-body-sm text-[12px] text-error mt-1.5">{quote.coupon.message}</p>
                )}
              </Card>
              <OrderTotals pricing={quote.pricing} />
              {quote.shop?.returnWindowDays > 0 && (
                <p className="font-body-sm text-[12px] text-on-surface-variant px-1 flex gap-1.5">
                  <Icon name="autorenew" className="text-[16px]" />
                  Easy returns and size exchange within {quote.shop.returnWindowDays} days of delivery.
                </p>
              )}
              <p className="font-body-sm text-[11px] text-on-surface-variant px-1">
                By placing the order you agree to our{' '}
                <Link className="underline" to="/policies/terms">
                  terms
                </Link>{' '}
                and{' '}
                <Link className="underline" to="/policies/returns">
                  returns policy
                </Link>
                .
              </p>
              <Button size="lg" className="hidden md:block w-full" onClick={place} disabled={!canPlace || placing || !user}>
                {placing ? 'Placing order…' : placeLabel}
              </Button>
            </div>
          </div>
        )}
      </PageContainer>

      {quote && (
        <StickyBar>
          <Button size="lg" className="w-full" onClick={place} disabled={!canPlace || placing}>
            {placing ? 'Placing order…' : placeLabel}
          </Button>
        </StickyBar>
      )}

      {picker && (
        <Sheet onClose={() => setPicker(false)} label="Choose a delivery address">
          <h2 className="font-headline-sm text-headline-sm text-primary mb-3">Deliver to</h2>
          <div className="space-y-2">
            {addresses.map((a) => (
              <button
                key={a._id}
                type="button"
                onClick={() => {
                  setAddressId(a._id);
                  setPicker(false);
                }}
                className={cx(
                  'w-full text-left rounded-xl border p-3',
                  a._id === addressId ? 'border-primary-container bg-primary/5' : 'border-outline-variant/50'
                )}
              >
                <AddressText a={a} />
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full mt-3"
            onClick={() => {
              setPicker(false);
              setEditing({});
            }}
          >
            + Add a new address
          </Button>
        </Sheet>
      )}
      {editing && <AddressSheet address={editing} defaultName={user?.name} defaultPhone={user?.phone} onClose={() => setEditing(null)} />}
      {placing && !payment && (
        <div className="fixed inset-0 z-[70] bg-on-surface/20 flex items-center justify-center" aria-live="polite">
          <Spinner />
        </div>
      )}
      <PaymentLauncher
        payment={payment}
        onPaid={(order) => setPlaced(order.orderNumber)}
        onClosed={() => {
          const n = payment.orderNumber;
          setPayment(null);
          toast('Payment not completed. You can pay from your order within a few minutes.');
          navigate(`/account/orders/${n}`, { replace: true });
        }}
        onError={(msg) => {
          const n = payment?.orderNumber;
          setPayment(null);
          toast(msg);
          if (n) navigate(`/account/orders/${n}`, { replace: true });
        }}
      />
    </div>
  );
}
