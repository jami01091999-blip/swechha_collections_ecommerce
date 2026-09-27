import { z } from 'zod';
import { MAX_LINE_QTY } from '../models/Cart.js';

const objectId = (msg = 'Invalid item.') => z.string().regex(/^[a-f0-9]{24}$/i, msg);
const size = z
  .string()
  .trim()
  .min(1, 'Choose a size.')
  .max(12)
  .transform((s) => s.toUpperCase());
const qty = z.coerce
  .number()
  .int('Quantity must be a whole number.')
  .min(1, 'Quantity must be at least 1.')
  .max(MAX_LINE_QTY, `Quantity can be at most ${MAX_LINE_QTY}.`);

export const cartAddBody = z.object({ productId: objectId('Invalid product.'), size, qty: qty.default(1) });
export const cartUpdateBody = z
  .object({ qty: qty.optional(), size: size.optional() })
  .refine((b) => b.qty !== undefined || b.size !== undefined, 'Nothing to change.');
export const itemIdParams = z.object({ itemId: objectId() });
const deviceLine = z.object({
  key: z.string().max(80).optional(),
  productId: z.string().max(40),
  size: z.string().max(12),
  qty: z.coerce.number().int().min(1).max(MAX_LINE_QTY),
});
export const cartLinesBody = z.object({ items: z.array(deviceLine).max(20, 'Your bag can hold up to 20 different items.') });

const checkoutBase = {
  source: z.enum(['cart', 'buy_now'], { message: 'Choose what to check out.' }),
  item: z.object({ productId: objectId('Invalid product.'), size, qty: qty.default(1) }).optional(),
  addressId: z.string().max(40).optional(),
  paymentMethod: z.enum(['cod', 'online']).optional(),
  couponCode: z.string().trim().max(30).optional(),
};
const buyNowNeedsItem = (b) => b.source !== 'buy_now' || Boolean(b.item);
export const quoteBody = z.object(checkoutBase).refine(buyNowNeedsItem, 'Choose a size.');
export const placeOrderBody = z
  .object({
    ...checkoutBase,
    addressId: z.string({ required_error: 'Choose a delivery address.' }).regex(/^[a-f0-9]{24}$/i, 'Choose a delivery address.'),
    paymentMethod: z.enum(['cod', 'online'], { message: 'Choose how you want to pay.' }),
    idempotencyKey: z.string().trim().min(8).max(80),
  })
  .refine(buyNowNeedsItem, 'Choose a size.');

export const orderNumberParams = z.object({
  orderNumber: z
    .string()
    .trim()
    .regex(/^SW-\d{4}-\d{6}$/i, 'Order not found.'),
});
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).catch(10).default(10),
});
export const cancelBody = z.object({ reason: z.string().trim().max(200).optional() });
export const RETURN_REASONS = [
  'Size does not fit',
  'Different from photos',
  'Damaged or defective',
  'Wrong item received',
  'Quality not as expected',
  'Changed my mind',
];
export const returnBody = z.object({
  type: z.enum(['refund', 'exchange'], { message: 'Choose refund or size exchange.' }),
  reason: z.enum(RETURN_REASONS, { message: 'Choose a reason.' }),
  note: z.string().trim().max(500).optional(),
  items: z
    .array(z.object({ itemId: objectId(), qty: z.coerce.number().int().min(1) }))
    .min(1, 'Choose at least one item.')
    .max(20),
});

export const razorpayVerifyBody = z.object({
  orderNumber: z.string().trim().max(20),
  razorpay_order_id: z.string().max(60),
  razorpay_payment_id: z.string().max(60),
  razorpay_signature: z.string().max(200),
});
export const mockPayBody = z.object({ outcome: z.enum(['success', 'failure']) });
export const failureBody = z.object({ reason: z.string().max(200).optional() });
export const pincodeQuery = z.object({
  pincode: z.string().trim().max(10),
  weight: z.coerce.number().int().min(0).max(50000).catch(500).optional(),
});

export const adminOrdersQuery = z.object({
  tab: z.enum(['new', 'packed', 'shipped', 'delivered', 'returns', 'unpaid', 'cancelled', 'all']).catch('all').default('all'),
  q: z.string().trim().max(80).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  payment: z.enum(['cod', 'online']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).catch(20).default(20),
});
export const adminIdParams = z.object({ id: z.string().trim().min(1).max(40) });
export const statusBody = z.object({
  action: z.enum(['pack', 'unpack', 'out_for_delivery', 'delivered', 'rto']),
  note: z.string().trim().max(200).optional(),
});
export const shipBody = z.object({
  courier: z.string().trim().max(60).optional(),
  awb: z.string().trim().max(40).optional(),
  trackingUrl: z.string().trim().max(300).optional(),
});
export const refundBody = z.object({
  amount: z.coerce.number().int('Refund in whole rupees.').positive('Refund amount must be more than 0.'),
  reason: z.string().trim().min(2, 'Add a reason.').max(200),
  note: z.string().trim().max(200).optional(),
});
export const returnActionBody = z.object({
  action: z.enum(['approve', 'reject', 'picked_up', 'received', 'refund', 'exchange', 'close']),
  note: z.string().trim().max(300).optional(),
  restock: z.boolean().optional(),
  amount: z.coerce.number().int().positive().optional(),
});
export const customersQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).catch(20).default(20),
});
export const blockBody = z.object({ isBlocked: z.boolean() });
export const salesQuery = z.object({ range: z.enum(['today', '7d', '30d', '90d']).catch('7d').default('7d') });
export const exportQuery = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});
export const auditQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).catch(1).default(1),
  entity: z.string().max(30).optional(),
  entityId: z.string().max(40).optional(),
});
