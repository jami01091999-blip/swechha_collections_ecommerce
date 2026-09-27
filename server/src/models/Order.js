import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ORDER_STATUSES = ['pending_payment', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto'];
export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refund_pending',
  'refunded',
  'partially_refunded',
  'cod_pending',
  'cod_collected',
];
export const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'picked_up', 'received', 'refunded', 'exchanged', 'closed'];

const itemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  slug: String,
  name: String,
  image: String,
  fabric: String,
  category: String,
  sku: String,
  size: String,
  qty: Number,
  price: Number, // per unit, GST inclusive, at the time of the order
  mrp: Number,
  lineTotal: Number,
  discountShare: Number, // coupon discount allocated to this line
  taxRatePercent: Number,
  taxableValue: Number,
  taxAmount: Number,
  hsnCode: String,
  weightGrams: Number,
  isReturnable: Boolean,
});

const historySchema = new Schema({ status: String, at: { type: Date, default: Date.now }, note: String, by: String }, { _id: false });

const refundSchema = new Schema(
  {
    refundId: String,
    amount: Number,
    status: { type: String, enum: ['pending', 'processed', 'failed'] },
    method: { type: String, enum: ['gateway', 'manual'] },
    reason: String,
    note: String,
    by: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true },
    invoiceNumber: String,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: String,
    source: { type: String, enum: ['cart', 'buy_now'] },
    idempotencyKey: String,
    items: [itemSchema],
    address: {
      fullName: String,
      phone: String,
      line1: String,
      line2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
    },
    pricing: {
      subtotal: Number,
      mrpTotal: Number,
      discount: Number,
      couponCode: String,
      shipping: Number,
      codFee: Number,
      total: Number,
      taxTotal: Number,
      savings: Number,
      interState: Boolean,
    },
    payment: {
      method: { type: String, enum: ['cod', 'online'] },
      provider: String,
      status: { type: String, enum: PAYMENT_STATUSES },
      providerOrderId: String,
      paymentId: String,
      paidAt: Date,
      attempts: [{ _id: false, providerOrderId: String, status: String, error: String, at: { type: Date, default: Date.now } }],
      refunds: [refundSchema],
      refundedTotal: { type: Number, default: 0 },
    },
    status: { type: String, enum: ORDER_STATUSES, required: true },
    statusHistory: [historySchema],
    // Stock: `reserved` (held on the products), `committed` (left the warehouse), `released`, `restocked`.
    stockState: { type: String, enum: ['reserved', 'committed', 'released', 'restocked'], default: 'reserved' },
    reservationExpiresAt: Date,
    shipment: {
      provider: String,
      courier: String,
      awb: String,
      trackingUrl: String,
      labelUrl: String,
      shipmentId: String,
      providerOrderId: String,
      etaDays: Number,
      events: [{ _id: false, status: String, at: Date, location: String, note: String }],
    },
    cancel: { reason: String, by: String, at: Date },
    returnRequest: {
      status: { type: String, enum: RETURN_STATUSES },
      type: { type: String, enum: ['refund', 'exchange'] },
      reason: String,
      note: String,
      items: [{ _id: false, itemId: Schema.Types.ObjectId, qty: Number }],
      amount: Number,
      restocked: Boolean,
      requestedAt: Date,
      history: [historySchema],
    },
    cartLines: [{ _id: false, productId: Schema.Types.ObjectId, size: String, qty: Number }],
    couponCounted: Boolean,
    placedAt: { type: Date, default: Date.now },
    deliveredAt: Date,
  },
  { collection: 'orders', versionKey: false, timestamps: true }
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ placedAt: -1 });
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
orderSchema.index({ 'payment.providerOrderId': 1 });
orderSchema.index({ status: 1, reservationExpiresAt: 1 });
orderSchema.index({ 'shipment.awb': 1 });
orderSchema.index({ 'returnRequest.status': 1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
