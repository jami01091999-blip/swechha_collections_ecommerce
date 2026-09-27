import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

/** Header every state-changing request needs (CSRF rule). */
export const XRW = { 'X-Requested-With': 'swechha' };
export const PHOTO = { url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', publicId: '' };

/**
 * Starts an in-memory MongoDB, then loads the app (env is read at import time).
 * Set TEST_MONGO_URI to run against an existing MongoDB-compatible server instead (the database is dropped first).
 */
export async function startTestApp() {
  const external = process.env.TEST_MONGO_URI;
  const mongo = external ? null : await MongoMemoryServer.create();
  process.env.MONGO_URI = external || mongo.getUri();
  const { createApp } = await import('../src/app.js');
  const db = await import('../src/db/mongoose.js');
  const { Product } = await import('../src/models/Product.js');
  const { Setting } = await import('../src/models/Setting.js');
  const { User } = await import('../src/models/User.js');
  const { OtpCode } = await import('../src/models/OtpCode.js');
  const { Session } = await import('../src/models/Session.js');
  const { testOutbox } = await import('../src/integrations/mailer.js');
  const tokens = await import('../src/services/tokenService.js');
  await db.connectDb();
  if (external) await (await import('mongoose')).default.connection.db.dropDatabase();
  // Build unique indexes before duplicate-key tests.
  await Promise.all([Product.init(), User.init(), Session.init(), OtpCode.init()]);
  const app = createApp();
  return {
    app,
    Product,
    Setting,
    User,
    OtpCode,
    Session,
    testOutbox,
    tokens,
    /** Latest code emailed to `email`. */
    lastCode(email) {
      const msg = [...testOutbox].reverse().find((m) => m.to === email);
      return msg?.text.match(/code is (\d{6})/)?.[1];
    },
    /** Full OTP sign-in; returns a cookie-keeping supertest agent and the user JSON. */
    async signIn(email, { role } = {}) {
      const agent = request.agent(app);
      await agent.post('/api/auth/otp/request').set(XRW).send({ email }).expect(200);
      const code = this.lastCode(email.trim().toLowerCase());
      const res = await agent.post('/api/auth/otp/verify').set(XRW).send({ email, code }).expect(200);
      if (role) await User.updateOne({ email: res.body.user.email }, { $set: { role } });
      // Let the next sign-in for the same email skip the 60 s cool-down.
      await OtpCode.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      return { agent, user: res.body.user };
    },
    async stop() {
      await db.disconnectDb();
      await mongo?.stop();
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
