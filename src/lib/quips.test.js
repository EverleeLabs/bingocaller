import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLine, falseBingoLines, quipBanks, speechMs, cleanBanks, DEFAULT_FALSE_BINGO, DEFAULT_BANKS } from './quips.js';

test('no replies until the event switches them on', () => {
  assert.deepEqual(falseBingoLines({}), []);
  assert.deepEqual(quipBanks({ quipBanks: [{ id: 'b', name: 'B', lines: ['Hush'] }] }), []);
});

test('built-in replies are used until the event changes them', () => {
  const on = { cheekyReplies: true };
  assert.deepEqual(falseBingoLines(on), DEFAULT_FALSE_BINGO);
  assert.deepEqual(falseBingoLines({ ...on, falseBingoReplies: ['  Nope. ', '', '   '] }), ['Nope.']);
  assert.deepEqual(falseBingoLines({ ...on, falseBingoReplies: [] }), []);
  assert.equal(quipBanks(on).length, DEFAULT_BANKS.length);
});

test('empty banks are left out', () => {
  const banks = quipBanks({ cheekyReplies: true, quipBanks: [{ id: 'a', name: 'A', lines: ['', ' '] }, { id: 'b', name: 'B', lines: ['Hush'] }] });
  assert.deepEqual(banks, [{ id: 'b', name: 'B', lines: ['Hush'] }]);
});

test('a line is not repeated soon after it was said', () => {
  const lines = ['a', 'b', 'c', 'd', 'e'];
  const recent = [];
  for (let i = 0; i < 50; i++) {
    const before = recent.slice(-3);
    const line = pickLine(lines, recent);
    assert.ok(!before.includes(line), `${line} was said in the last 3`);
  }
});

test('two lines alternate, one line repeats', () => {
  const recent = [];
  const first = pickLine(['x', 'y'], recent, () => 0);
  assert.notEqual(pickLine(['x', 'y'], recent, () => 0), first);
  assert.equal(pickLine(['only'], [], () => 0.9), 'only');
  assert.equal(pickLine(['only'], ['only']), 'only');
  assert.equal(pickLine([]), null);
});

test('speech time grows with length and shrinks with speed', () => {
  assert.ok(speechMs('one two three four five six') > speechMs('one'));
  assert.ok(speechMs('one two three', 2) < speechMs('one two three', 1));
});

test('banks from a file are cleaned', () => {
  assert.equal(cleanBanks('nope'), undefined);
  assert.deepEqual(cleanBanks([{ id: '!!', name: 5, lines: ['ok', 7] }, null]), [{ id: 'bank-0', name: 'Replies', lines: ['ok'] }]);
});
