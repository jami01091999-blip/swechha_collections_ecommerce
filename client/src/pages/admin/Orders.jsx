import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { Button, Card, Chip, EmptyState, Input, PageContainer, Skeleton, ToneChip } from '../../components/ui';
import Icon from '../../components/shared/Icon';
import Img from '../../components/shared/Img';
import { ORDER_STATUS, PAYMENT_STATUS, RETURN_STATUS, formatDateTime } from '../../components/shop/ShopBits';
import { useAdminOrders } from '../../lib/api';
import { isAdmin, useAuth } from '../../lib/auth';
import { ADMIN_BASE } from '../../lib/constants';
import { formatINR } from '../../lib/format';

export const ORDER_TABS = [
  ['new', 'To pack'],
  ['packed', 'To ship'],
  ['shipped', 'In transit'],
  ['delivered', 'Delivered'],
  ['returns', 'Returns'],
  ['unpaid', 'Unpaid'],
  ['cancelled', 'Cancelled'],
  ['all', 'All'],
];

export default function Orders() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'new';
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAdminOrders({ tab, q: params.get('q') || undefined, page });
  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
    setPage(1);
  };
  return (
    <>
      <AdminHeader />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Orders</h1>
          {isAdmin(user) && (
            <Button as="a" href="/api/admin/orders/export.csv" variant="secondary" size="sm" className="px-3 flex items-center gap-1">
              <Icon name="download" className="text-[18px]" /> Export
            </Button>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: q.trim(), tab: q.trim() ? 'all' : tab });
          }}
        >
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search order, name, phone, email or AWB"
            aria-label="Search orders"
          />
        </form>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-gutter-mobile px-gutter-mobile md:mx-0 md:px-0">
          {ORDER_TABS.map(([k, label]) => (
            <Chip key={k} active={tab === k} onClick={() => set({ tab: k })}>
              {label}
              {data?.counts?.[k] ? ` (${data.counts[k]})` : ''}
            </Chip>
          ))}
        </div>
        {error && !data ? (
          <Card className="text-center">
            <p className="font-body-sm text-body-sm">{error.message}</p>
            <Button variant="ghost" onClick={reload} className="mt-2">
              Try again
            </Button>
          </Card>
        ) : loading && !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : !data.items.length ? (
          <EmptyState
            icon="inventory_2"
            title="No orders here"
            body={tab === 'new' ? 'New orders to pack will show up here.' : 'Try another tab or search.'}
          />
        ) : (
          <>
            <div className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
              {data.items.map((o) => {
                const [word, tone] = ORDER_STATUS[o.status] || [o.status, 'grey'];
                return (
                  <Card
                    as={Link}
                    key={o._id}
                    to={`${ADMIN_BASE}/orders/${o._id}`}
                    className="block hover:border-outline-variant transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-title-md text-[15px] text-primary">{o.orderNumber}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant truncate">
                          {o.customerName} · {o.city} · {formatDateTime(o.placedAt)}
                        </p>
                      </div>
                      <p className="font-title-md text-[15px] text-on-surface shrink-0">{formatINR(o.total)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="flex gap-1.5">
                        {o.thumbs.map((t, i) => (
                          <div
                            key={i}
                            className="w-9 h-12 rounded-md overflow-hidden bg-surface-container border border-outline-variant/30"
                          >
                            <Img src={t} alt="" width={80} className="w-full h-full object-cover" />
                          </div>
                        ))}
                        <span className="self-end font-label-md text-label-md text-on-surface-variant ml-1">{o.itemCount} pc</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <ToneChip tone={tone}>{word}</ToneChip>
                        <span className="font-label-md text-[10px] text-on-surface-variant">
                          {o.payment.method === 'cod' ? 'COD' : 'Online'} · {PAYMENT_STATUS[o.payment.status]}
                        </span>
                        {o.returnStatus && <ToneChip tone="amber">{RETURN_STATUS[o.returnStatus]}</ToneChip>}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                <Button variant="secondary" size="sm" className="px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Newer
                </Button>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {page} / {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="px-4"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Older
                </Button>
              </div>
            )}
          </>
        )}
      </PageContainer>
      <AdminNav />
    </>
  );
}
