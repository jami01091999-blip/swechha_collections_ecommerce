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

| Method      | Path                                  | Auth           | Request                                                  | Response                                                                                                                                              |
| ----------- | ------------------------------------- | -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET         | `/api/health`                         | —              | —                                                        | `200 { status: "ok", db: "up", uptime, mode }` · `503` with `db: "down"`                                                                              |
| POST        | `/api/auth/otp/request`               | —              | `{ email }`                                              | `200 { ok, resendIn: 60, expiresIn: 600 }` · `400 "Enter a valid email address."` · `429` · `502 "We couldn't send the code. Try again in a minute."` |
| POST        | `/api/auth/otp/verify`                | —              | `{ email, code }`                                        | `200 { user, isNew }` + cookies · `400` `OTP_WRONG` (with `attemptsLeft`) / `OTP_EXPIRED` / `OTP_LOCKED` · `403` blocked                              |
| POST        | `/api/auth/refresh`                   | refresh cookie | —                                                        | `200 { user }` + rotated cookies · `401 SESSION_EXPIRED / SESSION_REVOKED` (cookies cleared) · `403` blocked                                          |
| POST        | `/api/auth/logout`                    | —              | —                                                        | `200 { ok: true }`; revokes this session, clears cookies (idempotent)                                                                                 |
| POST        | `/api/auth/logout-all`                | user           | —                                                        | `200 { ok: true }`; revokes every session of the user                                                                                                 |
| GET         | `/api/auth/me`                        | optional       | —                                                        | `200 { user }` or `200 { user: null }` when signed out · `401 TOKEN_EXPIRED` when the access token needs refreshing                                   |
| PATCH       | `/api/users/me`                       | user           | `{ name?, phone? }` (email can't change)                 | `200 { user }` · `400` with `fields`                                                                                                                  |
| GET         | `/api/users/me/addresses`             | user           | —                                                        | `200 { addresses }` (default first)                                                                                                                   |
| POST        | `/api/users/me/addresses`             | user           | Address fields                                           | `201 { address, addresses }` · `400` with `fields` · `400 "You can save up to 10 addresses."`                                                         |
| PATCH       | `/api/users/me/addresses/:id`         | user           | Any Address fields                                       | `200 { address, addresses }` · `400` · `404 "Address not found."`                                                                                     |
| DELETE      | `/api/users/me/addresses/:id`         | user           | —                                                        | `200 { addresses }` (the most recent remaining address becomes default) · `404`                                                                       |
| POST        | `/api/users/me/addresses/:id/default` | user           | —                                                        | `200 { addresses }` · `404`                                                                                                                           |
| GET         | `/api/products`                       | —              | —                                                        | `200 Product[]` published only, sorted `displayOrder` ↑ then newest, max 500 (plain array; pagination arrives in Phase 2)                             |
| GET         | `/api/products?all=1`                 | staff          | —                                                        | `200 Product[]` including drafts                                                                                                                      |
| POST        | `/api/products`                       | staff          | Product fields (below)                                   | `201 Product` with generated `slug` (`name` → `noor-set`, then `noor-set-2`, `-3`…) · `400` validation · `409` duplicate code                         |
| GET         | `/api/products/:idOrSlug`             | — / staff      | 24-hex `_id` or slug                                     | `200 Product` · `404 "Product not found."` (drafts are 404 unless signed in as staff/admin)                                                           |
| PATCH / PUT | `/api/products/:idOrSlug`             | staff          | Any subset of Product fields (partial; others unchanged) | `200 Product` · `400` · `404` · `409`. Photos removed from `images` are deleted from Cloudinary.                                                      |
| DELETE      | `/api/products/:idOrSlug`             | staff          | —                                                        | `200 { deleted: true }` · `404`. Also deletes the product's Cloudinary photos.                                                                        |
| GET         | `/api/settings`                       | —              | —                                                        | `200 Settings` (design defaults merged with the saved `site` document)                                                                                |
| PUT         | `/api/settings`                       | admin          | Settings fields                                          | `200 Settings` as saved (sanitised) · `400`                                                                                                           |
| POST        | `/api/upload-signature`               | staff          | —                                                        | `200 { cloudName, apiKey, folder, timestamp, signature }` · `503` when Cloudinary keys are missing                                                    |
| GET         | `/api/admin/team`                     | admin          | —                                                        | `200 { team: Member[] }` (staff and admins)                                                                                                           |
| POST        | `/api/admin/team`                     | admin          | `{ email, role: "staff" \| "admin" }`                    | `201 { member }`; creates the account if needed · `400 "Choose a role: staff or admin."`                                                              |
| PATCH       | `/api/admin/team/:userId`             | admin          | `{ role }`                                               | `200 { member }` · `400 "You can't change your own role."` / `"Keep at least one admin."` · `404`                                                     |
| DELETE      | `/api/admin/team/:userId`             | admin          | —                                                        | `200 { removed: true }` (they become a customer) · `400 "You can't remove yourself."` / `"Keep at least one admin."` · `404`                          |

"staff" = staff or admin. Note: someone listed in `ADMIN_EMAILS` becomes admin again at their next sign-in.

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
