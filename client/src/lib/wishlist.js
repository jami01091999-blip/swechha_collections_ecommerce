import { useSyncExternalStore } from 'react';

const KEY = 'swechha_saved';
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
let saved = read();

function emit() {
  listeners.forEach((l) => l());
}

export function toggleSaved(slug) {
  saved = saved.includes(slug) ? saved.filter((s) => s !== slug) : [slug, ...saved];
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage full or blocked — keep in memory */
  }
  emit();
  return saved.includes(slug);
}

export function useSaved() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => saved
  );
}
