import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { StatusChip, Thumb, ToneChip } from '../../components/admin/bits';
import StockSheet from '../../components/admin/StockSheet';
import Icon from '../../components/shared/Icon';
import { deleteProduct, useAdminProducts } from '../../lib/api';
import { ADESK, ADMIN_BASE, CATEGORIES } from '../../lib/constants';
import { formatINR } from '../../lib/format';
import { attentionChip, isOutOfStock, sizeRows, totalStock } from '../../lib/stock';
import { useInventoryStats } from './Dashboard';
import { ConfirmSheet } from '../../components/admin/bits';

const STATUS_FILTERS = [
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'attention', label: 'Needs Attention' },
];

const chip = (active) =>
  `shrink-0 px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors active:scale-95 border ${
    active ? 'bg-primary-container text-white border-primary-container font-semibold shadow-sm' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container'
  }`;

export default function Products() {
  const { data: products, loading, error, reload } = useAdminProducts();
  const stats = useInventoryStats(products);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState('');
  const [stockFor, setStockFor] = useState(null);
  const [deleteProductId, setDeleteProductId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const items = useMemo(() => {
    let list = products || [];
    if (cat) list = list.filter((p) => p.category === cat);
    if (status === 'published' || status === 'draft') list = list.filter((p) => p.status === status);
    if (status === 'out') list = list.filter(isOutOfStock);
    if (status === 'attention') list = list.filter((p) => attentionChip(p));
    if (q) {
      const n = q.toLowerCase();
      list = list.filter((p) => [p.name, p.code, p.fabric].some((s) => s?.toLowerCase().includes(n)));
    }
    return list;
  }, [products, cat, status, q]);

  const deletingProduct = products?.find((p) => p._id === deleteProductId) || null;

  const handleDelete = async () => {
    if (!deleteProductId) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteProductId);
      setDeleteProductId(null);
      await reload();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AdminHeader alerts={stats.attention.length} />
      <main className={`pt-3 md:pt-6 space-y-3 ${ADESK}`}>
        <div className="px-gutter-mobile md:px-0 flex items-baseline justify-between">
          <h2 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Products ({products?.length ?? '…'})</h2>
          <Link to={`${ADMIN_BASE}/products/new`} className="font-label-lg text-label-lg text-secondary hover:text-primary font-semibold flex items-center gap-0.5">
            <Icon name="add" className="text-[16px]" /> Add
          </Link>
        </div>
        <div className="px-gutter-mobile md:px-0">
          <label className="relative block md:max-w-md">
            <span className="sr-only">Search products</span>
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, code or fabric" className="field pl-10" />
          </label>
        </div>
        <div className="flex items-center gap-2 px-gutter-mobile md:px-0 overflow-x-auto no-scrollbar">
          <button className={chip(!cat)} onClick={() => setCat('')} type="button">
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={chip(cat === c.key)} onClick={() => setCat(cat === c.key ? '' : c.key)} type="button">
              {c.chip || c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-gutter-mobile md:px-0 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map((s) => (
            <button key={s.key} className={chip(status === s.key)} onClick={() => setStatus(status === s.key ? '' : s.key)} type="button">
              {s.label}
            </button>
          ))}
        </div>

        <div className="px-gutter-mobile md:px-0 space-y-2 pb-4 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-3 md:space-y-0">
          {error && !products ? (
            <div className="admin-card text-center md:col-span-full">
              <p className="font-body-sm text-body-sm">{error.message}</p>
              <button onClick={reload} className="mt-2 font-label-lg text-label-lg text-primary underline" type="button">
                Try again
              </button>
            </div>
          ) : loading && !products ? (
            [0, 1, 2].map((i) => <div key={i} className="h-[92px] rounded-xl bg-surface-container-lowest border border-outline-variant/40 animate-pulse" />)
          ) : items.length ? (
            items.map((p) => {
              const alert = attentionChip(p);
              const rows = sizeRows(p);
              return (
                <div key={p._id} className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-3 flex items-center justify-between gap-2 shadow-luxury-subtle">
                  <Link to={`${ADMIN_BASE}/products/${p._id}`} className="flex items-center gap-3 min-w-0 flex-1">
                    <Thumb p={p} />
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-title-md text-title-md text-primary leading-tight truncate">{p.name}</h3>
                      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
                        <span className="truncate">{p.code}</span>
                        <span>•</span>
                        <span className="font-semibold text-on-surface">{formatINR(p.price)}</span>
                      </div>
                      {p.sizeType === 'sized' && (
                        <p className="font-label-md text-label-md text-on-surface-variant truncate">
                          {rows.map((s) => `${s.label} ${s.stock > 0 ? '✓' : '✕'}`).join('  ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <StatusChip status={p.status} />
                        {alert ? <ToneChip tone={alert.tone}>{alert.text}</ToneChip> : <ToneChip tone="green">{totalStock(p)} in stock</ToneChip>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <Link to={`${ADMIN_BASE}/products/${p._id}`} aria-label={`Edit ${p.name}`} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors active:scale-95">
                      <Icon name="edit" className="text-[20px]" />
                    </Link>
                    <button onClick={() => setStockFor(p)} aria-label={`Update stock for ${p.name}`} className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors active:scale-95" type="button">
                      <Icon name="inventory" className="text-[20px]" />
                    </button>
                    <button onClick={() => setDeleteProductId(p._id)} aria-label={`Delete ${p.name}`} className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors active:scale-95" type="button">
                      <Icon name="delete" className="text-[20px]" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="admin-card text-center py-8 md:col-span-full">
              <Icon name="styler" className="text-3xl text-outline" />
              <p className="font-title-md text-[15px] text-primary mt-1">{products?.length ? 'No products match' : 'No products yet'}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {products?.length ? 'Clear the search or filters.' : 'Add your first design to start the catalogue.'}
              </p>
              {!products?.length && (
                <Link to={`${ADMIN_BASE}/products/new`} className="inline-block mt-3 bg-primary-container text-white px-4 py-2.5 rounded-xl font-label-lg text-label-lg">
                  Add New Product
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
      <AdminNav />
      {stockFor && <StockSheet product={stockFor} onClose={() => setStockFor(null)} />}
      {deleteProductId && deletingProduct && (
        <ConfirmSheet
          title="Are you sure you want to delete?"
          body={`${deletingProduct.name} will be deleted everywhere and removed from the public catalogue.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteProductId(null)}
        />
      )}
    </>
  );
}
