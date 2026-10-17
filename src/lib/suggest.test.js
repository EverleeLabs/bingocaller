import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestThemes, pictureStats, distinctHues } from './suggest.js';
import { themeWarnings, cleanTheme } from './theme.js';
import { contrast, ensureContrast, readableOn, mix } from './colour.js';

test('contrast helpers', () => {
  assert.equal(readableOn('#000000'), '#ffffff');
  assert.equal(readableOn('#ffffff'), '#1d1838');
  assert.ok(contrast(ensureContrast('#777777', '#808080', 4.5), '#808080') >= 4.5);
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('the standard look has no readability warnings', () => {
  assert.deepEqual(themeWarnings(undefined), []);
});

test('every warning comes with a fix that clears it', () => {
  const bad = { bg: '#ffffff', text: '#eeeeee', accent: '#fafafa', face: '#000000', faceText: '#111111', balls: [{ bg: '#ffff00', text: '#ffffff' }, {}, {}, {}, {}] };
  const warnings = themeWarnings(bad);
  assert.equal(warnings.length, 4);
  const fixed = warnings.reduce((t, w) => ({ ...t, ...w.fix.patch }), bad);
  assert.deepEqual(themeWarnings(fixed), []);
});

const backgrounds = ['#221b45', '#000000', '#ffffff', '#f4f1e8', '#5a0f1a', '#0b3d2e', '#808080', '#ffd400', '#3a7bd5'];

test('suggestions from any background colour pass every check', () => {
  for (const bg of backgrounds) {
    for (const s of suggestThemes({ bg })) {
      assert.ok(cleanTheme(s.patch), `${bg} ${s.id} is a valid theme`);
      assert.deepEqual(themeWarnings(s.patch).map((w) => w.message), [], `${bg} ${s.id}`);
    }
  }
});

test('suggestions from a picture use its colours and fade it enough', () => {
  const pixels = [
    ...Array(500).fill([250, 240, 220]), // bright sky
    ...Array(300).fill([30, 110, 60]), // green field
    ...Array(200).fill([200, 60, 40]), // red barn
  ];
  const stats = pictureStats(pixels);
  assert.ok(stats.palette.length >= 2);
  const theme = { image: 'p', dim: 0 };
  for (const s of suggestThemes(theme, stats)) {
    const t = { ...theme, ...s.patch };
    assert.ok(t.dim > 0, 'fades the bright picture');
    assert.deepEqual(themeWarnings(t, stats).map((w) => w.message), [], s.id);
  }
});

test('ball hues are easy to tell apart', () => {
  const hues = distinctHues([50, 140, 55, 10], 4);
  assert.equal(hues.length, 4);
  for (const a of hues) for (const b of hues) if (a !== b) assert.ok(Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) >= 40, `${a} vs ${b}`);
  assert.deepEqual(distinctHues([0, 90, 180, 270], 4), [0, 90, 180, 270]);
});
