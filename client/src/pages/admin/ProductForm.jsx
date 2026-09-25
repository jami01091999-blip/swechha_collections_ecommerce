import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminSubHeader } from '../../components/admin/AdminChrome';
import { ConfirmSheet, Stepper, StockStateChip } from '../../components/admin/bits';
import ImageManager from '../../components/admin/ImageManager';
import { ErrorSummary, Field, Section, Segmented, Switch } from '../../components/admin/FormBits';
import Icon from '../../components/shared/Icon';
import { SizeSection } from '../../components/shared/SizeAvailability';
import { createProduct, deleteProduct, updateProduct, useAdminProduct, useAdminProducts } from '../../lib/api';
import { ADESK, ADMIN_BASE, BLOUSE_PIECE_OPTIONS, CATEGORIES, STANDARD_SIZES } from '../../lib/constants';
import { discountPercent } from '../../lib/format';
import { stockSummary } from '../../lib/stock';
import { useToast } from '../../context/Toast';

const EMPTY = {
  name: '',
  code: '',
  category: 'Sarees',
  fabric: '',
  badge: '',
  mrp: '',
  price: '',
  images: [],
  colors: [],
  sizeType: 'sized',
  freeSizeStock: 1,
  sizes: [],
  lowStockThreshold: 2,
  sareeDetails: { sareeLength: '', blousePiece: 'Included (Unstitched)', blouseLength: '', blouseFabric: '' },
  description: '',
  fabricDetails: '',
  occasion: '',
  care: '',
  status: 'published',
  isNewArrival: false,
  isFeatured: false,
  displayOrder: 0,
};

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  mrp: p.mrp || '',
  price: p.price || '',
  sareeDetails: { ...EMPTY.sareeDetails, ...(p.sareeDetails || {}) },
  fabricDetails: (p.fabricDetails || []).join('\n'),
  care: (p.care || []).join('\n'),
});

const toPayload = (f) => ({
  ...f,
  mrp: Number(f.mrp) || 0,
  price: Number(f.price) || 0,
  fabricDetails: f.fabricDetails.split('\n').map((s) => s.trim()).filter(Boolean),
  care: f.care.split('\n').map((s) => s.trim()).filter(Boolean),
});

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Product name is required.';
  if (f.mrp && f.price && Number(f.mrp) < Number(f.price)) e.mrp = 'MRP cannot be lower than the selling price.';
  if (f.price && Number(f.price) <= 0) e.price = 'Selling price must be more than 0.';
  return e;
}

function makeCode(existing) {
  const year = new Date().getFullYear();
  for (;;) {
    const code = `SC-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
    if (!existing.includes(code)) return code;
  }
}

export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: all } = useAdminProducts();
  const { data: product, loading, error } = useAdminProduct(id);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const loaded = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (editing && product && !loaded.current) {
      setForm(toForm({ ...product, sizeType: product.sizeType === 'free' ? 'sized' : product.sizeType }));
      loaded.current = true;
    }
  }, [editing, product]);

  useEffect(() => {
    const warn = (e) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const set = (patch) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const setSaree = (patch) => set({ sareeDetails: { ...form.sareeDetails, ...patch } });

  const off = discountPercent(Number(form.mrp), Number(form.price));
  const others = useMemo(() => (all || []).filter((p) => p._id !== id), [all, id]);
  const previewProduct = { ...form, freeSizeStock: Number(form.freeSizeStock) || 0 };
  const summary = stockSummary(previewProduct);

  /* sizes */
  const allSizeLabels = [...STANDARD_SIZES, ...form.sizes.map((s) => s.label).filter((l) => !STANDARD_SIZES.includes(l))];
  const orderSizes = (sizes) => [...sizes].sort((a, b) => allSizeLabels.indexOf(a.label) - allSizeLabels.indexOf(b.label));
  const toggleSize = (label) => {
    const has = form.sizes.find((s) => s.label === label);
    set({ sizes: has ? form.sizes.filter((s) => s.label !== label) : orderSizes([...form.sizes, { label, stock: 1 }]) });
  };
  const addCustomSize = () => {
    const label = customSize.trim().toUpperCase().slice(0, 12);
    if (!label || form.sizes.some((s) => s.label === label)) return setCustomSize('');
    set({ sizes: [...form.sizes, { label, stock: 1 }] });
    setCustomSize('');
  };
  const setSizeStock = (label, stock) => set({ sizes: form.sizes.map((s) => (s.label === label ? { ...s, stock } : s)) });

  /* colours */
  const setColour = (i, patch) => set({ colors: form.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const save = async () => {
    const e = validate(form);
    setErrors(e);
    setServerError('');
    if (Object.keys(e).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editing) await updateProduct(id, payload);
      else await createProduct(payload);
      dirty.current = false;
      toast(editing ? 'Changes saved' : 'Product published');
      navigate(`${ADMIN_BASE}/products`);
    } catch (err) {
      setServerError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteProduct(id);
      dirty.current = false;
      toast('Product deleted');
      navigate(`${ADMIN_BASE}/products`);
    } catch (err) {
      setServerError(err.message);
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing && !product) {
    return (
      <>
        <AdminSubHeader title="Edit Product" backTo={`${ADMIN_BASE}/products`} />
        <div className="px-gutter-mobile pt-10 text-center">
          {loading ? (
            <span className="inline-block w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{error?.message || 'Product not found.'}</p>
          )}
        </div>
      </>
    );
  }

  const chipBtn = (on) =>
    `min-w-11 px-3 py-2 rounded-xl font-label-lg text-label-lg border transition-all active:scale-95 ${
      on ? 'bg-primary-container text-white border-primary-container' : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40'
    }`;

  return (
    <>
      <AdminSubHeader
        title={editing ? 'Edit Product' : 'Add Product'}
        subtitle={editing ? `${product.code} · last updated ${new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Fill in the details customers will see'}
        backTo={`${ADMIN_BASE}/products`}
        right={
          editing &&
          product.status === 'published' && (
            <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer" className="p-2 text-secondary hover:text-primary" aria-label="View on site">
              <Icon name="open_in_new" className="text-[20px]" />
            </a>
          )
        }
      />
      <main className={`px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-4 ${ADESK}`}>
        <ErrorSummary errors={{ ...errors, server: serverError }} />
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
        <div className="space-y-4">

        <Section title="Photos" hint="The first photo is the cover on product cards." id="photos">
          <ImageManager images={form.images} onChange={(images) => set({ images })} invalid={!!errors.images} />
        </Section>

        <Section title="Basic Details">
          <Field label="Product name" required error={errors.name} htmlFor="name">
            <input id="name" className={`field ${errors.name ? 'field-error' : ''}`} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Gulmohar Silk Saree" />
          </Field>
          <Field label="Product code / SKU" error={errors.code} htmlFor="code" hint="Shown to customers and in WhatsApp enquiries.">
            <div className="flex gap-2">
              <input id="code" className={`field flex-1 uppercase ${errors.code ? 'field-error' : ''}`} value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="SC-2025-084" />
              <button type="button" onClick={() => set({ code: makeCode((all || []).map((p) => p.code)) })} className="shrink-0 px-3 rounded-xl border border-[#C59B6A] text-on-surface font-label-lg text-label-lg active:scale-95">
                Auto
              </button>
            </div>
          </Field>
          <Field label="Category" htmlFor="category">
            <select id="category" className="field" value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fabric line" error={errors.fabric} htmlFor="fabric" hint="Short line above the name, e.g. “Pure Tussar Silk with Zari”.">
            <input id="fabric" className={`field ${errors.fabric ? 'field-error' : ''}`} value={form.fabric} onChange={(e) => set({ fabric: e.target.value })} placeholder="Pure Tussar Silk with Zari" />
          </Field>
        </Section>

        <Section title="Price">
          <div className="grid grid-cols-2 gap-3">
            <Field label="MRP (₹)" error={errors.mrp} htmlFor="mrp">
              <input id="mrp" type="number" inputMode="numeric" min="0" className={`field ${errors.mrp ? 'field-error' : ''}`} value={form.mrp} onChange={(e) => set({ mrp: e.target.value })} placeholder="24000" />
            </Field>
            <Field label="Selling price (₹)" required error={errors.price} htmlFor="price">
              <input id="price" type="number" inputMode="numeric" min="0" className={`field ${errors.price ? 'field-error' : ''}`} value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="14500" />
            </Field>
          </div>
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            {off > 0 ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full">{off}% OFF shown to customers</span>
            ) : (
              'Leave MRP empty (or equal to price) to show no discount.'
            )}
          </p>
        </Section>

        </div>
        <div className="space-y-4">
        <Section title="Sizes & Stock" hint="Set 0 for any size you don't have — customers will see it as Not Available." id="sizes">
          <div>
            <span className="field-label">Select sizes</span>
            <div className="flex flex-wrap gap-2">
              {allSizeLabels.map((l) => (
                <button key={l} type="button" className={chipBtn(form.sizes.some((s) => s.label === l))} onClick={() => toggleSize(l)} aria-pressed={form.sizes.some((s) => s.label === l)}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
                placeholder="Custom size, e.g. 32 or 34"
                className="field flex-1 text-[13px]"
              />
              <button type="button" onClick={addCustomSize} className="shrink-0 px-3 rounded-xl border border-[#C59B6A] font-label-lg text-label-lg active:scale-95">
                + Add
              </button>
            </div>
            {errors.sizes && <p className="font-body-sm text-[12px] text-error mt-1">{errors.sizes}</p>}
          </div>
          {form.sizes.length > 0 && (
            <div className="rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/20">
              {form.sizes.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-title-md text-[15px] text-on-surface">{s.label}</span>
                    <StockStateChip stock={s.stock} limit={form.lowStockThreshold} />
                  </div>
                  <Stepper label={s.label} value={s.stock} onChange={(v) => setSizeStock(s.label, v)} />
                </div>
              ))}
            </div>
          )}
          {form.sizes.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: Math.max(1, s.stock) })) })} className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95">
                Mark all available
              </button>
              <button type="button" onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: 0 })) })} className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95">
                Set all to 0
              </button>
              <button type="button" onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: 0 })) })} className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95">
                Mark all out of stock
              </button>
            </div>
          )}
          <Field label="Low stock alert when at or below" htmlFor="low" hint="Customers see “Only N left” at this level.">
            <input id="low" type="number" min="1" inputMode="numeric" className="field w-28" value={form.lowStockThreshold} onChange={(e) => set({ lowStockThreshold: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <p className="font-body-sm text-[12px] text-on-surface">
            Total stock: <strong>{summary.total}</strong>
            {summary.available.length > 0 && ` · Available: ${summary.available.join(', ')}`}
            {summary.out.length > 0 && ` · Not available: ${summary.out.join(', ')}`}
          </p>
          {form.sizes.length > 0 && (
            <div className="rounded-xl bg-surface-container-low/70 border border-outline-variant/30 p-3">
              <span className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider">Customers will see</span>
              <div className="mt-2">
                <SizeSection product={previewProduct} />
              </div>
            </div>
          )}
        </Section>

        <Section title="Colours" hint="Link a colour to another product to open it when tapped.">
          {form.colors.map((c, i) => (
            <div key={i} className="rounded-xl border border-outline-variant/40 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <label className="relative w-10 h-10 shrink-0 rounded-full ring-1 ring-outline-variant/60 overflow-hidden cursor-pointer" style={{ backgroundColor: c.hex }}>
                  <span className="sr-only">Pick colour</span>
                  <input type="color" value={c.hex} onChange={(e) => setColour(i, { hex: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
                <input className="field flex-1" value={c.name} onChange={(e) => setColour(i, { name: e.target.value })} placeholder="Colour name, e.g. Vermilion Crimson" />
                <button type="button" onClick={() => set({ colors: form.colors.filter((_, j) => j !== i) })} className="p-2 text-on-surface-variant hover:text-error" aria-label="Remove colour">
                  <Icon name="delete" className="text-[20px]" />
                </button>
              </div>
              <select className="field text-[13px]" value={c.productSlug || ''} onChange={(e) => setColour(i, { productSlug: e.target.value })} aria-label="Linked product">
                <option value="">This product (no link)</option>
                {others.map((p) => (
                  <option key={p._id} value={p.slug}>
                    Opens: {p.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {form.colors.length < 12 && (
            <button type="button" onClick={() => set({ colors: [...form.colors, { name: '', hex: '#6b1d2f', productSlug: '' }] })} className="w-full py-2.5 rounded-xl border border-dashed border-[#C59B6A] text-primary font-label-lg text-label-lg active:scale-95">
              + Add colour
            </button>
          )}
        </Section>

        <Section title="Story & Care" hint="Each box becomes a section on the product page. Empty boxes are hidden.">
          <Field label="Description" htmlFor="desc">
            <textarea id="desc" rows={4} maxLength={2000} className="field" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Tell the story of the weave and the craft…" />
            <span className="block text-right font-label-md text-[10px] text-outline mt-0.5">{form.description.length}/2000</span>
          </Field>
        </Section>

        <Section title="Visibility">
          <p className="font-body-sm text-[12px] text-on-surface-variant">Visible to customers.</p>
          <Switch checked={form.isNewArrival} onChange={(v) => set({ isNewArrival: v })} label="Mark as New Arrival" hint="Shows in New Arrivals with a “New” badge." />
        </Section>

        {editing && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-xl text-error font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-error-container/30">
            <Icon name="delete" className="text-[18px]" /> Delete Product
          </button>
        )}
        </div>
        </div>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 bg-surface/95 backdrop-blur-md px-gutter-mobile md:px-8 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-outline-variant/30 shadow-luxury grid grid-cols-[1fr_2fr] md:flex md:justify-end gap-2.5">
        <button type="button" onClick={() => navigate(`${ADMIN_BASE}/products`)} className="py-3 md:w-40 rounded-xl border border-[#C59B6A] text-on-surface font-label-lg text-label-lg active:scale-95 transition-all">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving} className="py-3 md:w-60 rounded-xl bg-primary-container hover:bg-[#541423] text-surface-container-lowest font-title-md text-[15px] font-semibold shadow-luxury active:scale-95 transition-all disabled:opacity-60">
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Product'}
        </button>
      </div>

      {confirmDelete && (
        <ConfirmSheet
          title={`Delete ${product.name}?`}
          body="This removes it from the catalogue and deletes its uploaded photos. This cannot be undone."
          confirmLabel="Delete"
          busy={saving}
          onConfirm={remove}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
