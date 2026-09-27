// Builds the indexes declared in the Mongoose models. Needed once per database in production,
// where autoIndex is off.
//   npm run db:indexes              → create missing indexes (never drops anything)
//   npm run db:indexes -- --drop    → also drop indexes that are not declared in the models
import { connectDb, disconnectDb } from '../db/mongoose.js';
import { Product } from '../models/Product.js';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';
import { OtpCode } from '../models/OtpCode.js';
import { Session } from '../models/Session.js';
import { Wishlist } from '../models/Wishlist.js';
import { Cart } from '../models/Cart.js';
import { Order } from '../models/Order.js';
import { Coupon } from '../models/Coupon.js';
import { Counter } from '../models/Counter.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { AuditLog } from '../models/AuditLog.js';

// Every model: unique emails/orders/coupons, TTL expiry of sign-in codes, sessions and webhook ids, query indexes.
const MODELS = [Product, Setting, User, OtpCode, Session, Wishlist, Cart, Order, Coupon, Counter, WebhookEvent, AuditLog];

const drop = process.argv.includes('--drop');

try {
  await connectDb();
  for (const Model of MODELS) {
    if (drop) {
      const dropped = await Model.syncIndexes();
      console.log(`${Model.modelName}: indexes in sync${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}.`);
    } else {
      await Model.createIndexes();
      const { toDrop } = await Model.diffIndexes();
      console.log(`${Model.modelName}: indexes created.${toDrop.length ? ` Not declared (kept): ${toDrop.join(', ')}` : ''}`);
    }
  }
  await disconnectDb();
  process.exit(0);
} catch (e) {
  console.error('Index sync failed:', e.message);
  process.exit(1);
}
