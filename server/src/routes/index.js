import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { adminWriteLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import { productIdParams } from '../validators/product.js';
import { adminListQuery, productListQuery, slugParams, stockBody, suggestQuery } from '../validators/catalog.js';
import * as catalog from '../controllers/catalogController.js';
import * as products from '../controllers/productController.js';
import * as settings from '../controllers/settingsController.js';
import * as upload from '../controllers/uploadController.js';
import * as team from '../controllers/teamController.js';
import { health } from '../controllers/healthController.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { wishlistRouter } from './wishlist.js';

// Catalogue writes: staff and admins. Settings and team: admins only.
const staffWrite = [adminWriteLimiter, requireAuth, requireRole('admin', 'staff')];
const adminOnly = [adminWriteLimiter, requireAuth, requireRole('admin')];
const idParam = validate(productIdParams, 'params');

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/wishlist', wishlistRouter);

apiRouter
  .route('/health')
  .get(health)
  .all(methodNotAllowed(['GET']));

// Public catalogue (card projections, cacheable).
apiRouter
  .route('/home')
  .get(h(catalog.home))
  .all(methodNotAllowed(['GET']));
apiRouter
  .route('/categories')
  .get(h(catalog.categories))
  .all(methodNotAllowed(['GET']));
apiRouter
  .route('/search/suggest')
  .get(validate(suggestQuery, 'query'), h(catalog.suggest))
  .all(methodNotAllowed(['GET']));

apiRouter
  .route('/products')
  .get(validate(productListQuery, 'query'), h(catalog.list))
  .post(staffWrite, h(products.create))
  .all(methodNotAllowed(['GET', 'POST']));

apiRouter
  .route('/products/:slug/related')
  .get(validate(slugParams, 'params'), h(catalog.related))
  .all(methodNotAllowed(['GET']));

apiRouter
  .route('/products/:id')
  .get(validate(productIdParams, 'params'), (req, res, next) => ((req.params.slug = req.params.id), next()), h(catalog.product))
  .patch(staffWrite, idParam, h(products.update))
  .put(staffWrite, idParam, h(products.update))
  .delete(staffWrite, idParam, h(products.remove))
  .all(methodNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE']));

// Admin catalogue (staff and admins).
const staffRead = [requireAuth, requireRole('admin', 'staff')];
apiRouter
  .route('/admin/products')
  .get(staffRead, validate(adminListQuery, 'query'), h(products.adminList))
  .all(methodNotAllowed(['GET']));
apiRouter
  .route('/admin/stats')
  .get(staffRead, h(products.adminStats))
  .all(methodNotAllowed(['GET']));
apiRouter
  .route('/admin/products/:id')
  .get(staffRead, h(products.adminGet))
  .all(methodNotAllowed(['GET']));
apiRouter
  .route('/admin/products/:id/stock')
  .patch(staffWrite, validate(stockBody), h(products.updateStock))
  .all(methodNotAllowed(['PATCH']));

apiRouter
  .route('/settings')
  .get(h(settings.get))
  .put(adminOnly, h(settings.put))
  .all(methodNotAllowed(['GET', 'PUT']));

apiRouter
  .route('/upload-signature')
  .post(staffWrite, h(upload.signature))
  .all(methodNotAllowed(['POST']));

apiRouter
  .route('/admin/team')
  .get(adminOnly, h(team.list))
  .post(adminOnly, h(team.add))
  .all(methodNotAllowed(['GET', 'POST']));

apiRouter
  .route('/admin/team/:userId')
  .patch(adminOnly, h(team.changeRole))
  .delete(adminOnly, h(team.remove))
  .all(methodNotAllowed(['PATCH', 'DELETE']));
