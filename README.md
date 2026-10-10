# Swechha Collections — Catalogue + Admin

Clothing catalogue with WhatsApp enquiry, plus an admin at **`/adminDivya`**. It is being extended into a full
e-commerce site in phases (see [`docs/PLAN.md`](docs/PLAN.md)).

**Responsive on every screen:** phones get the Stitch mobile design exactly; tablets and laptops (768px and wider) get a
full-width layout with top navigation, wider grids, and two-column product page and product form.

```
Browser → Vercel (client/, React)  ──/api/* rewrite──▶  Render (server/, Express)  →  MongoDB Atlas
                                                                     ↘ Cloudinary (photos)
```

| Layer    | Used here                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend | React 18 + Vite, React Router, TanStack Query (`client/`)                                                                                  |
| Styling  | Tailwind CSS with the exact Stitch "Regal Modernity" tokens (`client/tailwind.config.js`) and a shared UI kit (`client/src/components/ui`) |
| API      | Express + Mongoose (`server/`), documented in [`docs/API.md`](docs/API.md)                                                                 |
| Database | MongoDB Atlas (database: `swechha`)                                                                                                        |
| Images   | Cloudinary, signed direct upload from the browser                                                                                          |
| Sign-in  | Email + 6-digit code for everyone; admin access by role (`ADMIN_EMAILS`, Team screen)                                                      |
| Deploy   | Client → Vercel, API → Render (`render.yaml`)                                                                                              |

## Pages

**Customer site**

- `/` Home — hero banners, New Arrivals, Shop by Category, consultation banner, footer
- `/product/:slug` Product page — photos + zoom, price and discount, colours, size availability (sold-out sizes greyed and struck through, "Only N left"), details, related designs, WhatsApp enquiry that includes the chosen size and colour
- `/collection` (Lookbook tab) — search, category, sort, in-stock filter

**Admin (`/adminDivya`)**

- Dashboard — live counts, Recently Added
- Products — search, filter, edit, quick stock update, delete
- Add / Edit product — photos, details, price, sizes and stock, colours, story, publish or draft, delete
- Lookbook — home page banners, WhatsApp number, email, locations, Instagram

## Run locally

Needs Node 20 or newer. `client/` and `server/` are separate packages: install and run each in its own terminal.

```bash
# Terminal 1: API
cd server
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_ACCESS_SECRET, OTP_SECRET, ADMIN_EMAILS, SMTP_*, Cloudinary
npm run seed           # optional: 8 sample products + default settings
npm run dev            # API: http://localhost:4000/api/health

# Terminal 2: site
cd client
npm install
npm run dev            # site: http://localhost:5173   admin: /adminDivya
```

Other commands (in either folder): `npm test`, `npm run lint`, `npm run format`; `npm run build` in `client/`. The
dev server also serves a UI kit gallery at `http://localhost:5173/__ui`. See [`CLAUDE.md`](CLAUDE.md) for the folder map and design rules.

## Deploy

1. **Render (API):** New → Blueprint → pick this repo → it reads `render.yaml`. Enter the secret env vars when asked.
2. **Vercel (site):** Project → Settings → Root Directory = `client`. Put the Render URL into `client/vercel.json`
   (replace `REPLACE_WITH_RENDER_URL`).
3. **GitHub:** add the repository secret `API_HEALTH_URL` so `.github/workflows/keepalive.yml` keeps the free Render
   instance awake.

## Notes

- **Admin access:** sign in at `/login` with an email listed in `ADMIN_EMAILS` (it becomes an admin), then add staff
  from `/adminDivya/team`. In test mode the sign-in code is also printed in the API terminal.
- **Sample photos** in the seed come from the Stitch export (Google-hosted). Replace them with your own through Edit
  Product — they may stop loading in future.
- **Stock rules** (`client/src/lib/stock.js`): 0 = Not available; at or below the product's low-stock limit (default 2) = "Only N left".
- `npm run seed:reset` deletes **all** products and re-adds the samples.
