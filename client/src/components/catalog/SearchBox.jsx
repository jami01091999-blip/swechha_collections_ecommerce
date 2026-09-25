import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../shared/Icon';
import Img from '../shared/Img';
import { useSuggest } from '../../lib/api';
import { formatINR } from '../../lib/format';
import { addRecent, clearRecent, getRecent } from '../../lib/recentSearches';
import { categoryMeta } from '../../lib/constants';
import { cx } from '../ui';

/** Value that settles `ms` after the last change (so suggestions don't fire on every key). */
export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Search field with a suggestions dropdown: products (photo + price), categories, "See all results".
 * Empty field → recent searches. Keyboard: ↑ ↓ to move, Enter to open, Esc to close.
 */
export default function SearchBox({
  initial = '',
  onSearch,
  placeholder = 'Search designs',
  inputClassName,
  dropdownClassName = 'left-0 right-0',
  inputRef,
  label = 'Search the catalogue',
  iconClassName = 'text-xl',
}) {
  const navigate = useNavigate();
  const listId = useId();
  const box = useRef(null);
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(getRecent);
  const term = useDebounced(text);
  const { data } = useSuggest(term);

  useEffect(() => setText(initial), [initial]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const typed = text.trim();
  const options =
    typed.length < 2
      ? recent.map((q) => ({ type: 'recent', key: `r-${q}`, q }))
      : [
          ...(data?.products || []).map((p) => ({ type: 'product', key: `p-${p.slug}`, ...p })),
          ...(data?.categories || []).map((c) => ({ type: 'category', key: `c-${c.key}`, ...c })),
          { type: 'all', key: 'all', q: typed },
        ];

  const search = (q) => {
    setOpen(false);
    setActive(-1);
    setRecent(addRecent(q));
    onSearch(q.trim());
  };

  const choose = (o) => {
    if (!o) return search(text);
    setOpen(false);
    setActive(-1);
    if (o.type === 'product') return navigate(`/product/${o.slug}`);
    if (o.type === 'category') return navigate(`/collection?category=${encodeURIComponent(o.key)}`);
    setText(o.q);
    return search(o.q);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!options.length) return;
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % options.length : (i <= 0 ? options.length : i) - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(open && active >= 0 ? options[active] : null);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const showList = open && options.length > 0;
  const row = (on) =>
    cx('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left', on ? 'bg-surface-container' : 'hover:bg-surface-container-low');

  return (
    <div className="relative" ref={box}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          choose(active >= 0 && open ? options[active] : null);
        }}
      >
        <Icon name="search" className={cx('absolute left-3 top-1/2 -translate-y-1/2 text-outline', iconClassName)} />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
      </form>
      {showList && (
        <div className={cx('admin-card absolute top-full mt-1.5 z-50 p-1.5 shadow-luxury max-h-[70vh] overflow-y-auto', dropdownClassName)}>
          {typed.length < 2 && (
            <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
              <span className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider">Recent searches</span>
              <button
                type="button"
                className="font-label-md text-label-md text-on-surface-variant underline"
                onClick={() => {
                  clearRecent();
                  setRecent([]);
                }}
              >
                Clear
              </button>
            </div>
          )}
          <ul id={listId} role="listbox" aria-label="Suggestions" className="space-y-0.5">
            {options.map((o, i) => (
              <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={row(i === active)}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                >
                  {o.type === 'product' ? (
                    <>
                      <span className="w-10 h-12 rounded-md overflow-hidden bg-surface-container shrink-0">
                        <Img src={o.image} alt="" width={120} className="w-full h-full object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-title-md text-[14px] text-on-surface truncate">{o.name}</span>
                        <span className="block font-label-md text-[12px] text-primary font-semibold">{formatINR(o.price)}</span>
                      </span>
                    </>
                  ) : o.type === 'category' ? (
                    <>
                      <Icon name="category" className="text-[20px] text-secondary" />
                      <span className="font-body-sm text-[14px] text-on-surface">
                        {categoryMeta(o.key).label} <span className="text-on-surface-variant">· {o.count}</span>
                      </span>
                    </>
                  ) : o.type === 'recent' ? (
                    <>
                      <Icon name="history" className="text-[20px] text-outline" />
                      <span className="font-body-sm text-[14px] text-on-surface truncate">{o.q}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="search" className="text-[20px] text-primary" />
                      <span className="font-body-sm text-[14px] text-primary font-semibold truncate">See all results for “{o.q}”</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
