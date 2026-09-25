import Icon from '../shared/Icon';

export function Section({ title, hint, children, id, action }) {
  return (
    <section id={id} className="admin-card scroll-mt-20">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-headline-sm text-[18px] leading-tight text-primary">{title}</h2>
          {hint && <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">{hint}</p>}
        </div>
        {action && <div className="flex items-center gap-1 shrink-0">{action}</div>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({ label, required, error, hint, children, htmlFor }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      {children}
      {error ? <p className="font-body-sm text-[12px] text-error mt-1">{error}</p> : hint && <p className="font-body-sm text-[11px] text-on-surface-variant mt-1">{hint}</p>}
    </div>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid rounded-xl bg-surface-container p-1 gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`py-2 rounded-lg font-label-lg text-label-lg transition-all ${
            value === o.value ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/40' : 'text-on-surface-variant'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span>
        <span className="font-title-md text-[14px] text-on-surface block">{label}</span>
        {hint && <span className="font-body-sm text-[12px] text-on-surface-variant">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-11 h-6 rounded-full bg-surface-container-highest peer-checked:bg-primary-container transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#C59B6A]" />
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function ErrorSummary({ errors }) {
  const list = Object.values(errors).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-error/30 bg-error-container/40 p-3 flex gap-2" role="alert">
      <Icon name="error" className="text-error text-[20px] shrink-0" />
      <div className="font-body-sm text-[13px] text-on-error-container">
        <p className="font-semibold">Fix {list.length === 1 ? 'this' : 'these'} before saving:</p>
        <ul className="list-disc list-inside">
          {list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
