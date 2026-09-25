import { CATEGORIES, DESK } from '../../lib/constants';

const ACTIVE = 'shrink-0 bg-primary-container text-white px-4 py-1.5 rounded-full font-label-md text-label-md font-semibold shadow-sm active:scale-95 transition-transform';
const IDLE = 'shrink-0 bg-surface-container-low text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container px-3.5 py-1.5 rounded-full font-label-md text-label-md transition-colors active:scale-95';

/** Horizontally scrollable category chips — Stitch markup. value '' = All. */
export default function CategoryChips({ value = '', onChange }) {
  return (
    <section className="py-space-xs">
      <div className={`flex items-center gap-2 px-margin-mobile overflow-x-auto no-scrollbar scroll-smooth md:flex-wrap md:justify-center ${DESK}`}>
        <button className={value === '' ? ACTIVE : IDLE} onClick={() => onChange('')} type="button" aria-pressed={value === ''}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={value === c.key ? ACTIVE : IDLE} onClick={() => onChange(c.key)} type="button" aria-pressed={value === c.key}>
            {c.chip || c.label}
          </button>
        ))}
      </div>
    </section>
  );
}
