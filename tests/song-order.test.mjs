import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDenseSongOrder,
  moveItemById,
  sortSongs,
} from '../lib/services/song-order.ts';

const songs = [
  { id: 'third', created_at: '2026-01-03T00:00:00Z', display_order: 2 },
  { id: 'first', created_at: '2026-01-01T00:00:00Z', display_order: 0 },
  { id: 'second', created_at: '2026-01-02T00:00:00Z', display_order: 1 },
];

test('sortSongs uses display order before timestamps', () => {
  assert.deepEqual(
    sortSongs(songs).map(song => song.id),
    ['first', 'second', 'third']
  );
});

test('sortSongs falls back to created_at and id for older rows', () => {
  assert.deepEqual(
    sortSongs([
      { id: 'b', created_at: '2026-01-01T00:00:00Z' },
      { id: 'a', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c', created_at: '2026-01-02T00:00:00Z' },
    ]).map(song => song.id),
    ['a', 'b', 'c']
  );
});

test('moveItemById moves one position and respects list boundaries', () => {
  const orderedSongs = sortSongs(songs);
  assert.deepEqual(
    moveItemById(orderedSongs, 'third', -1).map(song => song.id),
    ['first', 'third', 'second']
  );
  assert.deepEqual(
    moveItemById(orderedSongs, 'third', 1).map(song => song.id),
    ['first', 'second', 'third']
  );
});

test('applyDenseSongOrder produces dense optimistic positions', () => {
  const reordered = applyDenseSongOrder(songs, ['third', 'first', 'second']);
  assert.deepEqual(
    reordered.map(song => [song.id, song.display_order]),
    [['third', 0], ['first', 1], ['second', 2]]
  );
});
