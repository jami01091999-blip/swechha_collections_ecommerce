import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { Button, Card, ConfirmSheet, EmptyState, Input, PageContainer, Sheet, Skeleton, ToneChip } from '../../components/ui';
import { ORDER_STATUS, formatDate } from '../../components/shop/ShopBits';
import { setCustomerBlocked, useCustomer, useCustomers } from '../../lib/api';
import { ADMIN_BASE } from '../../lib/constants';
import { formatINR } from '../../lib/format';
import { useToast } from '../../context/Toast';

function CustomerSheet({ id, onClose }) {
  const toast = useToast();
  const { data: c, loading } = useCustomer(id);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await setCustomerBlocked(id, !c.isBlocked);
      toast(c.isBlocked ? 'Customer unblocked' : 'Customer blocked');
      setConfirm(false);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose} label="Customer" full>
      {loading || !c ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-primary">{c.name || c.email}</h2>
            <p className="font-body-sm text-[13px] text-on-surface-variant break-all">
              {c.email}
              {c.phone ? ` · ${c.phone}` : ''}
            </p>
            <p className="font-label-md text-label-md text-on-surface-variant">Joined {formatDate(c.createdAt)}</p>
            {c.isBlocked && <ToneChip tone="red">Blocked</ToneChip>}
          </div>
          <div>
            <h3 className="field-label">Orders</h3>
            {c.orders.length ? (
              <div className="divide-y divide-outline-variant/20">
                {c.orders.map((o) => (
                  <Link key={o._id} to={`${ADMIN_BASE}/orders/${o._id}`} className="flex items-center justify-between py-2">
                    <span className="font-body-sm text-[13px]">
                      {o.orderNumber} · {formatDate(o.placedAt)}
                    </span>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {formatINR(o.total)} · {(ORDER_STATUS[o.status] || [o.status])[0]}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="font-body-sm text-[13px] text-on-surface-variant">No orders yet.</p>
            )}
          </div>
          <div>
            <h3 className="field-label">Addresses</h3>
            {c.addresses.map((a) => (
              <p key={a._id} className="font-body-sm text-[13px] text-on-surface-variant">
                {a.fullName}, {a.line1}, {a.city} {a.pincode} · {a.phone}
              </p>
            ))}
          </div>
          <Button variant={c.isBlocked ? 'secondary' : 'danger'} size="sm" className="w-full" onClick={() => setConfirm(true)}>
            {c.isBlocked ? 'Unblock customer' : 'Block customer'}
          </Button>
        </div>
      )}
      {confirm && (
        <ConfirmSheet
          title={c.isBlocked ? 'Unblock this customer?' : 'Block this customer?'}
          body={
            c.isBlocked
              ? 'They can sign in and order again.'
              : 'They are signed out everywhere and can’t sign in or order. Use for fraud or repeated refused COD orders.'
          }
          confirmLabel={c.isBlocked ? 'Unblock' : 'Block'}
          busy={busy}
          onConfirm={toggle}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useCustomers({ q: search || undefined, page });
  const open = params.get('open');
  return (
    <>
      <AdminHeader />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-3">
        <h1 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Customers{data ? ` (${data.total})` : ''}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
            setPage(1);
          }}
        >
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email or phone"
            aria-label="Search customers"
          />
        </form>
        {error && !data ? (
          <Card className="text-center">
            <p className="font-body-sm text-body-sm">{error.message}</p>
            <Button variant="ghost" onClick={reload}>
              Try again
            </Button>
          </Card>
        ) : loading && !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : !data.items.length ? (
          <EmptyState icon="group" title="No customers yet" body="People appear here after they sign in for the first time." />
        ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {data.items.map((c) => (
              <Card
                as="button"
                type="button"
                key={c._id}
                onClick={() => setParams({ open: c._id })}
                className="w-full text-left flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block font-title-md text-[14px] text-on-surface truncate">{c.name || c.email}</span>
                  <span className="block font-label-md text-label-md text-on-surface-variant truncate">{c.email}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block font-title-md text-[14px] text-primary">{formatINR(c.spent)}</span>
                  <span className="block font-label-md text-label-md text-on-surface-variant">
                    {c.orders} order{c.orders === 1 ? '' : 's'}
                    {c.isBlocked ? ' · blocked' : ''}
                  </span>
                </span>
              </Card>
            ))}
          </div>
        )}
        {data?.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" className="px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="font-label-md text-label-md">
              {page} / {data.totalPages}
            </span>
            <Button variant="secondary" size="sm" className="px-4" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </PageContainer>
      <AdminNav />
      {open && <CustomerSheet id={open} onClose={() => setParams({})} />}
    </>
  );
}
