import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callWords, callParts } from './voice.js';

test('call wording', () => {
  assert.equal(callWords(7, { repeat: false, digits: true }), 'B, 7.');
  assert.equal(callWords(52, { repeat: false, digits: true }), 'G, 52. five, two.');
  assert.equal(callWords(52, { repeat: true, digits: false }), 'G, 52. ... G, 52.');
});

test('digits are a separate part so they get a pause', () => {
  assert.deepEqual(callParts(7, { repeat: true, digits: true }), ['B, 7. ... B, 7.']);
  assert.deepEqual(callParts(52, { repeat: false, digits: true }), ['G, 52.', 'five, two.']);
  assert.deepEqual(callParts(52, { repeat: true, digits: true }), ['G, 52.', 'five, two. ... G, 52.']);
});
