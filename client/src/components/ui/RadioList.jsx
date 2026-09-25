import { cx } from './cx';

/** Single-choice list (e.g. sort order in a sheet). options: [{ value, label }]. */
export default function RadioList({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="divide-y divide-outline-variant/20">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'w-full flex items-center justify-between gap-3 py-3 text-left font-body-sm text-[15px] transition-colors',
              on ? 'text-primary font-semibold' : 'text-on-surface hover:text-primary'
            )}
          >
            {o.label}
            <span
              aria-hidden="true"
              className={cx(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                on ? 'border-primary-container' : 'border-outline-variant'
              )}
            >
              {on && <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
