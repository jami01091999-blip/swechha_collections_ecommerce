import { useEffect, useState } from 'react';
import { Chip, Input, Switch } from '../ui';
import { CATEGORIES } from '../../lib/constants';
import { DISCOUNTS, PRICE_PRESETS, presetFor, sizeLabel } from './filters';

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'FREE'];
const bySizeOrder = (a, b) => {
  const ia = SIZE_ORDER.indexOf(a);
  const ib = SIZE_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

function Group({ title, children }) {
  return (
    <fieldset className="py-3 border-b border-outline-variant/20 last:border-0">
      <legend className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider mb-2">{title}</legend>
      {children}
    </fieldset>
  );
}

const withCount = (label, n) => (n === undefined ? label : `${label} (${n})`);

/**
 * Filter controls (category, price, size, availability, offers, new/featured).
 * `value` is the filter state from filters.js; `onChange(patch)` merges changes; `facets` gives counts.
 */
export default function FilterPanel({ value: f, onChange, facets }) {
  const catCount = new Map((facets?.categories || []).map((c) => [c.key, c.count]));
  const sizeCount = new Map((facets?.sizes || []).map((s) => [s.label, s.count]));
  const priceCount = new Map((facets?.prices || []).map((p) => [p.key, p.count]));
  const categories = CATEGORIES.filter((c) => catCount.get(c.key) || f.category === c.key);
  const sizes = [...new Set([...sizeCount.keys(), ...f.sizes])].sort(bySizeOrder);
  const preset = presetFor(f);

  // Custom min/max are applied when the field loses focus or Enter is pressed.
  const [min, setMin] = useState(f.min);
  const [max, setMax] = useState(f.max);
  useEffect(() => {
    setMin(f.min);
    setMax(f.max);
  }, [f.min, f.max]);
  const clean = (v) => String(v).replace(/\D/g, '').slice(0, 8);
  const applyRange = () => {
    if (clean(min) !== f.min || clean(max) !== f.max) onChange({ min: clean(min), max: clean(max) });
  };
  const onEnter = (e) => e.key === 'Enter' && (e.preventDefault(), applyRange());

  return (
    <div>
      <Group title="Category">
        <div className="flex flex-wrap gap-2">
          <Chip active={!f.category} onClick={() => onChange({ category: '' })} aria-pressed={!f.category}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.key}
              active={f.category === c.key}
              onClick={() => onChange({ category: f.category === c.key ? '' : c.key })}
              aria-pressed={f.category === c.key}
            >
              {withCount(c.label, catCount.get(c.key) || 0)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => {
            const on = preset?.key === p.key;
            return (
              <Chip
                key={p.key}
                active={on}
                aria-pressed={on}
                onClick={() => onChange(on ? { min: '', max: '' } : { min: String(p.min ?? ''), max: String(p.max ?? '') })}
              >
                {withCount(p.label, priceCount.get(p.key))}
              </Chip>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <label>
            <span className="sr-only">Minimum price</span>
            <Input
              inputMode="numeric"
              placeholder="Min ₹"
              value={min}
              onChange={(e) => setMin(clean(e.target.value))}
              onBlur={applyRange}
              onKeyDown={onEnter}
            />
          </label>
          <label>
            <span className="sr-only">Maximum price</span>
            <Input
              inputMode="numeric"
              placeholder="Max ₹"
              value={max}
              onChange={(e) => setMax(clean(e.target.value))}
              onBlur={applyRange}
              onKeyDown={onEnter}
            />
          </label>
        </div>
      </Group>

      {sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const on = f.sizes.includes(s);
              return (
                <Chip
                  key={s}
                  kind="size"
                  active={on}
                  aria-pressed={on}
                  onClick={() => onChange({ sizes: on ? f.sizes.filter((x) => x !== s) : [...f.sizes, s] })}
                >
                  {withCount(sizeLabel(s), sizeCount.get(s) || 0)}
                </Chip>
              );
            })}
          </div>
        </Group>
      )}

      <Group title="Availability">
        <Switch checked={f.instock} onChange={(v) => onChange({ instock: v })} label="In stock only" />
      </Group>

      <Group title="Offers">
        <div className="flex flex-wrap gap-2">
          {DISCOUNTS.map((d) => {
            const on = f.discount === String(d);
            return (
              <Chip key={d} active={on} aria-pressed={on} onClick={() => onChange({ discount: on ? '' : String(d) })}>
                {d}%+ off
              </Chip>
            );
          })}
        </div>
      </Group>

      <Group title="Collections">
        <div className="flex flex-wrap gap-2">
          {[
            ['new', 'New arrivals'],
            ['featured', 'Featured'],
          ].map(([key, label]) => (
            <Chip
              key={key}
              active={f.filter === key}
              aria-pressed={f.filter === key}
              onClick={() => onChange({ filter: f.filter === key ? '' : key })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </Group>
    </div>
  );
}
