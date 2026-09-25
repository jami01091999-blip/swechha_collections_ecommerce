import { useEffect, useRef, useState } from 'react';
import { AdminHeader, AdminNav } from '../../components/admin/AdminChrome';
import { SingleImage } from '../../components/admin/ImageManager';
import { ErrorSummary, Field, Section } from '../../components/admin/FormBits';
import Icon from '../../components/shared/Icon';
import { saveSettings, useAdminProducts, useSettings } from '../../lib/api';
import { ADESK, CATEGORIES } from '../../lib/constants';
import { useInventoryStats } from './Dashboard';
import { useToast } from '../../context/Toast';

const NEW_BANNER = { tag: '', title: '', subtitle: '', image: '', ctaLabel: 'Explore Collection', ctaLink: '/collection' };

/** Lookbook = the home-page hero banners + boutique contact details shown in the footer. */
export default function Lookbook() {
  const toast = useToast();
  const { data: settings, loading } = useSettings();
  const { data: products } = useAdminProducts();
  const stats = useInventoryStats(products);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (settings && !loaded.current) {
      setForm(JSON.parse(JSON.stringify(settings)));
      loaded.current = true;
    }
  }, [settings]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setBanner = (i, patch) => set({ banners: form.banners.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const moveBanner = (i, dir) => {
    const next = [...form.banners];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set({ banners: next });
  };

  const linkOptions = [
    { value: '/collection', label: 'All designs' },
    { value: '/collection?filter=new', label: 'New Arrivals' },
    { value: '/collection?filter=featured', label: 'Featured' },
    ...CATEGORIES.map((c) => ({ value: `/collection?category=${encodeURIComponent(c.key)}`, label: c.label })),
    ...(products || []).filter((p) => p.status === 'published').map((p) => ({ value: `/product/${p.slug}`, label: `Product: ${p.name}` })),
  ];

  const save = async () => {
    setError('');
    const bad = form.banners.findIndex((b) => !b.title.trim() || !b.image);
    if (bad >= 0) {
      setError(`Banner ${bad + 1} needs a title and a photo.`);
      return window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setSaving(true);
    try {
      const saved = await saveSettings(form);
      setForm(JSON.parse(JSON.stringify(saved)));
      toast('Lookbook saved');
    } catch (e) {
      setError(e.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const iconBtn = 'p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container disabled:opacity-30';

  return (
    <>
      <AdminHeader alerts={stats.attention.length} />
      <main className={`px-gutter-mobile pt-3 md:pt-6 pb-8 space-y-4 ${ADESK}`}>
        <div>
          <h2 className="font-headline-sm text-headline-sm md:text-headline-md text-primary">Lookbook</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant -mt-0.5">Home page banners and boutique details</p>
        </div>
        <ErrorSummary errors={{ error }} />
        {!form ? (
          <div className="admin-card h-40 animate-pulse" aria-busy={loading} />
        ) : (
          <>
            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
            {form.banners.map((b, i) => (
              <Section
                key={i}
                title={`Banner ${i + 1}`}
                hint={i === 0 ? 'Shows first when the site opens.' : undefined}
                action={
                  <>
                    <button type="button" className={iconBtn} onClick={() => moveBanner(i, -1)} disabled={i === 0} aria-label="Move up">
                      <Icon name="arrow_upward" className="text-[18px]" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => moveBanner(i, 1)} disabled={i === form.banners.length - 1} aria-label="Move down">
                      <Icon name="arrow_downward" className="text-[18px]" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => set({ banners: form.banners.filter((_, j) => j !== i) })} disabled={form.banners.length === 1} aria-label="Remove banner">
                      <Icon name="delete" className="text-[18px]" />
                    </button>
                  </>
                }
              >
                <Field label="Photo" required>
                  <SingleImage value={b.image} onChange={(image) => setBanner(i, { image })} />
                </Field>
                <Field label="Small tag" hint="e.g. AUTUMN / FESTIVE 2025">
                  <input className="field" maxLength={40} value={b.tag} onChange={(e) => setBanner(i, { tag: e.target.value })} />
                </Field>
                <Field label="Title" required>
                  <input className="field" maxLength={80} value={b.title} onChange={(e) => setBanner(i, { title: e.target.value })} placeholder="The Festive Edit" />
                </Field>
                <Field label="Subtitle">
                  <textarea className="field" rows={2} maxLength={200} value={b.subtitle} onChange={(e) => setBanner(i, { subtitle: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Button text">
                    <input className="field" maxLength={40} value={b.ctaLabel} onChange={(e) => setBanner(i, { ctaLabel: e.target.value })} />
                  </Field>
                  <Field label="Button opens">
                    <select className="field" value={b.ctaLink} onChange={(e) => setBanner(i, { ctaLink: e.target.value })}>
                      {!linkOptions.some((o) => o.value === b.ctaLink) && <option value={b.ctaLink}>{b.ctaLink}</option>}
                      {linkOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Section>
            ))}
            </div>
            {form.banners.length < 6 && (
              <button type="button" onClick={() => set({ banners: [...form.banners, { ...NEW_BANNER }] })} className="w-full md:w-auto md:px-8 py-3 rounded-xl border border-dashed border-[#C59B6A] text-primary font-label-lg text-label-lg active:scale-95 bg-surface-container-lowest">
                + Add banner
              </button>
            )}

            <Section title="Boutique Details" hint="Used for WhatsApp enquiries and the site footer.">
              <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
              <Field label="Current collection name" hint="Shown on your dashboard.">
                <input className="field" value={form.collectionName} onChange={(e) => set({ collectionName: e.target.value })} />
              </Field>
              <Field label="WhatsApp number" hint="With country code, no + or spaces. e.g. 919876543210">
                <input className="field" inputMode="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
              </Field>
              <Field label="Email">
                <input className="field" type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </Field>
              <Field label="Atelier locations">
                <input className="field" value={form.locations} onChange={(e) => set({ locations: e.target.value })} />
              </Field>
              <Field label="Instagram" hint="Profile link or @handle">
                <input className="field" value={form.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="@swechhacollections" />
              </Field>
              </div>
            </Section>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full md:w-auto md:px-12 bg-primary-container hover:bg-[#541423] text-surface-container-lowest py-3.5 rounded-xl font-title-md text-title-md font-semibold shadow-luxury active:scale-95 transition-all disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Lookbook'}
            </button>
          </>
        )}
      </main>
      <AdminNav />
    </>
  );
}
