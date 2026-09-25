import { cloudinaryConfig, sign } from '../integrations/cloudinary.js';
import { HttpError } from '../utils/HttpError.js';
import { noStore } from '../utils/cache.js';

// Short-lived signature so the browser uploads straight to Cloudinary; the secret never leaves the server.
export function signature(req, res) {
  noStore(res);
  const cfg = cloudinaryConfig();
  if (!cfg) {
    throw new HttpError(
      503,
      'Photo upload is not set up. Add the CLOUDINARY_* keys to your environment, or paste an image link instead.'
    );
  }
  const timestamp = Math.floor(Date.now() / 1000);
  res.status(200).json({
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
    folder: cfg.folder,
    timestamp,
    signature: sign({ folder: cfg.folder, timestamp }, cfg.apiSecret),
  });
}
