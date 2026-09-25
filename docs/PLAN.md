# Swechha Collections — plan to a full e-commerce site

Each phase ships on its own, keeps the Stitch design (see design rules in `CLAUDE.md`), and ends with passing
`npm run lint && npm test && npm run build`. Payments and couriers stay in test mode until Phase 8.

| #   | Phase                   | Goal                                                                                  |
| --- | ----------------------- | ------------------------------------------------------------------------------------- |
| 0   | Foundation              | Monorepo, Express API, shared UI kit, tests, deploy setup. No new features. **Done.** |
| 1   | Email-OTP login & roles | Customers and staff sign in with a 6-digit email code; roles replace the admin key.   |
| 2   | Catalogue upgrade       | SKU per size, server pagination and search, wishlist synced to the account.           |
| 3   | Cart & Buy Now          | Cart (guest and signed-in, merged on login) and a one-tap Buy Now path.               |
| 4   | Checkout + COD + Orders | Address book, checkout, cash on delivery, order records and customer order pages.     |
| 5   | Razorpay (test mode)    | Online payments with signature verification and webhooks.                             |
| 6   | Delivery                | Mock courier first; Shiprocket adapter behind `SHIPPING_PROVIDER`; tracking.          |
| 7   | Admin commerce          | Orders dashboard, fulfilment, refunds/cancellations, stock movements, reports.        |
| 8   | Go-live switch          | `APP_MODE=live`: live payment and courier keys, final checks, launch.                 |

## 0 — Foundation (done)

- npm workspaces: `client/` (Vite React on Vercel) and `server/` (Express + Mongoose on Render).
- Every old serverless endpoint ported with identical paths, status codes, JSON and messages; `/api/health`.
- helmet, compression, CORS allowlist, rate limits, request ids, pino logs, zod-validated env, graceful shutdown.
- TanStack Query in the client with the same hooks; admin routes lazy-loaded.
- UI kit in `client/src/components/ui/` (incl. `OtpInput` for Phase 1) and a dev-only `/__ui` gallery.
- Tests: API (supertest + in-memory MongoDB) and DOM snapshots of every route; ESLint + Prettier.

## 1 — Email-OTP login & roles

- `User` model (email, name, phone, roles: `customer` / `staff` / `owner`), `OtpCode` with TTL index, hashed codes,
  attempt limits and resend cool-down; email via a transactional provider (test inbox in `APP_MODE=test`).
- Session: httpOnly, `Secure`, `SameSite=Lax` cookie (works through the Vercel rewrite because the API is same-origin).
- Screens: sign in (email → `OtpInput`), account basics, sign out. `/adminDivya` requires `staff`/`owner`;
  remove `x-admin-key` once the owner account exists.
- Rate limits on OTP send/verify; audit log of admin sign-ins.

## 2 — Catalogue upgrade

- Variants: one SKU per size with its own stock (migration script from `sizes[]` / `freeSizeStock`, reversible).
- `GET /api/products` gains pagination, filters, sort and text search (response becomes `{ items, page, total }`
  behind a version flag so the current client keeps working until switched).
- Wishlist stored on the account and merged from the phone's saved list; route `/saved`.

## 3 — Cart & Buy Now

- Cart in the database for signed-in users, local for guests, merged at login; stock checked on every change.
- Prices and totals always recomputed on the server. Buy Now skips the cart for one item.

## 4 — Checkout + COD + Orders

- Addresses (Indian PIN code validation), delivery charge rules, COD with limits.
- `Order` model with status history; stock reserved at order time and released on cancel.
- Customer "My orders" with loading, empty and error states; order emails.

## 5 — Razorpay (test mode)

- Create Razorpay order on the server, verify the signature, idempotent webhook handler, retries and failure states.
- Never trust amounts from the client.

## 6 — Delivery

- Courier interface with a mock provider (test mode) and a Shiprocket adapter selected by `SHIPPING_PROVIDER`.
- Serviceability check by PIN code, shipment creation, tracking page and status webhooks.

## 7 — Admin commerce

- Orders list/detail, packing slips, status changes, cancellations/refunds, low-stock and sales reports.
- Staff permissions per role; audit trail.

## 8 — Go-live switch

- `APP_MODE=live` with live Razorpay and courier keys; remove test banners; final security, performance and
  accessibility checks; backups and monitoring; launch checklist.
