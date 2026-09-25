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

const secret = optional.refine((v) => !v || v.length >= 32, 'must be at least 32 characters');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_MODE: z.enum(['test', 'live']).default('test'),
  MONGO_URI: optional,
  MONGO_DB: z.string().min(1).default('swechha'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Auth
  JWT_ACCESS_SECRET: secret,
  OTP_SECRET: secret,
  ADMIN_EMAILS: z.string().default(''),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  // Email (Gmail SMTP with an App Password)
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: optional,
  // Photos
  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  CLOUDINARY_FOLDER: z.string().min(1).default('swechha/products'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Number of proxies in front of the app (Render's load balancer = 1).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

// Checked separately so every missing variable is listed at once.
const REQUIRED = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'OTP_SECRET'];
const REQUIRED_IN_PRODUCTION = ['CLIENT_ORIGIN'];
const REQUIRED_IN_LIVE_MODE = ['SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];

const parsed = schema.safeParse(process.env);
const isSet = (name) => Boolean(process.env[name]?.trim());
const required = [
  ...REQUIRED,
  ...(process.env.NODE_ENV === 'production' ? REQUIRED_IN_PRODUCTION : []),
  ...(process.env.APP_MODE === 'live' ? REQUIRED_IN_LIVE_MODE : []),
];
const problems = [
  ...required.filter((name) => !isSet(name)).map((name) => `${name}: missing`),
  ...(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`)),
];
if (problems.length) {
  // Only variable names and rule messages are printed, never values.
  console.error(
    `Invalid server environment. Fix these in server/.env (or the Render dashboard):\n${problems.map((p) => `  - ${p}`).join('\n')}`
  );
  process.exit(1);
}

const d = parsed.data;
export const env = Object.freeze({
  ...d,
  clientOrigins: d.CLIENT_ORIGIN.split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  adminEmails: d.ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  smtpConfigured: Boolean(d.SMTP_USER && d.SMTP_PASS && d.MAIL_FROM),
  isProd: d.NODE_ENV === 'production',
  isTest: d.NODE_ENV === 'test',
  isLive: d.APP_MODE === 'live',
});
