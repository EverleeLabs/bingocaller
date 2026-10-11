// Export events to a file and read them back in.
// File format: { app: 'bingo-caller', version: 1, exportedAt, events: [...] }

const APP = 'bingo-caller';
const VERSION = 1;

export function downloadEvents(events, filename) {
  const data = { app: APP, version: VERSION, exportedAt: new Date().toISOString(), events };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'event';

export const backupFilename = () => `bingo-events-${today()}.json`;
export const eventFilename = (event) => `${slug(event.name)}-${today()}.json`;

/**
 * Read a backup file's text. Returns { events, skipped } or throws an Error
 * whose message can be shown to the person as is.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file can't be read. Choose a .json file exported from the bingo caller.");
  }
  if (data?.app !== APP || !Array.isArray(data.events)) {
    throw new Error("This file isn't a bingo caller export. Choose a file made with Export.");
  }
  if (data.version > VERSION) {
    throw new Error('This file was made by a newer version of the app. Refresh the page to update, then try again.');
  }
  const events = [];
  let skipped = 0;
  for (const raw of data.events) {
    const ev = cleanEvent(raw);
    if (ev) events.push(ev);
    else skipped++;
  }
  if (!events.length) throw new Error('No events in this file could be read.');
  return { events, skipped, exportedAt: data.exportedAt };
}

const str = (v, fallback) => (typeof v === 'string' ? v.slice(0, 200) : fallback);
const num = (v, min, max, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const cells = (v) => (Array.isArray(v) ? [...new Set(v.filter((c) => Number.isInteger(c) && c >= 0 && c < 25))] : []);
const id = (v) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : Math.random().toString(36).slice(2, 10));

/** Keep only the fields the app understands, with safe values. */
function cleanEvent(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  const items = raw.items.map(cleanItem).filter(Boolean);
  return {
    id: id(raw.id),
    name: str(raw.name, 'Imported event'),
    interval: num(raw.interval, 2, 60, 8),
    items,
    createdAt: num(raw.createdAt, 0, 9e15, Date.now()),
    updatedAt: num(raw.updatedAt, 0, 9e15, Date.now()),
  };
}

function cleanItem(raw) {
  if (raw?.type === 'break') {
    return { id: id(raw.id), type: 'break', name: str(raw.name, 'Intermission'), minutes: num(raw.minutes, 1, 120, 10), message: str(raw.message, '') };
  }
  if (raw?.type === 'game') {
    const ids = Array.isArray(raw.patternIds) ? raw.patternIds : raw.patternId ? [raw.patternId] : ['any-line'];
    const game = {
      id: id(raw.id),
      type: 'game',
      name: str(raw.name, 'Game'),
      patternIds: ids.filter((x) => typeof x === 'string').slice(0, 30),
      custom: Array.isArray(raw.custom) ? raw.custom.slice(0, 50).map(cells) : [[]],
      customName: str(raw.customName, ''),
      interval: raw.interval == null ? null : num(raw.interval, 2, 60, null),
    };
    if (raw.colPick && Array.isArray(raw.colPick.cols)) {
      game.colPick = { cols: raw.colPick.cols.filter((c) => Number.isInteger(c) && c >= 0 && c < 5).slice(0, 2) };
    }
    if (raw.callLimit && typeof raw.callLimit === 'object') {
      game.callLimit = {
        enabled: raw.callLimit.enabled === true,
        count: num(raw.callLimit.count, 1, 75, 40),
        announceAt: Array.isArray(raw.callLimit.announceAt)
          ? [...new Set(raw.callLimit.announceAt.filter((n) => Number.isInteger(n) && n >= 1 && n <= 75))].sort((a, b) => a - b)
          : [],
      };
    }
    if (!game.patternIds.length) game.patternIds = ['any-line'];
    return game;
  }
  return null;
}
