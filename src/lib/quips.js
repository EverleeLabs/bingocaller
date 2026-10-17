// Things the caller says on cue: the start-of-game reminder and the banks of
// cheeky replies (one for a bingo that isn't, others for any time in a game).
// An event that hasn't changed a bank uses the built-in lines below.

export const DEFAULT_FALSE_BINGO = [
  "Nice try. Sit down.",
  "That's not a bingo, that's a cry for help.",
  'Ooh, so close. Not really, but it sounds nicer.',
  'Bold. Wrong, but bold.',
  'We admire the enthusiasm. Not the accuracy.',
  'Put the dauber down and step away from the card.',
  'False alarm. Everyone else, you may breathe again.',
  'That card has been checked and found guilty of wishful thinking.',
  'Close only counts in horseshoes.',
  "Let's all pretend that never happened.",
];

export const DEFAULT_BANKS = [
  {
    id: 'loud',
    name: 'Too loud',
    lines: [
      "If you can hear me, you're too quiet. If you can't, you're too loud.",
      "Inside voices, please. The balls can't hear themselves think.",
      "Shh. Money is being won here.",
      'Save the chat for the intermission. Daub now, gossip later.',
      "I'll wait.",
      "Some of us came to win, not to hear about your neighbour's hedge.",
    ],
  },
  {
    id: 'missed',
    name: 'What was called?',
    lines: [
      "It's on the board. The big glowing thing on the wall.",
      "Don't ask me, ask the TV. It never forgets.",
      'I say each one twice. Three times costs extra.',
      'Eyes up. Every number is on the screen.',
      'Pay attention, there will be a quiz at the end.',
      'Fewer chats, more daubs.',
    ],
  },
];

export const REMINDER_PLACEHOLDER = 'Phones on silent, please, and shout "Bingo!" nice and loud.';

/** The event's not-a-bingo replies, blank lines dropped. */
export const falseBingoLines = (event) => usable(event?.falseBingoReplies ?? DEFAULT_FALSE_BINGO);

/** The event's in-game banks, each with its blank lines dropped. Empty banks are left out. */
export const quipBanks = (event) =>
  (event?.quipBanks ?? DEFAULT_BANKS).map((b) => ({ ...b, lines: usable(b.lines) })).filter((b) => b.lines.length);

const usable = (lines) => (Array.isArray(lines) ? lines.map((l) => String(l).trim()).filter(Boolean) : []);

/**
 * A random line that wasn't said recently. `recent` holds the lines already
 * used from this bank, newest last; it is updated in place.
 */
export function pickLine(lines, recent = [], random = Math.random) {
  if (!lines.length) return null;
  const avoid = new Set(recent.slice(-Math.min(3, lines.length - 1)));
  const fresh = lines.filter((l) => !avoid.has(l));
  const line = fresh[Math.floor(random() * fresh.length)] ?? lines[0];
  recent.push(line);
  if (recent.length > 10) recent.shift();
  return line;
}

/** Roughly how long the voice takes to read some text, in ms. */
export function speechMs(text, rate = 1) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.round(600 + (words * 380) / (rate || 1));
}

/** Clean a bank of lines read from a file. */
export function cleanLines(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((l) => typeof l === 'string').slice(0, 100).map((l) => l.slice(0, 200));
}

export function cleanBanks(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((b) => b && typeof b === 'object')
    .slice(0, 12)
    .map((b, i) => ({
      id: typeof b.id === 'string' && /^[\w-]{1,40}$/.test(b.id) ? b.id : `bank-${i}`,
      name: typeof b.name === 'string' ? b.name.slice(0, 40) : 'Replies',
      lines: cleanLines(b.lines) ?? [],
    }));
}
