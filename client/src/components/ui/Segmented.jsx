/** Segmented control (radio group). options: [{ value, label }]. */
export default function Segmented({ value, options, onChange, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid rounded-xl bg-surface-container p-1 gap-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`py-2 rounded-lg font-label-lg text-label-lg transition-all ${
            value === o.value
              ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/40'
              : 'text-on-surface-variant'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
