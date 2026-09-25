# Swechha API

Base path `/api`. In production the browser calls the Vercel site, which rewrites `/api/*` to the Render service.
In development Vite proxies `/api` to `http://localhost:4000`.

## Common behaviour

| Topic        | Rule                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body         | JSON, max 1 MB. Invalid JSON → `400 { error: "Request body is not valid JSON." }`                                                                                                           |
| Errors       | `{ "error": "<message for people>", "requestId": "<id>" }`. Unexpected errors → 500 "The server could not complete the request. Try again in a moment."                                     |
| Request id   | Every response has `X-Request-Id` (an incoming sane `X-Request-Id` is reused).                                                                                                              |
| Admin auth   | Header `x-admin-key: <ADMIN_KEY>`. Missing/wrong → `401 { error: "Admin key is missing or incorrect." }`. (Phase 1 replaces this with login roles.)                                         |
| Caching      | Public GETs: `public, s-maxage=30, stale-while-revalidate=300` (settings: `s-maxage=60`). Admin and writes: `no-store`.                                                                     |
| Rate limits  | 600 requests / 15 min per IP on `/api`; 120 / 15 min per IP on admin writes and key checks. Over the limit → `429 { error: "Too many requests. Please wait a few minutes and try again." }` |
| Wrong method | `405 { error: "Method X not allowed." }` with an `Allow` header.                                                                                                                            |
| Unknown path | `404 { error: "Unknown API route." }`                                                                                                                                                       |
| CORS         | Browser origins listed in `CLIENT_ORIGIN`, with credentials.                                                                                                                                |

## Endpoints

| Method      | Path                      | Auth      | Request                                                  | Response                                                                                                                      |
| ----------- | ------------------------- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/api/health`             | —         | —                                                        | `200 { status: "ok", db: "up", uptime, mode }` · `503` with `db: "down"`                                                      |
| GET         | `/api/products`           | —         | —                                                        | `200 Product[]` published only, sorted `displayOrder` ↑ then newest, max 500 (plain array; pagination arrives in Phase 2)     |
| GET         | `/api/products?all=1`     | admin     | —                                                        | `200 Product[]` including drafts                                                                                              |
| POST        | `/api/products`           | admin     | Product fields (below)                                   | `201 Product` with generated `slug` (`name` → `noor-set`, then `noor-set-2`, `-3`…) · `400` validation · `409` duplicate code |
| GET         | `/api/products/:idOrSlug` | — / admin | 24-hex `_id` or slug                                     | `200 Product` · `404 "Product not found."` (drafts are 404 unless a valid admin key is sent)                                  |
| PATCH / PUT | `/api/products/:idOrSlug` | admin     | Any subset of Product fields (partial; others unchanged) | `200 Product` · `400` · `404` · `409`. Photos removed from `images` are deleted from Cloudinary.                              |
| DELETE      | `/api/products/:idOrSlug` | admin     | —                                                        | `200 { deleted: true }` · `404`. Also deletes the product's Cloudinary photos.                                                |
| GET         | `/api/settings`           | —         | —                                                        | `200 Settings` (design defaults merged with the saved `site` document)                                                        |
| PUT         | `/api/settings`           | admin     | Settings fields                                          | `200 Settings` as saved (sanitised) · `400`                                                                                   |
| POST        | `/api/upload-signature`   | admin     | —                                                        | `200 { cloudName, apiKey, folder, timestamp, signature }` · `503` when Cloudinary keys are missing                            |
| GET         | `/api/admin/verify`       | —         | —                                                        | `200 { required: boolean }` (is an admin key configured?)                                                                     |
| POST        | `/api/admin/verify`       | admin key | —                                                        | `200 { ok: true }` · `401 { ok: false }`                                                                                      |

## Product

Stored in `products`. Unknown fields are dropped; values are trimmed and clamped.

| Field                        | Type                                                       | Rules                                                                                 |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `_id`                        | ObjectId                                                   |                                                                                       |
| `name`                       | string ≤120                                                | required                                                                              |
| `slug`                       | string                                                     | generated from `name` on create, unique                                               |
| `code`                       | string ≤40                                                 | required, upper-cased, unique → 409 "Another product already uses this product code." |
| `category`                   | string ≤120                                                | required                                                                              |
| `fabric`                     | string ≤120                                                | required ("Fabric line")                                                              |
| `badge`                      | string ≤40                                                 |                                                                                       |
| `price`                      | integer ₹                                                  | required, > 0                                                                         |
| `mrp`                        | integer ₹                                                  | 0 = no discount; if set must be ≥ price                                               |
| `images`                     | `{ url, publicId }[]` ≤12                                  | https only; at least one to publish                                                   |
| `colors`                     | `{ name, hex, productSlug }[]` ≤12                         | hex `#rrggbb` (default `#6b1d2f`); `productSlug` links to another product             |
| `sizeType`                   | `"sized"` \| `"free"`                                      | sized needs ≥1 size                                                                   |
| `sizes`                      | `{ label, stock }[]` ≤20                                   | labels upper-cased, unique                                                            |
| `freeSizeStock`              | integer                                                    | used when `sizeType` is `free`                                                        |
| `lowStockThreshold`          | integer 1–100                                              | default 2 ("Only N left" at or below)                                                 |
| `sareeDetails`               | `{ sareeLength, blousePiece, blouseLength, blouseFabric }` | `blousePiece` ∈ Included (Unstitched) / Included (Stitched) / Not included            |
| `description`                | string ≤2000                                               |                                                                                       |
| `fabricDetails`, `care`      | string[] ≤12 (or newline-separated string)                 |                                                                                       |
| `occasion`                   | string ≤1000                                               |                                                                                       |
| `status`                     | `"published"` \| `"draft"`                                 | default draft; drafts are hidden from customers                                       |
| `isNewArrival`, `isFeatured` | boolean                                                    |                                                                                       |
| `displayOrder`               | integer 0–9999                                             | lower shows first                                                                     |
| `createdAt`, `updatedAt`     | Date                                                       |                                                                                       |

Validation errors are joined into one message, e.g.
`"Product name is required. Product code is required. Category is required. Fabric line is required. Selling price must be more than 0."`
Others: "MRP cannot be lower than the selling price.", "Add at least one size, or switch to Free Size.", "Add at least one photo before publishing."

## Settings

Stored in `settings` as a single document with `_id: "site"`.

| Field            | Rules                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collectionName` | ≤80                                                                                                                                                                                                                   |
| `banners`        | 1–6 of `{ tag ≤40, title ≤80, subtitle ≤200, image (https) , ctaLabel ≤40, ctaLink ≤300 }`; banners without a title or https image are dropped; none left → 400 "Keep at least one banner with a title and an image." |
| `whatsapp`       | digits only; if set, ≥10 digits with country code, else 400 "WhatsApp number needs the country code, e.g. 919876543210."                                                                                              |
| `email`          | ≤120                                                                                                                                                                                                                  |
| `locations`      | ≤200                                                                                                                                                                                                                  |
| `instagram`      | full URL kept; `@handle` or `handle` → `https://instagram.com/handle`                                                                                                                                                 |
| `updatedAt`      | set on save                                                                                                                                                                                                           |
