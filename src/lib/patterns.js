// A bingo card is a 5x5 grid. Cells are indexed 0–24, row by row:
//   0  1  2  3  4      B I N G O
//   5  6  7  8  9
//  10 11 12 13 14      12 is the FREE space
//  15 16 17 18 19
//  20 21 22 23 24
//
// A "way to win" is a list of variants. Covering every cell of ANY one
// variant wins. Example: "Any line" has 12 variants.

export const LETTERS = ['B', 'I', 'N', 'G', 'O'];
export const FREE = 12;

const row = (r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c);
const col = (c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c);
const DIAG_DOWN = [0, 6, 12, 18, 24];
const DIAG_UP = [4, 8, 12, 16, 20];
const uniq = (cells) => [...new Set(cells)].sort((a, b) => a - b);
const ALL = Array.from({ length: 25 }, (_, i) => i);

export const PRESETS = [
  { id: 'any-line', name: 'Any line', blurb: 'Across, down or diagonal',
    variants: [...[0, 1, 2, 3, 4].map(row), ...[0, 1, 2, 3, 4].map(col), DIAG_DOWN, DIAG_UP] },
  { id: 'across', name: 'Line across', blurb: 'Any horizontal row', variants: [0, 1, 2, 3, 4].map(row) },
  { id: 'down', name: 'Line down', blurb: 'Any vertical column', variants: [0, 1, 2, 3, 4].map(col) },
  { id: 'diagonal', name: 'Diagonal', blurb: 'Either diagonal', variants: [DIAG_DOWN, DIAG_UP] },
  { id: 'two-lines', name: 'Two lines across', blurb: 'Any two rows',
    variants: pairs([0, 1, 2, 3, 4]).map(([a, b]) => uniq([...row(a), ...row(b)])) },
  { id: 'two-cols', name: 'Two lines down', blurb: 'Any two columns',
    variants: pairs([0, 1, 2, 3, 4]).map(([a, b]) => uniq([...col(a), ...col(b)])) },
  { id: 'corners', name: 'Four corners', blurb: 'All four corner squares', variants: [[0, 4, 20, 24]] },
  { id: 'stamp', name: 'Postage stamp', blurb: 'A 2×2 block in any corner',
    variants: [[0, 1, 5, 6], [3, 4, 8, 9], [15, 16, 20, 21], [18, 19, 23, 24]] },
  { id: 'x', name: 'Letter X', blurb: 'Both diagonals', variants: [uniq([...DIAG_DOWN, ...DIAG_UP])] },
  { id: 'plus', name: 'Plus sign', blurb: 'Middle row and middle column', variants: [uniq([...row(2), ...col(2)])] },
  { id: 't', name: 'Letter T', blurb: 'Top row and the N column', variants: [uniq([...row(0), ...col(2)])] },
  { id: 'l', name: 'Letter L', blurb: 'B column and bottom row', variants: [uniq([...col(0), ...row(4)])] },
  { id: 'h', name: 'Letter H', blurb: 'B and O columns joined across the middle', variants: [uniq([...col(0), ...col(4), ...row(2)])] },
  { id: 'small-frame', name: 'Inside square', blurb: 'The ring around the free space', variants: [[6, 7, 8, 11, 13, 16, 17, 18]] },
  { id: 'frame', name: 'Picture frame', blurb: 'Every square on the outside edge',
    variants: [uniq([...row(0), ...row(4), ...col(0), ...col(4)])] },
  { id: 'coverall', name: 'Coverall', blurb: 'Every square on the card', variants: [ALL] },
];

function pairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  return out;
}

export const presetById = (id) => PRESETS.find((p) => p.id === id);

/**
 * A game can accept several ways to win: any mix of presets plus the game's
 * own drawing ('custom'). Older saved games used a single `patternId`.
 */
export function patternIdsOf(game) {
  return game.patternIds ?? (game.patternId ? [game.patternId] : []);
}

/** Toggle a pattern on or off, never leaving a game with none. */
export function togglePatternId(game, id) {
  const ids = patternIdsOf(game);
  if (ids.includes(id)) return ids.length > 1 ? ids.filter((x) => x !== id) : ids;
  return [...ids, id];
}

// "Any 2 in two columns": the host picks exactly two columns. A card wins only
// with any 2 squares in the first column AND any 2 in the second. The free
// space counts as covered in N.
export const COLUMN_PICK = 'col-picks';
export const DEFAULT_COLUMN_PICK = { cols: [0, 4], count: 2 };

export function columnPickOf(game) {
  const picked = [...new Set(game.colPick?.cols || [])].filter((c) => c >= 0 && c < 5);
  const cols = picked.length >= 2 ? picked.slice(0, 2) : DEFAULT_COLUMN_PICK.cols;
  return { cols: cols.sort(), count: 2 };
}

export function columnPickVariants({ cols, count }) {
  const perCol = cols.map((c) => combos([0, 1, 2, 3, 4], count).map((rows) => rows.map((r) => r * 5 + c)));
  return perCol.reduce((acc, options) => acc.flatMap((a) => options.map((o) => [...a, ...o])), [[]]).map((v) => uniq(v));
}

/** "Any 2 in B and any 2 in O" */
export function columnPickName({ cols, count }) {
  return cols.map((c, i) => `${i === 0 ? 'Any' : 'any'} ${count} in ${LETTERS[c]}`).join(' and ');
}

function combos(list, k) {
  if (k === 0) return [[]];
  if (list.length < k) return [];
  const [first, ...rest] = list;
  return [...combos(rest, k - 1).map((c) => [first, ...c]), ...combos(rest, k)];
}

/** The selected patterns in a stable order (presets, chosen columns, then the drawing). */
export function selectedPatterns(game) {
  const ids = new Set(patternIdsOf(game));
  const out = PRESETS.filter((p) => ids.has(p.id)).map(({ id, name, variants }) => ({ id, name, variants }));
  if (ids.has(COLUMN_PICK)) {
    const cp = columnPickOf(game);
    out.push({ id: COLUMN_PICK, name: columnPickName(cp), variants: columnPickVariants(cp) });
  }
  if (ids.has('custom')) {
    out.push({ id: 'custom', name: game.customName?.trim() || 'Custom pattern', variants: (game.custom || []).filter((v) => v.length) });
  }
  return out;
}

/**
 * The optional cap on how many numbers a game calls: { enabled, count }.
 * Returns the number to stop at (never more than the numbers in play), or null.
 */
export function callLimitFor(game, poolSize, extra = 0) {
  if (!game?.callLimit?.enabled) return null;
  return Math.min(poolSize, Math.max(1, (game.callLimit.count || 0) + extra));
}

/** "30, 40 45" -> [30, 40, 45]: whole numbers 1–75, sorted, no repeats. */
export function parseAnnounceList(text) {
  const nums = String(text).match(/\d+/g) || [];
  return [...new Set(nums.map(Number).filter((n) => n >= 1 && n <= 75))].sort((a, b) => a - b);
}

export const DEFAULT_PRIZE_MESSAGE = 'Special prize! Check your cards for O 69.';
export const MILESTONE_PLACEHOLDER = "That's {called} numbers called. {left} to go.";

/**
 * The milestone announcement for the Nth call. With no custom wording:
 * "That's 40 numbers called. 10 to go." Custom wording can use {called},
 * {left} and {total}, e.g. "We're at {called}. Only {left} left!"
 */
export function milestoneText(count, limit, template = '') {
  const left = limit != null ? Math.max(0, limit - count) : 0;
  if (template && template.trim()) {
    return template
      .replace(/\{called\}/gi, String(count))
      .replace(/\{left\}/gi, String(left))
      .replace(/\{total\}/gi, limit != null ? String(limit) : String(count));
  }
  return `That's ${count} ${count === 1 ? 'number' : 'numbers'} called.${left > 0 ? ` ${left} to go.` : ''}`;
}

/** Should the Nth call get a milestone announcement in this game? */
export function isMilestone(game, count) {
  return !!game?.callLimit?.enabled && (game.callLimit.announceAt || []).includes(count);
}

/** Every winning shape across all selected patterns, without duplicates. */
export function variantsFor(game) {
  const seen = new Set();
  const out = [];
  for (const p of selectedPatterns(game)) {
    for (const v of p.variants) {
      const key = [...v].sort((a, b) => a - b).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
  }
  return out;
}

/** "Four corners", "Four corners or Letter X", "Four corners, Letter X or Coverall" */
export function patternName(game) {
  const names = selectedPatterns(game).map((p) => p.name);
  if (!names.length) return 'No pattern picked';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * Columns (0–4) that can contribute to a win. A column is only "in play" when
 * some variant needs a real (non-free) square in it. Numbers from the other
 * columns can never help anyone win, so they are never called.
 */
export function activeColumns(variants) {
  const cols = new Set();
  for (const v of variants) for (const cell of v) if (cell !== FREE) cols.add(cell % 5);
  return [0, 1, 2, 3, 4].filter((c) => cols.has(c));
}

/** Numbers 1–75 and their column: B 1–15, I 16–30, N 31–45, G 46–60, O 61–75. */
export const columnOf = (n) => Math.floor((n - 1) / 15);
export const letterOf = (n) => LETTERS[columnOf(n)];

export function callPool(variants) {
  const cols = new Set(activeColumns(variants));
  const pool = [];
  for (let n = 1; n <= 75; n++) if (cols.has(columnOf(n))) pool.push(n);
  return pool;
}

/** Union of all variants: used for a single-card preview. */
export const previewCells = (variants) => new Set(variants.flat());
