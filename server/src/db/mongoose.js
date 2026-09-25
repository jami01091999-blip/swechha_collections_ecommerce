import mongoose from 'mongoose';
import { env } from '../config/env.js';

mongoose.set('strictQuery', true);

let connecting = null;

/** Connect once; later calls reuse the same promise. */
export function connectDb(uri = env.MONGO_URI) {
  if (!connecting) {
    connecting = mongoose
      .connect(uri, {
        dbName: env.MONGO_DB,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        autoIndex: !env.isProd,
      })
      .catch((e) => {
        connecting = null; // allow a retry
        throw e;
      });
  }
  return connecting;
}

export const isDbUp = () => mongoose.connection.readyState === 1;

export async function disconnectDb() {
  connecting = null;
  await mongoose.disconnect();
}
