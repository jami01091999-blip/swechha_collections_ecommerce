import Icon from '../shared/Icon';
import { waLink } from '../../lib/format';

export default function ConsultBanner({ whatsapp }) {
  return (
    <section
      id="atelier"
      className="scroll-mt-20 md:scroll-mt-24 mt-space-lg md:mt-space-xl mx-margin-mobile md:mx-auto md:w-[calc(100%-4rem)] md:max-w-3xl p-space-md md:p-10 rounded-xl bg-primary-container text-white border border-outline-variant/30 flex flex-col items-center text-center shadow-md"
    >
      <Icon name="auto_awesome" className="text-secondary-fixed text-3xl mb-1" />
      <h3 className="font-headline-sm text-headline-sm md:text-headline-md text-white font-medium">Private Atelier Consultations</h3>
      <p className="font-body-sm text-body-sm md:text-body-md text-surface-container-highest/90 mt-1 max-w-[280px] md:max-w-lg">
        Schedule a personalized one-on-one virtual or in-person styling appointment with our master drapers.
      </p>
      <a
        className="mt-3.5 md:mt-5 w-full md:w-auto md:px-12 bg-white text-primary py-2.5 rounded-xl font-label-lg text-label-lg tracking-wider font-semibold hover:bg-surface-bright transition-colors active:scale-95 shadow text-center"
        href={waLink(whatsapp, 'Hello Swechha Atelier, I would like to schedule a private styling consultation.')}
        target="_blank"
        rel="noreferrer"
      >
        Inquire with Stylist
      </a>
    </section>
  );
}
