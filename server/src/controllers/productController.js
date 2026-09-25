// Product writes (staff/admin) and the admin catalogue reads. Public reads live in catalogController.
import * as products from '../services/productService.js';
import * as admin from '../services/adminProductService.js';
import { noStore } from '../utils/cache.js';

export async function create(req, res) {
  noStore(res);
  res.status(201).json(await products.createProduct(req.body || {}));
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

export async function adminList(req, res) {
  noStore(res);
  res.status(200).json(await admin.listAdminProducts(req.query));
}

export async function adminGet(req, res) {
  noStore(res);
  res.status(200).json(await admin.getAdminProduct(req.params.id));
}

export async function adminStats(req, res) {
  noStore(res);
  res.status(200).json(await admin.adminStats());
}

export async function updateStock(req, res) {
  noStore(res);
  res.status(200).json(await admin.updateStock(req.params.id, req.body.sizes));
}
