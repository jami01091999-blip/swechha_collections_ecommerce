import * as products from '../services/productService.js';
import { assertAdmin, isAdmin } from '../middlewares/adminKey.js';
import { noStore, publicCache } from '../utils/cache.js';
import { HttpError } from '../utils/HttpError.js';

// GET /api/products → published (public) · GET /api/products?all=1 → everything (admin)
export async function list(req, res) {
  const wantAll = req.query.all === '1';
  if (wantAll) {
    assertAdmin(req);
    noStore(res);
  } else {
    publicCache(res, 30);
  }
  res.status(200).json(await products.listProducts({ includeDrafts: wantAll }));
}

export async function create(req, res) {
  noStore(res);
  res.status(201).json(await products.createProduct(req.body || {}));
}

export async function getOne(req, res) {
  const doc = await products.findProductOr404(req.params.id);
  const admin = req.headers['x-admin-key'] !== undefined && isAdmin(req);
  if (doc.status !== 'published' && !admin) throw new HttpError(404, 'Product not found.');
  if (admin) noStore(res);
  else publicCache(res, 30);
  res.status(200).json(doc);
}

export async function update(req, res) {
  noStore(res);
  res.status(200).json(await products.updateProduct(req.params.id, req.body || {}));
}

export async function remove(req, res) {
  noStore(res);
  await products.deleteProduct(req.params.id);
  res.status(200).json({ deleted: true });
}
