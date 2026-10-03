import { useState } from 'react';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  Field,
  Input,
  PageContainer,
  Segmented,
  Sheet,
  Skeleton,
  Switch,
  ToneChip,
} from '../../components/ui';
import { formatDate } from '../../components/shop/ShopBits';
import { createCoupon, deleteCoupon, updateCoupon, useCoupons } from '../../lib/api';
import { formatINR } from '../../lib/format';
import { useToast } from '../../context/Toast';

const EMPTY = {
  code: '',
  description: '',
  type: 'percent',
  value: '',
  minOrder: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  startsAt: '',
  endsAt: '',
  active: true,
};
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function CouponSheet({ coupon, onClose }) {
  const toast = useToast();
  const editing = Boolean(coupon?._id);
  const [f, setF] = useState(() => (editing ? { ...EMPTY, ...coupon, startsAt: day(coupon.startsAt), endsAt: day(coupon.endsAt) } : EMPTY));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const save = async () => {
    setBusy(true);
    const body = {
      ...f,
      endsAt: f.endsAt ? `${f.endsAt}T23:59:59+05:30` : null,
      startsAt: f.startsAt ? `${f.startsAt}T00:00:00+05:30` : null,
    };
    try {
      if (editing) await updateCoupon(coupon._id, body);
      else await createCoupon(body);
      toast(editing ? 'Coupon saved' : 'Coupon created');
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
      label={editing ? 'Edit coupon' : 'New coupon'}
      full
      footer={
        <Button size="lg" className="w-full" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save coupon' : 'Create coupon'}
        </Button>
      }
    >
      <h2 className="font-headline-sm text-headline-sm text-primary mb-3">{editing ? coupon.code : 'New coupon'}</h2>
      <div className="space-y-3">
        {!editing && (
          <Field label="Code" htmlFor="c-code" hint="Letters and numbers, e.g. FESTIVE10">
            <Input id="c-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') })} />
          </Field>
        )}
        <Field label="Shown to customers" htmlFor="c-desc">
          <Input id="c-desc" value={f.description} onChange={set('description')} placeholder="10% off festive wear" />
        </Field>
        <Segmented
          value={f.type}
          onChange={set('type')}
          label="Discount type"
          options={[
            { value: 'percent', label: 'Percent off' },
            { value: 'flat', label: 'Flat ₹ off' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.type === 'percent' ? 'Percent' : 'Amount (₹)'} htmlFor="c-val">
            <Input id="c-val" type="number" inputMode="numeric" value={f.value} onChange={set('value')} />
          </Field>
          {f.type === 'percent' && (
            <Field label="Max discount (₹)" htmlFor="c-max" hint="0 = no cap">
              <Input id="c-max" type="number" inputMode="numeric" value={f.maxDiscount} onChange={set('maxDiscount')} />
            </Field>
          )}
          <Field label="Min. order (₹)" htmlFor="c-min">
            <Input id="c-min" type="number" inputMode="numeric" value={f.minOrder} onChange={set('minOrder')} />
          </Field>
          <Field label="Total uses" htmlFor="c-lim" hint="0 = unlimited">
            <Input id="c-lim" type="number" inputMode="numeric" value={f.usageLimit} onChange={set('usageLimit')} />
          </Field>
          <Field label="Uses per customer" htmlFor="c-per" hint="0 = unlimited">
            <Input id="c-per" type="number" inputMode="numeric" value={f.perUserLimit} onChange={set('perUserLimit')} />
          </Field>
          <Field label="Starts" htmlFor="c-start">
            <Input id="c-start" type="date" value={f.startsAt} onChange={set('startsAt')} />
          </Field>
          <Field label="Ends" htmlFor="c-end">
            <Input id="c-end" type="date" value={f.endsAt} onChange={set('endsAt')} />
          </Field>
        </div>
        <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active" hint="Turn off to pause the coupon" />
      </div>
    </Sheet>
  );
}

export default function Coupons() {
  const toast = useToast();
  const { data, loading } = useCoupons();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const state = (c) =>
    !c.active
      ? ['Paused', 'grey']
      : c.endsAt && new Date(c.endsAt) < now
        ? ['Expired', 'grey']
        : c.usageLimit && c.usedCount >= c.usageLimit
          ? ['Used up', 'grey']
          : ['Active', 'green'];
  const remove = async () => {
    setBusy(true);
    try {
      await deleteCoupon(removing._id);
      toast('Coupon deleted');
      setRemoving(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminHeader />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Coupons</h1>
          <Button size="sm" className="px-4" onClick={() => setEditing({})}>
            + New coupon
          </Button>
        </div>
        {loading && !data ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : !data?.length ? (
          <EmptyState icon="sell" title="No coupons yet" body="Create a code customers can enter at checkout." />
        ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {data.map((c) => {
              const [word, tone] = state(c);
              return (
                <Card key={c._id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-title-md text-[16px] text-primary tracking-wider">{c.code}</p>
                      <p className="font-body-sm text-[13px] text-on-surface">
                        {c.type === 'percent'
                          ? `${c.value}% off${c.maxDiscount ? ` (up to ${formatINR(c.maxDiscount)})` : ''}`
                          : `${formatINR(c.value)} off`}
                        {c.minOrder ? ` on ${formatINR(c.minOrder)}+` : ''}
                      </p>
                      <p className="font-label-md text-label-md text-on-surface-variant">
                        Used {c.usedCount}
                        {c.usageLimit ? ` of ${c.usageLimit}` : ''}
                        {c.endsAt ? ` · until ${formatDate(c.endsAt)}` : ''}
                      </p>
                    </div>
                    <ToneChip tone={tone}>{word}</ToneChip>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <Button variant="ghost" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button variant="ghost" onClick={() => setRemoving(c)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageContainer>
      <AdminNav />
      {editing && <CouponSheet coupon={editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmSheet
          title={`Delete ${removing.code}?`}
          body="Customers will no longer be able to use it. Past orders keep their discount."
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}
