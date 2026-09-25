const GENERIC = 'The server could not complete the request. Try again in a moment.';

const DUPLICATE_MESSAGES = {
  code: 'Another product already uses this product code.',
  email: 'An account with this email already exists.',
  'sizes.sku': 'Another product already uses one of these SKUs.',
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const requestId = req.id;
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.', requestId });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.', requestId });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ error: DUPLICATE_MESSAGES[field] || `Another product already uses this ${field}.`, requestId });
  }
  const status = err?.status || err?.statusCode || 500;
  if (!err?.expose) req.log?.error({ err }, 'Unhandled error');
  if (err?.extra?.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
  res.status(status).json({ error: err?.expose ? err.message : GENERIC, ...(err?.expose ? err.extra : undefined), requestId });
}
