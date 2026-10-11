import { useSyncExternalStore } from 'react';

// Events are saved in this browser (localStorage). Each host's events stay on
// their own device. Swap this module for an API later to add accounts.

const KEY = 'bingo.events.v1';
const listeners = new Set();
let cache = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save(next) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
  listeners.forEach((l) => l());
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    cache = load();
    listeners.forEach((l) => l());
  }
});

const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));
export const useEvents = () => useSyncExternalStore(subscribe, () => cache);
export const getEvent = (id) => cache.find((e) => e.id === id);

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newGame(n = 1) {
  return { id: uid(), type: 'game', name: `Game ${n}`, patternIds: ['any-line'], custom: [[]], customName: '', interval: null };
}

export function newBreak() {
  return { id: uid(), type: 'break', name: 'Intermission', minutes: 10, message: '' };
}

export function createEvent() {
  const event = {
    id: uid(),
    name: 'Bingo night',
    interval: 8,
    items: [newGame(1), { ...newGame(2), patternIds: ['corners', 'x'] }, newBreak(), { ...newGame(3), patternIds: ['coverall'] }],
    createdAt: Date.now(),
  };
  save([event, ...cache]);
  return event;
}

export function updateEvent(id, patch) {
  save(cache.map((e) => (e.id === id ? { ...e, ...(typeof patch === 'function' ? patch(e) : patch), updatedAt: Date.now() } : e)));
}

export function deleteEvent(id) {
  save(cache.filter((e) => e.id !== id));
}

export function duplicateEvent(id) {
  const src = getEvent(id);
  if (!src) return;
  const copy = { ...structuredClone(src), id: uid(), name: `${src.name} (copy)`, createdAt: Date.now() };
  copy.items = copy.items.map((i) => ({ ...i, id: uid() }));
  save([copy, ...cache]);
}

/**
 * Add imported events. An event whose id is already saved here replaces it
 * (restoring a backup); everything else is added to the top of the list.
 */
export function importEvents(events) {
  const incoming = new Map(events.map((e) => [e.id, e]));
  const replaced = cache.map((e) => incoming.get(e.id) ?? e);
  const added = events.filter((e) => !cache.some((c) => c.id === e.id));
  save([...added, ...replaced]);
  return { added: added.length, replaced: events.length - added.length };
}

export const isSavedHere = (id) => cache.some((e) => e.id === id);
