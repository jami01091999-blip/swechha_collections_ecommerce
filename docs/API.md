# Swechha API

Base path `/api`. In production the browser calls the Vercel site, which rewrites `/api/*` to the Render service.
In development Vite proxies `/api` to `http://localhost:4000`. The browser therefore only ever talks to one origin.

## Common behaviour

| Topic        | Rule                                                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Body         | JSON, max 1 MB. Invalid JSON → `400 { error: "Request body is not valid JSON." }`                                                                                                                                                                                                          |
| Errors       | `{ "error": "<message for people>", "requestId": "<id>" }`, plus extra fields where useful: `code`, `fields` (per-field form messages), `retryAfter` (seconds), `attemptsLeft`. Unexpected errors → 500 "The server could not complete the request. Try again in a moment."                |
| Request id   | Every response has `X-Request-Id` (an incoming sane `X-Request-Id` is reused).                                                                                                                                                                                                             |
| Sign-in      | httpOnly cookies set by `/api/auth/*` (see **Sessions**). The client never sees the tokens.                                                                                                                                                                                                |
| Roles        | `customer` (default), `staff` (catalogue), `admin` (catalogue + lookbook settings + team). Guests → `401 { code: "AUTH_REQUIRED" }`; wrong role → `403 { code: "FORBIDDEN", error: "You don't have access to this." }`.                                                                    |
| CSRF         | POST/PUT/PATCH/DELETE need the header `X-Requested-With: swechha`, and a browser `Origin` (when sent) must be in `CLIENT_ORIGIN` (in development the page's own host is also accepted). Otherwise `403 { code: "CSRF" }`. Future webhooks are exempt via an explicit list (`CSRF_EXEMPT`). |
| Caching      | Public GETs: `public, s-maxage=30, stale-while-revalidate=300` (settings: `s-maxage=60`). Everything signed-in, admin and every write: `no-store`.                                                                                                                                         |
| Rate limits  | 600 requests / 15 min per IP on `/api`; 120 / 15 min on staff/admin endpoints; 100 / 15 min on `/api/auth/*` (except `/me`), plus the OTP limits below. Over the limit → `429`.                                                                                                            |
| Wrong method | `405 { error: "Method X not allowed." }` with an `Allow` header.                                                                                                                                                                                                                           |
| Unknown path | `404 { error: "Unknown API route." }`                                                                                                                                                                                                                                                      |
| CORS         | Browser origins listed in `CLIENT_ORIGIN`, with credentials.                                                                                                                                                                                                                               |

## Sessions

| Cookie  | Contents                                                                             | Lifetime                                                                                                 | Path        |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------- |
| `sw_at` | Access token: JWT (HS256, `JWT_ACCESS_SECRET`) `{ sub, role }`                       | token valid `ACCESS_TOKEN_MINUTES` (15); cookie kept for the session so an expired token can be reported | `/`         |
| `sw_rt` | Refresh token: 48 random bytes (base64url); only its SHA-256 is stored in `sessions` | `REFRESH_TOKEN_DAYS` (30)                                                                                | `/api/auth` |

Both are `HttpOnly`, `SameSite=Lax`, `Secure` in production, and host-only (no `Domain`).
An expired access token gives `401 { code: "TOKEN_EXPIRED" }`; the client then calls `POST /api/auth/refresh` once and
retries. Every refresh rotates the refresh token. Presenting the previous token within 30 s of a rotation (two tabs) is
allowed and rotates again; presenting it later revokes the whole session (`401 { code: "SESSION_REVOKED" }`).
The user is loaded on every request, so role changes and blocks apply immediately.

## OTP rules

6 digits (`crypto.randomInt`), valid 10 minutes, emailed from `MAIL_FROM`. Stored as HMAC-SHA256 (`OTP_SECRET`).
5 wrong tries kill a code. A new request invalidates earlier codes. 60 s cool-down per email; at most 5 codes per
email and 60 per IP per hour (counted from `otp_codes`, kept 65 minutes) → `429 { code: "OTP_RATE_LIMIT", retryAfter }`.
First successful verify creates the account. Emails in `ADMIN_EMAILS` become `admin` on every sign-in.
In `APP_MODE=test` the code is also written to the server log (`OTP for <email>: <code>`), and email is skipped if SMTP
is not configured.

## Endpoints

| Method      | Path                                  | Auth           | Request                                                                                                   | Response                                                                                                                                                          |
| ----------- | ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/api/health`                         | —              | —                                                                                                         | `200 { status: "ok", db: "up", uptime, mode }` · `503` with `db: "down"`                                                                                          |
| POST        | `/api/auth/otp/request`               | —              | `{ email }`                                                                                               | `200 { ok, resendIn: 60, expiresIn: 600 }` · `400 "Enter a valid email address."` · `429` · `502 "We couldn't send the code. Try again in a minute."`             |
| POST        | `/api/auth/otp/verify`                | —              | `{ email, code }`                                                                                         | `200 { user, isNew }` + cookies · `400` `OTP_WRONG` (with `attemptsLeft`) / `OTP_EXPIRED` / `OTP_LOCKED` · `403` blocked                                          |
| POST        | `/api/auth/refresh`                   | refresh cookie | —                                                                                                         | `200 { user }` + rotated cookies · `401 SESSION_EXPIRED / SESSION_REVOKED` (cookies cleared) · `403` blocked                                                      |
| POST        | `/api/auth/logout`                    | —              | —                                                                                                         | `200 { ok: true }`; revokes this session, clears cookies (idempotent)                                                                                             |
| POST        | `/api/auth/logout-all`                | user           | —                                                                                                         | `200 { ok: true }`; revokes every session of the user                                                                                                             |
| GET         | `/api/auth/me`                        | optional       | —                                                                                                         | `200 { user }` or `200 { user: null }` when signed out · `401 TOKEN_EXPIRED` when the access token needs refreshing                                               |
| PATCH       | `/api/users/me`                       | user           | `{ name?, phone? }` (email can't change)                                                                  | `200 { user }` · `400` with `fields`                                                                                                                              |
| GET         | `/api/users/me/addresses`             | user           | —                                                                                                         | `200 { addresses }` (default first)                                                                                                                               |
| POST        | `/api/users/me/addresses`             | user           | Address fields                                                                                            | `201 { address, addresses }` · `400` with `fields` · `400 "You can save up to 10 addresses."`                                                                     |
| PATCH       | `/api/users/me/addresses/:id`         | user           | Any Address fields                                                                                        | `200 { address, addresses }` · `400` · `404 "Address not found."`                                                                                                 |
| DELETE      | `/api/users/me/addresses/:id`         | user           | —                                                                                                         | `200 { addresses }` (the most recent remaining address becomes default) · `404`                                                                                   |
| POST        | `/api/users/me/addresses/:id/default` | user           | —                                                                                                         | `200 { addresses }` · `404`                                                                                                                                       |
| GET         | `/api/products`                       | —              | `category, q, sort, minPrice, maxPrice, sizes, inStock=1, filter=new\|featured, minDiscount, page, limit` | `200 { items: Card[], page, limit, total, totalPages, facets }` (see **Catalogue list**). The plain array from before Phase 2 is **removed**.                     |
| GET         | `/api/home`                           | —              | —                                                                                                         | `200 { newArrivals: Card[8], featured: Card[8], categories: [{ key, count, cover }] }` (flagged items, else the normal order) · cache 60 s                        |
| GET         | `/api/categories`                     | —              | —                                                                                                         | `200 { items: [{ key, count, cover }] }` published counts · cache 60 s                                                                                            |
| GET         | `/api/search/suggest?q=`              | —              | 2+ characters                                                                                             | `200 { products: [{ name, slug, price, image }] (≤6), categories: [{ key, count }] }` (word-prefix match on name/code/fabric) · cache 60 s                        |
| POST        | `/api/products`                       | staff          | Product fields (below)                                                                                    | `201 Product` with generated `slug` (`name` → `noor-set`, then `noor-set-2`, `-3`…) · `400` validation · `409` duplicate code                                     |
| GET         | `/api/products/:slug`                 | —              | slug (or 24-hex `_id`)                                                                                    | `200` full product, **published only**; `sizes: [{ label, sku, available }]` (never raw stock/reserved); no weight, dimensions, HSN or tax · `404`                |
| GET         | `/api/products/:slug/related`         | —              | —                                                                                                         | `200 { items: Card[] }` same category first, in stock first, never itself, ≤8 · `404`                                                                             |
| PATCH / PUT | `/api/products/:idOrSlug`             | staff          | Any subset of Product fields (partial; others unchanged)                                                  | `200 Product` · `400` · `404` · `409`. Photos removed from `images` are deleted from Cloudinary.                                                                  |
| DELETE      | `/api/products/:idOrSlug`             | staff          | —                                                                                                         | `200 { deleted: true }` · `404`. Also deletes the product's Cloudinary photos.                                                                                    |
| GET         | `/api/admin/products`                 | staff          | `q, category, status=published\|draft, stock=in\|low\|out\|attention, sort, page, limit (≤100)`           | `200 { items, page, limit, total, totalPages }` rows with sizes and admin fields (no long texts)                                                                  |
| GET         | `/api/admin/products/:id`             | staff          | —                                                                                                         | `200` full product incl. drafts, weight, dimensions, HSN, tax, stock and reserved                                                                                 |
| PATCH       | `/api/admin/products/:id/stock`       | staff          | `{ sizes: [{ label, stock }] }`                                                                           | `200` updated row; `400 BELOW_RESERVED` "M: stock can't be below the 2 reserved for orders." · `400 "Unknown size: XXL."` · `409` if changed concurrently 4 times |
| GET         | `/api/admin/stats`                    | staff          | —                                                                                                         | `200 { total, published, drafts, outOfStock, lowStock, categories, attentionCount, attention: Row[≤10], recent: Row[3] }`                                         |
| GET         | `/api/wishlist`                       | user           | —                                                                                                         | `200 { items: Card[] (newest first, + addedAt; unavailable: true for deleted/unpublished), count }`                                                               |
| POST        | `/api/wishlist/items`                 | user           | `{ productId }`                                                                                           | `200` list (idempotent) · `400 "Invalid product."` · `404` unpublished/unknown · `400 "You can save up to 200 designs."`                                          |
| DELETE      | `/api/wishlist/items/:productId`      | user           | —                                                                                                         | `200` list (idempotent)                                                                                                                                           |
| POST        | `/api/wishlist/merge`                 | user           | `{ slugs: string[] }`                                                                                     | `200` list; guest saves added once, unknown slugs skipped, capped at 200 (oldest dropped)                                                                         |
| GET         | `/api/settings`                       | —              | —                                                                                                         | `200 Settings` (design defaults merged with the saved `site` document)                                                                                            |
| PUT         | `/api/settings`                       | admin          | Settings fields                                                                                           | `200 Settings` as saved (sanitised) · `400`                                                                                                                       |
| POST        | `/api/upload-signature`               | staff          | —                                                                                                         | `200 { cloudName, apiKey, folder, timestamp, signature }` · `503` when Cloudinary keys are missing                                                                |
| GET         | `/api/admin/team`                     | admin          | —                                                                                                         | `200 { team: Member[] }` (staff and admins)                                                                                                                       |
| POST        | `/api/admin/team`                     | admin          | `{ email, role: "staff" \| "admin" }`                                                                     | `201 { member }`; creates the account if needed · `400 "Choose a role: staff or admin."`                                                                          |
| PATCH       | `/api/admin/team/:userId`             | admin          | `{ role }`                                                                                                | `200 { member }` · `400 "You can't change your own role."` / `"Keep at least one admin."` · `404`                                                                 |
| DELETE      | `/api/admin/team/:userId`             | admin          | —                                                                                                         | `200 { removed: true }` (they become a customer) · `400 "You can't remove yourself."` / `"Keep at least one admin."` · `404`                                      |

"staff" = staff or admin. Note: someone listed in `ADMIN_EMAILS` becomes admin again at their next sign-in.

## Catalogue list

`GET /api/products` parameters are validated with zod; unknown parameters are ignored and bad values fall back to
defaults (`page` and `limit` are clamped: `limit` 1–48, default 24).

- **Filters:** `category`, `minPrice`/`maxPrice` (₹), `sizes` (comma list, matches available sizes; free size = `FREE`),
  `inStock=1`, `filter=new|featured`, `minDiscount` (%).
- **Sort:** `recommended` (default: display order, then newest), `newest`, `price_asc`, `price_desc`, `discount`.
  With `q` and no sort, results are ordered by relevance.
- **Search** `q`: the weighted text index (name 10, code 8, fabric 5, colour names 3, category 3, description 1); if that
  finds nothing, an escaped case-insensitive match on name/fabric/colours/code/category (so partial words work).
- **Facets:** `{ sizes: [{ label, count }], categories: [{ key, count }], prices: [{ key, label, min?, max?, count }] }`;
  each group is counted with every filter **except its own** (price buckets: under 5,000 · 5,000–10,000 · 10,000–20,000 · 20,000+).
- **Card** (every list): `_id, slug, name, fabric, price, mrp, discountPercent, badge, isNewArrival, isFeatured,
inStock, availableSizes, category, images` (cover only). Never descriptions or full image lists.

## User

`{ _id, email, name, phone, role, createdAt }`: never any session or internal fields. Team members add `lastLoginAt`.
`phone` is an Indian mobile: 10 digits starting 6–9 (`+91` / `0` prefixes are removed).

## Address

| Field               | Rules (message)                                                     |
| ------------------- | ------------------------------------------------------------------- |
| `fullName`          | required, ≤60 ("Enter the full name.")                              |
| `phone`             | Indian mobile ("Enter a 10-digit mobile number.")                   |
| `line1`             | required, ≤120 ("Enter the house number and street.")               |
| `line2`, `landmark` | optional                                                            |
| `city`              | required ("Enter the city.")                                        |
| `state`             | one of `INDIAN_STATES`, incl. union territories ("Choose a state.") |
| `pincode`           | 6 digits, first 1–9 ("Enter a 6-digit PIN code.")                   |
| `type`              | `home` \| `work` \| `other`                                         |
| `isDefault`         | exactly one default when any address exists                         |

## Product

Stored in `products`. Unknown fields are dropped; values are trimmed and clamped.

| Field                                                        | Type                                                       | Rules                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_id`                                                        | ObjectId                                                   |                                                                                                                                                                                                                             |
| `name`                                                       | string ≤120                                                | required                                                                                                                                                                                                                    |
| `slug`                                                       | string                                                     | generated from `name` on create, unique                                                                                                                                                                                     |
| `code`                                                       | string ≤40                                                 | required, upper-cased, unique → 409 "Another product already uses this product code."                                                                                                                                       |
| `category`                                                   | string ≤120                                                | required                                                                                                                                                                                                                    |
| `fabric`                                                     | string ≤120                                                | required ("Fabric line")                                                                                                                                                                                                    |
| `badge`                                                      | string ≤40                                                 |                                                                                                                                                                                                                             |
| `price`                                                      | integer ₹                                                  | required, > 0                                                                                                                                                                                                               |
| `mrp`                                                        | integer ₹                                                  | 0 = no discount; if set must be ≥ price                                                                                                                                                                                     |
| `images`                                                     | `{ url, publicId }[]` ≤12                                  | https only; at least one to publish                                                                                                                                                                                         |
| `colors`                                                     | `{ name, hex, productSlug }[]` ≤12                         | hex `#rrggbb` (default `#6b1d2f`); `productSlug` links to another product                                                                                                                                                   |
| `sizeType`                                                   | `"sized"` \| `"free"`                                      | sized needs ≥1 size                                                                                                                                                                                                         |
| `sizes`                                                      | `{ label, sku, stock, reserved }[]` ≤20                    | free size = exactly one `FREE` row. `sku` = `CODE-LABEL` unless edited; unique across products (409 `SKU_TAKEN`). `reserved` is set by checkout only. **Available = stock − reserved.** Changing `code` never rewrites SKUs |
| `lowStockThreshold`                                          | integer 1–100                                              | default 2 ("Only N left" at or below)                                                                                                                                                                                       |
| `sareeDetails`                                               | `{ sareeLength, blousePiece, blouseLength, blouseFabric }` | `blousePiece` ∈ Included (Unstitched) / Included (Stitched) / Not included                                                                                                                                                  |
| `description`                                                | string ≤2000                                               |                                                                                                                                                                                                                             |
| `fabricDetails`, `care`                                      | string[] ≤12 (or newline-separated string)                 |                                                                                                                                                                                                                             |
| `occasion`                                                   | string ≤1000                                               |                                                                                                                                                                                                                             |
| `status`                                                     | `"published"` \| `"draft"`                                 | default draft; drafts are hidden from customers                                                                                                                                                                             |
| `isNewArrival`, `isFeatured`                                 | boolean                                                    |                                                                                                                                                                                                                             |
| `displayOrder`                                               | integer 0–9999                                             | lower shows first                                                                                                                                                                                                           |
| `weightGrams`                                                | integer                                                    | category default (e.g. Night dresses 350, Sarees 700; others 500)                                                                                                                                                           |
| `dimensionsCm`                                               | `{ l, b, h }`                                              | default 30 × 25 × 5                                                                                                                                                                                                         |
| `hsnCode`                                                    | string                                                     | optional, 4–8 digits ("HSN code has 4 to 8 digits.")                                                                                                                                                                        |
| `taxRatePercent`                                             | number 0–28                                                | default from settings `defaultTaxRatePercent` (5)                                                                                                                                                                           |
| `isCodAllowed`, `isReturnable`                               | boolean                                                    | default true                                                                                                                                                                                                                |
| `maxQtyPerOrder`                                             | integer 1–20                                               | default 5                                                                                                                                                                                                                   |
| `totalStock`, `inStock`, `availableSizes`, `discountPercent` | derived                                                    | always written by `services/productShape.js`                                                                                                                                                                                |
| `createdAt`, `updatedAt`                                     | Date                                                       |                                                                                                                                                                                                                             |

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

## Commerce (Phases 3–8)

All customer routes below need a signed-in user (cookies) except `POST /api/cart/preview`, `GET /api/shipping/serviceability`
and `GET /api/sitemap.xml`. Every response is `no-store` unless noted. Prices, totals, discounts and stock always
come from the database; anything like `price` or `total` in a request body is ignored.

### Bag

| Method | Path                                    | Body                                      | Notes                                                                                                   |
| ------ | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/api/cart`                             | –                                         | `{ items, summary }`                                                                                    |
| POST   | `/api/cart/items`                       | `{ productId, size, qty=1 }`              | adds or increases; 409 `Only N left in M.`, 400 `Choose a size.` (`SIZE_REQUIRED`), 400 per-order limit |
| PATCH  | `/api/cart/items/:itemId`               | `{ qty?, size? }`                         | changing to a size already in the bag merges the lines                                                  |
| DELETE | `/api/cart/items/:itemId` · `/api/cart` | –                                         | remove one · empty the bag                                                                              |
| POST   | `/api/cart/merge`                       | `{ items: [{ productId, size, qty }] }`   | device bag → account at sign-in; trims to stock, skips what can't be bought; returns `merged`           |
| POST   | `/api/cart/preview`                     | same as merge (+ optional `key` per line) | guests: prices the device bag (line `_id` = `key`)                                                      |

Bag line: `{ _id, productId, slug, name, fabric, image, size, sizeLabel ("Free Size" for FREE), sku, qty, buyQty, price, mrp,
lineTotal, available, maxQty, status, message, sizes: [{label, sizeLabel, available}] }` where `status` is `ok`,
`qty_reduced` (fewer left than asked; `buyQty` is what can be bought), `out_of_stock` or `unavailable`.
`summary`: `{ itemCount, lineCount, subtotal, mrpTotal, savings }`. Limits: 20 lines, 10 per line, product `maxQtyPerOrder`.

### Checkout and orders

| Method | Path                               | Body                                                                                       | Notes                                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| POST   | `/api/checkout/quote`              | `{ source: cart\|buy_now, item?, addressId?, paymentMethod?: cod\|online, couponCode? }`   | live totals + `problems[]` + `canPlace`                                                    |
| POST   | `/api/orders`                      | quote body + `addressId`, `paymentMethod`, `idempotencyKey` (8–80 chars, new per checkout) | 201 `{ order, payment? }`; same key → same order; 409 `CHECKOUT_PROBLEMS` / `OUT_OF_STOCK` |
| GET    | `/api/orders?page&limit`           | –                                                                                          | my orders, newest first                                                                    |
| GET    | `/api/orders/:orderNumber`         | –                                                                                          | full order (404 for other people's)                                                        |
| POST   | `/api/orders/:orderNumber/cancel`  | `{ reason? }`                                                                              | before shipping; releases stock; paid online orders are refunded                           |
| POST   | `/api/orders/:orderNumber/returns` | `{ type: refund\|exchange, reason, note?, items: [{ itemId, qty }] }`                      | delivered + within the return window + returnable items                                    |
| GET    | `/api/orders/:orderNumber/invoice` | –                                                                                          | printable GST invoice (HTML) once confirmed                                                |

Quote: `{ lines, pricing: { subtotal, mrpTotal, discount, couponCode, shipping, codFee, total, taxTotal, savings, interState,
amountToFreeShipping }, coupon: { code, valid, discount, message } | null, address, delivery: { serviceable, cod, etaDays:{min,max},
etaDate } | null, payment: { method, cod: { available, reason?, fee }, online: { available, provider, testMode } }, problems: [{ type, message, lineId? }], canPlace }`.

Order: `orderNumber` (`SW-YYYY-NNNNNN`), `invoiceNumber` (`SWI-…`, after confirmation), `status`
(`pending_payment → confirmed → packed → shipped → out_for_delivery → delivered`, or `cancelled` / `rto`), `statusHistory`,
`items` (snapshot incl. `taxableValue`, `taxAmount`), `address`, `pricing`, `payment: { method, provider, status, paidAt,
refundedTotal, refunds }`, `shipment: { courier, awb, trackingUrl, events }`, `returnRequest`, and flags `canCancel`,
`canPay`, `canReturn`, `returnDeadline`, `invoiceAvailable`. Payment status: `pending, paid, failed, refund_pending, refunded,
partially_refunded, cod_pending, cod_collected`.

Stock: placing an order **holds** it (`reserved`), cancelling or not paying in time **releases** it, shipping **deducts** it,
a received return or courier RTO **adds it back** (`services/stockService.js`).

### Payments

| Method | Path                                | Notes                                                                                                    |
| ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| POST   | `/api/payments/razorpay/verify`     | `{ orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature }` → confirmed order          |
| POST   | `/api/payments/:orderNumber/retry`  | new `payment` payload while the order is still inside its time limit (409 `PAYMENT_EXPIRED` after)       |
| POST   | `/api/payments/:orderNumber/failed` | `{ reason? }` records a failed attempt (order stays payable)                                             |
| POST   | `/api/payments/:orderNumber/mock`   | `{ outcome: success\|failure }` — built-in test screen, only when `APP_MODE=test` and no Razorpay key id |
| POST   | `/api/webhooks/razorpay`            | server-to-server; raw body, `X-Razorpay-Signature`; each event once                                      |

`payment` payload (Razorpay): `{ provider:'razorpay', keyId, providerOrderId, amount (paise), currency, name, description, prefill,
orderNumber, expiresAt, testMode }` → open Razorpay Checkout with it. Mock: `{ provider:'mock', orderNumber, amount, expiresAt, testMode:true }`.
Unpaid online orders are cancelled after `reservationMinutes` (default 15); a payment that lands later restores the order,
or is refunded automatically if the items sold out.

### Delivery

| Method | Path                                    | Notes                                                                     |
| ------ | --------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/shipping/serviceability?pincode=` | `{ serviceable, cod, etaDays, etaDate, message? }` (cached 1 h)           |
| POST   | `/api/webhooks/courier`                 | Shiprocket tracking updates, header `x-api-key: SHIPROCKET_WEBHOOK_TOKEN` |

### Admin (staff: fulfilment · admin: money, customers, settings)

| Method   | Path                                              | Role                    | Notes                                                                                                 |
| -------- | ------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| GET      | `/api/admin/orders?tab&q&from&to&payment&page`    | staff                   | tabs `new, packed, shipped, delivered, returns, unpaid, cancelled, all`; `counts` per tab             |
| GET      | `/api/admin/orders/:id`                           | staff                   | id or order number; `customer`, `allowedNext`                                                         |
| POST     | `/api/admin/orders/:id/status`                    | staff                   | `{ action: pack\|unpack\|out_for_delivery\|delivered\|rto, note? }`                                   |
| POST     | `/api/admin/orders/:id/ship`                      | staff                   | `{ courier?, awb?, trackingUrl? }` (manual; test mode fills blanks)                                   |
| POST     | `/api/admin/orders/:id/cancel`                    | admin                   | `{ reason? }`                                                                                         |
| POST     | `/api/admin/orders/:id/refund`                    | admin                   | `{ amount, reason, note? }` (COD refunds need `note` = UPI/bank reference)                            |
| POST     | `/api/admin/orders/:id/return`                    | staff (refund: admin)   | `{ action: approve\|reject\|picked_up\|received\|refund\|exchange\|close, note?, restock?, amount? }` |
| GET      | `/api/admin/orders/:id/packing-slip` · `/invoice` | staff                   | printable HTML                                                                                        |
| GET      | `/api/admin/orders/export.csv?from&to`            | admin                   | CSV (spreadsheet-formula safe)                                                                        |
| GET      | `/api/admin/customers?q&page` · `/:id`            | admin                   | with orders and spend                                                                                 |
| PATCH    | `/api/admin/customers/:id`                        | admin                   | `{ isBlocked }`                                                                                       |
| GET      | `/api/admin/sales?range=today\|7d\|30d\|90d`      | admin                   | revenue (net of refunds), orders, daily series, top products, work queue                              |
| GET/POST | `/api/admin/coupons` · PATCH/DELETE `/:id`        | admin                   | percent/flat, min order, cap, dates, limits                                                           |
| GET/PUT  | `/api/admin/shop-settings`                        | staff read, admin write | delivery fee, free-delivery threshold, COD rules, return days, payment time limit, GSTIN/business     |
| GET      | `/api/admin/audit?page&entity&entityId`           | admin                   | who did what                                                                                          |

### Other

`POST /api/internal/jobs` (header `x-cron-secret`) runs housekeeping; `GET /api/sitemap.xml`; `GET /api/settings` now also returns `shop`.
