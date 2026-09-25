import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function cloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return null;
  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
    folder: CLOUDINARY_FOLDER,
  };
}

/** Cloudinary signature: sha1 of sorted "k=v&k=v" params + api secret. */
export function sign(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

/** Best-effort image delete; never throws. */
export async function destroyImages(publicIds = []) {
  const cfg = cloudinaryConfig();
  if (!cfg) return;
  await Promise.all(
    publicIds.filter(Boolean).map(async (publicId) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = sign({ public_id: publicId, timestamp }, cfg.apiSecret);
        const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: cfg.apiKey, signature });
        await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`, { method: 'POST', body });
      } catch (e) {
        logger.warn({ publicId, reason: e.message }, 'Cloudinary destroy failed');
      }
    })
  );
}
