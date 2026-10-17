import { useSyncExternalStore } from 'react';
import { cleanTheme, PICTURE_KEYS } from './theme.js';
import { uid } from './store.js';

// Colour sets the host saved to reuse in any event, kept in this browser.
// set = { id, name, theme }; its picture and logo are ids in the picture store
// (src/lib/pictures.js), kept there while any set or event uses them.

const KEY = 'bingo.palettes.v1';
const listeners = new Set();
let readable = true; // false if the saved sets couldn't be read
let cache = load();

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    readable = true;
    return Array.isArray(list) ? list : [];
  } catch {
    readable = false;
    return [];
  }
}

/** Returns false if the browser couldn't store it (usually full). */
function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  listeners.forEach((l) => l());
  return true;
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    cache = load();
    listeners.forEach((l) => l());
  }
});

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
export const useSavedSets = () => useSyncExternalStore(subscribe, () => cache);
export const allSets = () => cache;
export const setsReadable = () => readable;
export const mapSets = (fn) => save(cache.map(fn));

/** Save a theme under a name. `pictures` is { image, logo, logoSource }: ones that are missing are left out. */
export function saveSet(name, theme, pictures) {
  const t = { ...theme };
  for (const k of PICTURE_KEYS) if (!pictures[k]) delete t[k];
  if (!t.logoSource) delete t.logoCrop;
  const set = { id: uid(), name: name.trim().slice(0, 60) || 'My colours', theme: cleanTheme(t) || {} };
  return save([...cache, set]);
}

export const deleteSet = (id) => save(cache.filter((s) => s.id !== id));
