// Printable HTML documents: GST tax invoice (customer + admin) and packing slip (admin).
// Print → "Save as PDF" in any browser gives a PDF; no PDF library needed on the server.
import { formatDate, formatINR } from '../utils/format.js';
import { round2 } from '../utils/money.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sizeName = (s) => (s === 'FREE' ? 'Free Size' : s);
const money2 = (n) => `₹${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const page = (
  title,
  body
) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<style>
  *{box-sizing:border-box} body{margin:0;background:#fcf9f8;color:#1b1c1c;font:13px/1.5 Arial,Helvetica,sans-serif}
  .sheet{max-width:820px;margin:24px auto;background:#fff;border:1px solid #dac0c2;border-radius:12px;padding:28px}
  h1{font:500 22px Georgia,serif;color:#4e051a;margin:0} h2{font:600 12px Arial;letter-spacing:.08em;text-transform:uppercase;color:#7a582d;margin:18px 0 6px}
  .row{display:flex;gap:24px;flex-wrap:wrap;justify-content:space-between} .muted{color:#544244}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:7px 6px;border-bottom:1px solid #eae7e7;text-align:left;vertical-align:top}
  th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#544244} td.n,th.n{text-align:right;white-space:nowrap}
  .tot td{border:0;padding:3px 6px} .grand td{font-weight:bold;font-size:15px;border-top:2px solid #4e051a}
  .actions{max-width:820px;margin:12px auto 0;text-align:right} button{background:#6b1d2f;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:bold;cursor:pointer}
  .big{font-size:18px;font-weight:bold} .box{border:1px dashed #877274;border-radius:10px;padding:12px}
  @media print{body{background:#fff}.sheet{border:0;margin:0;padding:0;max-width:none}.actions{display:none}}
</style></head><body><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div><div class="sheet">${body}</div></body></html>`;

const addressBlock = (a) =>
  `${esc(a.fullName)}<br>${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ''}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}`;

export function invoiceHtml(order, shop) {
  const inter = order.pricing.interState;
  const rows = order.items
    .map((i, n) => {
      const tax = i.taxAmount || 0;
      const taxCols = inter
        ? `<td class="n">${i.taxRatePercent}%<br>${money2(tax)}</td>`
        : `<td class="n">${i.taxRatePercent / 2}%<br>${money2(tax / 2)}</td><td class="n">${i.taxRatePercent / 2}%<br>${money2(tax / 2)}</td>`;
      return `<tr><td>${n + 1}</td><td>${esc(i.name)}<br><span class="muted">${esc(sizeName(i.size))} · SKU ${esc(i.sku)}${i.hsnCode ? ` · HSN ${esc(i.hsnCode)}` : ''}</span></td>
      <td class="n">${i.qty}</td><td class="n">${money2(i.lineTotal - (i.discountShare || 0))}</td><td class="n">${money2(i.taxableValue)}</td>${taxCols}</tr>`;
    })
    .join('');
  const taxHead = inter ? '<th class="n">IGST</th>' : '<th class="n">CGST</th><th class="n">SGST</th>';
  const p = order.pricing;
  const cancelledNote = order.status === 'cancelled' ? '<p class="big" style="color:#ba1a1a">CANCELLED</p>' : '';
  return page(
    `Invoice ${order.invoiceNumber}`,
    `<div class="row"><div><h1>${esc(shop.businessName)}</h1><div class="muted">${esc(shop.businessAddress || '')}${shop.businessState ? `<br>${esc(shop.businessState)}` : ''}${shop.gstin ? `<br>GSTIN: ${esc(shop.gstin)}` : ''}</div></div>
    <div style="text-align:right"><div class="big">${shop.gstin ? 'Tax invoice' : 'Invoice'}</div>Invoice ${esc(order.invoiceNumber)}<br>Order ${esc(order.orderNumber)}<br>${formatDate(order.placedAt)}</div></div>
    ${cancelledNote}
    <div class="row"><div><h2>Bill to / ship to</h2>${addressBlock(order.address)}<br>${esc(order.email)}</div>
    <div><h2>Payment</h2>${order.payment.method === 'cod' ? 'Cash on delivery' : 'Paid online'}${order.payment.paymentId ? `<br><span class="muted">Ref ${esc(order.payment.paymentId)}</span>` : ''}<br>Place of supply: ${esc(order.address.state)}</div></div>
    <h2>Items</h2><table><thead><tr><th>#</th><th>Item</th><th class="n">Qty</th><th class="n">Amount</th><th class="n">Taxable</th>${taxHead}</tr></thead><tbody>${rows}</tbody></table>
    <table class="tot" style="margin-top:12px;max-width:340px;margin-left:auto">
      <tr><td>Items</td><td class="n">${formatINR(p.subtotal)}</td></tr>
      ${p.discount ? `<tr><td>Coupon ${esc(p.couponCode || '')}</td><td class="n">−${formatINR(p.discount)}</td></tr>` : ''}
      <tr><td>Delivery</td><td class="n">${p.shipping ? formatINR(p.shipping) : 'Free'}</td></tr>
      ${p.codFee ? `<tr><td>Cash on delivery fee</td><td class="n">${formatINR(p.codFee)}</td></tr>` : ''}
      <tr class="grand"><td>Total</td><td class="n">${formatINR(p.total)}</td></tr>
      <tr><td class="muted">GST included in items</td><td class="n muted">${money2(p.taxTotal)}</td></tr>
      ${order.payment.refundedTotal ? `<tr><td>Refunded</td><td class="n">−${formatINR(order.payment.refundedTotal)}</td></tr>` : ''}
    </table>
    <p class="muted" style="margin-top:20px">Prices include GST. ${shop.gstin ? '' : 'Issued without GSTIN.'} This is a computer-generated invoice.</p>`
  );
}

export function packingSlipHtml(order) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td><b>${esc(i.sku)}</b></td><td>${esc(i.name)}</td><td>${esc(sizeName(i.size))}</td><td class="n big">${i.qty}</td><td>☐</td></tr>`
    )
    .join('');
  const cod = order.payment.method === 'cod';
  return page(
    `Packing slip ${order.orderNumber}`,
    `<div class="row"><div><h1>Packing slip</h1>Order <b>${esc(order.orderNumber)}</b><br>${formatDate(order.placedAt)}</div>
    <div class="box" style="text-align:center"><div class="muted">${cod ? 'COLLECT CASH' : 'PREPAID'}</div><div class="big">${cod ? formatINR(order.pricing.total) : 'Do not collect'}</div></div></div>
    <h2>Ship to</h2>${addressBlock(order.address)}
    <h2>Pack these</h2><table><thead><tr><th>SKU</th><th>Item</th><th>Size</th><th class="n">Qty</th><th>Packed</th></tr></thead><tbody>${rows}</tbody></table>
    ${order.shipment?.awb ? `<h2>Courier</h2>${esc(order.shipment.courier)} · AWB <b>${esc(order.shipment.awb)}</b>` : ''}`
  );
}
