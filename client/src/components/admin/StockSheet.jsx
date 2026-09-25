import { useState } from 'react';
import { Sheet, Stepper, StockStateChip, Thumb } from './bits';
import { updateProduct } from '../../lib/api';
import { threshold } from '../../lib/stock';
import { useToast } from '../../context/Toast';

/** Quick Stock Update — change quantities without opening the full form. */
export default function StockSheet({ product, onClose }) {
  const toast = useToast();
  const sized = product.sizeType === 'sized';
  const [sizes, setSizes] = useState(() => (product.sizes || []).map((s) => ({ ...s })));
  const [free, setFree] = useState(product.freeSizeStock || 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const limit = threshold(product);

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await updateProduct(product._id, sized ? { sizes } : { freeSizeStock: free });
      toast('Stock updated');
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const row = 'flex items-center justify-between gap-2 py-2.5 border-b border-outline-variant/20 last:border-0';
  return (
    <Sheet onClose={onClose} label="Quick stock update">
      <div className="flex items-center gap-3">
        <Thumb p={product} />
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-secondary uppercase tracking-wider font-semibold">Quick Stock Update</p>
          <h2 className="font-title-md text-title-md text-primary leading-tight truncate">{product.name}</h2>
          <p className="font-label-md text-label-md text-on-surface-variant">{product.code}</p>
        </div>
      </div>
      <div className="admin-card mt-3 py-1">
        {sized ? (
          sizes.map((s, i) => (
            <div key={s.label} className={row}>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-title-md text-[15px] text-on-surface">{s.label}</span>
                <StockStateChip stock={s.stock} limit={limit} />
              </div>
              <Stepper label={s.label} value={s.stock} onChange={(v) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, stock: v } : x)))} />
            </div>
          ))
        ) : (
          <div className={row}>
            <div className="flex flex-col gap-1">
              <span className="font-title-md text-[15px] text-on-surface">Free Size</span>
              <StockStateChip stock={free} limit={limit} />
            </div>
            <Stepper label="Free Size" value={free} onChange={setFree} />
          </div>
        )}
      </div>
      {err && <p className="font-body-sm text-[12px] text-error mt-2">{err}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="w-full mt-4 bg-primary-container hover:bg-[#541423] text-surface-container-lowest py-3.5 rounded-xl font-title-md text-title-md font-semibold shadow-luxury active:scale-95 transition-all disabled:opacity-60"
        type="button"
      >
        {busy ? 'Saving…' : 'Save Stock'}
      </button>
    </Sheet>
  );
}
