import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import {
  Button,
  Card,
  ConfirmSheet,
  Field,
  PageContainer,
  Select,
  Sheet,
  Skeleton,
  Stepper,
  Textarea,
  ToneChip,
  cx,
} from '../../components/ui';
import Icon from '../../components/shared/Icon';
import PaymentLauncher from '../../components/shop/PaymentLauncher';
import {
  ItemRow,
  ORDER_STATUS,
  OrderTotals,
  PAYMENT_STATUS,
  RETURN_STATUS,
  formatDate,
  formatDateTime,
  sizeName,
} from '../../components/shop/ShopBits';
import { cancelMyOrder, requestReturn, retryPayment, useMyOrder, useSettings } from '../../lib/api';
import { formatINR, waLink } from '../../lib/format';
import { useToast } from '../../context/Toast';
import NotFound from './NotFound';
import { LoadError } from './Home';

const TRACK = ['confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
const TRACK_WORDS = {
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};
export const RETURN_REASONS = [
  'Size does not fit',
  'Different from photos',
  'Damaged or defective',
  'Wrong item received',
  'Quality not as expected',
  'Changed my mind',
];

function Timeline({ order }) {
  const reached = new Map((order.statusHistory || []).map((h) => [h.status, h.at]));
  const at = TRACK.indexOf(order.status);
  return (
    <ol className="relative ml-2">
      {TRACK.map((s, i) => {
        const done = i <= at;
        return (
          <li key={s} className="relative pl-6 pb-4 last:pb-0">
            {i < TRACK.length - 1 && (
              <span className={cx('absolute left-[7px] top-4 bottom-0 w-0.5', i < at ? 'bg-emerald-600' : 'bg-outline-variant/60')} />
            )}
            <span
              className={cx(
                'absolute left-0 top-1 w-4 h-4 rounded-full border-2',
                done ? 'bg-emerald-600 border-emerald-600' : 'bg-surface border-outline-variant'
              )}
            />
            <p className={cx('font-title-md text-[14px]', done ? 'text-on-surface' : 'text-on-surface-variant')}>{TRACK_WORDS[s]}</p>
            {reached.get(s) && <p className="font-label-md text-label-md text-on-surface-variant">{formatDateTime(reached.get(s))}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function ReturnSheet({ order, onClose }) {
  const toast = useToast();
  const returnable = order.items.filter((i) => i.isReturnable !== false);
  const [qty, setQty] = useState(() => Object.fromEntries(returnable.map((i) => [i._id, returnable.length === 1 ? i.qty : 0])));
  const [type, setType] = useState('exchange');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = Object.entries(qty).filter(([, q]) => q > 0);
  const submit = async () => {
    if (!chosen.length) return toast('Choose at least one item.');
    if (!reason) return toast('Choose a reason.');
    setBusy(true);
    try {
      await requestReturn(order.orderNumber, {
        type,
        reason,
        note: note || undefined,
        items: chosen.map(([itemId, q]) => ({ itemId, qty: q })),
      });
      toast('Return requested. We will email you the next steps.');
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      onClose={onClose}
      label="Return or exchange"
      full
      footer={
        <Button size="lg" className="w-full" onClick={submit} disabled={busy}>
          {busy ? 'Sending…' : 'Request return'}
        </Button>
      }
    >
      <h2 className="font-headline-sm text-headline-sm text-primary">Return or exchange</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
        Accepted until {formatDate(order.returnDeadline)}. Items must be unused with tags attached.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-4" role="radiogroup" aria-label="What would you like">
        {[
          ['exchange', 'Size exchange', 'swap_horiz'],
          ['refund', 'Refund', 'currency_rupee'],
        ].map(([v, label, icon]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={type === v}
            onClick={() => setType(v)}
            className={cx(
              'rounded-xl border p-3 flex flex-col items-center gap-1',
              type === v ? 'border-primary-container bg-primary/5 text-primary' : 'border-outline-variant/50 text-on-surface'
            )}
          >
            <Icon name={icon} className="text-[22px]" />
            <span className="font-label-lg text-label-lg">{label}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {returnable.map((i) => (
          <div key={i._id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-title-md text-[14px] text-on-surface line-clamp-1">{i.name}</p>
              <p className="font-label-md text-label-md text-on-surface-variant">
                {sizeName(i.size)} · bought {i.qty}
              </p>
            </div>
            <Stepper label={i.name} value={qty[i._id]} onChange={(v) => setQty((q) => ({ ...q, [i._id]: Math.min(v, i.qty) }))} />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Reason" required htmlFor="ret-reason">
          <Select id="ret-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {RETURN_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label={type === 'exchange' ? 'Which size would you like?' : 'Anything else?'} htmlFor="ret-note">
          <Textarea
            id="ret-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === 'exchange' ? 'e.g. Please send M instead of S' : 'Optional'}
          />
        </Field>
      </div>
    </Sheet>
  );
}

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const { data: order, loading, error, reload } = useMyOrder(orderNumber);
  const { data: settings } = useSettings();
  const [payment, setPayment] = useState(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);

  if (error?.status === 404) return <NotFound message="We couldn't find this order in your account." />;

  const payNow = async () => {
    setPaying(true);
    try {
      setPayment(await retryPayment(order.orderNumber));
    } catch (e) {
      toast(e.message);
      reload();
    } finally {
      setPaying(false);
    }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await cancelMyOrder(order.orderNumber, 'Changed my mind');
      toast('Order cancelled');
      setCancelling(false);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const placed = params.get('placed') === '1' && order && order.status !== 'pending_payment';
  const [word, tone] = order ? ORDER_STATUS[order.status] || [order.status, 'grey'] : [];
  const help =
    settings?.whatsapp && order
      ? waLink(settings.whatsapp, `Hello Swechha Collections, I need help with my order ${order.orderNumber}.`)
      : null;

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title={orderNumber} subtitle="Order details" />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">Order {orderNumber}</h1>
        <Link to="/account/orders" className="font-label-lg text-label-lg text-secondary hover:text-primary">
          All orders
        </Link>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1">
        {error && !order ? (
          <LoadError error={error} onRetry={reload} />
        ) : loading && !order ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="md:grid md:grid-cols-[1fr_340px] md:gap-6 md:items-start space-y-4 md:space-y-0">
            <div className="space-y-4">
              {placed && (
                <Card className="text-center py-6 bg-primary-container text-white border-primary-container">
                  <Icon name="check_circle" className="text-4xl text-secondary-fixed" />
                  <h2 className="font-headline-sm text-headline-sm mt-1">Thank you! Your order is confirmed.</h2>
                  <p className="font-body-sm text-body-sm text-surface-container-highest/90 mt-1">
                    {order.payment.method === 'cod'
                      ? `Please keep ${formatINR(order.pricing.total)} ready when it arrives.`
                      : 'Payment received.'}{' '}
                    We&apos;ve emailed you the details.
                  </p>
                </Card>
              )}

              <Card>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-label-md text-label-md text-on-surface-variant">Placed {formatDate(order.placedAt)}</p>
                    <p className="font-title-md text-[15px] text-primary mt-0.5">
                      {formatINR(order.pricing.total)} · {PAYMENT_STATUS[order.payment.status] || order.payment.status}
                    </p>
                  </div>
                  <ToneChip tone={tone}>{word}</ToneChip>
                </div>
                {order.canPay && (
                  <div className="mt-3 rounded-xl bg-secondary-fixed/40 border border-secondary/20 p-3">
                    <p className="font-body-sm text-[13px] text-on-secondary-container">
                      Payment not completed. Your items are held until {formatDateTime(order.reservationExpiresAt)}.
                    </p>
                    <Button size="sm" className="w-full mt-2" onClick={payNow} disabled={paying}>
                      {paying ? 'Opening…' : `Pay ${formatINR(order.pricing.total)} now`}
                    </Button>
                  </div>
                )}
                {order.status === 'cancelled' && order.cancel?.reason && (
                  <p className="mt-2 font-body-sm text-[13px] text-on-surface-variant">{order.cancel.reason}</p>
                )}
              </Card>

              {!['cancelled', 'pending_payment', 'rto'].includes(order.status) && (
                <Card>
                  <h2 className="font-headline-sm text-[17px] text-primary mb-3">Tracking</h2>
                  <Timeline order={order} />
                  {order.shipment?.awb && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/30 font-body-sm text-[13px]">
                      <p>
                        {order.shipment.courier} · AWB <span className="font-semibold">{order.shipment.awb}</span>
                      </p>
                      {order.shipment.trackingUrl && (
                        <a
                          href={order.shipment.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline font-label-lg text-label-lg"
                        >
                          Track with the courier
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {order.returnRequest?.status && (
                <Card>
                  <h2 className="font-headline-sm text-[17px] text-primary">
                    {order.returnRequest.type === 'exchange' ? 'Exchange' : 'Return'}
                  </h2>
                  <p className="font-body-sm text-[13px] text-on-surface mt-1">{RETURN_STATUS[order.returnRequest.status]}</p>
                  <p className="font-label-md text-label-md text-on-surface-variant mt-1">Reason: {order.returnRequest.reason}</p>
                </Card>
              )}

              <Card>
                <h2 className="font-headline-sm text-[17px] text-primary mb-3">Items</h2>
                <div className="space-y-3">
                  {order.items.map((i) => (
                    <ItemRow
                      key={i._id}
                      item={i}
                      right={<p className="font-title-md text-[14px] text-primary font-semibold shrink-0">{formatINR(i.price * i.qty)}</p>}
                    />
                  ))}
                </div>
              </Card>

              <Card>
                <h2 className="font-headline-sm text-[17px] text-primary mb-1.5">Delivery address</h2>
                <p className="font-body-sm text-[13px] text-on-surface">
                  {order.address.fullName} · {order.address.phone}
                </p>
                <p className="font-body-sm text-[13px] text-on-surface-variant">
                  {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ''}, {order.address.city}, {order.address.state}{' '}
                  {order.address.pincode}
                </p>
              </Card>
            </div>

            <div className="space-y-3 md:sticky md:top-24">
              <OrderTotals pricing={order.pricing} title="Payment summary" />
              {order.payment.refundedTotal > 0 && (
                <Card>
                  <p className="font-body-sm text-[13px] text-emerald-800">
                    Refunded {formatINR(order.payment.refundedTotal)}. Banks usually take 5–7 working days to show it.
                  </p>
                </Card>
              )}
              <div className="grid gap-2">
                {order.invoiceAvailable && (
                  <Button
                    as="a"
                    href={`/api/orders/${order.orderNumber}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                    className="text-center"
                  >
                    Download invoice
                  </Button>
                )}
                {order.canReturn && (
                  <Button variant="secondary" size="sm" onClick={() => setReturning(true)}>
                    Return or exchange
                  </Button>
                )}
                {order.canCancel && (
                  <Button variant="secondary" size="sm" onClick={() => setCancelling(true)}>
                    Cancel order
                  </Button>
                )}
                {help && (
                  <Button as="a" href={help} target="_blank" rel="noreferrer" variant="whatsapp" size="sm">
                    <Icon name="chat" className="text-lg" /> Help with this order
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </PageContainer>
      <BottomNav />
      {cancelling && (
        <ConfirmSheet
          title="Cancel this order?"
          body={
            order.payment.status === 'paid'
              ? 'Your payment will be refunded to the original method (usually 5–7 working days).'
              : 'The items will go back on sale.'
          }
          confirmLabel="Cancel order"
          busy={busy}
          onConfirm={cancel}
          onClose={() => setCancelling(false)}
        />
      )}
      {returning && <ReturnSheet order={order} onClose={() => setReturning(false)} />}
      <PaymentLauncher
        payment={payment}
        onPaid={() => {
          setPayment(null);
          toast('Payment received — your order is confirmed');
        }}
        onClosed={() => setPayment(null)}
        onError={(msg) => {
          setPayment(null);
          toast(msg);
          reload();
        }}
      />
    </div>
  );
}
