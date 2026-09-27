import mongoose from 'mongoose';

// Mirrors the documents in the `products` collection. Subdocuments have no _id and there is no __v.
// Sizes, totalStock, inStock, availableSizes and discountPercent are always written through
// services/productShape.js (shapeProduct) — never set them by hand.
const { Schema } = mongoose;

const imageSchema = new Schema({ url: String, publicId: String }, { _id: false });
const colorSchema = new Schema({ name: String, hex: String, productSlug: String }, { _id: false });
/** One row per size; free-size products have exactly one row with label "FREE". Available = stock − reserved. */
const sizeSchema = new Schema({ label: String, sku: String, stock: Number, reserved: { type: Number, default: 0 } }, { _id: false });

const productSchema = new Schema(
  {
    name: String,
    slug: String,
    code: String,
    category: String,
    fabric: String,
    badge: String,
    mrp: Number,
    price: Number,
    images: [imageSchema],
    colors: [colorSchema],
    sizeType: String,
    sizes: [sizeSchema],
    lowStockThreshold: Number,
    sareeDetails: {
      sareeLength: String,
      blousePiece: String,
      blouseLength: String,
      blouseFabric: String,
    },
    description: String,
    fabricDetails: [String],
    occasion: String,
    care: [String],
    status: String,
    isNewArrival: Boolean,
    isFeatured: Boolean,
    displayOrder: Number,
    // Shipping and tax (Phase 2)
    weightGrams: Number,
    dimensionsCm: { l: Number, b: Number, h: Number },
    hsnCode: String,
    taxRatePercent: Number,
    isCodAllowed: Boolean,
    isReturnable: Boolean,
    maxQtyPerOrder: Number,
    // Denormalised (productShape.derive)
    totalStock: Number,
    inStock: Boolean,
    availableSizes: [String],
    discountPercent: Number,
    // Stock revision: every write that touches sizes (checkout holds, stock edits, product edits) compares and bumps it.
    rev: Number,
  },
  { collection: 'products', versionKey: false, timestamps: true }
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ code: 1 }, { unique: true });
// Only documents that already have SKUs (after migration 002) take part, so older data can't collide on null.
productSchema.index({ 'sizes.sku': 1 }, { unique: true, partialFilterExpression: { 'sizes.sku': { $exists: true } } });
productSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });
productSchema.index({ status: 1, category: 1, displayOrder: 1, createdAt: -1 });
productSchema.index({ status: 1, price: 1 });
productSchema.index({ status: 1, inStock: 1 });
productSchema.index({ status: 1, discountPercent: -1 });
productSchema.index({ status: 1, isNewArrival: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index(
  { name: 'text', fabric: 'text', 'colors.name': 'text', category: 'text', code: 'text', description: 'text' },
  {
    name: 'product_text',
    // TEST_MONGO_COMPAT: MongoDB-compatible test servers (FerretDB/DocumentDB) allow at most 3 custom weights.
    weights: process.env.TEST_MONGO_COMPAT
      ? { name: 10, code: 8, fabric: 5 }
      : { name: 10, code: 8, fabric: 5, 'colors.name': 3, category: 3, description: 1 },
    default_language: 'english',
  }
);

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
