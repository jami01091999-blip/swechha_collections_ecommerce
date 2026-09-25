import Icon from '../shared/Icon';
import { formatPhone, waLink } from '../../lib/format';
import { useToast } from '../../context/Toast';
import { DESK } from '../../lib/constants';

export default function Footer({ settings = {} }) {
  const toast = useToast();
  const share = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({ title: 'Swechha Collections', url }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(url);
      toast('Catalogue link copied!');
    }
  };
  const round = 'w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors';
  return (
    <footer className="mt-space-xl bg-surface-container-low border-t border-outline-variant/30 px-margin-mobile pt-space-lg md:pt-space-xl pb-space-lg flex flex-col">
      <div className={`md:grid md:grid-cols-3 md:gap-10 md:items-start ${DESK}`}>
        <div>
          <div className="text-center md:text-left">
            <h4 className="font-headline-sm text-headline-sm text-primary font-medium tracking-wide">Swechha Collections</h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 italic">Contemporary elegance woven into timeless Indian traditions.</p>
          </div>
          <div className="my-space-md border-b border-outline-variant/20 w-16 mx-auto md:mx-0 md:mb-0" />
        </div>
      <div className="flex flex-col gap-space-sm text-left md:col-span-2 md:grid md:grid-cols-2 md:gap-10">
        {settings.locations && (
          <div>
            <span className="font-label-lg text-label-lg text-secondary font-semibold uppercase tracking-wider block">Atelier Locations</span>
            <p className="font-body-sm text-body-sm text-on-surface mt-0.5">{settings.locations}</p>
          </div>
        )}
        <div>
          <span className="font-label-lg text-label-lg text-secondary font-semibold uppercase tracking-wider block">Styling Concierge</span>
          {settings.whatsapp && (
            <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 mt-0.5 text-on-surface">
              <Icon name="chat" className="text-sm text-primary" />
              <span className="font-body-sm text-body-sm">WhatsApp: {formatPhone(settings.whatsapp)}</span>
            </a>
          )}
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="flex items-center gap-1.5 mt-0.5 text-on-surface">
              <Icon name="mail" className="text-sm text-primary" />
              <span className="font-body-sm text-body-sm break-all">{settings.email}</span>
            </a>
          )}
        </div>
      </div>
      </div>
      <div className={`mt-space-md md:mt-space-lg pt-space-md border-t border-outline-variant/20 flex flex-col items-center gap-space-xs text-center ${DESK}`}>
        <div className="flex items-center gap-4 text-primary">
          {settings.instagram && (
            <a aria-label="Instagram" className={round} href={settings.instagram} target="_blank" rel="noreferrer">
              <Icon name="photo_camera" className="text-lg" />
            </a>
          )}
          {settings.whatsapp && (
            <a aria-label="WhatsApp" className={round} href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer">
              <Icon name="chat" className="text-lg" />
            </a>
          )}
          <button aria-label="Share Catalogue" className={round} onClick={share} type="button">
            <Icon name="share" className="text-lg" />
          </button>
        </div>
        <p className="font-label-md text-label-md text-on-surface-variant/80 mt-2 px-2 leading-relaxed">
          Private Catalogue Presentation • Inquire with our stylists for bespoke consultations.
        </p>
        <span className="font-label-md text-[10px] text-outline mt-1">© {new Date().getFullYear()} Swechha Collections Atelier. All rights reserved.</span>
      </div>
    </footer>
  );
}
