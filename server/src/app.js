import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { requestId } from './middlewares/requestId.js';
import { csrf } from './middlewares/csrf.js';
import { apiLimiter } from './middlewares/rateLimit.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRouter } from './routes/index.js';

/** Builds the Express app (no listening, no DB connect) so tests can drive it with supertest. */
export function createApp() {
  const app = express();

  // Requests arrive through Render's load balancer (and Vercel's rewrite proxy in front of it).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.set('etag', false); // the old serverless API sent no ETags; caching is driven by Cache-Control

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      // Only method, path and client IP — never bodies or headers (admin key, cookies).
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.raw?.ip }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    })
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Unknown origins get no CORS headers (the browser blocks them); same-origin calls via the Vercel rewrite need none.
      origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter, csrf, apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
