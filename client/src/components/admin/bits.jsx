import { useEffect } from 'react';
import Img from '../shared/Img';
import Icon from '../shared/Icon';
import { coverImage } from '../../lib/format';

export function Thumb({ p, src }) {
  return (
    <div className="w-14 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 border border-outline-variant/30">
      <Img src={src ?? coverImage(p)} alt={p?.name || ''} width={140} className="w-full h-full object-cover" />
    </div>
  );
}

/** Status chips from the Needs Attention / Recently Added rows. */
export function ToneChip({ tone = 'grey', children }) {
  const tones = {
    red: 'bg-error-container/70 text-error font-semibold',
    amber: 'bg-secondary-fixed/60 text-on-secondary-container font-semibold',
    green: 'text-emerald-800 bg-emerald-50 border border-emerald-200/60',
    grey: 'text-on-surface-variant bg-surface-container-high border border-outline-variant/40',
  };
  const dots = { red: 'bg-error', amber: 'bg-secondary', green: 'bg-emerald-600', grey: 'bg-outline' };
  return (
    <span className={`inline-flex items-center gap-1 font-label-md text-label-md px-2 py-0.5 rounded-full ${tones[tone]}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[tone]}`} />
      {children}
    </span>
  );
}

export function StatusChip({ status }) {
  return status === 'published' ? <ToneChip tone="green">Published</ToneChip> : <ToneChip tone="grey">Draft</ToneChip>;
}

export function Stepper({ value, onChange, label }) {
  const v = Number(value) || 0;
  const btn =
    'w-9 h-9 rounded-lg border border-outline-variant/60 bg-surface-container-low text-primary flex items-center justify-center active:scale-95 transition-all hover:bg-surface-container disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0} aria-label={`Decrease ${label}`}>
        <Icon name="remove" className="text-[18px]" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={v}
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        aria-label={`${label} quantity`}
        className="w-14 h-9 rounded-lg border border-[#EBE5DD] bg-[#FAF6F0] text-center font-title-md text-[15px] text-on-surface focus:border-[#C59B6A] focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(v + 1)} aria-label={`Increase ${label}`}>
        <Icon name="add" className="text-[18px]" />
      </button>
    </div>
  );
}

export function StockStateChip({ stock, limit }) {
  if (stock <= 0) return <ToneChip tone="red">Not Available</ToneChip>;
  if (stock <= limit) return <ToneChip tone="amber">Low Stock</ToneChip>;
  return <ToneChip tone="green">Available</ToneChip>;
}

/** Bottom sheet container (used for quick stock + confirm). */
export function Sheet({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button className="absolute inset-0 bg-on-surface/40 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div className="animate-sheet-up relative w-full max-w-[480px] md:max-w-md max-h-[88vh] overflow-y-auto bg-background rounded-t-[24px] md:rounded-[24px] shadow-luxury border-t md:border border-outline-variant/30 px-gutter-mobile md:px-5 pt-2 md:pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="md:hidden w-10 h-1 rounded-full bg-outline-variant mx-auto mb-3" />
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({ title, body, confirmLabel, onConfirm, onClose, busy }) {
  return (
    <Sheet onClose={onClose} label={title}>
      <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{body}</p>
      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <button onClick={onClose} className="py-3 rounded-xl border border-[#C59B6A] text-on-surface font-label-lg text-label-lg active:scale-95 transition-all" type="button">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="py-3 rounded-xl bg-error text-white font-label-lg text-label-lg active:scale-95 transition-all disabled:opacity-60"
          type="button"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
