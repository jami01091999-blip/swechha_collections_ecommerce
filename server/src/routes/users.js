import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import * as users from '../controllers/userController.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter
  .route('/me')
  .patch(h(users.updateMe))
  .all(methodNotAllowed(['PATCH']));
usersRouter
  .route('/me/addresses')
  .get(h(users.listAddresses))
  .post(h(users.addAddress))
  .all(methodNotAllowed(['GET', 'POST']));
usersRouter
  .route('/me/addresses/:id')
  .patch(h(users.updateAddress))
  .delete(h(users.removeAddress))
  .all(methodNotAllowed(['PATCH', 'DELETE']));
usersRouter
  .route('/me/addresses/:id/default')
  .post(h(users.makeDefault))
  .all(methodNotAllowed(['POST']));
