import mongoose from 'mongoose';

// Every processed webhook event id, so a retried delivery is handled exactly once. Kept 90 days.
const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: String,
    receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { collection: 'webhook_events', versionKey: false }
);
webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);
