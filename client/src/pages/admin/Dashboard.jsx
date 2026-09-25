import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { StatusChip, Thumb, ToneChip } from '../../components/admin/bits';
import StockSheet from '../../components/admin/StockSheet';
import Icon from '../../components/shared/Icon';
import ScrollToHash from '../../components/shared/ScrollToHash';
import { useAdminProducts, useSettings } from '../../lib/api';
import { ADESK, ADMIN_BASE, categoryMeta } from '../../lib/constants';
import { formatINR } from '../../lib/format';
import { attentionChip, isOutOfStock, stockSummary, threshold } from '../../lib/stock';

export function useInventoryStats(products) {
  return useMemo(() => {
    const list = products || [];
    const out = list.filter(isOutOfStock);
    const low = list.filter((p) => !isOutOfStock(p) && stockSummary(p).low.length > 0);
    const attention = list.filter((p) => attentionChip(p));
    return {
      total: list.length,
      categories: new Set(list.map((p) => p.category)).size,
      published: list.filter((p) => p.status === 'published').length,
      drafts: list.filter((p) => p.status !== 'published').length,
      out: out.length,
      low: low.length,
      lowLimit: Math.max(2, ...list.map(threshold)),
      attention,
    };
  }, [products]);
}

function Stat({ label, icon, value, note, iconWrap, valueClass, noteClass, hover }) {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-3.5 flex flex-col justify-between shadow-luxury-subtle ${hover} transition-all duration-200`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">{label}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconWrap}`}>
          <Icon name={icon} className="text-[19px]" />
        </div>
      </div>
      <div className="mt-2.5">
        <span className={`font-headline-md text-headline-md font-semibold ${valueClass}`}>{value}</span>
        <span className={`font-label-md text-label-md block mt-0.5 ${noteClass}`}>{note}</span>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex items-center gap-3">
      <div className="w-14 h-16 rounded-lg bg-surface-container animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-surface-container animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-surface-container animate-pulse" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: products, loading, error, reload } = useAdminProducts();
  const { data: settings } = useSettings();
  const stats = useInventoryStats(products);
  const [stockFor, setStockFor] = useState(null);
  const recent = [...(products || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  const live = stats.published > 0;

  const tip =
    stats.drafts > 0
      ? { title: 'Drafts waiting', text: `${stats.drafts} product${stats.drafts === 1 ? ' is' : 's are'} saved as draft and hidden from customers. Open them from Products and publish when ready.` }
      : stats.out > 0
        ? { title: 'Restock reminder', text: `${stats.out} product${stats.out === 1 ? ' shows' : 's show'} “Out of Stock” to customers. Update stock as soon as new pieces arrive.` }
        : { title: 'Catalogue in good shape', text: 'Every published design has stock. Add new arrivals with the + button.' };

  return (
    <>
      <ScrollToHash ready={!loading} />
      <AdminHeader alerts={stats.attention.length} />
      <main className={`px-gutter-mobile space-y-5 md:space-y-7 pt-3 md:pt-6 ${ADESK}`}>
        {/* Live bar */}
        <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 shadow-luxury-subtle">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${live ? 'bg-emerald-600 animate-pulse' : 'bg-outline'}`} />
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface-variant font-medium">{live ? 'Boutique Catalogue Live' : 'Catalogue Offline'}</p>
              <p className="font-body-sm text-body-sm text-on-surface font-medium truncate">{settings?.collectionName || 'Swechha Collections'}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-label-md text-label-md text-secondary border border-secondary/30 bg-surface-container-low px-2 py-1 rounded-full">Private Salon</span>
          </div>
        </div>

        {error && !products && (
          <div className="admin-card text-center">
            <p className="font-body-sm text-body-sm text-on-surface">{error.message}</p>
            <button onClick={reload} className="mt-2 font-label-lg text-label-lg text-primary underline" type="button">
              Try again
            </button>
          </div>
        )}

        {/* Inventory Snapshot */}
        <section>
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <h2 className="font-headline-sm text-headline-sm text-primary">Inventory Snapshot</h2>
            <button onClick={reload} className="font-label-md text-label-md text-on-surface-variant hover:text-primary" type="button">
              {loading ? 'Syncing…' : 'Real-time Sync'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-4">
            <Stat
              label="Total Products" icon="inventory_2" value={stats.total}
              note={`${stats.categories} Active Categor${stats.categories === 1 ? 'y' : 'ies'}`}
              iconWrap="bg-surface-container-low text-primary" valueClass="text-primary" noteClass="text-secondary" hover="hover:border-secondary/50"
            />
            <Stat
              label="Published" icon="check_circle" value={stats.published} note="In Online Folio"
              iconWrap="bg-emerald-50 text-emerald-800" valueClass="text-emerald-950" noteClass="text-emerald-700" hover="hover:border-emerald-600/40"
            />
          </div>
        </section>

        {/* Primary CTA (laptop uses the Add Product button in the header) */}
        <div className="md:hidden">
          <button
            onClick={() => navigate(`${ADMIN_BASE}/products/new`)}
            className="w-full bg-primary-container hover:bg-[#541423] text-surface-container-lowest py-3.5 px-space-lg rounded-xl font-title-md text-title-md font-semibold flex items-center justify-center gap-2 shadow-luxury active:scale-95 transition-all duration-150 border border-primary-fixed/20"
            type="button"
          >
            <Icon name="add" className="text-[20px]" />
            <span>Add New Product</span>
            <Icon name="auto_awesome" className="text-[18px] text-tertiary-fixed opacity-80" />
          </button>
        </div>

        <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-1 md:gap-6 md:items-start">
        {/* Recently Added */}
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-headline-sm text-headline-sm text-primary">Recently Added</h2>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            </div>
            <Link to={`${ADMIN_BASE}/products`} className="font-label-lg text-label-lg text-secondary hover:text-primary font-semibold transition-colors flex items-center gap-0.5">
              View All
              <Icon name="chevron_right" className="text-[15px]" />
            </Link>
          </div>
          <div className="space-y-2">
            {loading && !products ? (
              <RowSkeleton />
            ) : recent.length ? (
              recent.map((p) => (
                <Link
                  key={p._id}
                  to={`${ADMIN_BASE}/products/${p._id}`}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex items-center justify-between shadow-luxury-subtle hover:border-outline-variant transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Thumb p={p} />
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-title-md text-title-md text-primary leading-tight truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                        <span>{p.category}</span>
                        <span>•</span>
                        <span className="font-semibold text-on-surface">{formatINR(p.price)}</span>
                      </div>
                      <StatusChip status={p.status} />
                    </div>
                  </div>
                  <span aria-label="Edit product" className="p-2 text-on-surface-variant hover:text-primary rounded-lg">
                    <Icon name="edit" className="text-[20px]" />
                  </span>
                </Link>
              ))
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant px-0.5">No products yet. Tap “Add New Product” to create the first one.</p>
            )}
          </div>
        </section>

        </div>

        {/* Tip */}
        <div className="bg-surface-container-low border border-secondary/20 rounded-xl p-3.5 flex items-start gap-3">
          <Icon name="lightbulb" className="text-secondary text-[22px] shrink-0 mt-0.5" />
          <div>
            <p className="font-label-lg text-label-lg text-primary font-semibold">{tip.title}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed">{tip.text}</p>
          </div>
        </div>
      </main>
      <AdminNav />
      {stockFor && <StockSheet product={stockFor} onClose={() => setStockFor(null)} />}
    </>
  );
}
