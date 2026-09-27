// Order emails. All are fire-and-forget: sendEmail never throws.
import { env } from '../config/env.js';
import { brandEmail, sendEmail } from '../integrations/mailer.js';
import { formatDate, formatINR } from '../utils/format.js';

const link = (order) => `${env.siteUrl}/account/orders/${order.orderNumber}`;
const sizeName = (s) => (s === 'FREE' ? 'Free Size' : s);
const itemRows = (order) => order.items.map((i) => [`${i.name} · ${sizeName(i.size)} × ${i.qty}`, formatINR(i.price * i.qty)]);
const totalRows = (order) => [
  ['Items', formatINR(order.pricing.subtotal)],
  ...(order.pricing.discount ? [[`Coupon ${order.pricing.couponCode || ''}`.trim(), `−${formatINR(order.pricing.discount)}`]] : []),
  ['Delivery', order.pricing.shipping ? formatINR(order.pricing.shipping) : 'Free'],
  ...(order.pricing.codFee ? [['Cash on delivery fee', formatINR(order.pricing.codFee)]] : []),
  ['Total', formatINR(order.pricing.total), true],
];

const send = (order, subject, body) =>
  sendEmail(order.email, subject, brandEmail({ ...body, button: { label: 'View your order', url: link(order) } }));

export function orderConfirmed(order) {
  const cod = order.payment.method === 'cod';
  return send(order, `Order ${order.orderNumber} confirmed`, {
    heading: 'Thank you — your order is confirmed',
    paragraphs: [
      `Order ${order.orderNumber}, placed on ${formatDate(order.placedAt)}.`,
      cod ? `Please keep ${formatINR(order.pricing.total)} ready to pay when it arrives.` : 'Your payment was received.',
      `We'll email you when it ships. Delivering to ${order.address.fullName}, ${order.address.city} ${order.address.pincode}.`,
    ],
    rows: [...itemRows(order), ...totalRows(order)],
  });
}

export function orderCancelled(order) {
  const refund = order.payment.status === 'refund_pending' || order.payment.status === 'refunded';
  return send(order, `Order ${order.orderNumber} cancelled`, {
    heading: 'Your order was cancelled',
    paragraphs: [
      order.cancel?.reason ? `Reason: ${order.cancel.reason}` : `Order ${order.orderNumber} has been cancelled.`,
      refund
        ? `A refund of ${formatINR(order.payment.refundedTotal || order.pricing.total)} is on its way to your original payment method (usually 5–7 working days).`
        : '',
    ].filter(Boolean),
  });
}

export function orderShipped(order) {
  const s = order.shipment || {};
  return send(order, `Order ${order.orderNumber} has shipped`, {
    heading: 'Your order is on its way',
    paragraphs: [
      `Courier: ${s.courier || '—'} · Tracking number: ${s.awb || '—'}`,
      s.trackingUrl ? `Track it here: ${s.trackingUrl}` : '',
    ].filter(Boolean),
    rows: itemRows(order),
  });
}

export function orderDelivered(order) {
  return send(order, `Order ${order.orderNumber} delivered`, {
    heading: 'Delivered — we hope you love it',
    paragraphs: [
      `Order ${order.orderNumber} was delivered.`,
      order.items.some((i) => i.isReturnable)
        ? 'If something is not right, you can request a return or size exchange from your order page.'
        : '',
    ].filter(Boolean),
  });
}

export function refundIssued(order, amount) {
  return send(order, `Refund for order ${order.orderNumber}`, {
    heading: 'Your refund is on its way',
    paragraphs: [
      `We've issued a refund of ${formatINR(amount)} for order ${order.orderNumber}. Banks usually take 5–7 working days to show it.`,
    ],
  });
}

export function returnUpdate(order) {
  const r = order.returnRequest || {};
  const words = {
    requested: 'We received your return request and will review it within 1–2 days.',
    approved: 'Your return was approved. Our courier partner will contact you for pickup.',
    rejected: `Your return request was not approved.${r.note ? ` ${r.note}` : ''}`,
    picked_up: 'Your return has been picked up.',
    received: 'We received your return and are checking it.',
    refunded: 'Your refund for the return has been issued.',
    exchanged: 'Your exchange is being arranged; we will share the new tracking details.',
    closed: 'Your return request is closed.',
  };
  return send(order, `Return update for order ${order.orderNumber}`, {
    heading: 'Return update',
    paragraphs: [words[r.status] || 'Your return was updated.'],
  });
}
