// Admin commerce: orders, returns, refunds, customers, coupons, sales, shop rules, audit, documents.
import * as admin from '../services/adminOrderService.js';
import * as coupons from '../services/couponService.js';
import { audit, listAudit } from '../services/auditService.js';
import { getShop, saveShop } from '../services/settingsService.js';
import { invoiceHtml, packingSlipHtml } from '../services/documentService.js';
import { Order } from '../models/Order.js';
import { HttpError } from '../utils/HttpError.js';
import { noStore } from '../utils/cache.js';

const json = (res, data, status = 200) => {
  noStore(res);
  res.status(status).json(data);
};

export const listOrders = async (req, res) => json(res, await admin.listOrders(req.query));
export const getOrder = async (req, res) => json(res, await admin.getOrder(req.params.id));

export async function setStatus(req, res) {
  const out = await admin.setStatus(req.params.id, req.body.action, req.body, req);
  await audit(req, `order.${req.body.action}`, {
    entity: 'order',
    entityId: out.orderNumber,
    summary: `${out.orderNumber} → ${out.status}`,
  });
  json(res, out);
}
export async function ship(req, res) {
  const out = await admin.ship(req.params.id, req.body, req);
  await audit(req, 'order.ship', {
    entity: 'order',
    entityId: out.orderNumber,
    summary: `${out.orderNumber} shipped (${out.shipment?.courier} ${out.shipment?.awb})`,
  });
  json(res, out);
}
export async function cancel(req, res) {
  const out = await admin.adminCancel(req.params.id, req.body, req);
  await audit(req, 'order.cancel', {
    entity: 'order',
    entityId: out.orderNumber,
    summary: `${out.orderNumber} cancelled: ${req.body.reason || ''}`,
  });
  json(res, out);
}
export async function refund(req, res) {
  const out = await admin.adminRefund(req.params.id, req.body, req);
  await audit(req, 'order.refund', {
    entity: 'order',
    entityId: out.orderNumber,
    summary: `Refund ₹${req.body.amount} on ${out.orderNumber}`,
    meta: { reason: req.body.reason },
  });
  json(res, out);
}
export async function updateReturn(req, res) {
  const out = await admin.updateReturn(req.params.id, req.body, req);
  await audit(req, `return.${req.body.action}`, {
    entity: 'order',
    entityId: out.orderNumber,
    summary: `Return ${req.body.action} on ${out.orderNumber}`,
  });
  json(res, out);
}

async function orderDoc(id) {
  const order = await Order.findOne(/^[a-f0-9]{24}$/i.test(id) ? { _id: id } : { orderNumber: String(id).toUpperCase() });
  if (!order) throw new HttpError(404, 'Order not found.');
  return order;
}
export async function packingSlip(req, res) {
  noStore(res);
  res.type('html').send(packingSlipHtml(await orderDoc(req.params.id)));
}
export async function invoice(req, res) {
  const order = await orderDoc(req.params.id);
  if (!order.invoiceNumber) throw new HttpError(404, 'No invoice yet: the order is not confirmed.');
  noStore(res);
  res.type('html').send(invoiceHtml(order, await getShop()));
}
export async function exportCsv(req, res) {
  noStore(res);
  res.setHeader('Content-Disposition', `attachment; filename="swechha-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv').send(`\uFEFF${await admin.exportCsv(req.query)}`);
}

export const listCustomers = async (req, res) => json(res, await admin.listCustomers(req.query));
export const getCustomer = async (req, res) => json(res, await admin.getCustomer(req.params.id));
export async function blockCustomer(req, res) {
  const out = await admin.setBlocked(req.params.id, req.body.isBlocked, req);
  await audit(req, req.body.isBlocked ? 'customer.block' : 'customer.unblock', { entity: 'user', entityId: out._id, summary: out.email });
  json(res, out);
}

export const sales = async (req, res) => json(res, await admin.sales(req.query.range));

export const listCoupons = async (req, res) => json(res, await coupons.listCoupons());
export async function createCoupon(req, res) {
  const c = await coupons.createCoupon(req.body || {});
  await audit(req, 'coupon.create', { entity: 'coupon', entityId: c._id, summary: c.code });
  json(res, c, 201);
}
export async function updateCoupon(req, res) {
  const c = await coupons.updateCoupon(req.params.id, req.body || {});
  await audit(req, 'coupon.update', { entity: 'coupon', entityId: c._id, summary: c.code });
  json(res, c);
}
export async function deleteCoupon(req, res) {
  await coupons.deleteCoupon(req.params.id);
  await audit(req, 'coupon.delete', { entity: 'coupon', entityId: req.params.id });
  json(res, { deleted: true });
}

export const getShopRules = async (req, res) => json(res, await getShop());
export async function putShopRules(req, res) {
  const shop = await saveShop(req.body || {});
  await audit(req, 'settings.shop', { entity: 'settings', entityId: 'shop', summary: 'Shop rules updated' });
  json(res, shop);
}

export const auditLog = async (req, res) => json(res, await listAudit(req.query));
