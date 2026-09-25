// Loads server/.env, validates it once, and fails fast with a readable list of problems.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Tests get their environment from vitest.config.js only, never from the real server/.env.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
}

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_MODE: z.enum(['test', 'live']).default('test'),
    MONGO_URI: z.string({ required_error: 'MONGO_URI is required' }).min(1, 'MONGO_URI is required'),
    MONGO_DB: z.string().min(1).default('swechha'),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    ADMIN_KEY: optional,
    CLOUDINARY_CLOUD_NAME: optional,
    CLOUDINARY_API_KEY: optional,
    CLOUDINARY_API_SECRET: optional,
    CLOUDINARY_FOLDER: z.string().min(1).default('swechha/products'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // Number of proxies in front of the app (Render's load balancer = 1).
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.ADMIN_KEY) ctx.addIssue({ code: 'custom', path: ['ADMIN_KEY'], message: 'ADMIN_KEY is required in production' });
    if (!process.env.CLIENT_ORIGIN) {
      ctx.addIssue({ code: 'custom', path: ['CLIENT_ORIGIN'], message: 'CLIENT_ORIGIN is required in production' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`);
  // Only variable names and rule messages are printed, never values.
  console.error(`Invalid server environment. Fix these in server/.env (or the Render dashboard):\n${lines.join('\n')}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...parsed.data,
  clientOrigins: parsed.data.CLIENT_ORIGIN.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
});
