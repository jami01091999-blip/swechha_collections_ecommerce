export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

export function publicCache(res, seconds = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=300`);
}
