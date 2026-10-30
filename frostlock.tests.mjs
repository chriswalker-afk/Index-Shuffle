// Frostlock: fair random control freezing, save safety, shop preview and
// shared keyboard/button/swipe enforcement. This must never affect Classic.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, blocker, slide } from "./engine.mjs";
import {
  BOSS_CATALOG, bossId, frozenControl, frostlockChoices,
  nextFrozenDirection, restoreFrozenDirection, FROST_DIRECTIONS,
  createBossSchedule
} from "./bosses.mjs";
import {
  newRogueliteRun, restoreRogueliteRun, advanceRogueliteRound
} from "./roguelite.mjs";

const empty = () => Array(16).fill(null);
const baseRun = newRogueliteRun(0, () => 0).run;
const frost = { ...baseRun, round: 6, phase: "playing",
  bosses: { 3: "blockade", 6: "frostlock", 9: "scorekeeper", 12: "silent-seven" },
  frozenDirection: null };
const board = empty();board[5] = tile(2);board[10] = tile(3);
assert.equal(BOSS_CATALOG.length, 8);
assert.ok(BOSS_CATALOG.some(b => b.id === "frostlock"));
assert.deepEqual(FROST_DIRECTIONS, ["left","up","down","right"]);
assert.equal(bossId(frost), "frostlock");
assert.deepEqual(frostlockChoices(board), FROST_DIRECTIONS);
const initial = nextFrozenDirection(board, frost, () => 0);
assert.equal(initial, "left");
assert.equal(frozenControl({ ...frost, frozenDirection: initial }), initial);
assert.equal(nextFrozenDirection(board, { ...frost, frozenDirection: "left" },
  () => 0), "up", "Ice rotates after successful action");
assert.equal(nextFrozenDirection(board, { ...frost, frozenDirection: "left" },
  () => .999), "right", "Random selection reaches other options");
assert.equal(restoreFrozenDirection(board,
  { ...frost, frozenDirection: "down" }), "down");
assert.equal(restoreFrozenDirection(board,
  { ...frost, frozenDirection: "nonsense" }), "left");

// Artificial corridor with one legal slide RIGHT. Never freeze RIGHT,
// including if a malformed/old saved run asks to freeze it.
const corridor = Array.from({ length:16 },()=>blocker());
corridor[0] = tile(2);corridor[1] = null;
assert.equal(slide(corridor,"right").changed,true);
for(const direction of ["left","up","down"]) {
 assert.equal(slide(corridor,direction).changed,false);
}
assert.deepEqual(frostlockChoices(corridor), ["left","up","down"]);
for(const random of [0,.2,.65,.999]) {
 const frozen = nextFrozenDirection(corridor,frost,()=>random);
 assert.notEqual(frozen,"right","Only available slide must always be free");
}
assert.equal(restoreFrozenDirection(corridor,
  { ...frost, frozenDirection: "right" }), "left");
assert.equal(restoreFrozenDirection(corridor,
  { ...frost, frozenDirection: "up" }), "up");
assert.equal(frozenControl({ ...baseRun, round: 1, frozenDirection: "left" }),null);
assert.equal(frozenControl({ ...frost,phase:"shop",frozenDirection:"up" }),null);
assert.equal(frozenControl({ ...frost,frozenDirection:"banana" }),null);
assert.equal(nextFrozenDirection(board,{ ...frost,phase:"round-clear" }),null);
assert.equal(nextFrozenDirection(board,{ ...baseRun,round:6,
  frozenDirection:"up" }),null);
assert.throws(()=>nextFrozenDirection(board,frost,"random"),RangeError);
assert.throws(()=>frostlockChoices(Array(3).fill(null)),RangeError);

// Initial freeze is generated just once when entering a scheduled boss
// round, and stored with the rest of the run.
const prior = newRogueliteRun(0,()=>0);
prior.run = { ...prior.run,round:5,phase:"shop",
  bosses:{3:"blockade",6:"frostlock",9:"scorekeeper",12:"silent-seven"},
  lastRoundReward:{bankCoins:0,moveCoins:0,unusedMoves:0,totalCoins:0} };
const advanced = advanceRogueliteRound(prior,()=>0);
assert.equal(advanced.run.round,6);
assert.equal(advanced.run.phase,"playing");
assert.ok(FROST_DIRECTIONS.includes(advanced.run.frozenDirection));
const legalAfterAdvance = FROST_DIRECTIONS.filter(dir =>
  slide(advanced.board,dir).changed);
if (legalAfterAdvance.length === 1) {
  assert.notEqual(advanced.run.frozenDirection, legalAfterAdvance[0],
    "The only legal movement direction must not freeze");
}
const saved = restoreRogueliteRun(advanced.run,advanced.movesLeft);
assert.equal(saved.frozenDirection, advanced.run.frozenDirection,
  "Restoring saves must never reroll the frozen direction");
assert.equal(restoreRogueliteRun({ ...saved,frozenDirection:"invalid" }).frozenDirection,null);
const other = newRogueliteRun(0,()=>0);
other.run={ ...other.run,round:5,phase:"shop",
 bosses:{3:"blockade",6:"five-thief",9:"scorekeeper",12:"silent-seven"},
 lastRoundReward:{bankCoins:0,moveCoins:0,unusedMoves:0,totalCoins:0} };
assert.equal(advanceRogueliteRound(other,()=>0).run.frozenDirection,null);
const schedule = createBossSchedule(()=>.999);
assert.ok(Object.values(schedule).includes("frostlock"),
  "The new boss is selectable after the introductory boss round");

// Frozen direction is guarded at the shared move() entrypoint BEFORE slide,
// and successful actions rotate it exactly once. All four input methods
// already call that same entrypoint.
const app=readFileSync("app.mjs","utf8");
const html=readFileSync("index.html","utf8");
const css=readFileSync("styles.css","utf8");
const gallery=readFileSync("boss-gallery.html","utf8");
const intro=app.slice(app.indexOf("function move(direction)"),app.indexOf("function updateClock()"));
assert.ok(intro.indexOf("frozenControl(state.run) === direction") <
 intro.indexOf("slide(before, direction, currentMovementRules())"));
assert.ok(intro.indexOf("if (!result.changed) return") <
 intro.indexOf("rollFrostlockAfterAction()"));
assert.match(app,/const newFreeze = rollFrostlockAfterAction\(\)/g);
assert.match(app,/function repairFrozenControl\(\)/);
assert.match(app,/function rollFrostlockAfterAction\(\)/);
assert.match(app,/state\.run\.frozenDirection = nextFrozenDirection\(/);
assert.match(app,/\$\("frostlockStatus"\)\.hidden = !frozen \|\| state\.over/);
assert.match(app,/button\.disabled = blocked/);
assert.match(app,/frozenControl\(state\.run\) === direction/);
assert.match(app,/bossSceneFor\(boss\.id\)/);
assert.match(html,/id="frostlockStatus"/);
assert.match(html,/id="frostlockDirection"/);
assert.match(html,/styles\.css\?v=release-5c/);
assert.match(html,/app\.mjs\?v=release-5c/);
assert.match(css,/\.controls button\.frostlock-frozen/);
assert.match(css,/\.frostlock-status/);
assert.match(css,/data-boss="frostlock"/);
assert.match(gallery,/Eight possible opponents/);
console.log("Frostlock boss mechanics, fairness, save and input wiring tests passed.");
