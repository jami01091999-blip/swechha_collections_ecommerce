import * as catalog from '../services/catalogService.js';
import { publicCache } from '../utils/cache.js';

// Public, cacheable reads. req.query / req.params are already parsed by validate(zod).

export async function list(req, res) {
  const data = await catalog.listProducts(req.query);
  publicCache(res, 30);
  res.status(200).json(data);
}

export async function home(req, res) {
  const data = await catalog.home();
  publicCache(res, 60);
  res.status(200).json(data);
}

export async function product(req, res) {
  const data = await catalog.publicProduct(req.params.slug);
  publicCache(res, 30);
  res.status(200).json(data);
}

export async function related(req, res) {
  const items = await catalog.related(req.params.slug);
  publicCache(res, 60);
  res.status(200).json({ items });
}

export async function suggest(req, res) {
  const data = await catalog.suggest(req.query.q);
  publicCache(res, 60);
  res.status(200).json(data);
}

export async function categories(req, res) {
  const items = await catalog.categoryCounts();
  publicCache(res, 60);
  res.status(200).json({ items });
}
