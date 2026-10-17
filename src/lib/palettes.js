import { useSyncExternalStore } from 'react';
import { cleanTheme, themePictures } from './theme.js';
import { uid } from './store.js';

// Colour sets the host saved to reuse in any event, kept in this browser.
// set = { id, name, theme, images: { [id]: dataUrl } }; the set carries its
// own copy of any picture or logo so it still works after the event is deleted.

const KEY = 'bingo.palettes.v1';
const listeners = new Set();
let cache = load();

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
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

/** Save a theme (with its pictures, taken from the event's images) under a name. */
export function saveSet(name, theme, eventImages) {
  const pics = themePictures(theme, eventImages);
  const images = {};
  const t = { ...theme };
  for (const k of ['image', 'logo']) {
    if (pics[k]) {
      images[t[k]] = pics[k];
    } else delete t[k];
  }
  const set = { id: uid(), name: name.trim().slice(0, 60) || 'My colours', theme: cleanTheme(t) || {}, images };
  return save([...cache, set]);
}

export const deleteSet = (id) => save(cache.filter((s) => s.id !== id));
