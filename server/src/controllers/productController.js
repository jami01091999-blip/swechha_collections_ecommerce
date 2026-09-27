import { audit } from '../services/auditService.js';
// Product writes (staff/admin) and the admin catalogue reads. Public reads live in catalogController.
import * as products from '../services/productService.js';
import * as admin from '../services/adminProductService.js';
import { noStore } from '../utils/cache.js';

export async function create(req, res) {
  noStore(res);
  const p = await products.createProduct(req.body || {});
  await audit(req, 'product.create', { entity: 'product', entityId: p._id, summary: `${p.name} (${p.code})` });
  res.status(201).json(p);
}

export async function update(req, res) {
  noStore(res);
  const p = await products.updateProduct(req.params.id, req.body || {});
  await audit(req, 'product.update', {
    entity: 'product',
    entityId: p._id,
    summary: `${p.name} (${p.code})`,
    meta: { fields: Object.keys(req.body || {}).slice(0, 30) },
  });
  res.status(200).json(p);
}

export async function remove(req, res) {
  noStore(res);
  await products.deleteProduct(req.params.id);
  await audit(req, 'product.delete', { entity: 'product', entityId: req.params.id });
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
  const p = await admin.updateStock(req.params.id, req.body.sizes);
  await audit(req, 'product.stock', {
    entity: 'product',
    entityId: req.params.id,
    summary: `Stock: ${req.body.sizes.map((s) => `${s.label}=${s.stock}`).join(', ')}`,
  });
  res.status(200).json(p);
}
