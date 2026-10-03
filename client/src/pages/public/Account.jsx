import { useMyOrders } from '../../lib/api';
import { ORDER_STATUS } from '../../components/shop/ShopBits';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import AddressSheet from '../../components/account/AddressSheet';
import Icon from '../../components/shared/Icon';
import { Button, Card, ConfirmSheet, EmptyState, Field, Input, PageContainer, Skeleton, ToneChip } from '../../components/ui';
import { deleteAddress, logout, logoutAll, makeDefaultAddress, updateMe, useAddresses } from '../../lib/api';
import { isStaff, useAuth } from '../../lib/auth';
import { useSaved } from '../../lib/wishlist';
import { ADMIN_BASE } from '../../lib/constants';
import { normalizePhone, profileErrors } from '../../lib/validation';
import { useToast } from '../../context/Toast';

function Block({ title, action, children, className }) {
  return (
    <Card as="section" className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-headline-sm text-[18px] leading-tight text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Profile({ user }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const dirty = form.name !== user.name || normalizePhone(form.phone) !== user.phone;

  const save = async (e) => {
    e.preventDefault();
    const found = profileErrors(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const u = await updateMe({ name: form.name, phone: form.phone });
      setForm({ name: u.name, phone: u.phone });
      toast('Details saved');
    } catch (err) {
      setErrors(err.data?.fields || { form: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block title="Your details">
      <form onSubmit={save} noValidate className="space-y-3">
        <Field label="Name" error={errors.name} htmlFor="me-name">
          <Input
            id="me-name"
            autoComplete="name"
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            invalid={!!errors.name}
          />
        </Field>
        <Field label="Mobile number" error={errors.phone} htmlFor="me-phone" hint="Optional. 10 digits.">
          <Input
            id="me-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={16}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            invalid={!!errors.phone}
          />
        </Field>
        <Field label="Email" htmlFor="me-email" hint="You sign in with this email. It can't be changed.">
          <Input id="me-email" value={user.email} disabled readOnly />
        </Field>
        {errors.form && <p className="font-body-sm text-[12px] text-error">{errors.form}</p>}
        <Button type="submit" disabled={busy || !dirty} className="w-full md:w-auto md:px-8">
          {busy ? 'Saving…' : 'Save details'}
        </Button>
      </form>
    </Block>
  );
}

const TYPE_LABEL = { home: 'Home', work: 'Work', other: 'Other' };

function AddressCard({ a, onEdit, onDelete, onDefault }) {
  return (
    <div className="rounded-xl border border-outline-variant/40 p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <ToneChip tone="grey">{TYPE_LABEL[a.type] || 'Home'}</ToneChip>
        {a.isDefault && <ToneChip tone="green">Default</ToneChip>}
      </div>
      <p className="font-title-md text-[15px] text-on-surface">{a.fullName}</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        {[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}
        <br />
        {a.city}, {a.state} {a.pincode}
        <br />
        Mobile: {a.phone}
      </p>
      <div className="flex items-center gap-4 pt-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {!a.isDefault && (
          <Button variant="ghost" size="sm" onClick={onDefault}>
            Make default
          </Button>
        )}
        <button type="button" onClick={onDelete} className="font-label-lg text-label-lg text-error underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function Addresses({ user }) {
  const toast = useToast();
  const { data: list, loading, error, reload } = useAddresses();
  const [editing, setEditing] = useState(null); // null | {} (new) | address
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const full = (list?.length || 0) >= 10;

  const remove = async () => {
    setBusy(true);
    try {
      await deleteAddress(deleting._id);
      toast('Address deleted');
      setDeleting(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (a) => {
    try {
      await makeDefaultAddress(a._id);
      toast('Default address updated');
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <Block
      title="Saved addresses"
      action={
        list?.length > 0 &&
        !full && (
          <Button variant="ghost" size="sm" onClick={() => setEditing({})}>
            + Add address
          </Button>
        )
      }
    >
      {error && !list ? (
        <div className="text-center py-4">
          <p className="font-body-sm text-body-sm text-on-surface">{error.message}</p>
          <Button variant="ghost" size="sm" onClick={reload} className="mt-2">
            Try again
          </Button>
        </div>
      ) : loading && !list ? (
        <div className="space-y-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : list.length ? (
        <div className="space-y-2.5">
          {list.map((a) => (
            <AddressCard key={a._id} a={a} onEdit={() => setEditing(a)} onDelete={() => setDeleting(a)} onDefault={() => makeDefault(a)} />
          ))}
          {full && <p className="font-body-sm text-[12px] text-on-surface-variant">You can save up to 10 addresses.</p>}
        </div>
      ) : (
        <div className="text-center py-4">
          <Icon name="home_pin" className="text-4xl text-outline" />
          <p className="font-title-md text-[15px] text-primary mt-1">No saved addresses</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Add an address to check out faster.</p>
          <Button size="sm" onClick={() => setEditing({})} className="mt-3 px-5">
            Add address
          </Button>
        </div>
      )}
      {editing && <AddressSheet address={editing} defaultName={user.name} defaultPhone={user.phone} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmSheet
          title="Delete this address?"
          body={`${deleting.line1}, ${deleting.city} will be removed from your account.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </Block>
  );
}

function RecentOrders() {
  const { data, loading } = useMyOrders(1);
  if (loading && !data) return <Skeleton className="h-16 rounded-xl" />;
  if (!data?.items?.length) return <EmptyState icon="receipt_long" title="No orders yet" body="Your orders will appear here." />;
  return (
    <div className="space-y-2">
      {data.items.slice(0, 3).map((o) => (
        <Link
          key={o._id}
          to={`/account/orders/${o.orderNumber}`}
          className="flex items-center justify-between gap-2 py-2 border-b border-outline-variant/20 last:border-0"
        >
          <span>
            <span className="block font-title-md text-[14px] text-primary">{o.orderNumber}</span>
            <span className="block font-label-md text-label-md text-on-surface-variant">
              {new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ₹{o.total.toLocaleString('en-IN')}
            </span>
          </span>
          <ToneChip tone={(ORDER_STATUS[o.status] || [])[1] || 'grey'}>{(ORDER_STATUS[o.status] || [o.status])[0]}</ToneChip>
        </Link>
      ))}
      <Link to="/account/orders" className="inline-block pt-1 font-label-lg text-label-lg text-secondary hover:text-primary">
        All orders
      </Link>
    </div>
  );
}

export default function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmAll, setConfirmAll] = useState(false);
  const { count: savedCount } = useSaved();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    await logout().catch(() => {});
    toast('You are signed out');
    navigate('/', { replace: true });
  };

  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      await logoutAll();
      toast('Signed out on all devices');
      navigate('/', { replace: true });
    } catch (e) {
      toast(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="My account" subtitle={user.email} />
      <PageContainer as="main" className="px-margin-mobile pt-4 md:pt-8 flex-1 space-y-4">
        <div>
          <h1 className="font-headline-md text-[24px] md:text-headline-md text-primary">Hello, {user.name || 'there'}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant break-all">{user.email}</p>
        </div>

        <Card as={Link} to="/saved" className="flex items-center justify-between gap-3 hover:border-outline-variant transition-colors">
          <span className="flex items-center gap-3">
            <Icon name="favorite" className="text-[22px] text-primary" />
            <span className="font-title-md text-[15px] text-primary">Saved designs ({savedCount})</span>
          </span>
          <Icon name="chevron_right" className="text-outline" />
        </Card>

        {isStaff(user) && (
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="font-title-md text-[15px] text-primary">Admin</p>
              <p className="font-body-sm text-[12px] text-on-surface-variant">Manage products and the lookbook.</p>
            </div>
            <Button as={Link} to={ADMIN_BASE} size="sm" className="px-4 shrink-0">
              Open admin
            </Button>
          </Card>
        )}

        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
          <div className="space-y-4">
            <Profile key={user._id} user={user} />
            <Block title="My orders">
              <RecentOrders />
            </Block>
          </div>
          <Addresses user={user} />
        </div>

        <div className="flex flex-col md:flex-row gap-2.5 pt-2">
          <Button variant="secondary" size="sm" onClick={signOut} className="md:px-8">
            Log out
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)} className="py-2">
            Log out of all devices
          </Button>
        </div>
      </PageContainer>
      <BottomNav />
      {confirmAll && (
        <ConfirmSheet
          title="Log out of all devices?"
          body="You'll need a new email code to sign in again on every phone and computer, including this one."
          confirmLabel="Log out everywhere"
          busy={busy}
          onConfirm={signOutEverywhere}
          onClose={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}
