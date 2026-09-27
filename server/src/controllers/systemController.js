import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { handleRazorpayWebhook } from '../services/paymentService.js';
import { courierUpdate } from '../services/adminOrderService.js';
import { runJobs } from '../services/jobService.js';
import { Product } from '../models/Product.js';
import { CATEGORIES } from '../validators/product.js';
import { logger } from '../utils/logger.js';

const same = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

/** POST /api/webhooks/razorpay — raw body (signature is over the exact bytes). */
export async function razorpayWebhook(req, res) {
  try {
    const out = await handleRazorpayWebhook(req.body, req.get('x-razorpay-signature'), req.get('x-razorpay-event-id'));
    res.status(200).json({ ok: true, ...out });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    // 5xx makes Razorpay retry later, which is what we want for temporary failures.
    logger.error({ reason: e.message }, 'Razorpay webhook failed');
    res.status(500).json({ error: 'Temporary failure' });
  }
}

/**
 * POST /api/webhooks/courier — Shiprocket tracking updates. Shiprocket sends the token you set in its panel as
 * `x-api-key`. (Its webhook URLs must not contain words like "shiprocket", hence "courier".)
 */
export async function courierWebhook(req, res) {
  if (!env.SHIPROCKET_WEBHOOK_TOKEN || !same(req.get('x-api-key'), env.SHIPROCKET_WEBHOOK_TOKEN))
    return res.status(401).json({ error: 'Unauthorized' });
  let body = {};
  try {
    body = JSON.parse(req.body.toString('utf8') || '{}');
  } catch {
    return res.status(200).json({ ignored: 'bad json' });
  }
  try {
    res.status(200).json(await courierUpdate(body));
  } catch (e) {
    logger.error({ reason: e.message }, 'Courier webhook failed');
    res.status(500).json({ error: 'Temporary failure' });
  }
}

/** POST /api/internal/jobs — for an external scheduler (GitHub Actions keep-alive) with `x-cron-secret`. */
export async function jobs(req, res) {
  if (!env.CRON_SECRET || !same(req.get('x-cron-secret'), env.CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });
  res.status(200).json(await runJobs());
}

const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** GET /api/sitemap.xml (the site serves it at /sitemap.xml through the Vercel rewrite). */
export async function sitemap(req, res) {
  const base = env.siteUrl;
  const products = await Product.find({ status: 'published' }, { slug: 1, updatedAt: 1 }).lean();
  const urls = [
    { loc: `${base}/`, changefreq: 'daily' },
    { loc: `${base}/collection`, changefreq: 'daily' },
    ...CATEGORIES.map((c) => ({ loc: `${base}/collection?category=${encodeURIComponent(c)}`, changefreq: 'weekly' })),
    ...['privacy', 'terms', 'returns', 'shipping', 'contact'].map((p) => ({ loc: `${base}/policies/${p}`, changefreq: 'monthly' })),
    ...products.map((p) => ({ loc: `${base}/product/${p.slug}`, lastmod: p.updatedAt?.toISOString().slice(0, 10), changefreq: 'weekly' })),
  ];
  const body = urls
    .map(
      (u) =>
        `<url><loc>${xmlEsc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq></url>`
    )
    .join('');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res
    .type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}
