import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MAX_WISHLIST = 200;

// One document per user. Items are kept newest first.
const wishlistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        _id: false,
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { collection: 'wishlists', versionKey: false, timestamps: true }
);

export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);
