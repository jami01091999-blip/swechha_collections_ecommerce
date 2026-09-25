import { CATEGORIES } from '../../lib/constants';
import { Chip, PageContainer } from '../ui';

/** Horizontally scrollable category chips — Stitch markup. value '' = All. */
export default function CategoryChips({ value = '', onChange }) {
  return (
    <section className="py-space-xs">
      <PageContainer className="flex items-center gap-2 px-margin-mobile overflow-x-auto no-scrollbar scroll-smooth md:flex-wrap md:justify-center">
        <Chip kind="category" active={value === ''} onClick={() => onChange('')} aria-pressed={value === ''}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} kind="category" active={value === c.key} onClick={() => onChange(c.key)} aria-pressed={value === c.key}>
            {c.chip || c.label}
          </Chip>
        ))}
      </PageContainer>
    </section>
  );
}
