import { useEffect, useState } from 'react';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { Section } from '../../components/admin/FormBits';
import { Button, Field, Input, PageContainer, Select, Skeleton, Switch, Textarea } from '../../components/ui';
import { saveShopRules, useShopRules } from '../../lib/api';
import { isAdmin, useAuth } from '../../lib/auth';
import { INDIAN_STATES } from '../../lib/india';
import { useToast } from '../../context/Toast';

export default function ShopRules() {
  const toast = useToast();
  const { user } = useAuth();
  const { data, loading } = useShopRules();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !f) setF({ ...data, codBlockedPincodePrefixes: (data.codBlockedPincodePrefixes || []).join(', ') });
  }, [data, f]);
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const str = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveShopRules(f);
      setF({ ...saved, codBlockedPincodePrefixes: saved.codBlockedPincodePrefixes.join(', ') });
      toast('Shop rules saved');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  const readOnly = !isAdmin(user);
  return (
    <>
      <AdminHeader />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-4">
        <div>
          <h1 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Shop rules</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Delivery charges, cash on delivery, returns and invoice details.
          </p>
        </div>
        {loading || !f ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)
        ) : (
          <fieldset disabled={readOnly} className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:items-start">
            <Section title="Delivery">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Delivery charge (₹)" htmlFor="s-fee">
                  <Input id="s-fee" type="number" inputMode="numeric" value={f.shippingFee} onChange={num('shippingFee')} />
                </Field>
                <Field label="Free above (₹)" htmlFor="s-free" hint="0 = always free">
                  <Input id="s-free" type="number" inputMode="numeric" value={f.freeShippingAbove} onChange={num('freeShippingAbove')} />
                </Field>
                <Field label="Fastest (days)" htmlFor="s-min">
                  <Input id="s-min" type="number" inputMode="numeric" value={f.deliveryDaysMin} onChange={num('deliveryDaysMin')} />
                </Field>
                <Field label="Slowest (days)" htmlFor="s-max">
                  <Input id="s-max" type="number" inputMode="numeric" value={f.deliveryDaysMax} onChange={num('deliveryDaysMax')} />
                </Field>
              </div>
              <Field label="Pickup PIN code" htmlFor="s-pick" hint="Where parcels leave from (used for delivery estimates)">
                <Input id="s-pick" inputMode="numeric" value={f.pickupPincode} onChange={str('pickupPincode')} />
              </Field>
            </Section>
            <Section title="Cash on delivery">
              <Switch checked={f.codEnabled} onChange={(v) => setF({ ...f, codEnabled: v })} label="Offer cash on delivery" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="COD fee (₹)" htmlFor="s-codfee">
                  <Input id="s-codfee" type="number" inputMode="numeric" value={f.codFee} onChange={num('codFee')} />
                </Field>
                <Field label="Max order (₹)" htmlFor="s-codmax" hint="0 = no limit">
                  <Input id="s-codmax" type="number" inputMode="numeric" value={f.codMaxOrderValue} onChange={num('codMaxOrderValue')} />
                </Field>
              </div>
              <Field label="No COD for PIN codes starting with" htmlFor="s-codblock" hint="Comma-separated, e.g. 19, 744">
                <Input id="s-codblock" value={f.codBlockedPincodePrefixes} onChange={str('codBlockedPincodePrefixes')} />
              </Field>
            </Section>
            <Section title="Returns and payment">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Return window (days)" htmlFor="s-ret" hint="0 = no returns">
                  <Input id="s-ret" type="number" inputMode="numeric" value={f.returnWindowDays} onChange={num('returnWindowDays')} />
                </Field>
                <Field label="Time to pay (minutes)" htmlFor="s-res" hint="Unpaid online orders release stock after this">
                  <Input id="s-res" type="number" inputMode="numeric" value={f.reservationMinutes} onChange={num('reservationMinutes')} />
                </Field>
              </div>
            </Section>
            <Section title="Business details (invoices)">
              <Field label="Business name" htmlFor="s-bn">
                <Input id="s-bn" value={f.businessName} onChange={str('businessName')} />
              </Field>
              <Field label="GSTIN" htmlFor="s-gst" hint="Leave empty if you are not registered yet">
                <Input id="s-gst" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Registered state" htmlFor="s-state">
                <Select id="s-state" value={f.businessState} onChange={str('businessState')}>
                  {INDIAN_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Business address" htmlFor="s-addr">
                <Textarea id="s-addr" rows={2} value={f.businessAddress} onChange={str('businessAddress')} />
              </Field>
            </Section>
          </fieldset>
        )}
        {f && !readOnly && (
          <Button size="lg" className="w-full md:w-auto md:px-12" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save shop rules'}
          </Button>
        )}
        {readOnly && <p className="font-body-sm text-[12px] text-on-surface-variant">Only admins can change these.</p>}
      </PageContainer>
      <AdminNav />
    </>
  );
}
