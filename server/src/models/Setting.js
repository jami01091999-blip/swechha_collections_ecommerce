import mongoose from 'mongoose';

// Single document with _id "site" in the `settings` collection.
const { Schema } = mongoose;

const bannerSchema = new Schema(
  { tag: String, title: String, subtitle: String, image: String, ctaLabel: String, ctaLink: String },
  { _id: false }
);

const settingSchema = new Schema(
  {
    _id: String,
    collectionName: String,
    banners: [bannerSchema],
    whatsapp: String,
    email: String,
    locations: String,
    instagram: String,
    defaultTaxRatePercent: Number,
    // Shop rules for checkout, delivery, returns and invoices (validators/shop.js).
    shop: Schema.Types.Mixed,
  },
  { collection: 'settings', versionKey: false, timestamps: { createdAt: false, updatedAt: true } }
);

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
