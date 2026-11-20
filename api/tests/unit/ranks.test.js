import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeRanks } from '../../src/lib/ranks.js';

describe('computeRanks', () => {
  it('classe des joueurs aux scores tous différents', () => {
    const result = computeRanks([
      { user: 'a', score: 10 },
      { user: 'b', score: 30 },
      { user: 'c', score: 20 }
    ]);

    assert.deepEqual(result, [
      { user: 'a', score: 10, rank: 3 },
      { user: 'b', score: 30, rank: 1 },
      { user: 'c', score: 20, rank: 2 }
    ]);
  });

  it('donne le même rang à deux joueurs à égalité', () => {
    const result = computeRanks([
      { user: 'a', score: 50 },
      { user: 'b', score: 50 },
      { user: 'c', score: 30 }
    ]);

    assert.deepEqual(result, [
      { user: 'a', score: 50, rank: 1 },
      { user: 'b', score: 50, rank: 1 },
      { user: 'c', score: 30, rank: 3 }
    ]);
  });

  it('classe un joueur seul premier', () => {
    const result = computeRanks([{ user: 'a', score: 0 }]);

    assert.deepEqual(result, [{ user: 'a', score: 0, rank: 1 }]);
  });
});