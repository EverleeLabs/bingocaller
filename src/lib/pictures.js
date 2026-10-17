import { useEffect, useSyncExternalStore } from 'react';
import { PICTURE_KEYS, themePictures, renamePictures } from './theme.js';
import { allEvents, eventsReadable, mapEvents, uid } from './store.js';
import { allSets, setsReadable, mapSets } from './palettes.js';

// Pictures (backgrounds and logos) are kept in IndexedDB, which has far more
// room than localStorage. Events and colour sets only hold their ids in
// `theme`. Every window of the app shares the one store, so the TV display
// reads pictures straight from it. A picture is never changed once saved (a
// new one gets a new id), so a window can keep what it has loaded.
//
// Record: { data: 'data:image/...', addedAt }. Pictures nothing points at are
// deleted when the app starts, once they're an hour old (so a picture another
// window is still saving, or one an undo could bring back, survives).

const DB = 'bingo';
const STORE = 'pictures';
const KEEP_UNUSED_MS = 60 * 60 * 1000;

let cache = {}; // id -> data URL, the ones this window has loaded
const listeners = new Set();
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

function remember(found) {
  if (!Object.keys(found).length) return;
  cache = { ...cache, ...found };
  listeners.forEach((l) => l());
}

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE).createIndex('addedAt', 'addedAt');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Run `fn(store)` in one transaction; resolves with what it returns once the transaction completes. */
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

/** Save pictures { id: dataUrl }. Resolves false if the browser couldn't store them. */
export async function putPictures(pictures) {
  const entries = Object.entries(pictures);
  if (!entries.length) return true;
  try {
    const addedAt = Date.now();
    await tx('readwrite', (s) => entries.forEach(([id, data]) => s.put({ data, addedAt }, id)));
  } catch {
    return false;
  }
  remember(pictures);
  return true;
}

/** Pictures by id, from memory or the database. Ids that aren't saved are left out. */
export async function getPictures(ids) {
  const want = [...new Set(ids)].filter((id) => id && !(id in cache));
  if (want.length) {
    try {
      const reqs = await tx('readonly', (s) => want.map((id) => [id, s.get(id)]));
      remember(Object.fromEntries(reqs.filter(([, r]) => r.result?.data).map(([id, r]) => [id, r.result.data])));
    } catch {
      /* not available: use what's in memory */
    }
  }
  return Object.fromEntries(ids.filter((id) => id in cache).map((id) => [id, cache[id]]));
}

/** The picture data a theme points at: { image, logo, logoSource } (null until loaded, or when missing). */
export function usePictures(theme) {
  const all = useSyncExternalStore(subscribe, () => cache);
  const missing = PICTURE_KEYS.map((k) => theme?.[k]).filter((id) => id && !(id in all)).join(',');
  useEffect(() => {
    if (missing) getPictures(missing.split(','));
  }, [missing]);
  return themePictures(theme, all);
}

/** Events with their pictures inline (`images`), for a backup file. */
export async function withPictures(events) {
  const ids = events.flatMap((e) => PICTURE_KEYS.map((k) => e.theme?.[k]).filter(Boolean));
  const found = await getPictures(ids);
  return events.map((e) => {
    const images = Object.fromEntries(PICTURE_KEYS.map((k) => e.theme?.[k]).filter((id) => found[id]).map((id) => [id, found[id]]));
    const { images: _, ...rest } = e;
    return Object.keys(images).length ? { ...rest, images } : rest;
  });
}

/**
 * Move imported events' inline pictures into the store under new ids (so they
 * never clash with pictures already here). Resolves with the events, or null
 * if the browser couldn't store the pictures.
 */
export async function storeImportedPictures(events) {
  const pictures = {};
  const out = events.map((e) => {
    const { theme, images } = renamePictures(e.theme, e.images, uid);
    Object.assign(pictures, images);
    const { images: _, theme: __, ...rest } = e;
    return theme ? { ...rest, theme } : rest;
  });
  return (await putPictures(pictures)) ? out : null;
}

/**
 * Older versions kept pictures inside each event and colour set in
 * localStorage. Move them into the store, then take them out of
 * localStorage. Until that works they're shown from where they are.
 */
async function moveOldPictures() {
  const old = {};
  for (const x of [...allEvents(), ...allSets()]) Object.assign(old, x.images);
  if (!Object.keys(old).length) return true;
  remember(old);
  if (!(await putPictures(old))) return false;
  const strip = (x) => {
    if (!x.images) return x;
    const { images: _, ...rest } = x;
    return rest;
  };
  mapEvents(strip);
  mapSets(strip);
  return true;
}

/** Delete pictures no event or colour set points at, once they're old enough. */
async function deleteUnused() {
  if (!eventsReadable() || !setsReadable()) return; // can't tell what's in use
  const used = new Set([...allEvents(), ...allSets()].flatMap((x) => PICTURE_KEYS.map((k) => x.theme?.[k])));
  const old = await tx('readonly', (s) => s.index('addedAt').getAllKeys(IDBKeyRange.upperBound(Date.now() - KEEP_UNUSED_MS)));
  const unused = old.result.filter((id) => !used.has(id));
  if (unused.length) await tx('readwrite', (s) => unused.forEach((id) => s.delete(id)));
}

// Ask the browser not to clear saved data when space runs low.
navigator.storage?.persist?.().catch(() => {});

moveOldPictures()
  .then((moved) => moved && deleteUnused())
  .catch(() => {});
