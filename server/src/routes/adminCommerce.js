import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { adminWriteLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import * as v from '../validators/commerce.js';
import * as c from '../controllers/adminCommerceController.js';

// Staff: run fulfilment (orders, packing, shipping, returns). Admin only: money and people (refunds, cancelling
// paid orders, customers, coupons, shop rules, sales, audit, export).
const staff = [requireAuth, requireRole('admin', 'staff')];
const admin = [requireAuth, requireRole('admin')];
const staffWrite = [adminWriteLimiter, ...staff];
const adminWrite = [adminWriteLimiter, ...admin];
const id = validate(v.adminIdParams, 'params');

export const adminCommerceRouter = Router();

adminCommerceRouter
  .route('/orders')
  .get(staff, validate(v.adminOrdersQuery, 'query'), h(c.listOrders))
  .all(methodNotAllowed(['GET']));
adminCommerceRouter
  .route('/orders/export.csv')
  .get(admin, validate(v.exportQuery, 'query'), h(c.exportCsv))
  .all(methodNotAllowed(['GET']));
adminCommerceRouter
  .route('/orders/:id')
  .get(staff, id, h(c.getOrder))
  .all(methodNotAllowed(['GET']));
adminCommerceRouter
  .route('/orders/:id/status')
  .post(staffWrite, id, validate(v.statusBody), h(c.setStatus))
  .all(methodNotAllowed(['POST']));
adminCommerceRouter
  .route('/orders/:id/ship')
  .post(staffWrite, id, validate(v.shipBody), h(c.ship))
  .all(methodNotAllowed(['POST']));
adminCommerceRouter
  .route('/orders/:id/cancel')
  .post(adminWrite, id, validate(v.cancelBody), h(c.cancel))
  .all(methodNotAllowed(['POST']));
adminCommerceRouter
  .route('/orders/:id/refund')
  .post(adminWrite, id, validate(v.refundBody), h(c.refund))
  .all(methodNotAllowed(['POST']));
adminCommerceRouter
  .route('/orders/:id/return')
  .post(
    staffWrite,
    id,
    validate(v.returnActionBody),
    (req, res, next) => {
      // Money moves only for admins.
      if (req.body.action === 'refund' && req.user.role !== 'admin')
        return res.status(403).json({ error: "You don't have access to this.", code: 'FORBIDDEN', requestId: req.id });
      next();
    },
    h(c.updateReturn)
  )
  .all(methodNotAllowed(['POST']));
adminCommerceRouter
  .route('/orders/:id/packing-slip')
  .get(staff, id, h(c.packingSlip))
  .all(methodNotAllowed(['GET']));
adminCommerceRouter
  .route('/orders/:id/invoice')
  .get(staff, id, h(c.invoice))
  .all(methodNotAllowed(['GET']));

adminCommerceRouter
  .route('/customers')
  .get(admin, validate(v.customersQuery, 'query'), h(c.listCustomers))
  .all(methodNotAllowed(['GET']));
adminCommerceRouter
  .route('/customers/:id')
  .get(admin, id, h(c.getCustomer))
  .patch(adminWrite, id, validate(v.blockBody), h(c.blockCustomer))
  .all(methodNotAllowed(['GET', 'PATCH']));

adminCommerceRouter
  .route('/sales')
  .get(admin, validate(v.salesQuery, 'query'), h(c.sales))
  .all(methodNotAllowed(['GET']));

adminCommerceRouter
  .route('/coupons')
  .get(admin, h(c.listCoupons))
  .post(adminWrite, h(c.createCoupon))
  .all(methodNotAllowed(['GET', 'POST']));
adminCommerceRouter
  .route('/coupons/:id')
  .patch(adminWrite, id, h(c.updateCoupon))
  .delete(adminWrite, id, h(c.deleteCoupon))
  .all(methodNotAllowed(['PATCH', 'DELETE']));

adminCommerceRouter
  .route('/shop-settings')
  .get(staff, h(c.getShopRules))
  .put(adminWrite, h(c.putShopRules))
  .all(methodNotAllowed(['GET', 'PUT']));

adminCommerceRouter
  .route('/audit')
  .get(admin, validate(v.auditQuery, 'query'), h(c.auditLog))
  .all(methodNotAllowed(['GET']));
