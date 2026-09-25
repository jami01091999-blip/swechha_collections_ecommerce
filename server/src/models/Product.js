import mongoose from 'mongoose';

// Mirrors the documents already in the `products` collection. Subdocuments have no _id and
// there is no __v so writes produce exactly the same shape as the old native-driver code.
const { Schema } = mongoose;

const imageSchema = new Schema({ url: String, publicId: String }, { _id: false });
const colorSchema = new Schema({ name: String, hex: String, productSlug: String }, { _id: false });
const sizeSchema = new Schema({ label: String, stock: Number }, { _id: false });

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
    freeSizeStock: Number,
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
  },
  { collection: 'products', versionKey: false, timestamps: true }
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ code: 1 }, { unique: true });
productSchema.index({ status: 1, displayOrder: 1, createdAt: -1 });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
