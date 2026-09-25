import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAdmin } from '../middlewares/adminKey.js';
import { adminWriteLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import { productIdParams, productListQuery } from '../validators/product.js';
import * as products from '../controllers/productController.js';
import * as settings from '../controllers/settingsController.js';
import * as upload from '../controllers/uploadController.js';
import * as admin from '../controllers/adminController.js';
import { health } from '../controllers/healthController.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';

const adminWrite = [adminWriteLimiter, requireAdmin];
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
  .get(validate(productListQuery, 'query'), h(products.list))
  .post(adminWrite, h(products.create))
  .all(methodNotAllowed(['GET', 'POST']));

apiRouter
  .route('/products/:id')
  .get(idParam, h(products.getOne))
  .patch(adminWrite, idParam, h(products.update))
  .put(adminWrite, idParam, h(products.update))
  .delete(adminWrite, idParam, h(products.remove))
  .all(methodNotAllowed(['GET', 'PATCH', 'PUT', 'DELETE']));

apiRouter
  .route('/settings')
  .get(h(settings.get))
  .put(adminWrite, h(settings.put))
  .all(methodNotAllowed(['GET', 'PUT']));

apiRouter
  .route('/upload-signature')
  .post(adminWrite, h(upload.signature))
  .all(methodNotAllowed(['POST']));

apiRouter
  .route('/admin/verify')
  .get(admin.keyRequired)
  .post(adminWriteLimiter, admin.verifyKey)
  .all(methodNotAllowed(['GET', 'POST']));
