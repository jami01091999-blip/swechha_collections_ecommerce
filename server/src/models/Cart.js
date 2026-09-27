import mongoose from 'mongoose';

const { Schema } = mongoose;

export const MAX_CART_LINES = 20;
export const MAX_LINE_QTY = 10;

// One cart per signed-in user. Guests keep their bag on the device and it is merged here at sign-in.
// Lines store only what the customer chose; prices and stock are always re-read from products.
const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        size: { type: String, required: true },
        qty: { type: Number, required: true, min: 1, max: MAX_LINE_QTY },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { collection: 'carts', versionKey: false, timestamps: true }
);

export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
