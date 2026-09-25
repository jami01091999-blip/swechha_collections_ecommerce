import mongoose from 'mongoose';

const { Schema } = mongoose;

// One document per code sent. `expiresAt` is when the code stops working (10 min).
// Documents are kept for 65 minutes (TTL on createdAt) so the hourly send limits can be counted from here.
const otpCodeSchema = new Schema(
  {
    email: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    consumedAt: Date,
    ip: String,
    userAgent: String,
  },
  { collection: 'otp_codes', versionKey: false, timestamps: true }
);

otpCodeSchema.index({ email: 1, createdAt: -1 });
otpCodeSchema.index({ ip: 1, createdAt: -1 });
otpCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 65 * 60 });

export const OtpCode = mongoose.models.OtpCode || mongoose.model('OtpCode', otpCodeSchema);
