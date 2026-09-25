import * as wishlist from '../services/wishlistService.js';
import { noStore } from '../utils/cache.js';

// The user always comes from the session (req.user), never from the request.
export async function list(req, res) {
  noStore(res);
  res.status(200).json(await wishlist.getWishlist(req.user._id));
}

export async function add(req, res) {
  noStore(res);
  res.status(200).json(await wishlist.addItem(req.user._id, req.body?.productId));
}

export async function remove(req, res) {
  noStore(res);
  res.status(200).json(await wishlist.removeItem(req.user._id, req.params.productId));
}

export async function merge(req, res) {
  noStore(res);
  res.status(200).json(await wishlist.mergeSlugs(req.user._id, req.body?.slugs));
}
