import assert from "node:assert/strict";
import {
  tile, key, slide, spawn, canMove, isBankable,
  bankReplacement, checkAnswer, answerFor, scoreFor, initial,
  BASES, BASE_UNLOCKS, activeBases, spawnOptions,
  INITIAL_MOVES_LEFT, MERGES_PER_BONUS_MOVE, spendMove, slideCost,
  blocker, warning, gameEnded
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


// The progressive unlock schedule is finite and depends only on successful slides.
assert.deepEqual(BASES, [2, 3, 5, 7, 11, 13]);
assert.deepEqual(BASE_UNLOCKS.map(x => [x.base, x.moves]), [[7, 15], [11, 35], [13, 60]]);
for (const [moves, expected] of [
  [0, [2, 3, 5]],
  [14, [2, 3, 5]],
  [15, [2, 3, 5, 7]],
  [34, [2, 3, 5, 7]],
  [35, [2, 3, 5, 7, 11]],
  [59, [2, 3, 5, 7, 11]],
  [60, [2, 3, 5, 7, 11, 13]],
  [1000, [2, 3, 5, 7, 11, 13]]
]) {
  assert.deepEqual(activeBases(moves), expected, "bases available at move " + moves);
  assert.deepEqual(
    spawnOptions(new Set(), moves).map(option => option.t.base),
    expected,
    "only active simple bases can spawn at move " + moves
  );
}

// A new base begins rare, increases gradually over twelve valid slides,
// and eventually matches the earlier bases' per-base weight.
function chanceFor(base, moves) {
  return spawnOptions(new Set(), moves)
    .find(option => option.t.base === base && option.t.exp === 1)?.w || 0;
}
assert.equal(chanceFor(7, 14), 0);
assert.ok(chanceFor(7, 15) > 0);
assert.ok(chanceFor(7, 15) < chanceFor(7, 20));
assert.ok(chanceFor(7, 20) < chanceFor(7, 27));
assert.ok(Math.abs(chanceFor(7, 27) - chanceFor(2, 27)) < 1e-9);
assert.equal(chanceFor(11, 34), 0);
assert.ok(chanceFor(11, 35) < chanceFor(11, 42));
assert.ok(Math.abs(chanceFor(11, 47) - chanceFor(2, 47)) < 1e-9);
assert.equal(chanceFor(13, 59), 0);
assert.ok(chanceFor(13, 60) < chanceFor(13, 67));
assert.ok(Math.abs(chanceFor(13, 72) - chanceFor(2, 72)) < 1e-9);

// With no higher powers discovered, a near-1 RNG picks the final allowed
// base, proving the spawn selection honours each milestone.
for (const [moves, base] of [[14, 5], [15, 7], [34, 7],
  [35, 11], [59, 11], [60, 13], [100, 13]]) {
  const spawnedBase = spawn(blank(), new Set(), () => 0.9999, moves).find(Boolean);
  assert.deepEqual(spawnedBase, tile(base), "last allowed base at move " + moves);
}
assert.equal(spawnOptions(new Set(["13-2"]), 59).some(x => x.t.base === 13), false);
assert.equal(spawnOptions(new Set(["13-2"]), 60).some(x => x.t.base === 13 && x.t.exp === 2), true);

// Successful banking retains its square and temporarily locks its replacement,
// preventing an immediate second bank. A valid slide clears the lock.
const prior = tile(5, 7);
const bankedPowers = new Set(["5-7"]);
const lower = bankReplacement(prior, new Set(["5-2", "5-3", "5-7"]), () => 0.99);
assert.deepEqual(lower, tile(5, 3));
assert.equal(isBankable(lower, bankedPowers, 4, new Set([4])), false);
assert.equal(isBankable(lower, bankedPowers, 4, new Set()), true);
assert.equal(isBankable(tile(5, 7), bankedPowers, 4, new Set()), false,
  "a previously banked power remains ineligible after cooldown");
assert.equal(isBankable(tile(3, 2), bankedPowers, 8, new Set([4])), true,
  "banking another tile is still allowed while a replacement is locked");


// MOVES LEFT is distinct from the cumulative successful-slide count.
// One successful slide costs one; every two merges refund one. The
// credit persists when the pair is made on separate slides.
assert.equal(INITIAL_MOVES_LEFT, 10);
assert.equal(MERGES_PER_BONUS_MOVE, 2);
assert.deepEqual(spendMove(10, 0, 0),
  { movesLeft: 9, mergeCredit: 0, earned: 0 });
assert.deepEqual(spendMove(10, 0, 1),
  { movesLeft: 9, mergeCredit: 1, earned: 0 });
assert.deepEqual(spendMove(9, 1, 1),
  { movesLeft: 9, mergeCredit: 0, earned: 1 });
assert.deepEqual(spendMove(10, 0, 2),
  { movesLeft: 10, mergeCredit: 0, earned: 1 });
assert.deepEqual(spendMove(10, 0, 3),
  { movesLeft: 10, mergeCredit: 1, earned: 1 });
assert.deepEqual(spendMove(10, 1, 3),
  { movesLeft: 11, mergeCredit: 0, earned: 2 });
assert.deepEqual(spendMove(10, 0, 4),
  { movesLeft: 11, mergeCredit: 0, earned: 2 },
  "multiple earned moves in a single swipe are all credited");
assert.deepEqual(spendMove(1, 1, 1),
  { movesLeft: 1, mergeCredit: 0, earned: 1 },
  "reward on the last available slide prevents premature game over");
assert.deepEqual(spendMove(1, 0, 0),
  { movesLeft: 0, mergeCredit: 0, earned: 0 },
  "running out of moves is a terminal loss");
assert.deepEqual(spendMove(0, 1, 2),
  { movesLeft: 0, mergeCredit: 1, earned: 0 },
  "cannot start a new swipe or resurrect from an exhausted budget");
for (const badArgs of [[-1, 0, 0], [1, -1, 0], [1, 2, 0],
  [1, 0, -1], [1.5, 0, 1], [1, 0, 1.5]]) {
  assert.throws(() => spendMove(...badArgs), RangeError);
}

// A user can still have legal sliding and/or banking actions and lose
// immediately if the move budget reaches zero.
const bankableBoard = put([0, 3, 2], [1, 3, 2]);
assert.equal(gameEnded(bankableBoard, new Set(), new Set(), 0), true);
assert.equal(gameEnded(bankableBoard, new Set(), new Set(), 1), false);
assert.equal(gameEnded(full, new Set(["2-2", "3-2", "5-2"]),
  new Set(), 10), true, "old gridlock loss condition still works");

// Integration-level budget checks use actual merge totals from the
// sliding engine, not powers discovered or tiles shifted.
const twoMerges = put([0, 2], [1, 2], [2, 3], [3, 3]);
const slideWithTwo = slide(twoMerges, "left");
assert.equal(slideWithTwo.changed, true);
assert.equal(slideWithTwo.merges.length, 2);
assert.deepEqual(spendMove(1, 0, slideWithTwo.merges.length),
  { movesLeft: 1, mergeCredit: 0, earned: 1 });
const ordinarySlide = slide(put([1, 2]), "left");
assert.equal(ordinarySlide.changed, true);
assert.equal(ordinarySlide.merges.length, 0);
assert.deepEqual(spendMove(10, 0, ordinarySlide.merges.length),
  { movesLeft: 9, mergeCredit: 0, earned: 0 });
assert.equal(slide(put([0, 2]), "up").changed, false,
  "an unchanged swipe should be discarded before budget processing");

// Saved game fields can be represented as ordinary integer values.
const persisted = JSON.parse(JSON.stringify({
  moves: 31, movesLeft: 4, mergeCredit: 1
}));
assert.deepEqual(spendMove(persisted.movesLeft, persisted.mergeCredit, 1),
  { movesLeft: 4, mergeCredit: 0, earned: 1 });
assert.equal(persisted.moves, 31, "slide milestones are separate from the budget");


// Blocker surcharge is computed from ACTIVE blockers at the start of
// the slide. Warnings and newly spawned blockers are not charged yet.
const noBlockerBoard = put([0, 2], [1, 2]);
const oneBlockerBoard = noBlockerBoard.slice();
oneBlockerBoard[5] = blocker(0, 1);
const twoBlockerBoard = oneBlockerBoard.slice();
twoBlockerBoard[10] = blocker(0, 2);
const warningBoard = oneBlockerBoard.slice();
warningBoard[10] = warning(2);
assert.equal(slideCost(noBlockerBoard), 1);
assert.equal(slideCost(oneBlockerBoard), 2);
assert.equal(slideCost(twoBlockerBoard), 3);
assert.equal(slideCost(warningBoard), 2,
  "the warning only raises cost after it becomes a blocker");
assert.deepEqual(spendMove(10, 0, 0, 1),
  { movesLeft: 8, mergeCredit: 0, earned: 0 },
  "one active blocker costs 2 moves per successful slide");
assert.deepEqual(spendMove(10, 0, 0, 2),
  { movesLeft: 7, mergeCredit: 0, earned: 0 },
  "two active blockers cost 3 moves per successful slide");
assert.deepEqual(spendMove(10, 0, 2, 1),
  { movesLeft: 9, mergeCredit: 0, earned: 1 },
  "two merges restore one move after the blocker surcharge");
assert.deepEqual(spendMove(1, 1, 1, 1),
  { movesLeft: 0, mergeCredit: 0, earned: 1 },
  "one merge bonus does not fully offset a blocker surcharge");
assert.deepEqual(spendMove(2, 0, 4, 2),
  { movesLeft: 1, mergeCredit: 0, earned: 2 },
  "two pairs of merges offset two of three moves charged");
assert.deepEqual(spendMove(1, 0, 0, 2),
  { movesLeft: 0, mergeCredit: 0, earned: 0 },
  "balance is clamped to zero, not negative");
assert.deepEqual(spendMove(0, 1, 3, 2),
  { movesLeft: 0, mergeCredit: 1, earned: 0 },
  "a game already over cannot earn back moves");
assert.throws(() => spendMove(10, 0, 0, -1), RangeError);
assert.throws(() => spendMove(10, 0, 0, 0.5), RangeError);

// With a warning on the board, only active blockers present BEFORE the
// swipe are charged; a new tier does not retroactively increase cost.
let escalating = warningBoard.slice();
assert.equal(slideCost(escalating), 2);
escalating[10] = blocker(0, 2);
assert.equal(slideCost(escalating), 3);
assert.equal(gameEnded(noBlockerBoard, new Set(), new Set(), 0), true);

console.log("All Index Shuffle engine tests passed.");
