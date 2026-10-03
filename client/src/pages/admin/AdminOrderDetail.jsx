import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminNav, AdminSubHeader } from '../../components/admin/AdminChrome';
import {
  Button,
  Card,
  ConfirmSheet,
  Field,
  Input,
  PageContainer,
  Sheet,
  Skeleton,
  Switch,
  Textarea,
  ToneChip,
  cx,
} from '../../components/ui';
import Icon from '../../components/shared/Icon';
import { ItemRow, ORDER_STATUS, PAYMENT_STATUS, PriceRows, RETURN_STATUS, formatDateTime, sizeName } from '../../components/shop/ShopBits';
import { adminCancelOrder, orderAction, refundOrder, returnAction, shipOrder, useAdminOrder } from '../../lib/api';
import { isAdmin, useAuth } from '../../lib/auth';
import { ADMIN_BASE } from '../../lib/constants';
import { formatINR } from '../../lib/format';
import { useToast } from '../../context/Toast';

const STEP_BUTTONS = {
  pack: ['Mark packed', 'inventory_2'],
  unpack: ['Back to “to pack”', 'undo'],
  out_for_delivery: ['Out for delivery', 'local_shipping'],
  delivered: ['Mark delivered', 'task_alt'],
  rto: ['Returned by courier', 'assignment_return'],
};

function ShipSheet({ order, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ courier: '', awb: '', trackingUrl: '' });
  const [busy, setBusy] = useState(false);
  const shiprocket = order.shippingProvider === 'shiprocket';
  const go = async () => {
    setBusy(true);
    try {
      await shipOrder(order._id, shiprocket ? {} : f);
      toast('Marked as shipped — the customer has been emailed');
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose} label="Ship order">
      <h2 className="font-headline-sm text-headline-sm text-primary">Ship {order.orderNumber}</h2>
      {shiprocket ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Shiprocket will choose the courier, assign the AWB and schedule the pickup. The label opens from this page afterwards.
        </p>
      ) : (
        <div className="space-y-3 mt-3">
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            Hand the parcel to any courier, then enter its details. In test mode, blank fields are filled in for you.
          </p>
          <Field label="Courier" htmlFor="ship-courier">
            <Input
              id="ship-courier"
              value={f.courier}
              onChange={(e) => setF({ ...f, courier: e.target.value })}
              placeholder="e.g. Delhivery, DTDC, India Post"
            />
          </Field>
          <Field label="AWB / tracking number" htmlFor="ship-awb">
            <Input id="ship-awb" value={f.awb} onChange={(e) => setF({ ...f, awb: e.target.value })} />
          </Field>
          <Field label="Tracking link (optional)" htmlFor="ship-url">
            <Input
              id="ship-url"
              inputMode="url"
              value={f.trackingUrl}
              onChange={(e) => setF({ ...f, trackingUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
        </div>
      )}
      <Button size="lg" className="w-full mt-5" onClick={go} disabled={busy}>
        {busy ? 'Working…' : 'Mark as shipped'}
      </Button>
    </Sheet>
  );
}

function RefundSheet({ order, onClose }) {
  const toast = useToast();
  const remaining = order.pricing.total - (order.payment.refundedTotal || 0);
  const cod = order.payment.method === 'cod';
  const [amount, setAmount] = useState(String(remaining));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await refundOrder(order._id, { amount: Number(amount), reason, note: note || undefined });
      toast('Refund recorded');
      onClose();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose} label="Refund">
      <h2 className="font-headline-sm text-headline-sm text-primary">Refund</h2>
      <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">
        {cod
          ? 'Cash on delivery: send the money by UPI or bank transfer, then record it here with the reference.'
          : 'The money goes back to the customer’s original payment method.'}{' '}
        Up to {formatINR(remaining)}.
      </p>
      <div className="space-y-3 mt-3">
        <Field label="Amount (₹)" htmlFor="rf-amt">
          <Input
            id="rf-amt"
            type="number"
            inputMode="numeric"
            min="1"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Reason" htmlFor="rf-reason">
          <Input id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in transit" />
        </Field>
        {cod && (
          <Field label="UPI / bank reference" htmlFor="rf-note">
            <Input id="rf-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
      </div>
      <Button variant="danger" size="sm" className="w-full mt-5" onClick={go} disabled={busy || !reason.trim() || !(Number(amount) > 0)}>
        {busy ? 'Working…' : `Refund ${formatINR(Number(amount) || 0)}`}
      </Button>
    </Sheet>
  );
}

function ReturnPanel({ order, admin }) {
  const toast = useToast();
  const r = order.returnRequest;
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    setBusy(true);
    try {
      await returnAction(order._id, { action, note: note || undefined, restock: action === 'received' ? restock : undefined });
      toast('Return updated');
      setNote('');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const items = (r.items || []).map((x) => ({ ...order.items.find((i) => i._id === String(x.itemId)), retQty: x.qty }));
  const cod = order.payment.method === 'cod';
  const actions =
    {
      requested: [
        ['approve', 'Approve'],
        ['reject', 'Reject'],
      ],
      approved: [
        ['picked_up', 'Picked up'],
        ['received', 'Received at shop'],
      ],
      picked_up: [['received', 'Received at shop']],
      received: [
        ...(admin && r.type === 'refund' ? [['refund', `Refund ${formatINR(r.amount)}`]] : []),
        ['exchange', 'Exchange sent'],
        ...(admin && r.type === 'exchange' ? [['refund', `Refund ${formatINR(r.amount)} instead`]] : []),
      ],
    }[r.status] || [];
  return (
    <Card className="border-secondary/40">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-headline-sm text-[17px] text-primary">{r.type === 'exchange' ? 'Size exchange' : 'Return'} request</h2>
        <ToneChip tone={['refunded', 'exchanged', 'closed', 'rejected'].includes(r.status) ? 'grey' : 'amber'}>
          {RETURN_STATUS[r.status]}
        </ToneChip>
      </div>
      <p className="font-body-sm text-[13px] mt-1">
        <span className="font-semibold">{r.reason}</span>
        {r.note ? ` — “${r.note}”` : ''}
      </p>
      <ul className="mt-2 space-y-1 font-body-sm text-[13px]">
        {items.map((i) => (
          <li key={i._id}>
            {i.name} · {sizeName(i.size)} × {i.retQty} <span className="text-on-surface-variant">({i.sku})</span>
          </li>
        ))}
      </ul>
      <p className="font-label-md text-label-md text-on-surface-variant mt-1">Refund value {formatINR(r.amount)}</p>
      {actions.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {r.status !== 'received' && r.status !== 'requested' ? null : null}
          {(r.status === 'approved' || r.status === 'picked_up') && (
            <Switch checked={restock} onChange={setRestock} label="Put the items back in stock" hint="Turn off if they're damaged" />
          )}
          {(r.status === 'requested' || (r.status === 'received' && cod)) && (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={r.status === 'requested' ? 'Note to the customer (for rejection)' : 'UPI / bank reference for the refund'}
              aria-label="Note"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map(([a, label]) => (
              <Button
                key={a}
                variant={a === 'reject' ? 'secondary' : 'primary'}
                size="sm"
                className="px-4"
                disabled={busy}
                onClick={() => act(a)}
              >
                {label}
              </Button>
            ))}
            {!['refunded', 'exchanged', 'closed', 'rejected'].includes(r.status) && (
              <Button variant="ghost" disabled={busy} onClick={() => act('close')}>
                Close request
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const { data: o, loading, error } = useAdminOrder(id);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const step = async (action) => {
    setBusy(true);
    try {
      await orderAction(o._id, action);
      toast('Order updated');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await adminCancelOrder(o._id, reason || 'Cancelled by the shop');
      toast('Order cancelled');
      setSheet(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !o) {
    return (
      <>
        <AdminSubHeader title="Order" backTo={`${ADMIN_BASE}/orders`} />
        <PageContainer className="px-gutter-mobile pt-10 text-center font-body-sm text-body-sm">{error.message}</PageContainer>
      </>
    );
  }
  if (loading && !o) {
    return (
      <>
        <AdminSubHeader title="Order" backTo={`${ADMIN_BASE}/orders`} />
        <PageContainer className="px-gutter-mobile pt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </PageContainer>
      </>
    );
  }
  const [word, tone] = ORDER_STATUS[o.status] || [o.status, 'grey'];
  const next = o.allowedNext || [];
  const a = o.address;
  const copyAddress = () => {
    navigator.clipboard?.writeText(
      `${a.fullName}\n${a.line1}${a.line2 ? `, ${a.line2}` : ''}${a.landmark ? `, near ${a.landmark}` : ''}\n${a.city}, ${a.state} ${a.pincode}\n${a.phone}`
    );
    toast('Address copied');
  };

  return (
    <>
      <AdminSubHeader title={o.orderNumber} subtitle={`Placed ${formatDateTime(o.placedAt)}`} backTo={`${ADMIN_BASE}/orders`} />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8">
        <div className="md:grid md:grid-cols-[1fr_340px] md:gap-5 md:items-start space-y-4 md:space-y-0">
          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-title-md text-[16px] text-primary">{formatINR(o.pricing.total)}</p>
                  <p className="font-label-md text-label-md text-on-surface-variant">
                    {o.payment.method === 'cod' ? 'Cash on delivery' : `Online (${o.payment.provider})`} ·{' '}
                    {PAYMENT_STATUS[o.payment.status]}
                  </p>
                </div>
                <ToneChip tone={tone}>{word}</ToneChip>
              </div>
              {o.payment.method === 'cod' && ['confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(o.status) && (
                <p className="mt-2 rounded-lg bg-secondary-fixed/40 px-2.5 py-1.5 font-label-md text-label-md text-on-secondary-container font-semibold">
                  Collect {formatINR(o.pricing.total)} on delivery
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {next.includes('ship') && (
                  <Button size="sm" className="px-4" onClick={() => setSheet('ship')} disabled={busy}>
                    Ship order
                  </Button>
                )}
                {Object.entries(STEP_BUTTONS)
                  .filter(([k]) => next.includes(k))
                  .map(([k, [label]]) => (
                    <Button
                      key={k}
                      variant={k === 'pack' ? 'primary' : 'secondary'}
                      size="sm"
                      className="px-4"
                      onClick={() => step(k)}
                      disabled={busy}
                    >
                      {label}
                    </Button>
                  ))}
                {admin && next.includes('refund') && (
                  <Button variant="secondary" size="sm" className="px-4" onClick={() => setSheet('refund')}>
                    Refund
                  </Button>
                )}
                {admin && next.includes('cancel') && (
                  <Button variant="ghost" onClick={() => setSheet('cancel')}>
                    Cancel order
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-outline-variant/30">
                <a
                  href={`/api/admin/orders/${o._id}/packing-slip`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-label-lg text-label-lg text-secondary hover:text-primary flex items-center gap-1"
                >
                  <Icon name="print" className="text-[18px]" /> Packing slip
                </a>
                {o.invoiceNumber && (
                  <a
                    href={`/api/admin/orders/${o._id}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-label-lg text-label-lg text-secondary hover:text-primary flex items-center gap-1"
                  >
                    <Icon name="receipt_long" className="text-[18px]" /> Invoice {o.invoiceNumber}
                  </a>
                )}
                {o.shipment?.labelUrl && (
                  <a
                    href={o.shipment.labelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-label-lg text-label-lg text-secondary hover:text-primary flex items-center gap-1"
                  >
                    <Icon name="label" className="text-[18px]" /> Shipping label
                  </a>
                )}
              </div>
            </Card>

            {o.returnRequest?.status && <ReturnPanel order={o} admin={admin} />}

            <Card>
              <h2 className="font-headline-sm text-[17px] text-primary mb-3">Items to pack</h2>
              <div className="space-y-3">
                {o.items.map((i) => (
                  <ItemRow
                    key={i._id}
                    item={{ ...i, slug: undefined }}
                    right={
                      <div className="text-right shrink-0">
                        <p className="font-title-md text-[14px] text-on-surface">{formatINR(i.price * i.qty)}</p>
                        <p className="font-label-md text-[10px] text-on-surface-variant">{i.sku}</p>
                      </div>
                    }
                  />
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="font-headline-sm text-[17px] text-primary mb-2">History</h2>
              <ol className="space-y-2">
                {[...(o.statusHistory || [])].reverse().map((h, i) => (
                  <li key={i} className="font-body-sm text-[13px] flex gap-2">
                    <span className="text-on-surface-variant shrink-0 w-28">{formatDateTime(h.at)}</span>
                    <span>
                      {h.note} <span className="text-on-surface-variant">· {h.by}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-[17px] text-primary">Ship to</h2>
                <Button variant="ghost" onClick={copyAddress}>
                  Copy
                </Button>
              </div>
              <p className="font-body-sm text-[13px] mt-1 font-semibold">{a.fullName}</p>
              <p className="font-body-sm text-[13px] text-on-surface-variant">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}
                {a.landmark ? `, near ${a.landmark}` : ''}
                <br />
                {a.city}, {a.state} {a.pincode}
              </p>
              <a href={`tel:${a.phone}`} className="font-label-lg text-label-lg text-secondary">
                {a.phone}
              </a>
              {o.shipment?.awb && (
                <p className="font-body-sm text-[13px] mt-2 pt-2 border-t border-outline-variant/30">
                  {o.shipment.courier} · AWB <span className="font-semibold">{o.shipment.awb}</span>
                </p>
              )}
            </Card>

            {o.customer && (
              <Card>
                <h2 className="font-headline-sm text-[17px] text-primary mb-1">Customer</h2>
                <p className="font-body-sm text-[13px]">{o.customer.name || '—'}</p>
                <p className="font-body-sm text-[13px] text-on-surface-variant break-all">{o.customer.email}</p>
                <p className="font-label-md text-label-md text-on-surface-variant mt-1">
                  {o.customer.previousOrders
                    ? `${o.customer.previousOrders} earlier order${o.customer.previousOrders === 1 ? '' : 's'}`
                    : 'First order'}
                  {o.customer.isBlocked ? ' · Blocked' : ''}
                </p>
                {admin && (
                  <Link
                    to={`${ADMIN_BASE}/customers?open=${o.customer._id}`}
                    className="font-label-lg text-label-lg text-secondary hover:text-primary"
                  >
                    View customer
                  </Link>
                )}
              </Card>
            )}

            <Card>
              <h2 className="font-headline-sm text-[17px] text-primary mb-2">Payment</h2>
              <PriceRows
                rows={[
                  ['Items', o.pricing.subtotal],
                  o.pricing.discount > 0 && [
                    `Coupon ${o.pricing.couponCode || ''}`,
                    `−${formatINR(o.pricing.discount)}`,
                    { tone: 'green' },
                  ],
                  ['Delivery', o.pricing.shipping || 'Free'],
                  o.pricing.codFee > 0 && ['COD fee', o.pricing.codFee],
                  ['Total', o.pricing.total, { strong: true }],
                  o.payment.refundedTotal > 0 && ['Refunded', `−${formatINR(o.payment.refundedTotal)}`],
                ]}
              />
              {o.payment.paymentId && (
                <p className="font-label-md text-[10px] text-on-surface-variant mt-2 break-all">Payment ref {o.payment.paymentId}</p>
              )}
              {(o.payment.refunds || []).map((r) => (
                <p
                  key={r._id || r.at}
                  className={cx('font-label-md text-label-md mt-1', r.status === 'failed' ? 'text-error' : 'text-on-surface-variant')}
                >
                  {formatINR(r.amount)} {r.method === 'manual' ? 'manual' : 'gateway'} refund · {r.status} · {formatDateTime(r.at)}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              ))}
            </Card>
          </div>
        </div>
      </PageContainer>
      <AdminNav />
      {sheet === 'ship' && <ShipSheet order={o} onClose={() => setSheet(null)} />}
      {sheet === 'refund' && <RefundSheet order={o} onClose={() => setSheet(null)} />}
      {sheet === 'cancel' && (
        <ConfirmSheet
          title={`Cancel ${o.orderNumber}?`}
          body={
            <>
              {o.payment.status === 'paid' ? 'The customer will be refunded in full automatically. ' : ''}The items go back on sale and the
              customer is emailed.
              <Textarea
                className="mt-3"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason shown to the customer"
                aria-label="Reason"
              />
            </>
          }
          confirmLabel="Cancel order"
          busy={busy}
          onConfirm={cancel}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}
