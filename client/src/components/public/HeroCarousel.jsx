import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Img from '../shared/Img';
import Icon from '../shared/Icon';
import { DESK } from '../../lib/constants';

/** Hero banner carousel — Stitch hero, one slide per banner set in admin → Lookbook. */
export default function HeroCarousel({ banners = [] }) {
  const navigate = useNavigate();
  const track = useRef(null);
  const [index, setIndex] = useState(banners.length > 1 ? 1 : 0);

  useEffect(() => {
    const el = track.current;
    if (!el || banners.length < 2) return;
    el.scrollLeft = el.offsetWidth;
    setIndex(1);
  }, [banners.length]);

  // Auto-advance every 5s (off when the user prefers reduced motion or there is one slide).
  useEffect(() => {
    if (banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.offsetWidth) + 1) % banners.length;
      el.scrollTo({ left: next * el.offsetWidth, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  const go = (link) => {
    if (!link) return navigate('/collection');
    if (/^https?:\/\//i.test(link)) return window.open(link, '_blank', 'noopener');
    navigate(link);
  };

  if (!banners.length) {
    return (
      <section className={`relative px-margin-mobile pt-space-xs pb-space-md md:pt-6 ${DESK}`}>
        <div className="w-full aspect-[4/5] md:aspect-[16/7] rounded-xl bg-surface-container-low animate-pulse" />
      </section>
    );
  }

  return (
    <section className={`relative px-margin-mobile pt-space-xs pb-space-md md:pt-6 ${DESK}`}>
      <div className="relative w-full aspect-[4/5] md:aspect-[16/7] rounded-xl overflow-hidden shadow-lg border border-outline-variant/30">
        <div
          ref={track}
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth))}
        >
          {banners.map((b, i) => (
            <div key={i} className="relative w-full h-full shrink-0 snap-center flex flex-col justify-end md:justify-center p-space-md md:p-12 lg:p-16">
              <Img src={b.image} alt={b.title} width={900} eager={i === 0} className="absolute inset-0 w-full h-full object-cover object-top md:object-[center_25%]" />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-primary/95 via-primary/40 to-transparent" />
              <div className="relative z-10 flex flex-col items-start gap-space-xs md:gap-space-sm text-white md:max-w-lg">
                {b.tag && (
                  <span className="bg-secondary/90 backdrop-blur-sm text-surface-container-lowest px-2.5 py-0.5 rounded-full font-label-md text-label-md tracking-wider">
                    {b.tag}
                  </span>
                )}
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-display-lg md:text-headline-lg lg:text-display-lg text-surface-container-lowest font-medium mt-1">{b.title}</h1>
                {b.subtitle && <p className="font-body-sm text-body-sm md:text-body-lg text-surface-container-highest/90 line-clamp-2 max-w-[280px] md:max-w-md">{b.subtitle}</p>}
                <button
                  className="mt-2.5 md:mt-4 inline-flex items-center gap-2 bg-surface-container-lowest text-primary px-4 py-2 md:px-6 md:py-3 rounded-xl font-label-lg text-label-lg tracking-wide hover:bg-surface-bright transition-all active:scale-95 shadow-md"
                  onClick={() => go(b.ctaLink)}
                  type="button"
                >
                  <span>{b.ctaLabel || 'Explore Collection'}</span>
                  <Icon name="arrow_forward" className="text-sm font-semibold" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {banners.length > 1 && (
          <div className="absolute top-space-md right-space-md z-10 flex items-center gap-1.5 bg-primary/40 backdrop-blur-md px-2.5 py-1 rounded-full">
            {banners.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-secondary-fixed' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
