// k6 load test for the public catalogue — see docs/PERFORMANCE.md.
//   k6 run server/scripts/load/catalogue.k6.js
//   k6 run -e BASE_URL=http://localhost:4000 server/scripts/load/catalogue.k6.js
// 100 virtual users for 2 minutes: home, filtered collection pages, search suggestions, product pages.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

export const options = {
  scenarios: {
    shoppers: { executor: 'constant-vus', vus: 100, duration: '2m' },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{page:collection}': ['p(95)<500'],
    'http_req_duration{page:suggest}': ['p(95)<500'],
  },
};

const CATEGORIES = ['', 'Sarees', 'Night dresses', 'Dresses(3-pcs)', 'Frocks', 'Co-Ord sets', 'Kurti'];
const SORTS = ['', 'newest', 'price_asc', 'price_desc', 'discount'];
const SIZES = ['', 'M', 'L', 'XL', 'S,M', 'FREE'];
const PRICES = [
  ['', ''],
  ['', '4999'],
  ['5000', '9999'],
  ['10000', '19999'],
];
const WORDS = ['si', 'silk', 'cott', 'night', 'dress', 'kanj', 'life', 'bam', 'frock', 'co'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Each virtual user looks like a different phone. The API's rate limit is per IP; a local server trusts
// X-Forwarded-For (TRUST_PROXY=1), so this keeps one machine from tripping the limit. See PERFORMANCE.md.
const headers = () => ({ 'X-Forwarded-For': `10.${__VU % 250}.${Math.floor(__VU / 250)}.${(__ITER % 250) + 1}` });
const get = (path, page) => http.get(`${BASE}${path}`, { headers: headers(), tags: { page } });

let slugs = [];

export function setup() {
  const res = http.get(`${BASE}/api/products?limit=48`);
  const items = res.status === 200 ? res.json('items') : [];
  return { slugs: items.map((p) => p.slug) };
}

export default function (data) {
  slugs = data.slugs;

  group('home', () => {
    const r = get('/api/home', 'home');
    check(r, { 'home 200': (x) => x.status === 200 });
  });
  sleep(Math.random() * 1.5);

  group('collection', () => {
    const [min, max] = pick(PRICES);
    const params = [
      ['category', pick(CATEGORIES)],
      ['sort', pick(SORTS)],
      ['sizes', pick(SIZES)],
      ['minPrice', min],
      ['maxPrice', max],
      ['inStock', Math.random() < 0.3 ? '1' : ''],
      ['page', String(1 + Math.floor(Math.random() * 2))],
    ]
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const r = get(`/api/products?${params}`, 'collection');
    check(r, { 'collection 200': (x) => x.status === 200, 'has facets': (x) => x.status === 200 && x.json('facets') !== null });
  });
  sleep(Math.random() * 1.5);

  group('search', () => {
    const r = get(`/api/search/suggest?q=${pick(WORDS)}`, 'suggest');
    check(r, { 'suggest 200': (x) => x.status === 200 });
  });
  sleep(Math.random());

  if (slugs.length) {
    group('product', () => {
      const slug = pick(slugs);
      const r = get(`/api/products/${slug}`, 'product');
      check(r, { 'product 200': (x) => x.status === 200 });
      get(`/api/products/${slug}/related`, 'related');
    });
  }
  sleep(1 + Math.random() * 2);
}
