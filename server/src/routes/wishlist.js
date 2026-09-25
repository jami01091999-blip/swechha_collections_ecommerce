import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import * as wishlist from '../controllers/wishlistController.js';

export const wishlistRouter = Router();

wishlistRouter.use(requireAuth);
wishlistRouter
  .route('/')
  .get(h(wishlist.list))
  .all(methodNotAllowed(['GET']));
wishlistRouter
  .route('/items')
  .post(h(wishlist.add))
  .all(methodNotAllowed(['POST']));
wishlistRouter
  .route('/items/:productId')
  .delete(h(wishlist.remove))
  .all(methodNotAllowed(['DELETE']));
wishlistRouter
  .route('/merge')
  .post(h(wishlist.merge))
  .all(methodNotAllowed(['POST']));
