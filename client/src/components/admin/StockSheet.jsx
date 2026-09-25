import { useState } from 'react';
import { Thumb } from './bits';
import { Button, Card, Sheet, Stepper, StockStateChip } from '../ui';
import { updateStock } from '../../lib/api';
import { availableOf, threshold } from '../../lib/stock';
import { useToast } from '../../context/Toast';

/** Size rows to edit: stored sizes, or one FREE row for products saved before Phase 2. */
const editableRows = (p) =>
  p.sizes?.length
    ? p.sizes.map((s) => ({ ...s, reserved: s.reserved || 0 }))
    : [{ label: 'FREE', stock: Number(p.freeSizeStock) || 0, reserved: 0 }];

/** Quick Stock Update — change quantities without opening the full form. Stock can't go below what is reserved. */
export default function StockSheet({ product, onClose }) {
  const toast = useToast();
  const [sizes, setSizes] = useState(() => editableRows(product));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const limit = threshold(product);

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await updateStock(
        product._id,
        sizes.map(({ label, stock }) => ({ label, stock }))
      );
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
      <Card className="mt-3 py-1">
        {sizes.map((s, i) => {
          const label = s.label === 'FREE' ? 'Free Size' : s.label;
          return (
            <div key={s.label} className={row}>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-title-md text-[15px] text-on-surface">{label}</span>
                <StockStateChip stock={availableOf(s)} limit={limit} />
                {s.reserved > 0 && <span className="font-label-md text-label-md text-on-surface-variant">Reserved: {s.reserved}</span>}
              </div>
              <Stepper
                label={label}
                value={s.stock}
                min={s.reserved}
                onChange={(v) => setSizes((all) => all.map((x, j) => (j === i ? { ...x, stock: v } : x)))}
              />
            </div>
          );
        })}
      </Card>
      {err && <p className="font-body-sm text-[12px] text-error mt-2">{err}</p>}
      <Button size="lg" className="w-full mt-4" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save Stock'}
      </Button>
    </Sheet>
  );
}
