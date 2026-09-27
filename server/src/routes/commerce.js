import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import { env } from '../config/env.js';
import * as v from '../validators/commerce.js';
import * as c from '../controllers/commerceController.js';

/** Placing orders and paying: generous per IP (shared mobile IPs), but stops scripted abuse. */
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  skip: () => env.isTest,
});

export const cartRouter = Router();
// Guests: price the bag stored on their device (no account needed).
cartRouter
  .route('/preview')
  .post(validate(v.cartLinesBody), h(c.previewCart))
  .all(methodNotAllowed(['POST']));
cartRouter.use(requireAuth);
cartRouter
  .route('/')
  .get(h(c.getCart))
  .delete(h(c.clearCart))
  .all(methodNotAllowed(['GET', 'DELETE']));
cartRouter
  .route('/items')
  .post(validate(v.cartAddBody), h(c.addToCart))
  .all(methodNotAllowed(['POST']));
cartRouter
  .route('/items/:itemId')
  .patch(validate(v.itemIdParams, 'params'), validate(v.cartUpdateBody), h(c.updateCartItem))
  .delete(validate(v.itemIdParams, 'params'), h(c.removeCartItem))
  .all(methodNotAllowed(['PATCH', 'DELETE']));
cartRouter
  .route('/merge')
  .post(validate(v.cartLinesBody), h(c.mergeCart))
  .all(methodNotAllowed(['POST']));

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);
checkoutRouter
  .route('/quote')
  .post(validate(v.quoteBody), h(c.quote))
  .all(methodNotAllowed(['POST']));

export const ordersRouter = Router();
ordersRouter.use(requireAuth);
const num = validate(v.orderNumberParams, 'params');
ordersRouter
  .route('/')
  .get(validate(v.pageQuery, 'query'), h(c.myOrders))
  .post(checkoutLimiter, validate(v.placeOrderBody), h(c.placeOrder))
  .all(methodNotAllowed(['GET', 'POST']));
ordersRouter
  .route('/:orderNumber')
  .get(num, h(c.myOrder))
  .all(methodNotAllowed(['GET']));
ordersRouter
  .route('/:orderNumber/cancel')
  .post(num, validate(v.cancelBody), h(c.cancelMine))
  .all(methodNotAllowed(['POST']));
ordersRouter
  .route('/:orderNumber/returns')
  .post(num, validate(v.returnBody), h(c.requestReturn))
  .all(methodNotAllowed(['POST']));
ordersRouter
  .route('/:orderNumber/invoice')
  .get(num, h(c.invoice))
  .all(methodNotAllowed(['GET']));

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth, checkoutLimiter);
paymentsRouter
  .route('/razorpay/verify')
  .post(validate(v.razorpayVerifyBody), h(c.verifyRazorpay))
  .all(methodNotAllowed(['POST']));
paymentsRouter
  .route('/:orderNumber/retry')
  .post(num, h(c.retryPayment))
  .all(methodNotAllowed(['POST']));
paymentsRouter
  .route('/:orderNumber/failed')
  .post(num, validate(v.failureBody), h(c.paymentFailed))
  .all(methodNotAllowed(['POST']));
paymentsRouter
  .route('/:orderNumber/mock')
  .post(num, validate(v.mockPayBody), h(c.mockPay))
  .all(methodNotAllowed(['POST']));

export const shippingRouter = Router();
shippingRouter
  .route('/serviceability')
  .get(validate(v.pincodeQuery, 'query'), h(c.pincode))
  .all(methodNotAllowed(['GET']));
