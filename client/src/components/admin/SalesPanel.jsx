import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chip, Skeleton } from '../ui';
import { useSales } from '../../lib/api';
import { ADMIN_BASE } from '../../lib/constants';
import { formatINR } from '../../lib/format';

const RANGES = [
  ['today', 'Today'],
  ['7d', '7 days'],
  ['30d', '30 days'],
];

/** Sales snapshot + work queue for the dashboard (admins). */
export default function SalesPanel() {
  const [range, setRange] = useState('7d');
  const { data, error, reload } = useSales(range);
  const max = Math.max(1, ...(data?.series || []).map((d) => d.revenue));
  const queue = data?.queue;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-primary">Sales</h2>
        <div className="flex gap-1.5">
          {RANGES.map(([k, label]) => (
            <Chip key={k} kind="toggle" active={range === k} onClick={() => setRange(k)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      {!data ? (
        error ? (
          <Card className="text-center font-body-sm text-body-sm">
            {error.message}{' '}
            <button type="button" className="text-primary underline" onClick={reload}>
              Try again
            </button>
          </Card>
        ) : (
          <Skeleton className="h-40 rounded-xl" />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Revenue', formatINR(data.revenue)],
              ['Orders', data.orders],
              ['Average order', formatINR(data.averageOrder)],
              ['COD / online', `${data.cod} / ${data.online}`],
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="field-label">{label}</p>
                <p className="font-headline-sm text-[22px] text-primary">{value}</p>
              </Card>
            ))}
          </div>
          {data.series.length > 1 && (
            <Card>
              <div className="flex items-end gap-1 h-24" aria-label="Revenue per day">
                {data.series.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                    title={`${d.date}: ${formatINR(d.revenue)} · ${d.orders} orders`}
                  >
                    <div
                      className="w-full rounded-t bg-primary-container/80"
                      style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1 font-label-md text-[10px] text-on-surface-variant">
                <span>{data.series[0].date.slice(5)}</span>
                <span>{data.series[data.series.length - 1].date.slice(5)}</span>
              </div>
            </Card>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['To pack', queue.toPack, 'new'],
              ['To ship', queue.toShip, 'packed'],
              ['In transit', queue.inTransit, 'shipped'],
              ['Open returns', queue.returnsOpen, 'returns'],
            ].map(([label, n, tab]) => (
              <Card as={Link} key={label} to={`${ADMIN_BASE}/orders?tab=${tab}`} className="hover:border-outline-variant">
                <p className="field-label">{label}</p>
                <p className="font-headline-sm text-[22px] text-primary">{n}</p>
              </Card>
            ))}
          </div>
          {queue.codOutstanding > 0 && (
            <p className="font-body-sm text-[12px] text-on-surface-variant">
              {formatINR(queue.codOutstanding)} cash on delivery still to be collected.
            </p>
          )}
        </>
      )}
    </section>
  );
}
