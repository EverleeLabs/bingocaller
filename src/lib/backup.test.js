import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from './backup.js';

const file = (events, extra = {}) => JSON.stringify({ app: 'bingo-caller', version: 1, events, ...extra });

test('reads a valid export', () => {
  const { events } = parseBackup(file([{ id: 'abc', name: 'Friday', interval: 8, prizeMessage: 'Free dinner!', endMessage: 'See you next week!', items: [
    { id: 'g1', type: 'game', name: 'Game 1', patternIds: ['corners', 'col-picks'], colPick: { cols: [1, 3] }, callLimit: { enabled: true, count: 35, announceAt: [30, 20, 20, 99], message: 'At {called}!' } },
    { id: 'b1', type: 'break', name: 'Break', minutes: 15, message: 'Snacks' },
  ] }]));
  assert.equal(events[0].name, 'Friday');
  assert.equal(events[0].prizeMessage, 'Free dinner!');
  assert.equal(events[0].endMessage, 'See you next week!');
  assert.deepEqual(events[0].items[0].patternIds, ['corners', 'col-picks']);
  assert.deepEqual(events[0].items[0].colPick, { cols: [1, 3] });
  assert.equal(events[0].items[1].minutes, 15);
  assert.deepEqual(events[0].items[0].callLimit, { enabled: true, count: 35, announceAt: [20, 30], message: 'At {called}!' });
});

test('rejects files that are not exports', () => {
  assert.throws(() => parseBackup('not json'), /can't be read/);
  assert.throws(() => parseBackup('{"hello":1}'), /isn't a bingo caller export/);
  assert.throws(() => parseBackup(file([], { version: 99 })), /newer version/);
  assert.throws(() => parseBackup(file([{ name: 'no items' }])), /No events/);
});

test('cleans bad values and old single-pattern games', () => {
  const { events, skipped } = parseBackup(file([
    { id: 'x', name: 'Ok', interval: 999, items: [{ type: 'game', patternId: 'stamp', custom: [[1, 2, 99, -1]] }, { type: 'weird' }] },
    'garbage',
  ]));
  assert.equal(skipped, 1);
  assert.equal(events[0].interval, 60);
  assert.deepEqual(events[0].items.length, 1);
  assert.deepEqual(events[0].items[0].patternIds, ['stamp']);
  assert.deepEqual(events[0].items[0].custom, [[1, 2]]);
});
