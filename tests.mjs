import assert from "node:assert/strict";
import {
  tile, key, slide, spawn, canMove, isBankable,
  bankReplacement, checkAnswer, answerFor, scoreFor, initial
} from "./engine.mjs";

const blank = () => Array(16).fill(null);
function put(...entries) {
  const board = blank();
  for (const [index, base, exp = 1] of entries) board[index] = tile(base, exp);
  return board;
}

// Two equal bases multiply into a square and yield two movements into one cell.
let board = put([0, 3], [1, 3]);
let result = slide(board, "left");
assert.deepEqual(result.board[0], tile(3, 2));
assert.equal(result.board[1], null);
assert.equal(result.merges.length, 1);
assert.deepEqual(result.motions.map(m => [m.from, m.to]), [[0, 0], [1, 0]]);
assert.deepEqual(board[0], tile(3), "sliding does not mutate the source board");

// Any two powers of the same base merge, adding exponents; no remerging.
board = put([0, 3, 2], [1, 3, 3], [2, 3, 1]);
result = slide(board, "left");
assert.deepEqual(result.board[0], tile(3, 5));
assert.deepEqual(result.board[1], tile(3, 1));
assert.equal(result.merges.length, 1, "merged tiles cannot merge twice in one swipe");
assert.deepEqual(result.motions.map(m => [m.from, m.to]), [[0, 0], [1, 0], [2, 1]]);

// Non-adjacent equal bases cannot jump over a different base.
board = put([0, 2], [1, 3], [2, 2]);
result = slide(board, "left");
assert.deepEqual(result.board.slice(0, 3), [tile(2), tile(3), tile(2)]);

// Vertical, rightward and stationary cases must work as expected.
board = put([0, 2], [4, 2]);
result = slide(board, "up");
assert.equal(result.changed, true);
assert.deepEqual(result.board[0], tile(2, 2));
assert.equal(result.board[4], null);
assert.deepEqual(result.motions.map(m => m.to), [0, 0]);
result = slide(board, "down");
assert.equal(result.changed, true);
assert.deepEqual(result.board[12], tile(2, 2));
assert.equal(result.board[0], null);
assert.deepEqual(result.motions.map(m => m.to), [12, 12]);
result = slide(put([0, 2]), "up");
assert.equal(result.changed, false);
assert.deepEqual(result.motions, [{ from: 0, to: 0, merged: false }]);
assert.throws(() => slide(board, "diagonal"), RangeError);

board = put([0, 3], [1, 3], [2, 3], [3, 3]);
result = slide(board, "left");
assert.deepEqual(result.board.slice(0, 4), [tile(3, 2), tile(3, 2), null, null],
  "four equal tiles become two, not one");
result = slide(board, "right");
assert.deepEqual(result.board.slice(0, 4), [null, null, tile(3, 2), tile(3, 2)]);

// Only discovered higher powers may spawn.
const discovered = new Set(["3-2"]);
board = put([0, 5]);
let spawned = spawn(board, discovered, () => 0.99);
assert.equal(spawned.filter(Boolean).length, 2);
assert.deepEqual(spawned[15], tile(3, 2));
assert.deepEqual(spawned[0], tile(5));
spawned = spawn(board, discovered, () => 0);
assert.deepEqual(spawned[1], tile(2));
spawned = spawn(board, new Set(), () => 0.99);
assert.equal(spawned[15].exp, 1, "a power must be discovered before it can spawn");
assert.equal(initial(() => 0).filter(Boolean).length, 3);

// Banking must retain the same base, use only a previously unlocked LOWER
// exponent, and always have the ordinary base as a fallback.
const unlocked = new Set(["5-2", "5-3", "5-7", "3-6"]);
assert.deepEqual(bankReplacement(tile(5, 7), unlocked, () => 0), tile(5));
assert.deepEqual(bankReplacement(tile(5, 7), unlocked, () => 0.34), tile(5, 2));
assert.deepEqual(bankReplacement(tile(5, 7), unlocked, () => 0.99), tile(5, 3));
assert.deepEqual(bankReplacement(tile(5, 3), unlocked, () => 0.99), tile(5, 2));
assert.deepEqual(bankReplacement(tile(2, 2), unlocked, () => 0.99), tile(2));
assert.throws(() => bankReplacement(tile(5), unlocked), RangeError);
assert.deepEqual(bankReplacement(tile(5, 7), new Set(["5-9", "3-2"]), () => 0.99), tile(5));

// One incorrect attempt locks ONLY that board position. A successful slide
// clears the lock array and makes that tile bankable again.
board = put([0, 3, 2], [1, 3, 2]);
let banked = new Set();
let locked = new Set([0]);
assert.equal(isBankable(board[0], banked, 0, locked), false);
assert.equal(isBankable(board[1], banked, 1, locked), true);
assert.equal(isBankable(board[0], banked, 0, new Set()), true);
assert.equal(isBankable(board[0], new Set(["3-2"]), 0, new Set()), false);

// A full, checkerboard-pattern board has no merge opportunities.
const full = Array.from({ length: 16 }, (_, i) =>
  tile([2, 3, 5][(i + Math.floor(i / 4)) % 3], 2));
assert.equal(canMove(full, new Set(["2-2", "3-2", "5-2"])), false);
assert.equal(canMove(full, new Set()), true, "eligible banking prevents game over");
const locked2 = new Set(full.flatMap((t, i) => t.base === 2 ? [i] : []));
assert.equal(canMove(full, new Set(["3-2", "5-2"]), locked2), false,
  "a full board with only temporarily locked bankable tiles ends the game");
assert.equal(canMove(full, new Set(["3-2", "5-2"]), new Set()), true);
assert.equal(canMove(put([0, 3], [1, 3]), new Set()), true);
assert.equal(canMove(Array(16).fill(tile(2, 2)), new Set(["2-2"])), true,
  "merge possibilities still prevent game over");

// Banking questions and scoring use exact integer maths.
assert.equal(checkAnswer(tile(3, 4), "81"), true);
assert.equal(checkAnswer(tile(3, 4), " 81 "), true);
assert.equal(checkAnswer(tile(3, 4), "80"), false);
assert.equal(checkAnswer(tile(3, 4), "81.0"), false);
assert.equal(answerFor(tile(5, 8)), 390625n);
assert.ok(scoreFor(tile(3, 4)) > scoreFor(tile(3, 2)));
assert.equal(key(tile(3, 4)), "3-4");

console.log("All Index Shuffle engine tests passed.");
