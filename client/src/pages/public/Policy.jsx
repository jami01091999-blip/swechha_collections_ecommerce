// Policy pages required by payment gateways (Razorpay checks these before approving live payments).
// Text is filled from Admin → Shop rules and boutique details. Have it reviewed before going live.
import { Link, useParams } from 'react-router-dom';
import { SubHeader } from '../../components/public/Header';
import BottomNav from '../../components/public/BottomNav';
import { Card, PageContainer, Skeleton } from '../../components/ui';
import { useSettings } from '../../lib/api';
import { formatINR, formatPhone } from '../../lib/format';
import { usePageMeta } from '../../lib/seo';
import NotFound from './NotFound';
import { POLICIES } from '../../lib/constants';

function body(page, s) {
  const shop = s.shop || {};
  const name = shop.businessName || 'Swechha Collections';
  const contact = [s.email && `email ${s.email}`, s.whatsapp && `WhatsApp ${formatPhone(s.whatsapp)}`].filter(Boolean).join(' or ');
  const free =
    shop.freeShippingAbove > 0
      ? ` Delivery is free on orders of ${formatINR(shop.freeShippingAbove)} or more; below that a charge of ${formatINR(shop.shippingFee)} applies.`
      : ' Delivery is free on all orders.';
  const T = {
    shipping: [
      `We ship across India from ${shop.businessState || 'India'}. Orders are packed within 1–2 working days of confirmation.`,
      `Delivery usually takes ${shop.deliveryDaysMin}–${shop.deliveryDaysMax} days after dispatch, depending on your PIN code. You can check the expected date on any product page and at checkout.${free}`,
      shop.codEnabled
        ? `Cash on delivery is available on eligible PIN codes for orders up to ${shop.codMaxOrderValue > 0 ? formatINR(shop.codMaxOrderValue) : 'any value'}${shop.codFee ? `, with a ${formatINR(shop.codFee)} cash-handling fee` : ''}.`
        : 'All orders are prepaid.',
      'You will get an email with the courier name and tracking number when your order ships, and you can follow it in My orders.',
      `If a parcel is returned to us because it could not be delivered, prepaid orders are refunded (less the delivery charge); cash-on-delivery orders are cancelled.`,
    ],
    returns: [
      `You can request a return or size exchange within ${shop.returnWindowDays} days of delivery from My orders. Items must be unused, unwashed and have their original tags.`,
      'Some items — such as altered or custom-stitched pieces, and items marked "not returnable" on the product page — cannot be returned.',
      'Once approved, we arrange a pickup. After the item reaches us and passes a quality check, we issue the refund or send the new size.',
      'Refunds for online payments go back to the original payment method within 5–7 working days of approval. Cash-on-delivery refunds are sent by UPI or bank transfer.',
      'You can cancel an order any time before it ships from My orders; paid orders are refunded in full.',
    ],
    terms: [
      `This website is run by ${name}${shop.businessAddress ? `, ${shop.businessAddress}` : ''}. By placing an order you agree to these terms.`,
      'Prices are in Indian rupees and include GST. We try to show colours accurately, but handloom and hand-dyed fabrics vary slightly from piece to piece and from screen to screen; this is not a defect.',
      'An order is confirmed when you receive the confirmation email. If an item becomes unavailable after you order, we will cancel it and refund any payment in full.',
      'Coupons cannot be exchanged for cash and may have limits shown at checkout. We may refuse or cancel orders that look fraudulent.',
      `Questions about these terms: ${contact || 'see the Contact page'}.`,
    ],
    privacy: [
      'We collect only what we need to run your account and deliver orders: your email address, name, phone number, delivery addresses and order history.',
      'Payments are processed by our payment partner (Razorpay). We never see or store your card or UPI details.',
      'We share your name, address and phone number with the courier only to deliver your order. We do not sell your data.',
      'We use essential cookies to keep you signed in. Saved designs and your bag are stored on your device until you sign in.',
      `To see, correct or delete your data, contact us: ${contact || 'see the Contact page'}.`,
    ],
    contact: [
      name,
      shop.businessAddress || s.locations || '',
      s.email ? `Email: ${s.email}` : '',
      s.whatsapp ? `WhatsApp / phone: ${formatPhone(s.whatsapp)}` : '',
      shop.gstin ? `GSTIN: ${shop.gstin}` : '',
      'We reply within one working day.',
    ].filter(Boolean),
  };
  return T[page];
}

export default function Policy() {
  const { page } = useParams();
  const { data: settings, loading } = useSettings();
  const meta = POLICIES.find(([k]) => k === page);
  usePageMeta({ title: meta?.[1], description: meta ? `${meta[1]} — Swechha Collections` : undefined });
  if (!meta) return <NotFound />;
  const paras = settings ? body(page, settings) : [];
  return (
    <div className="w-full flex flex-col pb-24 md:pb-16 min-h-screen">
      <SubHeader title={meta[1]} subtitle="Swechha Collections" />
      <PageContainer as="main" className="px-margin-mobile pt-4 md:pt-8 flex-1">
        <h1 className="hidden md:block font-headline-md text-headline-md text-primary mb-4">{meta[1]}</h1>
        <div className="md:grid md:grid-cols-[1fr_220px] md:gap-8 md:items-start">
          <Card className="space-y-3">
            {loading && !settings
              ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-4 rounded" />)
              : paras.map((t, i) => (
                  <p key={i} className="font-body-sm text-[14px] leading-relaxed text-on-surface">
                    {t}
                  </p>
                ))}
          </Card>
          <nav aria-label="Policies" className="mt-4 md:mt-0 flex flex-wrap md:flex-col gap-2">
            {POLICIES.map(([k, label]) => (
              <Link
                key={k}
                to={`/policies/${k}`}
                className={`font-label-lg text-label-lg ${k === page ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </PageContainer>
      <BottomNav />
    </div>
  );
}
