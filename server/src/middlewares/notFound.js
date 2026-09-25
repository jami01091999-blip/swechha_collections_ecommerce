export function notFound(req, res) {
  res.status(404).json({ error: 'Unknown API route.', requestId: req.id });
}

/** 405 for a known path with an unsupported method (same body as the old serverless router). */
export const methodNotAllowed = (methods) => (req, res) => {
  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ error: `Method ${req.method} not allowed.`, requestId: req.id });
};
