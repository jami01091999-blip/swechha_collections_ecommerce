# Swechha Collections — Catalogue + Admin

View-only clothing catalogue (no cart) with WhatsApp enquiry, plus an admin at **`/adminDivya`**.

**Responsive on every screen:** phones get the Stitch mobile design exactly; tablets and laptops (768px and wider) get a full-width layout with top navigation, wider grids, and two-column product page and product form.

```
React (Vite + Tailwind)  →  /api/* (Vercel serverless functions)  →  MongoDB Atlas
                                         ↘ Cloudinary (photos)
```

| Layer            | Used here                                                                          |
| ---------------- | ---------------------------------------------------------------------------------- |
| Frontend         | React 18 + Vite, React Router                                                      |
| Styling          | Tailwind CSS with the exact Stitch "Regal Modernity" tokens (`tailwind.config.js`) |
| API              | `/api` folder → Vercel Serverless Functions (Node)                                 |
| Database         | MongoDB Atlas via the official MongoDB Node.js driver (database: `swechha`)        |
| Images           | Cloudinary, signed direct upload from the browser                                  |
| API calls        | `fetch` (`src/lib/api.js`)                                                         |
| Admin protection | One admin key (`ADMIN_KEY`), asked once per device — not a login                   |
| Deploy           | GitHub → Vercel                                                                    |

## Pages

**Customer site**

- `/` Home — hero banners, category chips, New Arrivals, Shop by Category, Featured, consultation banner, footer
- `/product/:slug` Product page — photos + zoom, price and discount, colours, saree specs or size availability (sold-out sizes greyed and struck through, "Only N left"), details, related designs, WhatsApp enquiry that includes the chosen size and colour
- `/collection` (Lookbook tab) — search, category, sort, in-stock filter
- `/saved` Saved designs (kept on the customer's phone)

**Admin (`/adminDivya`)**

- Dashboard — live counts, Needs Attention (low or zero stock) with quick stock update, Recently Added
- Products — search, filter, edit, quick stock update
- Add / Edit product — photos, details, price, sizes and stock, saree details, colours, story and care, publish or draft, delete
- Lookbook — home page banners, WhatsApp number, email, locations, Instagram

## Run locally

```bash
npm install
npm run seed      # adds the 8 sample products from the design + default settings
npm run dev       # site: http://localhost:5173   admin: http://localhost:5173/adminDivya
```

`.env` already points to your MongoDB cluster (new database `swechha`) and has an `ADMIN_KEY`.
Add your Cloudinary keys (Cloudinary dashboard → Settings → API Keys) to turn on photo uploads.
Until then you can paste image links in the admin.

## Deploy to Vercel

1. MongoDB Atlas → **Network Access** → add `0.0.0.0/0` (Vercel has no fixed IP address).
2. Push to GitHub. `.env` is git-ignored — never commit it.
3. Vercel → **Add New Project** → import the repo. Framework preset: Vite (auto-detected).
4. **Settings → Environment Variables**: add every key from `.env`
   (`MONGO_URI`, `MONGO_DB`, `ADMIN_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`).
5. Deploy. If the database is empty, run `npm run seed` once from your laptop.

## Notes

- **Admin key:** `/adminDivya` asks for `ADMIN_KEY` once per device, then remembers it. Without this, anyone who finds your API could edit or delete products. To change it, update the environment variable and redeploy; each device will be asked again. If you delete `ADMIN_KEY` entirely, the admin opens with no prompt and the API is unprotected.
- **Sample photos** in the seed come from the Stitch export (Google-hosted). Replace them with your own through Edit Product — they may stop loading in future.
- **Stock rules** (`src/lib/stock.js`): 0 = Not available; at or below the product's low-stock limit (default 2) = "Only N left".
- `npm run seed:reset` deletes **all** products and re-adds the samples.

## API

| Method      | Route                     | Access                      |
| ----------- | ------------------------- | --------------------------- |
| GET         | `/api/products`           | public (published only)     |
| GET         | `/api/products?all=1`     | admin                       |
| POST        | `/api/products`           | admin                       |
| GET         | `/api/products/:idOrSlug` | public (drafts: admin only) |
| PATCH / PUT | `/api/products/:id`       | admin                       |
| DELETE      | `/api/products/:id`       | admin                       |
| GET / PUT   | `/api/settings`           | public / admin              |
| POST        | `/api/upload-signature`   | admin                       |
| GET / POST  | `/api/admin/verify`       | —                           |

Admin requests send the header `x-admin-key: <ADMIN_KEY>`.
