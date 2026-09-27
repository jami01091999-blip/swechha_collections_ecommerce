# Swechha Collections — guide for Claude sessions

Women's-wear brand site: a catalogue (turning into a full shop, see `docs/PLAN.md`) plus an admin at `/adminDivya`.
MERN monorepo with npm workspaces: React client on Vercel, Express API on Render, MongoDB Atlas, Cloudinary for photos.

## Stack

| Part               | Tech                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client (`client/`) | React 18, Vite 5, React Router 6 (data router), TanStack Query 5, Tailwind 3                                                                               |
| Server (`server/`) | Node 20+, Express 4, Mongoose 8, zod, helmet, pino, express-rate-limit (ESM)                                                                               |
| Data               | MongoDB Atlas, database `swechha`: products, settings, users, sessions, otp codes, wishlists, carts, orders, coupons, counters, webhook events, audit logs |
| Images             | Cloudinary: signed direct upload from the browser                                                                                                          |
| Tests              | vitest everywhere; supertest + mongodb-memory-server (server); Testing Library + jsdom DOM snapshots (client)                                              |
| Quality            | ESLint flat config (`eslint.config.js`) and Prettier (`.prettierrc.json`, width 140) at the root                                                           |

## Folder map

```
client/                    Vite app (Vercel project root)
  src/App.jsx              route table (admin routes are React.lazy); `routes` is exported for tests
  src/components/ui/       shared UI kit — use these first (see /__ui on the dev server)
  src/components/public/   customer-site pieces (headers, cards, hero, footer)
  src/components/admin/    admin pieces (chrome, gate, image manager, form sections)
  src/components/shared/   Icon, Img, size availability
  src/pages/public|admin/  screens
  src/lib/api.js           fetch wrapper (cookies, CSRF header, one shared refresh) + TanStack Query hooks + mutations
  src/lib/auth.jsx         useMe / AuthProvider / useAuth, RequireAuth, safeNext, isStaff / isAdmin
  src/lib/india.js         Indian states + phone/PIN rules (copy of the server list; a test keeps them equal)
  src/lib/validation.js    address/profile messages (same words as the server)
  src/pages/public/Login.jsx, Account.jsx   sign-in (email → code → name) and the account area
  src/lib/stock.js         ALL stock rules (in stock / low / out, "Only N left")
  src/lib/format.js        formatINR, discountPercent, Cloudinary URLs, WhatsApp links
  src/lib/constants.js     categories, sizes, ADMIN_BASE, DESK (laptop width)
  src/dev/UiKit.jsx        /__ui gallery (dev only, not in production build)
  test/                    DOM snapshot suite (routes.test.jsx), kit tests, mock API, fixtures
  vercel.json              /api → Render rewrite + SPA fallback
server/
  src/server.js            listen, DB connect with retry, graceful shutdown
  src/app.js               builds the Express app (exported for tests)
  src/config/env.js        dotenv + zod validation (fails fast, lists every missing var)
  src/db/mongoose.js       single connection (pool 10, autoIndex off in production)
  src/models/              Product, Setting (mirror existing documents: no __v, no subdoc _id), User (+ addresses), OtpCode, Session
  src/routes/ → controllers/ → services/     request flow
  src/validators/          sanitising + validation rules and user-facing messages
  src/middlewares/         requestId, auth (requireAuth / optionalAuth / requireRole), csrf, validate(zod), rateLimit, notFound, errorHandler
  src/services/            productService, settingsService, otpService, tokenService, userService, teamService
  src/integrations/        cloudinary.js
  src/scripts/             seed.js, syncIndexes.js, seed data
  test/                    API tests (in-memory MongoDB)
docs/API.md                every endpoint
docs/PLAN.md               the 8-phase plan
render.yaml                Render blueprint for the API
.github/workflows/keepalive.yml   pings /api/health every 10 min
```

## Commands (run at the repo root)

```bash
npm install            # installs both workspaces
npm run dev            # API on :4000 + client on :5173 (Vite proxies /api → :4000)
npm test               # server tests, then client tests
npm run lint           # ESLint for both workspaces
npm run format         # Prettier write (format:check to verify)
npm run build          # production build of the client (client/dist)
npm run seed           # add the 8 sample products + default settings (seed:reset wipes products first)
npm run db:indexes     # create Mongoose indexes (needed once in production, where autoIndex is off)
```

Single workspace: `npm run <script> -w client` or `-w server`. The first server test run downloads a MongoDB binary (~600 MB, cached).

## Environment variables

Server (`server/.env`, never committed; template in `server/.env.example`; set on Render in production):

| Var                                                                                         | Notes                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                  | `development` / `test` / `production`                                     |
| `PORT`                                                                                      | default 4000 (Render sets its own)                                        |
| `APP_MODE`                                                                                  | `test` until the Phase 8 go-live switch, then `live`                      |
| `MONGO_URI`, `MONGO_DB`                                                                     | Atlas connection, database `swechha`                                      |
| `CLIENT_ORIGIN`                                                                             | comma-separated browser origins allowed by CORS (required in production)  |
| `JWT_ACCESS_SECRET`, `OTP_SECRET`                                                           | two different random strings, ≥32 characters (required)                   |
| `ADMIN_EMAILS`                                                                              | comma-separated emails that become admin on every sign-in                 |
| `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS`                                                | 15 and 30 by default                                                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`                             | Gmail App Password SMTP for sign-in codes (required when `APP_MODE=live`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` | photo upload; without them upload-signature returns 503                   |
| `LOG_LEVEL`                                                                                 | pino level                                                                |
| `TRUST_PROXY`                                                                               | optional, proxies in front of the API (default 1)                         |

Client (`client/.env.example`): only `VITE_*` vars, all public. `VITE_APP_MODE=test`.
Never print secret values, never commit `.env` files, never log request bodies of admin routes.

## Design rules (the UI is a faithful port of the Google Stitch "Regal Modernity" design)

- Use only the colours, fonts, font sizes, spacing and radii defined in `client/tailwind.config.js`, plus the few
  hex values already in use (`#C59B6A` gold focus, `#EBE5DD`/`#FAF6F0` field, `#541423` maroon hover,
  `#1b4332` WhatsApp green). **No new colours, fonts, shadows or radii.**
- Build screens from `client/src/components/ui/` (Button, IconButton, Chip, ToneChip/StatusChip, Card, Field/Input/
  Textarea/Select, Segmented, Switch, Stepper, Sheet/ConfirmSheet, PriceBlock, Skeleton, EmptyState, SectionHeader,
  PageContainer, Spinner, OtpInput). Extend the kit rather than hand-writing one-off styles; add new states to `/__ui`.
- Mobile-first: the phone layout (≈390px) _is_ the Stitch design. Tablet/laptop layouts only via `md:` / `lg:` classes;
  laptop content width comes from `PageContainer` (`DESK`). Check 390px, 820px and 1280px.
- Every new screen has loading (Skeleton/Spinner), empty (EmptyState) and error (message + "Try again") states.
- New copy is plain sentence case ("Add to cart", not "Add To Cart").
- Prices are always shown with `formatINR` (and `PriceBlock` where it fits). Stock wording and thresholds come only from
  `client/src/lib/stock.js` — never re-implement "Only N left" / out-of-stock logic.
- Never trust prices, totals or stock sent by the client; the server recomputes from the database.
- Admin screens live under `/adminDivya` (`ADMIN_BASE`), are lazy-loaded, and wrap in `AdminLayout` (which runs `AdminGuard`).
- Phone bottom bar is Curation · Lookbook · Account: don't add a fourth tab without a design decision.
- Tailwind scans every word in `src/`, including comments: a comment containing e.g. "ring" or "outline" adds CSS.

## Auth conventions

- Customers, staff and admins all sign in with email + a 6-digit code (`/login`); there are no passwords and no admin key.
- Server: protect routes with `requireAuth` and `requireRole('admin', 'staff')` / `requireRole('admin')`
  (`middlewares/auth.js`); use `optionalAuth` on public routes that vary for signed-in users.
  **Take the user id from `req.user` only — never from the body, query or URL.** User JSON goes through `publicUser()`.
- Staff: catalogue (products, stock, photos). Admin: also lookbook settings and `/api/admin/team`.
- Client: every request goes through `api()` in `lib/api.js`, which sends `credentials: 'include'` and
  `X-Requested-With: swechha` (the API rejects writes without it) and handles `TOKEN_EXPIRED` by refreshing once.
  Read the user with `useAuth()`; wrap signed-in pages in `RequireAuth`; build redirects with `safeNext()`.
- Never store tokens in JavaScript/localStorage; they are httpOnly cookies. Never log tokens or codes
  (the only exception is the `APP_MODE=test` OTP log line).
- New per-user queries must use a key under `['me', …]` or `['admin', …]` so sign-in/out clears them.

## Catalogue conventions (Phase 2)

- Stock sold to customers is **available = stock − reserved** (`reserved` = checkout holds, set only by the server).
  Client: `availableOf` / `sizeRows` in `lib/stock.js`. Server: `available` in `services/productShape.js`.
- Every write that touches sizes, price or code goes through `shapeProduct()` (`services/productShape.js`) — it builds
  SKUs and the derived `totalStock / inStock / availableSizes / discountPercent`. Never set those by hand or in hooks.
- List endpoints return the **card projection** only (`CARD_FIELDS` in `catalogService.js`); never descriptions.
  Public product JSON never includes `reserved`, weight, dimensions, HSN or tax.
- New list queries need a supporting index; add an `explain()` case to `server/test/catalog.test.js`.
- Schema changes to existing data ship as an idempotent migration in `server/src/scripts/migrations/` with a dry-run
  default and a JSON backup before `--apply` (see `002-sizes-sku.js`).
- Collection filters live in the URL (`components/catalog/filters.js`); saved designs go through `useSaved()`.

## Commerce conventions (Phases 3–8)

- Stock moves only through `services/stockService.js` (reserve / release / commit / restock). It compare-and-sets the
  product's `rev`; every other write to `sizes` must also filter on `rev` and `$inc` it (see `updateStock`, `updateProduct`).
- Order status changes only through `transition()` / `cancelOrder()` in `services/orderService.js` (allowed moves in
  `TRANSITIONS`); they apply stock, payment and email side effects once.
- Prices/totals: `services/pricingService.js` (`priceLines`, `orderTotals`). Never accept money values from the client.
- Money moves (refunds, cancelling paid orders, coupons, customers, shop rules, sales, export) are admin-only; staff run
  fulfilment. Admin actions call `audit(req, action, …)`.
- Webhooks are CSRF-exempt, read a raw body (`app.js`) and must verify a signature/token before doing anything.
- Payment providers: `razorpay` or `mock` (test mode only). Delivery: `manual` or `shiprocket` (`SHIPPING_PROVIDER`).
- New collections must be added to `scripts/syncIndexes.js` (production has autoIndex off).

## API conventions

- All requests from the client are relative `/api/...` with `credentials: 'include'` (see `lib/api.js`).
- Errors are JSON `{ error, requestId }`; messages are written for the shop owner/customer.
- Public GETs: `Cache-Control: public, s-maxage=30, stale-while-revalidate=300` (settings 60s). Admin: `no-store`.
- Keep response shapes backwards compatible; document every endpoint change in `docs/API.md`.

## Tests and the zero-visual-change safety net

- `client/test/routes.test.jsx` snapshots the DOM of every route and key state against a mocked API (class lists sorted).
  If a change is meant to be invisible, snapshots must not change. If the UI change is intentional, run
  `npm run test -w client -- -u`, then review the `.snap` diff before committing.
- Server tests cover every endpoint's status codes, messages and headers; add tests with every endpoint change.
- Before committing: `npm run lint && npm test && npm run build`.
