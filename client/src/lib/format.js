export const formatINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const discountPercent = (mrp, price) => (mrp > price && price > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0);

/** Cloudinary delivery transform: auto format/quality and a sensible width for phones. */
export function imgUrl(url, width = 600) {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !url.includes('/image/upload/f_auto')) {
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
  }
  return url;
}

export const coverImage = (p) => p?.images?.[0]?.url || '';

export function waLink(number, text) {
  const n = String(number || '').replace(/\D/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function formatPhone(number) {
  const n = String(number || '').replace(/\D/g, '');
  if ((n.length === 10 || n.length === 12) && n.startsWith('9')) {
    const body = n.length === 12 ? n.slice(2) : n;
    return `+91 ${body.slice(0, 5)} ${body.slice(5)}`;
  }
  return n ? `+${n}` : '';
}
