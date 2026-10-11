import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, presetById, activeColumns, callPool, variantsFor, patternName, togglePatternId, COLUMN_PICK } from './patterns.js';

const cols = (id) => activeColumns(presetById(id).variants).map((c) => 'BINGO'[c]).join('');

test('columns in play per pattern', () => {
  assert.equal(cols('corners'), 'BO');
  assert.equal(cols('stamp'), 'BIGO');
  assert.equal(cols('diagonal'), 'BIGO'); // N only has the free space
  assert.equal(cols('x'), 'BIGO');
  assert.equal(cols('l'), 'BINGO');
  assert.equal(cols('small-frame'), 'ING');
  assert.equal(cols('any-line'), 'BINGO');
});

test('custom pattern using only the free space in N skips N', () => {
  assert.deepEqual(activeColumns([[0, 12, 24]]), [0, 4]);
});

test('call pool only contains numbers from columns in play', () => {
  const pool = callPool(presetById('corners').variants);
  assert.equal(pool.length, 30);
  assert.ok(pool.every((n) => n <= 15 || n >= 61));
});

test('every preset has valid cells', () => {
  for (const p of PRESETS) for (const v of p.variants) assert.ok(v.every((c) => c >= 0 && c < 25), p.id);
});

test('several ways to win combine their columns', () => {
  const game = { patternIds: ['corners', 'diagonal'] };
  assert.deepEqual(activeColumns(variantsFor(game)), [0, 1, 3, 4]);
  assert.equal(patternName(game), 'Diagonal or Four corners');
  assert.equal(patternName({ patternIds: ['corners', 'x', 'coverall'] }), 'Four corners, Letter X or Coverall');
});

test('combining presets with the custom drawing', () => {
  const game = { patternIds: ['corners', 'custom'], custom: [[7, 12, 17]], customName: 'Mini line' };
  assert.deepEqual(activeColumns(variantsFor(game)), [0, 2, 4]);
  assert.equal(patternName(game), 'Four corners or Mini line');
});

test('older games with a single patternId still work', () => {
  assert.equal(patternName({ patternId: 'stamp' }), 'Postage stamp');
});

test('a game always keeps at least one way to win', () => {
  assert.deepEqual(togglePatternId({ patternIds: ['x'] }, 'x'), ['x']);
  assert.deepEqual(togglePatternId({ patternIds: ['x', 'corners'] }, 'x'), ['corners']);
  assert.deepEqual(togglePatternId({ patternIds: ['x'] }, 'h'), ['x', 'h']);
});

test('duplicate shapes across presets are only counted once', () => {
  assert.equal(variantsFor({ patternIds: ['any-line', 'across'] }).length, 12);
});

test('two lines down: any pair of columns', () => {
  const p = presetById('two-cols');
  assert.equal(p.variants.length, 10);
  assert.ok(p.variants.every((v) => new Set(v.map((c) => c % 5)).size === 2 && v.length === 10));
  assert.equal(cols('two-cols'), 'BINGO');
});

test('any 2 in two chosen columns: both columns are required', () => {
  const game = { patternIds: [COLUMN_PICK], colPick: { cols: [0, 4] } };
  const v = variantsFor(game);
  assert.equal(v.length, 100); // 10 pairs in B x 10 pairs in O
  // every winning shape is exactly 2 squares in B plus 2 squares in O, nothing else
  assert.ok(v.every((s) => s.length === 4 && s.filter((c) => c % 5 === 0).length === 2 && s.filter((c) => c % 5 === 4).length === 2));
  assert.deepEqual(activeColumns(v), [0, 4]);
  assert.equal(patternName(game), 'Any 2 in B and any 2 in O');
});

test('chosen columns: defaults, ordering and the free space', () => {
  assert.equal(patternName({ patternIds: [COLUMN_PICK] }), 'Any 2 in B and any 2 in O');
  assert.equal(patternName({ patternIds: [COLUMN_PICK], colPick: { cols: [3, 1] } }), 'Any 2 in I and any 2 in G');
  const n = variantsFor({ patternIds: [COLUMN_PICK], colPick: { cols: [2, 3] } });
  assert.ok(n.some((shape) => shape.includes(12))); // free space can be one of the N squares
  assert.deepEqual(activeColumns(n), [2, 3]);
});
