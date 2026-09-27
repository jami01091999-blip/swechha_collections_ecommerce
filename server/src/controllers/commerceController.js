// Customer commerce: bag, checkout, orders, payments, PIN code checks, invoices.
import * as cart from '../services/cartService.js';
import * as orders from '../services/orderService.js';
import * as payments from '../services/paymentService.js';
import { getShop } from '../services/settingsService.js';
import { serviceability } from '../services/shippingService.js';
import { invoiceHtml } from '../services/documentService.js';
import { HttpError } from '../utils/HttpError.js';
import { noStore } from '../utils/cache.js';

const json = (res, data, status = 200) => {
  noStore(res);
  res.status(status).json(data);
};
const uid = (req) => req.user._id;

export const getCart = async (req, res) => json(res, await cart.getCart(uid(req)));
export const addToCart = async (req, res) => json(res, await cart.addItem(uid(req), req.body));
export const updateCartItem = async (req, res) => json(res, await cart.updateItem(uid(req), req.params.itemId, req.body));
export const removeCartItem = async (req, res) => json(res, await cart.removeItem(uid(req), req.params.itemId));
export const clearCart = async (req, res) => json(res, await cart.clearCart(uid(req)));
export const mergeCart = async (req, res) => json(res, await cart.mergeBag(uid(req), req.body.items));
export const previewCart = async (req, res) => json(res, await cart.previewBag(req.body.items));

export const quote = async (req, res) => json(res, await orders.quote(req.user, req.body));
export async function placeOrder(req, res) {
  const result = await orders.placeOrder(req.user, req.body);
  json(res, result, 201);
}
export const myOrders = async (req, res) => json(res, await orders.listMyOrders(uid(req), req.query));
export const myOrder = async (req, res) => json(res, await orders.myOrder(uid(req), req.params.orderNumber));
export const cancelMine = async (req, res) => json(res, await orders.cancelMyOrder(uid(req), req.params.orderNumber, req.body.reason));
export const requestReturn = async (req, res) => json(res, await orders.requestReturn(uid(req), req.params.orderNumber, req.body));

export async function invoice(req, res) {
  const order = await orders.findMyOrder(uid(req), req.params.orderNumber);
  if (!order.invoiceNumber || order.status === 'pending_payment')
    throw new HttpError(404, 'The invoice is ready once the order is confirmed.');
  noStore(res);
  res.type('html').send(invoiceHtml(order, await getShop()));
}

export const retryPayment = async (req, res) => json(res, { payment: await payments.retryPayment(req.user, req.params.orderNumber) });
export const verifyRazorpay = async (req, res) => json(res, await payments.verifyRazorpay(req.user, req.body));
export const mockPay = async (req, res) => json(res, await payments.mockComplete(req.user, req.params.orderNumber, req.body.outcome));
export const paymentFailed = async (req, res) => json(res, await payments.reportFailure(req.user, req.params.orderNumber, req.body.reason));

export async function pincode(req, res) {
  const result = await serviceability(req.query.pincode, await getShop(), { weightGrams: req.query.weight || 500 });
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(result);
}
