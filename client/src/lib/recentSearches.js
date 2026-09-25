// Last 5 searches on this device (shown when the search box is empty).
const KEY = 'swechha_recent_searches';
const MAX = 5;

export function getRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(q) {
  const term = String(q || '').trim();
  if (!term) return getRecent();
  const next = [term, ...getRecent().filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: keep going without history */
  }
  return next;
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
