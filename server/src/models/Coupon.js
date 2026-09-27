import mongoose from 'mongoose';

const { Schema } = mongoose;

export const COUPON_TYPES = ['percent', 'flat'];

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true, min: 1 },
    minOrder: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }, // 0 = no cap (percent coupons)
    startsAt: Date,
    endsAt: Date,
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    perUserLimit: { type: Number, default: 1 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { collection: 'coupons', versionKey: false, timestamps: true }
);

export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
