import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminSubHeader } from '../../components/admin/AdminChrome';
import ImageManager from '../../components/admin/ImageManager';
import { ErrorSummary, Section } from '../../components/admin/FormBits';
import {
  Button,
  Chip,
  ConfirmSheet,
  Field,
  Input,
  PageContainer,
  Segmented,
  Select,
  Spinner,
  Stepper,
  StockStateChip,
  Switch,
  Textarea,
} from '../../components/ui';
import Icon from '../../components/shared/Icon';
import { SizeSection } from '../../components/shared/SizeAvailability';
import { createProduct, deleteProduct, updateProduct, useAdminProduct, useAdminProductOptions, useSettings } from '../../lib/api';
import { ADMIN_BASE, CATEGORIES, DEFAULT_DIMENSIONS_CM, STANDARD_SIZES, autoSku, weightFor } from '../../lib/constants';
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
  // Shipping & tax (category defaults are filled in for new products)
  weightGrams: weightFor('Sarees'),
  dimensionsCm: { ...DEFAULT_DIMENSIONS_CM },
  hsnCode: '',
  taxRatePercent: 5,
  isCodAllowed: true,
  isReturnable: true,
  maxQtyPerOrder: 5,
};

const SIZE_TYPES = [
  { value: 'sized', label: 'Sized' },
  { value: 'free', label: 'Free Size' },
];
const sizeName = (label) => (label === 'FREE' ? 'Free Size' : label);

const toForm = (p) => ({
  ...EMPTY,
  ...p,
  // Products saved before Phase 2 may still have freeSizeStock instead of a FREE size row.
  sizes: p.sizes?.length ? p.sizes : p.sizeType === 'sized' ? [] : [{ label: 'FREE', sku: '', stock: Number(p.freeSizeStock) || 0 }],
  dimensionsCm: { ...DEFAULT_DIMENSIONS_CM, ...(p.dimensionsCm || {}) },
  mrp: p.mrp || '',
  price: p.price || '',
  sareeDetails: { ...EMPTY.sareeDetails, ...(p.sareeDetails || {}) },
  fabricDetails: (p.fabricDetails || []).join('\n'),
  care: (p.care || []).join('\n'),
});

const toPayload = ({ freeSizeStock: _legacy, ...f }) => ({
  ...f,
  // `reserved` is managed by checkout; the server ignores it, so it isn't sent.
  sizes: f.sizes.map(({ label, sku, stock }) => ({ label, sku: (sku || '').trim(), stock })),
  mrp: Number(f.mrp) || 0,
  price: Number(f.price) || 0,
  weightGrams: Number(f.weightGrams) || 0,
  dimensionsCm: { l: Number(f.dimensionsCm.l) || 0, b: Number(f.dimensionsCm.b) || 0, h: Number(f.dimensionsCm.h) || 0 },
  taxRatePercent: Number(f.taxRatePercent) || 0,
  maxQtyPerOrder: Number(f.maxQtyPerOrder) || 1,
  fabricDetails: f.fabricDetails
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
  care: f.care
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
});

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Product name is required.';
  if (f.mrp && f.price && Number(f.mrp) < Number(f.price)) e.mrp = 'MRP cannot be lower than the selling price.';
  if (f.price && Number(f.price) <= 0) e.price = 'Selling price must be more than 0.';
  const skus = f.sizes.map((s) => (s.sku || '').trim().toUpperCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) e.sizes = 'Each size needs its own SKU.';
  if (f.hsnCode && !/^\d{4,8}$/.test(f.hsnCode)) e.hsnCode = 'HSN code has 4 to 8 digits.';
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
  const { data: all } = useAdminProductOptions();
  const { data: product, loading, error } = useAdminProduct(id);
  const { data: settings } = useSettings();
  const [skuErrors, setSkuErrors] = useState({});
  const sizedBackup = useRef([]);
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
      setForm(toForm(product));
      loaded.current = true;
    }
  }, [editing, product]);

  // New products start with the shop's default GST rate.
  useEffect(() => {
    if (!editing && settings?.defaultTaxRatePercent !== undefined && !dirty.current) {
      setForm((f) => ({ ...f, taxRatePercent: settings.defaultTaxRatePercent }));
    }
  }, [editing, settings?.defaultTaxRatePercent]);

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

  const off = discountPercent(Number(form.mrp), Number(form.price));
  const others = useMemo(() => (all || []).filter((p) => p._id !== id), [all, id]);
  const previewProduct = form;
  const codeChanged = editing && product && form.code.trim().toUpperCase() !== product.code;
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
  const setSizeSku = (label, sku) => {
    set({ sizes: form.sizes.map((s) => (s.label === label ? { ...s, sku: sku.toUpperCase().replace(/\s+/g, '-') } : s)) });
    setSkuErrors((e) => ({ ...e, [label]: undefined }));
  };
  // Switching type keeps the other type's rows so switching back doesn't lose them.
  const setSizeType = (sizeType) => {
    if (sizeType === form.sizeType) return;
    if (sizeType === 'free') {
      sizedBackup.current = form.sizes;
      set({ sizeType, sizes: [{ label: 'FREE', sku: '', stock: 1 }] });
    } else {
      set({ sizeType, sizes: sizedBackup.current.filter((s) => s.label !== 'FREE') });
    }
  };
  const setCategory = (category) => set(editing ? { category } : { category, weightGrams: weightFor(category) });
  const setDims = (patch) => set({ dimensionsCm: { ...form.dimensionsCm, ...patch } });

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
      if (err.data?.code === 'SKU_TAKEN') {
        // Show the clash next to the size that uses it.
        const bySku = Object.fromEntries(form.sizes.map((s) => [(s.sku || autoSku(form.code, s.label)).toUpperCase(), s.label]));
        setSkuErrors(Object.fromEntries(err.data.skus.map((sku) => [bySku[sku], 'Another product already uses this SKU.'])));
      }
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
            <Spinner className="inline-block" />
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">{error?.message || 'Product not found.'}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <AdminSubHeader
        title={editing ? 'Edit Product' : 'Add Product'}
        subtitle={
          editing
            ? `${product.code} · last updated ${new Date(product.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
            : 'Fill in the details customers will see'
        }
        backTo={`${ADMIN_BASE}/products`}
        right={
          editing &&
          product.status === 'published' && (
            <a
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-secondary hover:text-primary"
              aria-label="View on site"
            >
              <Icon name="open_in_new" className="text-[20px]" />
            </a>
          )
        }
      />
      <PageContainer as="main" className="px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-4">
        <ErrorSummary errors={{ ...errors, server: serverError }} />
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
          <div className="space-y-4">
            <Section title="Photos" hint="The first photo is the cover on product cards." id="photos">
              <ImageManager images={form.images} onChange={(images) => set({ images })} invalid={!!errors.images} />
            </Section>

            <Section title="Basic Details">
              <Field label="Product name" required error={errors.name} htmlFor="name">
                <Input
                  id="name"
                  invalid={!!errors.name}
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. Gulmohar Silk Saree"
                />
              </Field>
              <Field
                label="Product code"
                error={errors.code}
                htmlFor="code"
                hint={
                  codeChanged
                    ? 'Existing size SKUs keep the old code (orders refer to them). Edit them below if needed.'
                    : 'Shown to customers and in WhatsApp enquiries. Size SKUs are made from it.'
                }
              >
                <div className="flex gap-2">
                  <Input
                    id="code"
                    className="flex-1 uppercase"
                    invalid={!!errors.code}
                    value={form.code}
                    onChange={(e) => set({ code: e.target.value })}
                    placeholder="SC-2025-084"
                  />
                  <button
                    type="button"
                    onClick={() => set({ code: makeCode((all || []).map((p) => p.code)) })}
                    className="shrink-0 px-3 rounded-xl border border-[#C59B6A] text-on-surface font-label-lg text-label-lg active:scale-95"
                  >
                    Auto
                  </button>
                </div>
              </Field>
              <Field label="Category" htmlFor="category">
                <Select id="category" value={form.category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Fabric line"
                error={errors.fabric}
                htmlFor="fabric"
                hint="Short line above the name, e.g. “Pure Tussar Silk with Zari”."
              >
                <Input
                  id="fabric"
                  invalid={!!errors.fabric}
                  value={form.fabric}
                  onChange={(e) => set({ fabric: e.target.value })}
                  placeholder="Pure Tussar Silk with Zari"
                />
              </Field>
            </Section>

            <Section title="Price">
              <div className="grid grid-cols-2 gap-3">
                <Field label="MRP (₹)" error={errors.mrp} htmlFor="mrp">
                  <Input
                    id="mrp"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    invalid={!!errors.mrp}
                    value={form.mrp}
                    onChange={(e) => set({ mrp: e.target.value })}
                    placeholder="24000"
                  />
                </Field>
                <Field label="Selling price (₹)" required error={errors.price} htmlFor="price">
                  <Input
                    id="price"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    invalid={!!errors.price}
                    value={form.price}
                    onChange={(e) => set({ price: e.target.value })}
                    placeholder="14500"
                  />
                </Field>
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                {off > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full">
                    {off}% OFF shown to customers
                  </span>
                ) : (
                  'Leave MRP empty (or equal to price) to show no discount.'
                )}
              </p>
            </Section>
          </div>
          <div className="space-y-4">
            <Section title="Sizes & Stock" hint="Set 0 for any size you don't have — customers will see it as Not Available." id="sizes">
              <Segmented label="Size type" value={form.sizeType} options={SIZE_TYPES} onChange={setSizeType} />
              {form.sizeType === 'sized' && (
                <div>
                  <span className="field-label">Select sizes</span>
                  <div className="flex flex-wrap gap-2">
                    {allSizeLabels.map((l) => (
                      <Chip
                        key={l}
                        kind="size"
                        active={form.sizes.some((s) => s.label === l)}
                        onClick={() => toggleSize(l)}
                        aria-pressed={form.sizes.some((s) => s.label === l)}
                      >
                        {l}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={customSize}
                      onChange={(e) => setCustomSize(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSize())}
                      placeholder="Custom size, e.g. 32 or 34"
                      className="flex-1 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={addCustomSize}
                      className="shrink-0 px-3 rounded-xl border border-[#C59B6A] font-label-lg text-label-lg active:scale-95"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}
              {errors.sizes && <p className="font-body-sm text-[12px] text-error mt-1">{errors.sizes}</p>}
              {form.sizes.length > 0 && (
                <div className="rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/20">
                  {form.sizes.map((s) => {
                    const reserved = s.reserved || 0;
                    return (
                      <div key={s.label} className="px-3 py-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-title-md text-[15px] text-on-surface">{sizeName(s.label)}</span>
                            <StockStateChip stock={Math.max(0, s.stock - reserved)} limit={form.lowStockThreshold} />
                            {reserved > 0 && (
                              <span className="font-label-md text-label-md text-on-surface-variant">Reserved: {reserved}</span>
                            )}
                          </div>
                          <Stepper label={sizeName(s.label)} value={s.stock} min={reserved} onChange={(v) => setSizeStock(s.label, v)} />
                        </div>
                        <label className="flex items-center gap-2">
                          <span className="font-label-md text-label-md text-on-surface-variant shrink-0 w-8">SKU</span>
                          <Input
                            aria-label={`SKU for ${sizeName(s.label)}`}
                            className="text-[13px] uppercase"
                            value={s.sku || ''}
                            placeholder={autoSku(form.code, s.label) || 'Made from the product code'}
                            onChange={(e) => setSizeSku(s.label, e.target.value)}
                            invalid={!!skuErrors[s.label]}
                          />
                        </label>
                        {skuErrors[s.label] && <p className="font-body-sm text-[12px] text-error">{skuErrors[s.label]}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
              {form.sizeType === 'sized' && form.sizes.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: Math.max(1, s.stock) })) })}
                    className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95"
                  >
                    Mark all available
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: s.reserved || 0 })) })}
                    className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95"
                  >
                    Set all to 0
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ sizes: form.sizes.map((s) => ({ ...s, stock: s.reserved || 0 })) })}
                    className="py-2 rounded-xl border border-outline-variant/60 font-label-md text-label-md text-on-surface active:scale-95"
                  >
                    Mark all out of stock
                  </button>
                </div>
              )}
              <Field label="Low stock alert when at or below" htmlFor="low" hint="Customers see “Only N left” at this level.">
                <Input
                  id="low"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className="w-28"
                  value={form.lowStockThreshold}
                  onChange={(e) => set({ lowStockThreshold: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Field>
              <p className="font-body-sm text-[12px] text-on-surface">
                Total stock: <strong>{summary.total}</strong>
                {summary.available.length > 0 && ` · Available: ${summary.available.join(', ')}`}
                {summary.out.length > 0 && ` · Not available: ${summary.out.join(', ')}`}
              </p>
              {form.sizes.length > 0 && (
                <div className="rounded-xl bg-surface-container-low/70 border border-outline-variant/30 p-3">
                  <span className="font-label-md text-label-md text-secondary font-semibold uppercase tracking-wider">
                    Customers will see
                  </span>
                  <div className="mt-2">
                    <SizeSection product={previewProduct} />
                  </div>
                </div>
              )}
            </Section>

            <Section
              title="Shipping & tax"
              hint="Used for delivery charges and invoices. New products start from the category's usual values."
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight (g)" htmlFor="weight" hint="Packed weight.">
                  <Input
                    id="weight"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={form.weightGrams}
                    onChange={(e) => set({ weightGrams: e.target.value })}
                  />
                </Field>
                <Field label="Max per order" htmlFor="maxqty" hint="1 to 20.">
                  <Input
                    id="maxqty"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="20"
                    value={form.maxQtyPerOrder}
                    onChange={(e) => set({ maxQtyPerOrder: e.target.value })}
                  />
                </Field>
              </div>
              <div>
                <span className="field-label">Package size (cm)</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['l', 'Length'],
                    ['b', 'Breadth'],
                    ['h', 'Height'],
                  ].map(([k, label]) => (
                    <Input
                      key={k}
                      aria-label={`${label} in cm`}
                      placeholder={label}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={form.dimensionsCm[k]}
                      onChange={(e) => setDims({ [k]: e.target.value })}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="HSN code" htmlFor="hsn" error={errors.hsnCode} hint="4 to 8 digits, for GST invoices.">
                  <Input
                    id="hsn"
                    inputMode="numeric"
                    maxLength={8}
                    value={form.hsnCode}
                    invalid={!!errors.hsnCode}
                    onChange={(e) => set({ hsnCode: e.target.value.replace(/\D/g, '') })}
                  />
                </Field>
                <Field label="GST rate (%)" htmlFor="tax">
                  <Input
                    id="tax"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="28"
                    step="0.25"
                    value={form.taxRatePercent}
                    onChange={(e) => set({ taxRatePercent: e.target.value })}
                  />
                </Field>
              </div>
              <Switch checked={form.isCodAllowed} onChange={(v) => set({ isCodAllowed: v })} label="Allow Cash on Delivery" />
              <Switch checked={form.isReturnable} onChange={(v) => set({ isReturnable: v })} label="Returnable" />
            </Section>

            <Section title="Colours" hint="Link a colour to another product to open it when tapped.">
              {form.colors.map((c, i) => (
                <div key={i} className="rounded-xl border border-outline-variant/40 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <label
                      className="relative w-10 h-10 shrink-0 rounded-full ring-1 ring-outline-variant/60 overflow-hidden cursor-pointer"
                      style={{ backgroundColor: c.hex }}
                    >
                      <span className="sr-only">Pick colour</span>
                      <input
                        type="color"
                        value={c.hex}
                        onChange={(e) => setColour(i, { hex: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                    <Input
                      className="flex-1"
                      value={c.name}
                      onChange={(e) => setColour(i, { name: e.target.value })}
                      placeholder="Colour name, e.g. Vermilion Crimson"
                    />
                    <button
                      type="button"
                      onClick={() => set({ colors: form.colors.filter((_, j) => j !== i) })}
                      className="p-2 text-on-surface-variant hover:text-error"
                      aria-label="Remove colour"
                    >
                      <Icon name="delete" className="text-[20px]" />
                    </button>
                  </div>
                  <Select
                    className="text-[13px]"
                    value={c.productSlug || ''}
                    onChange={(e) => setColour(i, { productSlug: e.target.value })}
                    aria-label="Linked product"
                  >
                    <option value="">This product (no link)</option>
                    {others.map((p) => (
                      <option key={p._id} value={p.slug}>
                        Opens: {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
              {form.colors.length < 12 && (
                <button
                  type="button"
                  onClick={() => set({ colors: [...form.colors, { name: '', hex: '#6b1d2f', productSlug: '' }] })}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#C59B6A] text-primary font-label-lg text-label-lg active:scale-95"
                >
                  + Add colour
                </button>
              )}
            </Section>

            <Section title="Story & Care" hint="Each box becomes a section on the product page. Empty boxes are hidden.">
              <Field label="Description" htmlFor="desc">
                <Textarea
                  id="desc"
                  rows={4}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Tell the story of the weave and the craft…"
                />
                <span className="block text-right font-label-md text-[10px] text-outline mt-0.5">{form.description.length}/2000</span>
              </Field>
            </Section>

            <Section title="Visibility">
              <p className="font-body-sm text-[12px] text-on-surface-variant">Visible to customers.</p>
              <Switch
                checked={form.isNewArrival}
                onChange={(v) => set({ isNewArrival: v })}
                label="Mark as New Arrival"
                hint="Shows in New Arrivals with a “New” badge."
              />
            </Section>

            {editing && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3 rounded-xl text-error font-label-lg text-label-lg flex items-center justify-center gap-1.5 hover:bg-error-container/30"
              >
                <Icon name="delete" className="text-[18px]" /> Delete Product
              </button>
            )}
          </div>
        </div>
      </PageContainer>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 bg-surface/95 backdrop-blur-md px-gutter-mobile md:px-8 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-outline-variant/30 shadow-luxury grid grid-cols-[1fr_2fr] md:flex md:justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={() => navigate(`${ADMIN_BASE}/products`)} className="md:w-40">
          Cancel
        </Button>
        <Button onClick={save} disabled={saving} className="md:w-60">
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Product'}
        </Button>
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
