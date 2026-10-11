import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callWords } from './voice.js';

test('call wording', () => {
  assert.equal(callWords(7, { repeat: false, digits: true }), 'B, 7.');
  assert.equal(callWords(52, { repeat: false, digits: true }), 'G, 52. five, two.');
  assert.equal(callWords(52, { repeat: true, digits: false }), 'G, 52. ... G, 52.');
});
