import mongoose from 'mongoose';

const { Schema } = mongoose;

// One document per signed-in device. Only hashes of refresh tokens are stored.
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    previousTokenHash: String,
    rotatedAt: Date,
    userAgent: String,
    ip: String,
    lastUsedAt: Date,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { collection: 'sessions', versionKey: false, timestamps: true }
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ previousTokenHash: 1 }, { sparse: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
