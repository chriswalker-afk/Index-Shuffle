import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SIZE, tile, key, slide, initial, spawn, spawnOptions, activeBases,
  blocker, warning, isBlocker, isWarning, isObstacle,
  blockerStrength, blockerHitsForMove, adjacentIndices, isBankable, canMove,
  bankReplacement, mergeReadyAfterSlide, attemptBank, turnSpawns,
  BLOCKER_HITS, MAX_BLOCKER_HITS, BLOCKER_START, BLOCKER_INTERVAL,
  MAX_BLOCKERS, EXTRA_SPAWN_START, EXTRA_SPAWN_INTERVAL
} from "./engine.mjs";

const blank = () => Array(SIZE * SIZE).fill(null);
function withTiles(...entries) {
  const board = blank();
  for (const [index, value] of entries) board[index] = value;
  return board;
}
const numbers = b => b.filter(t => t && !isObstacle(t)).length;
const blockers = b => b.filter(isBlocker).length;
const warnings = b => b.filter(isWarning).length;
const context = (mergeReady = []) => ({
  discovered: new Set(["2-2", "3-2", "5-2"]),
  banked: new Set(),
  locked: new Set(),
  mergeReady: new Set(mergeReady)
});

// The blocking/warning tile model and old saved three-hit blockers survive
// unchanged. They cannot be banked or slid through.
assert.deepEqual(blocker(), { kind: "blocker", hits: 0, strength: 3 });
assert.deepEqual(warning(2), { kind: "warning", strength: 2 });
assert.equal(isBlocker(blocker()), true);
assert.equal(isWarning(warning()), true);
assert.equal(isObstacle(warning()), true);
assert.equal(isBankable(blocker(), new Set(), 1), false);
assert.equal(isBankable(warning(), new Set(), 1), false);
assert.throws(() => bankReplacement(blocker(), new Set()), RangeError);
assert.throws(() => bankReplacement(warning(), new Set()), RangeError);
assert.equal(key(blocker(2, 5)), "blocker:5:2");
assert.equal(key(warning(2)), "warning:2");
assert.equal(BLOCKER_HITS, 3);
assert.equal(MAX_BLOCKER_HITS, 5);
assert.equal(blockerStrength({ kind: "blocker", hits: 2 }), 3);
assert.deepEqual(adjacentIndices(0), [4, 1]);
assert.deepEqual(adjacentIndices(5), [1, 9, 4, 6]);
assert.equal(adjacentIndices(5).includes(0), false);

// Merging BESIDE a blocker produces a bankable power, but does not
// damage the blocker. The correct banking answer performs the damage.
let board = withTiles([0, tile(2)], [1, blocker(0, 2)],
  [2, tile(3)], [3, tile(3)]);
let move = slide(board, "left");
assert.deepEqual(move.board[1], blocker(0, 2), "merging itself causes no hit");
assert.deepEqual(move.board[2], tile(3, 2));
assert.deepEqual(move.mergeDestinations, [2]);
assert.deepEqual(move.damaged, []);
assert.deepEqual(move.destroyed, []);
const readyAfterMerge = mergeReadyAfterSlide([], move.motions);
assert.deepEqual(readyAfterMerge, [2]);
assert.deepEqual(board[1], blocker(0, 2), "slide must not mutate its input");

let bank = attemptBank(move.board, 2, "8", context(readyAfterMerge), () => 0);
assert.equal(bank.status, "incorrect");
assert.deepEqual(move.board[1], blocker(0, 2), "wrong answer is harmless to blockers");
bank = attemptBank(move.board, 2, "9", context(readyAfterMerge), () => 0);
assert.equal(bank.status, "success");
assert.deepEqual(bank.damaged, [1]);
assert.deepEqual(bank.destroyed, []);
assert.deepEqual(bank.board[1], blocker(1, 2));
assert.deepEqual(bank.board[2], tile(3), "bank keeps a lower replacement");
assert.deepEqual(move.board[1], blocker(0, 2), "bank must not mutate input");
assert.equal(bank.points > 0, true);

// The second CORRECT bank destroys a two-hit blocker. A wrong answer,
// timed-out attempt (no banking call), or simply sliding cannot destroy it.
board = withTiles([1, blocker(1, 2)], [2, tile(3, 2)]);
bank = attemptBank(board, 2, "9", context([2]), () => 0);
assert.deepEqual(bank.destroyed, [1]);
assert.equal(bank.board[1], null);
assert.deepEqual(board[1], blocker(1, 2));
assert.deepEqual(bank.damaged, []);

// A tier-1 blocker breaks after one correct merged-power bank; harder
// tiers require exactly their own number of successful hits.
for (const [strength, hitsBefore, expected] of [
  [1, 0, null],
  [2, 0, blocker(1, 2)],
  [3, 1, blocker(2, 3)],
  [5, 0, blocker(1, 5)],
  [5, 3, blocker(4, 5)],
  [5, 4, null]
]) {
  board = withTiles([1, blocker(hitsBefore, strength)], [2, tile(2, 2)]);
  bank = attemptBank(board, 2, "4", context([2]), () => 0);
  assert.equal(bank.status, "success");
  assert.deepEqual(bank.board[1], expected,
    "blocker tier " + strength + ", previous hits " + hitsBefore);
}
const oldSavedBlocker = { kind: "blocker", hits: 2 };
board = withTiles([1, oldSavedBlocker], [2, tile(2, 2)]);
bank = attemptBank(board, 2, "4", context([2]));
assert.deepEqual(bank.destroyed, [1], "legacy 3-hit blocker still breaks");
assert.deepEqual(oldSavedBlocker, { kind: "blocker", hits: 2 });

// Randomly spawned higher powers can be banked for points but NEVER
// damage blockers until actually merged with another tile.
board = withTiles([1, blocker(0, 2)], [2, tile(3, 2)]);
bank = attemptBank(board, 2, "9", context(), () => 0);
assert.equal(bank.status, "success");
assert.deepEqual(bank.board[1], blocker(0, 2));
assert.deepEqual(bank.damaged, []);
assert.deepEqual(bank.destroyed, []);

// No diagonal damage, even from a genuine merged and correctly banked
// power. Orthogonally adjacent blockers both take one hit on one bank.
board = withTiles([0, blocker()], [5, tile(3, 2)]);
bank = attemptBank(board, 5, "9", context([5]), () => 0);
assert.deepEqual(bank.board[0], blocker());
assert.deepEqual(bank.damaged, []);
board = withTiles([1, blocker(0, 3)], [4, blocker(0, 2)],
  [5, tile(3, 2)]);
bank = attemptBank(board, 5, "9", context([5]), () => 0);
assert.deepEqual(bank.damaged, [1, 4]);
assert.deepEqual(bank.board[1], blocker(1, 3));
assert.deepEqual(bank.board[4], blocker(1, 2));

// A reserved warning does not get hurt by banking.
board = withTiles([1, warning(1)], [2, tile(3, 2)]);
bank = attemptBank(board, 2, "9", context([2]), () => 0);
assert.deepEqual(bank.board[1], warning(1));
assert.deepEqual(bank.damaged, []);
assert.deepEqual(bank.destroyed, []);

// Already-bankable but locked or previously-bankED powers cannot
// circumvent the one-time scoring and cooldown rules.
board = withTiles([1, blocker()], [2, tile(3, 2)]);
let settings = context([2]); settings.banked.add("3-2");
assert.equal(attemptBank(board, 2, "9", settings).status, "unavailable");
settings = context([2]); settings.locked.add(2);
assert.equal(attemptBank(board, 2, "9", settings).status, "unavailable");

// Track merge provenance across shifts. Spawns, ordinary number slides,
// and bank replacements are not independently merge-ready.
board = withTiles([0, tile(2)], [1, blocker()],
  [2, tile(3, 2)]);
move = slide(board, "right");
assert.deepEqual(move.board[3], tile(3, 2));
assert.deepEqual(mergeReadyAfterSlide([2], move.motions), [3]);
assert.deepEqual(mergeReadyAfterSlide([], move.motions), []);
assert.deepEqual(mergeReadyAfterSlide([2], slide(board, "left").motions), [2]);
board = withTiles([0, tile(3)], [1, tile(3)], [2, tile(3)]);
move = slide(board, "left");
assert.deepEqual(mergeReadyAfterSlide([], move.motions), [0]);
assert.deepEqual(move.board[0], tile(3, 2));
assert.deepEqual(move.board[1], tile(3));

// Obstacle squares divide rows/columns into independent segments. This
// remains true for both permanent blockers and next-turn warnings.
board = withTiles([0, tile(2)], [1, blocker()], [3, tile(5)]);
move = slide(board, "left");
assert.deepEqual(move.board[0], tile(2));
assert.deepEqual(move.board[1], blocker());
assert.deepEqual(move.board[2], tile(5));
assert.deepEqual(move.damaged, []);
board = withTiles([0, tile(2)], [1, warning(1)], [2, tile(3)], [3, tile(3)]);
move = slide(board, "left");
assert.deepEqual(move.board[1], warning(1));
assert.deepEqual(move.board[2], tile(3, 2));
assert.deepEqual(move.damaged, []);
assert.deepEqual(mergeReadyAfterSlide([], move.motions), [2]);

// The older cadence of occasional extra numerical spawns remains.
assert.equal(EXTRA_SPAWN_START, 40);
assert.equal(EXTRA_SPAWN_INTERVAL, 10);
for (const [moves, expected] of [[0, 1], [9, 1], [39, 1],
  [40, 2], [41, 1], [49, 1], [50, 2], [60, 2]]) {
  const turn = turnSpawns(blank(), new Set(), moves, () => 0);
  assert.equal(turn.spawned.length, expected);
  assert.equal(numbers(turn.board), expected);
  assert.equal(turn.extraSpawned, expected === 2);
}

// Warning at move 9, 19, ... is reserved, then replaced with the
// exactly positioned blocker at 10, 20, ... with correct tier.
assert.equal(BLOCKER_START, 10);
assert.equal(BLOCKER_INTERVAL, 10);
assert.equal(MAX_BLOCKERS, 2);
for (const [milestone, strength] of [
  [10, 1], [20, 2], [30, 3], [40, 4], [50, 5], [80, 5]
]) {
  assert.equal(blockerHitsForMove(milestone), strength);
  const before = turnSpawns(withTiles([0, tile(2)]),
    new Set(), milestone - 1, () => 0);
  assert.equal(before.warningAt, 1);
  assert.deepEqual(before.board[1], warning(strength));
  const after = turnSpawns(before.board, new Set(), milestone, () => 0);
  assert.equal(after.blockerAt, before.warningAt);
  assert.deepEqual(after.board[1], blocker(0, strength));
  assert.equal(warnings(after.board), 0);
  assert.equal(blockers(after.board), 1);
}
assert.equal(turnSpawns(withTiles([0, tile(2)]),
  new Set(), 10, () => 0).blockerAt, -1,
  "never spawn blocker without an advance warning");
const capped = withTiles([0, tile(2)], [1, blocker(0, 1)],
  [4, blocker(1, 2)]);
assert.equal(turnSpawns(capped, new Set(), 29, () => 0).warningAt, -1);
assert.equal(turnSpawns(capped, new Set(), 29, () => 0).blockerAt, -1);

// An isolated empty square still counts as game over, not as a legal move.
board = Array.from({ length: 16 }, (_, i) =>
  tile([2, 3, 5, 7][(Math.floor(i / 4) + i % 4) % 4]));
board[5] = null;
for (const i of [1, 4, 6, 9]) board[i] = blocker();
assert.equal(canMove(board, new Set()), false);

// Browser DOM IDs used in app.mjs must exist, and damage indicator must
// be styled; this catches mismatches not caught by syntax-only checks.
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
for (const match of app.matchAll(/\$\("([a-zA-Z0-9]+)"\)/g)) {
  assert.match(html, new RegExp('id="' + match[1] + '"'),
    match[1] + " must exist in HTML");
}
assert.match(css, /\.block-strike\b/);
assert.match(html, /⚡/);

// Simulate a sequence of slides with provenance tracking. A power must
// always be either on the board or removed by merging; never attach
// strike rights to a blocker or to an empty square.
let seed = 93721;
const rng = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
board = initial(rng);
const discovered = new Set();
let mergeReady = [];
let moves = 0;
for (let i = 0; i < 300; i++) {
  const candidates = ["left", "up", "right", "down"]
    .map(dir => slide(board, dir)).filter(r => r.changed);
  if (!candidates.length) break;
  const next = candidates[Math.floor(rng() * candidates.length)];
  mergeReady = mergeReadyAfterSlide(mergeReady, next.motions);
  for (const merged of next.merges) discovered.add(key(merged));
  moves++;
  const turn = turnSpawns(next.board, discovered, moves, rng,
    new Set(next.destroyed));
  board = turn.board;
  assert.equal(board.length, 16);
  assert.ok(blockers(board) + warnings(board) <= MAX_BLOCKERS);
  for (const t of board) {
    if (!t) continue;
    if (isObstacle(t)) assert.ok(blockerStrength(t) <= MAX_BLOCKER_HITS);
    else assert.ok(activeBases(moves).includes(t.base));
  }
  for (const position of mergeReady) {
    assert.ok(board[position] && !isObstacle(board[position]));
    assert.ok(board[position].exp >= 2);
  }
}
console.log("All Index Shuffle hazard and banking tests passed.");
