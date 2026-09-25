import { Router } from 'express';
import { asyncHandler as h } from '../utils/asyncHandler.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.js';
import { methodNotAllowed } from '../middlewares/notFound.js';
import * as auth from '../controllers/authController.js';

export const authRouter = Router();

// /me is read on every app load, so it only counts toward the general API limit.
authRouter
  .route('/me')
  .get(optionalAuth, h(auth.me))
  .all(methodNotAllowed(['GET']));

authRouter.use(authLimiter);
authRouter
  .route('/otp/request')
  .post(h(auth.requestOtp))
  .all(methodNotAllowed(['POST']));
authRouter
  .route('/otp/verify')
  .post(h(auth.verifyOtp))
  .all(methodNotAllowed(['POST']));
authRouter
  .route('/refresh')
  .post(h(auth.refresh))
  .all(methodNotAllowed(['POST']));
authRouter
  .route('/logout')
  .post(h(auth.logout))
  .all(methodNotAllowed(['POST']));
authRouter
  .route('/logout-all')
  .post(requireAuth, h(auth.logoutAll))
  .all(methodNotAllowed(['POST']));
