import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import { Button, Card, EmptyState, PageContainer, Skeleton, ToneChip } from '../../components/ui';
import Img from '../../components/shared/Img';
import { ORDER_STATUS, formatDate } from '../../components/shop/ShopBits';
import { useMyOrders } from '../../lib/api';
import { formatINR } from '../../lib/format';
import { LoadError } from './Home';

export default function MyOrders() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useMyOrders(page);
  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title="My orders" subtitle={data ? `${data.total} order${data.total === 1 ? '' : 's'}` : ''} />
      <PageContainer className="hidden md:flex items-baseline justify-between pt-8 pb-2">
        <h1 className="font-headline-md text-headline-md text-primary">My orders</h1>
        <Link to="/account" className="font-label-lg text-label-lg text-secondary hover:text-primary">
          My account
        </Link>
      </PageContainer>
      <PageContainer as="main" className="px-margin-mobile pt-4 flex-1 space-y-3">
        {error && !data ? (
          <LoadError error={error} onRetry={reload} />
        ) : loading && !data ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : !data.items.length ? (
          <EmptyState icon="receipt_long" title="No orders yet" body="When you place an order it will appear here with its tracking.">
            <Button as={Link} to="/collection" size="sm" className="px-5 mt-4">
              Browse designs
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              {data.items.map((o) => {
                const [word, tone] = ORDER_STATUS[o.status] || [o.status, 'grey'];
                return (
                  <Card
                    as={Link}
                    key={o._id}
                    to={`/account/orders/${o.orderNumber}`}
                    className="block hover:border-outline-variant transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-title-md text-[14px] text-primary">{o.orderNumber}</p>
                        <p className="font-label-md text-label-md text-on-surface-variant">
                          {formatDate(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {formatINR(o.total)}
                        </p>
                      </div>
                      <ToneChip tone={tone}>{word}</ToneChip>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {o.items.map((i, k) => (
                        <div key={k} className="w-12 h-16 rounded-lg overflow-hidden bg-surface-container border border-outline-variant/30">
                          <Img src={i.image} alt={i.name} width={120} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    {o.canPay && (
                      <p className="mt-2 font-label-md text-label-md text-secondary font-semibold">Payment pending — tap to pay</p>
                    )}
                  </Card>
                );
              })}
            </div>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="secondary" size="sm" className="px-4" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Newer
                </Button>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  Page {page} of {data.totalPages}
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
      <BottomNav />
    </div>
  );
}
