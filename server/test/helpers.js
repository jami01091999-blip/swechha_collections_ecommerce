import { MongoMemoryServer } from 'mongodb-memory-server';

export const ADMIN = { 'x-admin-key': 'test-admin-key' };
export const PHOTO = { url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', publicId: '' };

/** Starts an in-memory MongoDB, then loads the app (env is read at import time). */
export async function startTestApp() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  const { createApp } = await import('../src/app.js');
  const db = await import('../src/db/mongoose.js');
  const { Product } = await import('../src/models/Product.js');
  const { Setting } = await import('../src/models/Setting.js');
  await db.connectDb();
  await Product.init(); // build unique indexes before duplicate-key tests
  return {
    app: createApp(),
    Product,
    Setting,
    async stop() {
      await db.disconnectDb();
      await mongo.stop();
    },
  };
}

export const validProduct = (overrides = {}) => ({
  name: 'Gulmohar Silk Saree',
  code: 'sc-t-001',
  category: 'Sarees',
  fabric: 'Pure Tussar Silk',
  price: 14500,
  mrp: 24000,
  images: [PHOTO],
  status: 'published',
  ...overrides,
});
