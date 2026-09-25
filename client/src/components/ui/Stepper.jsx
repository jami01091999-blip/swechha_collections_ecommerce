import Icon from '../shared/Icon';

const BTN =
  'w-9 h-9 rounded-lg border border-outline-variant/60 bg-surface-container-low text-primary flex items-center justify-center active:scale-95 transition-all hover:bg-surface-container disabled:opacity-40';

/** − [n] + quantity control; never goes below 0. */
export default function Stepper({ value, onChange, label }) {
  const v = Number(value) || 0;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={BTN} onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0} aria-label={`Decrease ${label}`}>
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
      <button type="button" className={BTN} onClick={() => onChange(v + 1)} aria-label={`Increase ${label}`}>
        <Icon name="add" className="text-[18px]" />
      </button>
    </div>
  );
}
