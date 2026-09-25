import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import { MiniCard } from '../../components/public/ProductCards';
import Img from '../../components/shared/Img';
import Icon from '../../components/shared/Icon';
import { FreeSizeChip, SizeSection } from '../../components/shared/SizeAvailability';
import { useProduct, useProducts, useSettings } from '../../lib/api';
import { Link } from 'react-router-dom';
import { categoryMeta, DESK } from '../../lib/constants';
import { discountPercent, formatINR, waLink } from '../../lib/format';
import { isOutOfStock } from '../../lib/stock';
import { useToast } from '../../context/Toast';
import NotFound from './NotFound';

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="px-margin-mobile md:px-0 py-2.5">
      <button className="w-full flex items-center justify-between py-1 text-left group" onClick={onToggle} aria-expanded={open} type="button">
        <span className="font-title-md text-[14px] text-on-surface font-medium group-hover:text-primary">{title}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-lg text-outline transition-transform duration-200" />
      </button>
      {open && <div className="pt-1.5 pb-2 text-body-sm text-[13px] text-on-surface-variant leading-relaxed">{children}</div>}
    </div>
  );
}

function ZoomViewer({ images, start, onClose }) {
  const track = useRef(null);
  const step = (dir) => track.current?.scrollBy({ left: dir * track.current.offsetWidth, behavior: 'smooth' });
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = start * el.offsetWidth;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [start, onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <button onClick={onClose} aria-label="Close photo viewer" className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
        <Icon name="close" className="text-2xl" />
      </button>
      {images.length > 1 && (
        <>
          <button onClick={() => step(-1)} aria-label="Previous photo" className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 text-white items-center justify-center hover:bg-white/25">
            <Icon name="chevron_left" className="text-3xl" />
          </button>
          <button onClick={() => step(1)} aria-label="Next photo" className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 text-white items-center justify-center hover:bg-white/25">
            <Icon name="chevron_right" className="text-3xl" />
          </button>
        </>
      )}
      <div ref={track} className="flex-1 flex overflow-x-auto snap-x snap-mandatory no-scrollbar">
        {images.map((img, i) => (
          <div key={i} className="w-full h-full shrink-0 snap-center flex items-center justify-center overflow-auto">
            <Img src={img.url} alt={`Photo ${i + 1}`} width={1600} className="max-w-full max-h-full object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductView({ p }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: all } = useProducts();
  const { data: settings } = useSettings();
  const [slide, setSlide] = useState(0);
  const [size, setSize] = useState(null);
  const [colour, setColour] = useState(0);
  const [open, setOpen] = useState({ desc: true });
  const [zoom, setZoom] = useState(false);
  const gallery = useRef(null);
  const goTo = (i) => gallery.current?.scrollTo({ left: i * gallery.current.offsetWidth, behavior: 'smooth' });
  const off = discountPercent(p.mrp, p.price);
  const isSaree = p.category === 'Sarees';
  const images = p.images?.length ? p.images : [{ url: '' }];
  const out = isOutOfStock(p);

  useEffect(() => {
    document.title = `${p.name} | Swechha Collections`;
    return () => {
      document.title = 'Swechha Collections | Private Atelier Catalogue';
    };
  }, [p.name]);

  const related = useMemo(() => {
    const others = (all || []).filter((x) => x.slug !== p.slug);
    return [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, 6);
  }, [all, p.slug, p.category]);

  const colourName = p.colors?.[colour]?.name;
  const waText = [
    `Hello Swechha Collections Atelier, I am enquiring about the ${p.name} (SKU: ${p.code}) priced at ${formatINR(p.price)}.`,
    size && `Size: ${size}.`,
    colourName && p.colors.length > 1 && `Colour: ${colourName}.`,
    out ? 'It shows out of stock — please let me know when it is back.' : 'Please share availability and private draper consultation options.',
    `${window.location.origin}/product/${p.slug}`,
  ]
    .filter(Boolean)
    .join(' ');

  const share = () => {
    const url = `${window.location.origin}/product/${p.slug}`;
    if (navigator.share) navigator.share({ title: p.name, text: 'Private Atelier curation at Swechha Collections', url }).catch(() => {});
    else {
      navigator.clipboard?.writeText(url);
      toast('Product link copied to clipboard');
    }
  };

  const pickColour = (i) => {
    const c = p.colors[i];
    if (c.productSlug && c.productSlug !== p.slug) return navigate(`/product/${c.productSlug}`);
    setColour(i);
  };

  const badge = p.badge || (p.isNewArrival ? 'New Arrival' : '');
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="w-full flex flex-col pb-28 md:pb-16 min-h-screen bg-surface">
      <SubHeader
        title={p.name}
        subtitle={p.category}
        right={
          <button
            aria-label="Share"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface hover:text-primary hover:bg-surface-container transition-colors active:scale-90"
            onClick={share}
            type="button"
          >
            <Icon name="share" className="text-xl" />
          </button>
        }
      />

      {/* Laptop breadcrumb */}
      <nav aria-label="Breadcrumb" className={`hidden md:flex items-center gap-1.5 pt-6 pb-4 font-label-md text-label-md text-on-surface-variant ${DESK}`}>
        <Link to="/" className="hover:text-primary">Home</Link>
        <Icon name="chevron_right" className="text-sm" />
        <Link to={`/collection?category=${encodeURIComponent(p.category)}`} className="hover:text-primary">{categoryMeta(p.category).label}</Link>
        <Icon name="chevron_right" className="text-sm" />
        <span className="text-primary truncate">{p.name}</span>
      </nav>

      <div className={`md:grid md:grid-cols-2 md:gap-10 lg:gap-14 md:items-start ${DESK}`}>
      <div className="md:sticky md:top-24">
      {/* Gallery */}
      <section className="relative w-full aspect-[3/4] bg-surface-container-low overflow-hidden md:rounded-xl md:border md:border-outline-variant/30">
        <div
          ref={gallery}
          className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}
        >
          {images.map((img, i) => (
            <div key={i} className="w-full h-full shrink-0 snap-center relative">
              <Img src={img.url} alt={`${p.name} view ${i + 1}`} width={900} eager={i === 0} className={`w-full h-full object-cover ${i === 0 ? 'object-top' : 'object-center'}`} />
            </div>
          ))}
        </div>
        {p.images?.length > 0 && (
          <button
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface-container-lowest/85 backdrop-blur-sm shadow flex items-center justify-center text-primary hover:bg-surface-container-lowest transition-colors"
            onClick={() => setZoom(true)}
            title="Zoom image"
            aria-label="Zoom image"
            type="button"
          >
            <Icon name="zoom_in" className="text-base" />
          </button>
        )}
        {badge && (
          <div className="absolute top-3 left-3 bg-secondary text-white font-label-md text-xs px-2.5 py-0.5 rounded-full shadow-sm tracking-wide">{badge}</div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(Math.max(0, slide - 1))} disabled={slide === 0} aria-label="Previous photo" className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-surface-container-lowest/85 backdrop-blur-sm shadow items-center justify-center text-primary disabled:opacity-0 transition-opacity">
              <Icon name="chevron_left" className="text-2xl" />
            </button>
            <button type="button" onClick={() => goTo(Math.min(images.length - 1, slide + 1))} disabled={slide === images.length - 1} aria-label="Next photo" className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-surface-container-lowest/85 backdrop-blur-sm shadow items-center justify-center text-primary disabled:opacity-0 transition-opacity">
              <Icon name="chevron_right" className="text-2xl" />
            </button>
          </>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 z-10 pointer-events-none">
            {images.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-primary' : 'w-1.5 bg-surface-container-lowest/70'}`} />
            ))}
          </div>
        )}
      </section>
      {images.length > 1 && (
        <div className="hidden md:grid grid-cols-6 gap-2 mt-3">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${i === slide ? 'border-primary' : 'border-transparent hover:border-outline-variant'}`}
            >
              <Img src={img.url} alt="" width={160} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      </div>

      <div>
      {/* Info */}
      <section className="px-margin-mobile md:px-0 pt-space-md md:pt-0 pb-space-sm border-b border-outline-variant/20">
        <div className="flex items-center justify-between gap-3 text-secondary">
          <span className="font-label-md text-[11px] font-semibold tracking-wider uppercase">{p.fabric}</span>
          <span className="font-label-md text-[10px] text-outline font-mono shrink-0">SKU: {p.code}</span>
        </div>
        <h1 className="font-headline-md text-[24px] md:text-[32px] md:leading-[40px] text-primary mt-1 font-medium leading-tight">{p.name}</h1>
        {p.description && (
          <div className="mt-3 rounded-md border border-outline-variant/30 bg-surface-container-low px-2.5 py-2.5">
            <div className="font-label-md text-[11px] text-secondary font-semibold uppercase tracking-wider">Description</div>
            <p className="mt-1 whitespace-pre-line text-[12px] leading-5 text-on-surface-variant">{p.description}</p>
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-headline-sm text-[22px] font-semibold text-primary">{formatINR(p.price)}</span>
          {off > 0 && (
            <>
              <span className="font-body-sm text-[13px] text-outline line-through">MRP {formatINR(p.mrp)}</span>
              <span className="bg-primary/10 text-primary font-label-md text-[11px] font-semibold px-2 py-0.5 rounded">{off}% OFF</span>
            </>
          )}
          <span className="text-[10px] text-outline ml-auto">Inclusive of all taxes</span>
        </div>
        {p.colors?.length > 0 && (
          <div className="space-y-2 mt-4 pt-3 border-t border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-[11px] text-on-surface font-semibold tracking-wide">{p.colors.length > 1 ? 'More Colours' : 'Colour'}</span>
              <span className="font-label-md text-[10px] text-secondary">{colourName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              {p.colors.map((c, i) => (
                <button
                  key={`${c.name}-${i}`}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={i === colour}
                  onClick={() => pickColour(i)}
                  className={`w-7 h-7 rounded-full p-0.5 transition-all ${i === colour ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-outline-variant/60 hover:ring-primary'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Size availability */}
      <section className="px-margin-mobile md:px-0 space-y-3 py-3.5 border-b border-outline-variant/20 bg-surface-container-lowest/60 md:bg-transparent">
        {(!isSaree || p.sizeType === 'sized') && (
          <SizeSection product={p} selected={size} onSelect={setSize} onGuide={() => toast('Standard Swechha Size Guide: Regular Indian Festive Fit')} />
        )}
      </section>

      {/* Accordions */}
      <section className="divide-y divide-outline-variant/20 border-b border-outline-variant/20">
        {p.fabricDetails?.length > 0 && (
          <Accordion title="Fabric, Weave & Embellishment" open={!!open.fabric} onToggle={() => toggle('fabric')}>
            <ul className="space-y-1 list-disc list-inside text-[12px]">
              {p.fabricDetails.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </Accordion>
        )}
        {p.occasion && (
          <Accordion title="Occasion & Drapery Advice" open={!!open.style} onToggle={() => toggle('style')}>
            <p className="whitespace-pre-line">{p.occasion}</p>
          </Accordion>
        )}
        {p.care?.length > 0 && (
          <Accordion title="Garment Care" open={!!open.care} onToggle={() => toggle('care')}>
            <p className="text-[12px]">
              {p.care.map((c, i) => (
                <span key={i}>
                  • {c}
                  <br />
                </span>
              ))}
            </p>
          </Accordion>
        )}
      </section>

      {/* Laptop: enquiry actions inline (phones use the sticky bar below) */}
      <div className="hidden md:flex items-center gap-2.5 pt-6">
        <a
          className="flex-1 bg-[#1b4332] hover:bg-[#143225] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all text-[15px] font-semibold tracking-wide"
          href={waLink(settings?.whatsapp, waText)}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chat" className="text-xl" />
          <span>Enquire on WhatsApp</span>
        </a>
        <button type="button" aria-label="Share" onClick={share} className="w-[52px] h-[52px] rounded-xl border border-[#C59B6A] text-on-surface flex items-center justify-center hover:bg-surface-container-low transition-colors">
          <Icon name="share" className="text-2xl" />
        </button>
      </div>
      <div className="hidden md:flex items-center justify-center pt-2">
        <span className="text-[11px] text-on-surface-variant">Enquire on whatsapp for more details</span>
      </div>
      </div>
      </div>

      {related.length > 0 && (
        <section className={`mt-space-md md:mt-space-xl pb-space-lg ${DESK}`}>
          <div className="px-margin-mobile md:px-0 mb-space-sm flex items-center justify-between">
            <h3 className="font-headline-sm text-[18px] md:text-headline-sm text-primary font-medium">You May Also Like</h3>
            <span className="font-label-md text-[10px] text-secondary">Similar Weaves</span>
          </div>
          <div className="flex gap-2.5 md:gap-4 px-margin-mobile md:px-0 overflow-x-auto no-scrollbar scroll-smooth">
            {related.map((r) => (
              <MiniCard key={r._id} p={r} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky WhatsApp enquiry bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface/95 backdrop-blur-md px-margin-mobile py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] max-w-[480px] mx-auto right-0 border-t border-outline-variant/30 shadow-[0_-6px_20px_rgba(78,5,26,0.08)]">
        <div className="flex flex-col gap-1.5">
          <a
            className="w-full bg-[#1b4332] hover:bg-[#143225] text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all text-[14px] font-semibold tracking-wide"
            href={waLink(settings?.whatsapp, waText)}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="chat" className="text-xl" />
            <span>Enquire on WhatsApp</span>
          </a>
        </div>
      </div>

      {zoom && <ZoomViewer images={p.images} start={slide} onClose={() => setZoom(false)} />}
    </div>
  );
}

function PdpSkeleton() {
  return (
    <div className="w-full min-h-screen bg-surface">
      <div className="h-14 md:hidden border-b border-outline-variant/30" />
      <div className={`md:grid md:grid-cols-2 md:gap-10 md:pt-10 ${DESK}`}>
      <div className="w-full aspect-[3/4] bg-surface-container-low animate-pulse md:rounded-xl" />
      <div className="px-margin-mobile md:px-0 pt-4 md:pt-0 space-y-3">
        <div className="h-3 w-1/3 bg-surface-container rounded animate-pulse" />
        <div className="h-6 w-2/3 bg-surface-container rounded animate-pulse" />
        <div className="h-5 w-1/2 bg-surface-container rounded animate-pulse" />
      </div>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { data, loading, error } = useProduct(slug);
  if (data) return <ProductView key={data.slug} p={data} />;
  if (loading) return <PdpSkeleton />;
  if (error?.status === 404) return <NotFound message="This design is no longer in the catalogue." />;
  return <NotFound message={error?.message || 'This design could not load.'} />;
}
