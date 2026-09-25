import { z } from 'zod';

// Query parsing for the public catalogue. Unknown params are ignored; bad values fall back to defaults
// (a shared link with a typo still shows products instead of an error).
export const SORTS = ['recommended', 'newest', 'price_asc', 'price_desc', 'discount'];
export const PAGE_LIMIT = { default: 24, max: 48 };

const optInt = (min, max) => z.coerce.number().int().min(min).max(max).optional().catch(undefined);

const text = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined)
    .catch(undefined);

export const productListQuery = z.object({
  category: text(60),
  q: text(80),
  sort: z.enum(SORTS).optional().catch(undefined),
  minPrice: optInt(0, 10_000_000),
  maxPrice: optInt(0, 10_000_000),
  sizes: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? [
            ...new Set(
              v
                .split(',')
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
            ),
          ].slice(0, 20)
        : undefined
    )
    .catch(undefined),
  inStock: z
    .string()
    .optional()
    .transform((v) => v === '1' || v === 'true')
    .catch(false),
  filter: z.enum(['new', 'featured']).optional().catch(undefined),
  minDiscount: optInt(1, 95),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT.max).catch(PAGE_LIMIT.default).default(PAGE_LIMIT.default),
});

export const suggestQuery = z.object({ q: text(60) });
export const slugParams = z.object({ slug: z.string().min(1).max(200) });

export const ADMIN_SORTS = ['recommended', 'newest', 'name', 'price_asc', 'price_desc', 'stock_asc'];
export const adminListQuery = z.object({
  q: text(80),
  category: text(60),
  status: z.enum(['published', 'draft']).optional().catch(undefined),
  stock: z.enum(['in', 'low', 'out', 'attention']).optional().catch(undefined),
  sort: z.enum(ADMIN_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).catch(24).default(24),
});

export const stockBody = z.object({
  sizes: z
    .array(
      z.object({
        label: z
          .string()
          .trim()
          .min(1)
          .max(12)
          .transform((v) => v.toUpperCase()),
        stock: z.coerce.number().int().min(0, 'Stock cannot be negative.').max(100000),
      })
    )
    .min(1, 'Send at least one size.')
    .max(20),
});

/** Escapes user text for use inside a RegExp (so "q=.*(" is just text). */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
