import { useState } from 'react';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { Button, Card, EmptyState, PageContainer, Skeleton } from '../../components/ui';
import { formatDateTime } from '../../components/shop/ShopBits';
import { useAudit } from '../../lib/api';

/** Who changed what: orders, refunds, stock, products, coupons, team, settings, staff sign-ins. */
export default function Activity() {
  const [page, setPage] = useState(1);
  const { data, loading } = useAudit(page);
  return (
    <>
      <AdminHeader />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-3">
        <h1 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Activity</h1>
        {loading && !data ? (
          <Skeleton className="h-60 rounded-xl" />
        ) : !data?.items.length ? (
          <EmptyState icon="history" title="No activity yet" body="Admin actions are recorded here." />
        ) : (
          <Card className="divide-y divide-outline-variant/20 py-1">
            {data.items.map((e) => (
              <div key={e._id} className="py-2.5 flex flex-col md:flex-row md:items-baseline md:gap-4">
                <span className="font-label-md text-label-md text-on-surface-variant md:w-36 shrink-0">{formatDateTime(e.at)}</span>
                <span className="font-body-sm text-[13px] text-on-surface flex-1">{e.summary || e.action}</span>
                <span className="font-label-md text-label-md text-secondary break-all">{e.actorEmail}</span>
              </div>
            ))}
          </Card>
        )}
        {data?.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" size="sm" className="px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Newer
            </Button>
            <span className="font-label-md text-label-md">
              {page} / {data.totalPages}
            </span>
            <Button variant="secondary" size="sm" className="px-4" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Older
            </Button>
          </div>
        )}
      </PageContainer>
      <AdminNav />
    </>
  );
}
