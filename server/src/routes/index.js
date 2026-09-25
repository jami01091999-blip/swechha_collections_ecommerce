import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.js';
import { adminWriteLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import { productIdParams, productListQuery } from '../validators/product.js';
import * as products from '../controllers/productController.js';
import * as settings from '../controllers/settingsController.js';
import * as upload from '../controllers/uploadController.js';
import * as team from '../controllers/teamController.js';
import { health } from '../controllers/healthController.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';

// Catalogue writes: staff and admins. Settings and team: admins only.
const staffWrite = [adminWriteLimiter, requireAuth, requireRole('admin', 'staff')];
const adminOnly = [adminWriteLimiter, requireAuth, requireRole('admin')];
const idParam = validate(productIdParams, 'params');

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

apiRouter
  .route('/health')
  .get(health)
  .all(methodNotAllowed(['GET']));

apiRouter
  .route('/products')
  .get(validate(productListQuery, 'query'), optionalAuth, h(products.list))
  .post(staffWrite, h(products.create))
  .all(methodNotAllowed(['GET', 'POST']));

apiRouter
  .route('/products/:id')
  .get(idParam, optionalAuth, h(products.getOne))
  .patch(staffWrite, idParam, h(products.update))
  .put(staffWrite, idParam, h(products.update))
  .delete(staffWrite, idParam, h(products.remove))
  .all(methodNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE']));

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
