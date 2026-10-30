import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SIZE, tile, key, slide, initial, spawn, spawnOptions, activeBases,
  blocker, warning, isBlocker, isWarning, isObstacle,
  blockerStrength, blockerHitsForMove, adjacentIndices,
  isBankable, canMove, bankReplacement, turnSpawns,
  BLOCKER_HITS, MAX_BLOCKER_HITS, BLOCKER_START,
  BLOCKER_INTERVAL, MAX_BLOCKERS, EXTRA_SPAWN_START, EXTRA_SPAWN_INTERVAL
} from "./engine.mjs";

const blank = () => Array(SIZE * SIZE).fill(null);
function boardWith(...entries) {
  const board = blank();
  for (const [index, value] of entries) board[index] = value;
  return board;
}
const countNumbers = board => board.filter(t => t && !isObstacle(t)).length;
const countBlockers = board => board.filter(isBlocker).length;
const countWarnings = board => board.filter(isWarning).length;

// A blocker is NOT a number: it cannot merge, move, be banked,
// become a power-spawn candidate, or cross row/column boundaries.
assert.deepEqual(blocker(), { kind: "blocker", hits: 0, strength: 3 });
assert.deepEqual(blocker(0, 1), { kind: "blocker", hits: 0, strength: 1 });
assert.deepEqual(warning(2), { kind: "warning", strength: 2 });
assert.equal(isWarning(warning(2)), true);
assert.equal(isObstacle(warning(2)), true);
assert.equal(isBlocker(warning(2)), false);
assert.equal(key(warning(2)), "warning:2");
assert.equal(isBankable(warning(2), new Set(), 0), false);
assert.throws(() => bankReplacement(warning(2), new Set()), RangeError);
assert.equal(blockerStrength(blocker(2, 5)), 5);
assert.equal(blockerStrength({ kind: "blocker", hits: 2 }), 3,
  "legacy save without strength retains three-hit durability");
assert.equal(isBlocker(blocker()), true);
assert.equal(isBlocker(tile(3)), false);
assert.equal(key(blocker(2)), "blocker:3:2");
assert.equal(key(blocker(2, 5)), "blocker:5:2");
assert.equal(isBankable(blocker(), new Set(), 2), false);
assert.throws(() => bankReplacement(blocker(), new Set()), RangeError);
assert.deepEqual(adjacentIndices(0), [4, 1]);
assert.deepEqual(adjacentIndices(5), [1, 9, 4, 6]);
assert.equal(adjacentIndices(0).includes(5), false, "diagonals never count");
assert.equal(BLOCKER_HITS, 3, "existing saves keep their original durability");
assert.equal(MAX_BLOCKER_HITS, 5);

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

// A beginner blocker breaks from one adjacent merge. A tier-five
// blocker takes five, with its own damage state preserved after each move.
for (const [strength, damage, expected] of [
  [1, 0, null],
  [2, 0, blocker(1, 2)],
  [2, 1, null],
  [5, 0, blocker(1, 5)],
  [5, 3, blocker(4, 5)],
  [5, 4, null]
]) {
  board = boardWith([1, blocker(damage, strength)], [2, tile(2)], [3, tile(2)]);
  result = slide(board, "left");
  assert.deepEqual(result.board[1], expected,
    "blocker tier " + strength + " with " + damage + " prior hits");
}
const oldSave = { kind: "blocker", hits: 2 };
result = slide(boardWith([1, oldSave], [2, tile(3)], [3, tile(3)]), "left");
assert.equal(result.board[1], null, "legacy 3-hit blocker can still be destroyed");
assert.deepEqual(oldSave, { kind: "blocker", hits: 2 },
  "do not mutate blocker saved state");

// A merge in a diagonally adjacent square does not damage the blocker.
board = boardWith([0, blocker()], [1, tile(3)], [5, tile(2)], [9, tile(2)]);
result = slide(board, "up");
assert.deepEqual(result.board[5], tile(2, 2));
assert.deepEqual(result.board[0], blocker());
assert.deepEqual(result.damaged, []);

// Existing values and banked status do not change the blocker.
assert.deepEqual(spawn(boardWith([0, blocker()]), new Set(), () => 0)[0], blocker());

// A blocker is always previewed one move in advance. A preview is a
// reserved barrier; it cannot be banked, moved through, or damaged.
board = boardWith([0, tile(2)], [1, warning(1)], [2, tile(3)], [3, tile(3)]);
result = slide(board, "left");
assert.deepEqual(result.board[1], warning(1));
assert.deepEqual(result.board[2], tile(3, 2));
assert.deepEqual(result.damaged, [], "the preview does not take merge damage");
assert.deepEqual(result.destroyed, []);
assert.equal(result.motions.some(m => m.from === 1), false);
assert.deepEqual(board[1], warning(1), "the preview is not mutated");

// A new blocker is previewed at 9, 19, 29, ..., then matures after the
// 10th, 20th, 30th, ... successful slides. Durability caps at five.
assert.equal(EXTRA_SPAWN_START, 40);
assert.equal(EXTRA_SPAWN_INTERVAL, 10);
assert.equal(BLOCKER_START, 10);
assert.equal(BLOCKER_INTERVAL, 10);
assert.equal(MAX_BLOCKERS, 2);
for (const [moves, expected] of [
  [0, 0], [9, 0], [10, 1], [19, 1], [20, 2],
  [29, 2], [30, 3], [39, 3], [40, 4], [49, 4],
  [50, 5], [60, 5], [1000, 5]
]) {
  assert.equal(blockerHitsForMove(moves), expected,
    "tier at successful slide " + moves);
}

// Existing extra-tile cadence is unchanged, including move 40.
for (const [moves, expected] of [
  [0, 1], [9, 1], [39, 1], [40, 2], [41, 1],
  [49, 1], [50, 2], [60, 2], [70, 2]
]) {
  const turn = turnSpawns(blank(), new Set(), moves, () => 0);
  assert.equal(turn.spawned.length, expected, "number spawns at slide " + moves);
  assert.equal(countNumbers(turn.board), expected);
  assert.equal(turn.extraSpawned, expected === 2);
  assert.equal(countWarnings(turn.board), 0,
    "an empty board cannot forecast a blocker without neighbouring numbers");
}

// The exact predicted position is preserved between two turns. All
// blockers require a prior warning; no surprise blocker appears at move 10.
for (const [milestone, strength] of [
  [10, 1], [20, 2], [30, 3], [40, 4],
  [50, 5], [60, 5], [80, 5]
]) {
  const current = boardWith([0, tile(2)]);
  const before = turnSpawns(current, new Set(), milestone - 1, () => 0);
  assert.equal(before.blockerAt, -1);
  assert.equal(before.warningAt, 1,
    "warning appears one successful slide before move " + milestone);
  assert.deepEqual(before.board[1], warning(strength));
  assert.equal(countWarnings(before.board), 1);
  const after = turnSpawns(before.board, new Set(), milestone, () => 0);
  assert.equal(after.warningAt, -1);
  assert.equal(after.blockerAt, before.warningAt,
    "blocker appears in the exact marked square");
  assert.deepEqual(after.board[1], blocker(0, strength));
  assert.equal(countWarnings(after.board), 0);
  assert.equal(countBlockers(after.board), 1);
  assert.equal(after.spawned.length, milestone >= 40 ? 2 : 1,
    "extra numbers continue to spawn on blocker milestones");
}
let turn = turnSpawns(boardWith([0, tile(2)]), new Set(), 10, () => 0);
assert.equal(turn.blockerAt, -1, "no blocker appears without a forecast");
turn = turnSpawns(boardWith([0, tile(2)]), new Set(), 11, () => 0);
assert.equal(turn.warningAt, -1);

// Two blockers may coexist but are never placed next to one another.
// The cap includes reserved warnings, so a third cannot be forecast.
const firstBlocker = boardWith([0, tile(2)], [1, blocker(0, 1)],
  [8, tile(3)]);
const previewSecond = turnSpawns(firstBlocker, new Set(), 19, () => 0);
assert.equal(previewSecond.warningAt, 4);
assert.deepEqual(previewSecond.board[4], warning(2));
assert.equal(adjacentIndices(4).includes(1), false,
  "avoid adjacent blocker placements");
turn = turnSpawns(previewSecond.board, new Set(), 20, () => 0);
assert.equal(turn.blockerAt, 4);
assert.deepEqual(turn.board[4], blocker(0, 2));
assert.equal(countBlockers(turn.board), 2);
turn = turnSpawns(boardWith([0, tile(2)], [1, blocker(0, 1)],
  [4, blocker(0, 2)]), new Set(), 29, () => 0);
assert.equal(turn.warningAt, -1, "do not forecast a third blocker");
assert.equal(countBlockers(turn.board), 2);

// When there is only one vacancy at the warning milestone, reserve it
// rather than let an ordinary number spawn crowd the blocker out.
const almostFull = Array(16).fill(tile(2));
almostFull[15] = null;
turn = turnSpawns(almostFull, new Set(), 9, () => 0);
assert.equal(turn.warningAt, 15);
assert.equal(turn.spawned.length, 0);
assert.deepEqual(turn.board[15], warning(1));
const matured = turnSpawns(turn.board, new Set(), 10, () => 0);
assert.equal(matured.blockerAt, 15);
assert.deepEqual(matured.board[15], blocker(0, 1));

// The forecast is suppressed if occupying the square would leave no
// legal swipe. This prevents a pre-blocker warning causing an instant loss.
const nearStuck = boardWith([0, tile(2)], [1, tile(3)],
  [2, tile(5)], [3, tile(7)]);
const early = turnSpawns(nearStuck, new Set(), 9, () => 0);
if (early.warningAt >= 0) {
  assert.ok(["left", "right", "up", "down"]
    .some(dir => slide(early.board, dir).changed),
    "forecast must leave at least one legal swipe");
}

// Skip extra tiles and blockers when space is insufficient; never overwrite.
board = Array(16).fill(tile(2));
board[15] = null;
turn = turnSpawns(board, new Set(), 40, () => 0);
assert.equal(turn.spawned.length, 1);
assert.equal(turn.extraSpawned, false);
assert.equal(countNumbers(turn.board), 16);
turn = turnSpawns(Array(16).fill(tile(2)), new Set(), 20, () => 0);
assert.equal(turn.blockerAt, -1);
assert.equal(countBlockers(turn.board), 0);

// A square freed by a destroyed blocker is excluded from number spawns
// and from the preview on that same slide.
turn = turnSpawns(boardWith([0, tile(2)]), new Set(), 19, () => 0, new Set([1]));
assert.equal(turn.board[0].base, 2);
assert.ok(!turn.spawned.includes(1));
assert.equal(turn.board[1], null);
assert.notEqual(turn.warningAt, 1);
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
assert.match(readFileSync("styles.css", "utf8"), /\.warning-tile\b/);

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
  assert.ok(countBlockers(board) + countWarnings(board) <= MAX_BLOCKERS);
  for (const t of board) {
    if (!t) continue;
    if (isBlocker(t)) {
      assert.ok(t.hits >= 0 && t.hits < blockerStrength(t));
      assert.ok(blockerStrength(t) <= MAX_BLOCKER_HITS);
    } else if (isWarning(t)) {
      assert.ok(blockerStrength(t) >= 1 && blockerStrength(t) <= MAX_BLOCKER_HITS);
    } else {
      assert.ok(activeBases(moves).includes(t.base));
      assert.ok(Number.isSafeInteger(t.exp) && t.exp > 0);
    }
  }
}
console.log("All Index Shuffle hazard tests passed.");
