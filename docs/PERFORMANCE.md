# Performance

## What keeps the catalogue fast

- **Card projections:** list endpoints (`/api/products`, `/api/home`, related, wishlist) return only the fields a
  product card needs, never descriptions or full image lists.
- **Indexes:** every list query is backed by an index; the text index covers name, code, fabric, colour names,
  category and description. `server/test/catalog.test.js` runs `explain()` and fails if category + sort, price range,
  in stock, discount sort or text search fall back to a collection scan.
- **Denormalised stock:** `totalStock`, `inStock`, `availableSizes` and `discountPercent` are stored on each product
  (always through `services/productShape.js`), so filters don't compute them per request.
- **One aggregation for facets**, run in parallel with the page query and the count.
- **Caching:** public GETs send `Cache-Control: public, s-maxage=30` (home, categories and suggestions: 60 s), so
  Vercel's edge can serve repeat requests. After an admin change customers see it within about 30 seconds.
- **Client:** TanStack Query keeps pages in memory (instant back navigation); images use Cloudinary `srcSet` so phones
  download ~300–600 px images instead of full size; admin, account, sign-in and saved pages are separate bundles.

## Load test (k6)

k6 is a separate tool, not an npm dependency. Install it once: `winget install k6` (Windows), `brew install k6`
(macOS) or see <https://k6.io/docs/get-started/installation/>.

1. Start the API with production settings on your machine against a **copy** of the data (or the seed data):
   ```bash
   # in server/.env use a test database, e.g. MONGO_DB=swechha_load, then:
   npm run seed -w server
   npm run migrate:002 -w server -- --apply
   NODE_ENV=production CLIENT_ORIGIN=http://localhost:5173 npm start -w server
   ```
2. In another terminal:
   ```bash
   k6 run server/scripts/load/catalogue.k6.js
   # or against another URL:
   k6 run -e BASE_URL=http://localhost:4000 server/scripts/load/catalogue.k6.js
   ```
3. Pass criteria (built into the script): **p95 < 500 ms** and **errors < 1 %** over 100 virtual users for 2 minutes,
   mixing home, filtered collection pages, search suggestions and product pages.

### Notes

- **Rate limits:** the API allows 600 requests / 15 min per IP. The script gives every virtual user its own
  `X-Forwarded-For` address, which a local server trusts (`TRUST_PROXY=1`). Behind Render the real client IP is set
  by the proxy, so a load test from one machine against the deployed API **will** be rate-limited (429s) — that is the
  limiter working. Load-test deployed environments from several machines, or with the limits raised temporarily.
- Don't run it against the live Atlas database during shop hours; the free Atlas and Render tiers are small.
- Results depend heavily on the machine and on the Atlas region. Run it after big catalogue changes and compare.
