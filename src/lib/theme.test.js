import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTheme, pruneImages, themeStyle, contrast, themeWarnings, themePictures } from './theme.js';

test('an empty theme means the standard look', () => {
  assert.equal(cleanTheme({}), undefined);
  assert.equal(cleanTheme({ balls: [{}, {}, {}, {}, {}], font: 'nope' }), undefined);
  assert.deepEqual(themeStyle(undefined), {});
});

test('only changed colours become CSS variables', () => {
  const s = themeStyle({ text: '#000000', balls: [{}, { bg: '#123456' }] });
  assert.deepEqual(s, { '--tv-text': '#000000', '--i': '#123456' });
});

test('a picture adds a veil tinted with the background colour', () => {
  const s = themeStyle({ bg: '#000000', image: 'p', dim: 60 }, 'data:image/jpeg;base64,AA');
  assert.equal(s['--tv-image'], 'url("data:image/jpeg;base64,AA")');
  assert.equal(s['--tv-veil'], 'color-mix(in srgb, #000000 60%, transparent)');
});

test('unused pictures are dropped', () => {
  assert.deepEqual(pruneImages({ a: 'x', b: 'y', c: 'z' }, { image: 'a', logo: 'c' }), { a: 'x', c: 'z' });
  assert.equal(pruneImages({ a: 'x' }, undefined), undefined);
});

test('contrast warnings', () => {
  assert.equal(Math.round(contrast('#000000', '#ffffff')), 21);
  assert.deepEqual(themeWarnings(undefined), []);
  assert.equal(themeWarnings({ text: '#2a2050' }).length, 1);
});

test('picture ids resolve to their data', () => {
  assert.deepEqual(themePictures({ image: 'p', logo: 'gone' }, { p: 'data:p' }), { image: 'data:p', logo: null });
  assert.deepEqual(themePictures(undefined, undefined), { image: null, logo: null });
});

test('logo and font settings are kept only when valid', () => {
  assert.deepEqual(cleanTheme({ logo: 'abc', logoPlace: 'instead', logoSize: 'xl', font: 'rounded' }), { logo: 'abc', logoPlace: 'instead', font: 'rounded' });
  assert.equal(cleanTheme({ font: 'comic-sans' }), undefined);
  assert.equal(themeStyle({ font: 'standard' })['--tv-font'], undefined);
  assert.match(themeStyle({ font: 'rounded' })['--tv-font'], /Fredoka/);
});
