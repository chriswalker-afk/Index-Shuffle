import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SIZE, tile, key, slide, initial, spawn, spawnOptions, activeBases,
  blocker, isBlocker, adjacentIndices, isBankable, canMove,
  bankReplacement, turnSpawns, BLOCKER_HITS, BLOCKER_START,
  BLOCKER_INTERVAL, MAX_BLOCKERS, EXTRA_SPAWN_START, EXTRA_SPAWN_INTERVAL
} from "./engine.mjs";

const blank = () => Array(SIZE * SIZE).fill(null);
function boardWith(...entries) {
  const board = blank();
  for (const [index, value] of entries) board[index] = value;
  return board;
}
const countNumbers = board => board.filter(t => t && !isBlocker(t)).length;
const countBlockers = board => board.filter(isBlocker).length;

// A blocker is NOT a number: it cannot merge, move, be banked,
// become a power-spawn candidate, or cross row/column boundaries.
assert.deepEqual(blocker(), { kind: "blocker", hits: 0 });
assert.equal(isBlocker(blocker()), true);
assert.equal(isBlocker(tile(3)), false);
assert.equal(key(blocker(2)), "blocker:2");
assert.equal(isBankable(blocker(), new Set(), 2), false);
assert.throws(() => bankReplacement(blocker(), new Set()), RangeError);
assert.deepEqual(adjacentIndices(0), [4, 1]);
assert.deepEqual(adjacentIndices(5), [1, 9, 4, 6]);
assert.equal(adjacentIndices(0).includes(5), false, "diagonals never count");
assert.equal(BLOCKER_HITS, 3);

let board = boardWith([0, tile(2)], [1, blocker()], [2, tile(3)], [3, tile(3)]);
let result = slide(board, "left");
assert.deepEqual(result.board[0], tile(2));
assert.deepEqual(result.board[1], blocker(1), "merge at 2 damages blocker at 1");
assert.deepEqual(result.board[2], tile(3, 2));
assert.equal(result.board[3], null);
assert.deepEqual(result.mergeDestinations, [2]);
assert.deepEqual(result.damaged, [1]);
assert.deepEqual(result.destroyed, []);
assert.equal(result.motions.some(m => m.from === 1), false, "no blocker ghost movement");
assert.deepEqual(board[1], blocker(), "input board is not mutated");

// Different slides may move tiles within each isolated segment, but
// numbers can never pass through the blocker.
result = slide(boardWith([0, tile(2)], [1, blocker()], [3, tile(5)]), "left");
assert.deepEqual(result.board[0], tile(2));
assert.deepEqual(result.board[1], blocker());
assert.deepEqual(result.board[2], tile(5));
assert.equal(result.board[3], null);
assert.deepEqual(result.damaged, [], "sliding beside a blocker causes no damage");
result = slide(boardWith([0, tile(2)], [1, blocker()], [3, tile(5)]), "right");
assert.deepEqual(result.board[0], tile(2));
assert.deepEqual(result.board[1], blocker());
assert.deepEqual(result.board[3], tile(5));

// The damage counter persists across separate slides and the 3rd
// adjacent merge destroys the blocker, leaving a free square.
for (const [hits, expected] of [[0, 1], [1, 2], [2, null]]) {
  board = boardWith([1, blocker(hits)], [2, tile(2)], [3, tile(2)]);
  result = slide(board, "left");
  assert.deepEqual(result.board[1], expected === null ? null : blocker(expected));
  assert.deepEqual(result.board[2], tile(2, 2));
  assert.deepEqual(result.destroyed, expected === null ? [1] : []);
  assert.deepEqual(result.damaged, expected === null ? [] : [1]);
}

// A merge in a diagonally adjacent square does not damage the blocker.
board = boardWith([0, blocker()], [1, tile(3)], [5, tile(2)], [9, tile(2)]);
result = slide(board, "up");
assert.deepEqual(result.board[5], tile(2, 2));
assert.deepEqual(result.board[0], blocker());
assert.deepEqual(result.damaged, []);

// Existing values and banked status do not change the blocker.
assert.deepEqual(spawn(boardWith([0, blocker()]), new Set(), () => 0)[0], blocker());

// Check exact extra-spawn thresholds and one-blocker cap.
assert.equal(EXTRA_SPAWN_START, 40);
assert.equal(EXTRA_SPAWN_INTERVAL, 10);
assert.equal(BLOCKER_START, 55);
assert.equal(BLOCKER_INTERVAL, 30);
assert.equal(MAX_BLOCKERS, 1);
for (const [moves, expected] of [[0, 1], [39, 1], [40, 2],
  [41, 1], [49, 1], [50, 2], [60, 2], [70, 2]]) {
  const result = turnSpawns(blank(), new Set(), moves, () => 0);
  assert.equal(result.spawned.length, expected, "spawn count at slide " + moves);
  assert.equal(countNumbers(result.board), expected);
  assert.equal(result.extraSpawned, expected === 2);
  assert.equal(countBlockers(result.board), 0);
}
let turn = turnSpawns(blank(), new Set(), 54, () => 0);
assert.equal(turn.blockerAt, -1);
turn = turnSpawns(blank(), new Set(), 55, () => 0);
assert.equal(turn.spawned.length, 1);
assert.equal(turn.blockerAt, 1);
assert.equal(countBlockers(turn.board), 1);
assert.deepEqual(turn.board[1], blocker());
turn = turnSpawns(blank(), new Set(), 56, () => 0);
assert.equal(turn.blockerAt, -1);
turn = turnSpawns(blank(), new Set(), 85, () => 0);
assert.equal(turn.blockerAt, 1);
turn = turnSpawns(boardWith([1, blocker(2)]), new Set(), 85, () => 0);
assert.equal(turn.blockerAt, -1, "a second blocker never spawns while one remains");
assert.equal(countBlockers(turn.board), 1);

// Skip extra tiles and blockers when space is insufficient; never overwrite.
board = Array(16).fill(tile(2));
board[15] = null;
turn = turnSpawns(board, new Set(), 40, () => 0);
assert.equal(turn.spawned.length, 1);
assert.equal(turn.extraSpawned, false);
assert.equal(countNumbers(turn.board), 16);
turn = turnSpawns(board, new Set(), 55, () => 0);
assert.equal(turn.blockerAt, -1);
assert.equal(countBlockers(turn.board), 0);

// The square freed by a destroyed blocker must stay empty for that swipe,
// even if new tiles are scheduled or a blocker is due.
turn = turnSpawns(blank(), new Set(), 55, () => 0, new Set([0]));
assert.equal(turn.board[0], null);
assert.ok(!turn.spawned.includes(0));
assert.notEqual(turn.blockerAt, 0);
turn = turnSpawns(blank(), new Set(), 40, () => 0, new Set([0, 1]));
assert.equal(turn.board[0], null);
assert.equal(turn.board[1], null);

// Previously discovered powers keep spawning; blockers cannot appear
// in the discovered powers pool.
assert.equal(spawnOptions(new Set(["3-2", "blocker:0"]), 40)
  .some(option => isBlocker(option.t)), false);
assert.deepEqual(activeBases(60), [2, 3, 5, 7, 11, 13]);

// Board with a completely isolated empty square is game-over if there
// are no banking options. The old "any empty square means can move"
// shortcut would make this a permanent, impossible-to-finish game.
board = Array.from({ length: 16 }, (_, i) =>
  tile([2, 3, 5, 7][(Math.floor(i / 4) + i % 4) % 4]));
board[5] = null;
for (const index of [1, 4, 6, 9]) board[index] = blocker();
assert.equal(canMove(board, new Set()), false,
  "blockers can isolate an empty cell with no legal move");
assert.equal(slide(board, "up").changed, false);
assert.equal(slide(board, "down").changed, false);
assert.equal(slide(board, "left").changed, false);
assert.equal(slide(board, "right").changed, false);

// A bankable number still prevents game over if it is accessible.
// Blockers have no banking state.
board = boardWith([0, blocker()], [1, tile(3, 2)]);
assert.equal(isBankable(board[1], new Set(), 1), true);
assert.equal(isBankable(board[0], new Set(), 0), false);

// Core DOM IDs must exist before app.mjs tries to update them.
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
for (const match of app.matchAll(/\$\("([a-zA-Z0-9]+)"\)/g)) {
  assert.match(html, new RegExp('id="' + match[1] + '"'), match[1] + " must exist in HTML");
}
assert.match(html, /id="blockerCount"/);
assert.match(readFileSync("styles.css", "utf8"), /\.block-tile\b/);

// A deterministic sequence of successful slides must preserve shape and
// limit blocker count; no tile is duplicated or lost across segments.
let seed = 93721;
const rng = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
board = initial(rng);
const discovered = new Set();
let moves = 0;
for (let i = 0; i < 300; i++) {
  const directions = ["left", "up", "right", "down"];
  const candidates = directions.map(dir => slide(board, dir)).filter(r => r.changed);
  if (!candidates.length) break;
  const next = candidates[Math.floor(rng() * candidates.length)];
  for (const merged of next.merges) discovered.add(key(merged));
  moves++;
  const turn = turnSpawns(next.board, discovered, moves, rng, new Set(next.destroyed));
  board = turn.board;
  assert.equal(board.length, 16);
  assert.ok(countBlockers(board) <= 1);
  for (const t of board) {
    if (!t) continue;
    if (isBlocker(t)) assert.ok(t.hits >= 0 && t.hits < BLOCKER_HITS);
    else {
      assert.ok(activeBases(moves).includes(t.base));
      assert.ok(Number.isSafeInteger(t.exp) && t.exp > 0);
    }
  }
}
console.log("All Index Shuffle hazard tests passed.");
