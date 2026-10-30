import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, blocker, warning, isBlocker, isWarning, slide, canMove,
  gameEnded, attemptBank, turnSpawns, MAX_BLOCKERS
} from "./engine.mjs";
import {
  BOSS_CATALOG, BOSS_ROUNDS, BOSS_BY_ID, createBossSchedule,
  restoreBossSchedule, validBossSchedule, bossForRound, bossId,
  bossPointsFor, bossTargetFor, bossMovementRules,
  bossAllowsMoveRestoration, startBossBoard, applyThreeCurse
} from "./bosses.mjs";
import {
  newRogueliteRun, targetForRound, recordRogueliteBank,
  restoreRogueliteRun, advanceRogueliteRound
} from "./roguelite.mjs";
import { bankItemBonuses, canActivateConsumable, useConsumable } from "./effects.mjs";

const rng = () => 0;
const blank = () => Array(16).fill(null);
function grid(...entries) {
  const board = blank();
  for (const [i, t] of entries) board[i] = t;
  return board;
}
function encounter(round, id) {
  const run = newRogueliteRun(0, rng).run;
  return { ...run, round, bosses: { ...run.bosses, [round]: id } };
}

// Every run has 4 unique encounters on rounds 3,6,9,12; first encounter
// cannot depend on an as-yet-locked base-7 or difficult later mechanics.
assert.deepEqual(BOSS_ROUNDS, [3, 6, 9, 12]);
assert.equal(BOSS_CATALOG.length, 8);
assert.equal(new Set(BOSS_CATALOG.map(b => b.id)).size, 8);
for (const boss of BOSS_CATALOG) {
  assert.equal(BOSS_BY_ID[boss.id], boss);
  assert.ok(boss.name.length > 5 && boss.summary.length > 10 && boss.detail.length > 40);
}
const schedule = createBossSchedule(rng);
assert.deepEqual(schedule, {
  3: "blockade", 6: "five-thief", 9: "scorekeeper", 12: "silent-seven"
});
assert.equal(validBossSchedule(schedule), true);
assert.equal(validBossSchedule({
  3: "silent-seven", 6: "blockade", 9: "scorekeeper", 12: "three-curse"
}), false);
assert.equal(validBossSchedule({
  3: "blockade", 6: "blockade", 9: "scorekeeper", 12: "three-curse"
}), false);
assert.throws(() => createBossSchedule("not an RNG"), RangeError);
const lastSchedule = createBossSchedule(() => 0.999);
assert.equal(lastSchedule[3], "scorekeeper");
assert.equal(new Set(Object.values(lastSchedule)).size, 4);
const fresh = newRogueliteRun(0, rng);
assert.equal(validBossSchedule(fresh.run.bosses), true);
assert.equal(bossForRound(fresh.run), null);
assert.equal(bossForRound(fresh.run, 3)?.name, "The Blockade");
assert.equal(bossForRound(fresh.run, 6)?.id, "five-thief");
assert.equal(bossForRound(fresh.run, 12)?.id, "silent-seven");

// Migrate an older saved game: choose a deterministic schedule without
// resetting the board or giving additional coins, once on restoration.
const oldRun = { round: 2, totalSlides: 17, totalScore: 18, coins: 9,
  phase: "playing", totalCoinsEarned: 9 };
const migrated = restoreRogueliteRun(oldRun, 7);
assert.equal(validBossSchedule(migrated.bosses), true);
assert.deepEqual(migrated.bosses, restoreBossSchedule(oldRun));
assert.deepEqual(restoreRogueliteRun(migrated, 7).bosses, migrated.bosses);
assert.equal(migrated.coins, 9);
assert.equal(migrated.totalScore, 18);
assert.deepEqual(restoreBossSchedule({ ...oldRun, bosses: schedule }), schedule);
assert.deepEqual(restoreBossSchedule(oldRun), restoreBossSchedule(oldRun),
  "Legacy boss selection must not change on every refresh");

// Non-boss rounds preserve the classic Roguelite score target.
assert.equal(bossTargetFor(fresh.run, targetForRound(1)), 8);
assert.equal(bossTargetFor(encounter(9, "scorekeeper"), 39), 55);
assert.equal(bossTargetFor(encounter(3, "scorekeeper"), 14), 20);
assert.throws(() => bossTargetFor(fresh.run, 0), RangeError);
assert.equal(bossTargetFor(encounter(6, "five-thief"), 24), 24);
let scoring = recordRogueliteBank(encounter(9, "scorekeeper"),
  52, tile(3, 2), { movesLeft: 4, merged: true });
assert.equal(scoring.cleared, false);
scoring = recordRogueliteBank(encounter(9, "scorekeeper"),
  54, tile(3, 2), { movesLeft: 4, merged: true });
assert.equal(scoring.roundScore, 56);
assert.equal(scoring.cleared, true);
assert.equal(scoring.moveGold, 4);

// Suppressed scores override item multipliers and additions, but still
// earn gold and preserve correct-bank move/damage provenance.
const zero5 = encounter(6, "five-thief");
zero5.inventory.permanents = [
  { id: "five-alive", pricePaid: 4 },
  { id: "square-specialist", pricePaid: 4 }
];
let bankBonus = bankItemBonuses(zero5, { ...tile(5, 2), gold: 1 }, true);
assert.equal(bankBonus.score, 5, "Items would score 5 without the boss");
assert.equal(bossPointsFor(zero5, tile(5, 2), bankBonus.score), 0);
scoring = recordRogueliteBank(zero5, 0,
  { ...tile(5, 2), gold: 1 },
  { scoreOverride: bankBonus.score, merged: true, movesLeft: 8,
    counters: bankBonus.counters });
assert.equal(scoring.points, 0);
assert.equal(scoring.run.totalScore, 0);
assert.equal(scoring.bankGold, 2);
assert.equal(scoring.run.coins, 2);
assert.equal(scoring.run.scoredBanks, 1);
assert.equal(scoring.cleared, false);
assert.equal(bossPointsFor(zero5, tile(3, 3), 3), 3);
const squareBoss = encounter(9, "power-snob");
assert.equal(bossPointsFor(squareBoss, tile(2, 2), 20), 0);
assert.equal(bossPointsFor(squareBoss, tile(11, 3), 3), 3);
const squareScore = recordRogueliteBank(squareBoss, 0,
  { ...tile(3, 2), gold: 1 }, { scoreOverride: 20, merged: true });
assert.equal(squareScore.points, 0);
assert.equal(squareScore.bankGold, 2);
assert.throws(() => bossPointsFor(squareBoss, tile(3, 2), -1), RangeError);

// The Silent Seven disables merges AND legal-move checks for base 7 only.
const sevenBoss = encounter(6, "silent-seven");
const sevens = grid([0, tile(7)], [1, tile(7)], [4, tile(3)], [5, tile(3)]);
assert.equal(slide(sevens, "left").merges.length, 2);
const slideBoss = slide(sevens, "left", bossMovementRules(sevenBoss));
assert.equal(slideBoss.merges.length, 1);
assert.deepEqual(slideBoss.board[0], tile(7));
assert.deepEqual(slideBoss.board[1], tile(7));
assert.deepEqual(slideBoss.board[4], tile(3, 2));
assert.equal(bossMovementRules(encounter(6, "five-thief")), null);
const wallOfSevens = Array(16).fill(null).map(() => tile(7));
assert.equal(canMove(wallOfSevens, new Set()), true);
assert.equal(canMove(wallOfSevens, new Set(), new Set(),
  bossMovementRules(sevenBoss)), false);
assert.equal(gameEnded(wallOfSevens, new Set(), new Set(), 5,
  bossMovementRules(sevenBoss)), true);
const bankSeven = grid([0, tile(7, 2)]);
assert.equal(attemptBank(bankSeven, 0, "49").status, "success",
  "Existing base-7 powers remain mathematically bankable");

// Timekeeper blocks *both* bonus-move restoration and Second Wind.
// It doesn't consume a held item and does not prohibit Protection.
const clockBoss = encounter(9, "timekeeper");
assert.equal(bossAllowsMoveRestoration(clockBoss), false);
assert.equal(bossAllowsMoveRestoration(sevenBoss), true);
let timeState = newRogueliteRun(0, rng);
timeState.run = clockBoss;
timeState.movesLeft = 4;
timeState.run.inventory.consumables = [
  { id: "second-wind", pricePaid: 3 }, { id: "protection", pricePaid: 3 }
];
assert.equal(canActivateConsumable(timeState, 0), false);
assert.equal(canActivateConsumable(timeState, 1), true);
assert.throws(() => useConsumable(timeState, 0, []), RangeError);
assert.equal(timeState.run.inventory.consumables[0].id, "second-wind");
assert.equal(useConsumable(timeState, 1, []).run.protectionSlides, 2);

// The Blockade starts one weak blocker at an adjacent, legal square,
// obeys the two-blocker cap and doesn't modify other bosses' start boards.
const bossBoard = grid([0, tile(2)], [1, tile(3)], [5, tile(5)]);
const blocked = startBossBoard(bossBoard, encounter(3, "blockade"), rng);
assert.equal(blocked.filter(isBlocker).length, 1);
assert.equal(blocked.find(isBlocker).strength, 1);
assert.equal(canMove(blocked, new Set()), true);
assert.deepEqual(bossBoard.filter(isBlocker), []);
assert.deepEqual(startBossBoard(bossBoard, encounter(6, "five-thief"), rng), bossBoard);
const fullOfBlockers = grid([0, tile(2)], [1, blocker()], [6, blocker()]);
assert.deepEqual(startBossBoard(fullOfBlockers, encounter(3, "blockade"), rng),
  fullOfBlockers, "Cannot exceed the two-blocker cap");
assert.throws(() => startBossBoard(Array(15).fill(null), encounter(3, "blockade")),
  RangeError);
// Going from shop after round 2 to boss round 3 creates the extra blocker
// and carries gold/items/recorded boss assignment across transitions.
const before = newRogueliteRun(0, rng);
before.run = { ...before.run, round: 2, phase: "shop", coins: 8,
  lastRoundReward: { bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0 } };
const advanced = advanceRogueliteRound(before, rng);
assert.equal(advanced.run.round, 3);
assert.equal(advanced.run.bosses[3], "blockade");
assert.equal(advanced.board.filter(isBlocker).length, 1);
assert.equal(advanced.run.coins, 8);
assert.equal(advanced.movesLeft, 10);

// Three Curse only applies to newly merged base-3 powers. Their
// countdown travels with the tile through slides, and banking it clears
// the curse. After three additional successful slides, the tile becomes
// a one-hit blocker, unless that would exceed the cap or strand the board.
const curseRun = encounter(6, "three-curse");
const baseBoard = grid([0, tile(3, 2)], [7, tile(2)], [8, tile(5)]);
let cursed = applyThreeCurse(baseBoard, [0], curseRun);
assert.equal(cursed.board[0].curseLeft, 3);
assert.deepEqual(cursed.expired, []);
assert.deepEqual(baseBoard[0], tile(3, 2), "Curse bookkeeping is immutable");
cursed = applyThreeCurse(cursed.board, [], curseRun);
assert.equal(cursed.board[0].curseLeft, 2);
cursed = applyThreeCurse(cursed.board, [], curseRun);
assert.equal(cursed.board[0].curseLeft, 1);
const fourth = applyThreeCurse(cursed.board, [], curseRun);
assert.deepEqual(fourth.expired, [0]);
assert.equal(isBlocker(fourth.board[0]), true);
assert.equal(fourth.board[0].strength, 1);
assert.equal(fourth.board[0].hits, 0);
assert.equal(fourth.board.filter(isBlocker).length, 1);
assert.equal(cursed.board[0].curseLeft, 1,
  "Previous countdown must not be changed by the next slide");
const bankedCurse = attemptBank(cursed.board, 0, "9");
assert.equal(bankedCurse.status, "success");
assert.equal(bankedCurse.board[0].curseLeft, undefined);
const shifted = slide(cursed.board, "right");
const cursedShifted = shifted.board.find(t => t?.base === 3);
assert.equal(cursedShifted.curseLeft, 1);
const merged3 = slide(grid([0, { ...tile(3, 2), curseLeft: 1 }],
  [1, tile(3)]), "left");
assert.equal(merged3.board[0].exp, 3);
assert.equal(applyThreeCurse(merged3.board, merged3.mergeDestinations,
  curseRun).board[0].curseLeft, 3, "Re-merging refreshes the countdown");
assert.deepEqual(applyThreeCurse(baseBoard, [0], encounter(6, "five-thief")).board,
  baseBoard, "Other bosses do not place a curse");
const capped = grid([0, { ...tile(3, 2), curseLeft: 1 }],
  [4, blocker(0, 1)], [5, blocker(0, 1)], [10, tile(2)]);
const cappedResult = applyThreeCurse(capped, [], curseRun);
assert.deepEqual(cappedResult.expired, []);
assert.deepEqual(cappedResult.spared, [0]);
assert.equal(cappedResult.board[0].curseLeft, undefined);
assert.equal(cappedResult.board.filter(isBlocker).length, MAX_BLOCKERS);
const stranded = grid([0, { ...tile(3, 2), curseLeft: 1 }]);
const safe = applyThreeCurse(stranded, [], curseRun, new Set(["3-2"]));
assert.deepEqual(safe.expired, []);
assert.deepEqual(safe.spared, [0]);
assert.equal(safe.board[0].curseLeft, undefined);
assert.throws(() => applyThreeCurse(blank(), null, curseRun), RangeError);

// Alchemist should provide a direct counter to the Three Curse, but
// should not automatically bank the tile or unlock banned powers.
let alchemist = newRogueliteRun(0, rng);
alchemist.run = curseRun;
alchemist.run.inventory.consumables = [
  { id: "alchemist", pricePaid: 2 }, null
];
alchemist.board = grid([0, { ...tile(3, 2), curseLeft: 1 }]);
const transmuted = useConsumable(alchemist, 0, [0]);
assert.equal(transmuted.board[0].base, 5);
assert.equal(transmuted.board[0].curseLeft, undefined);
assert.equal(transmuted.score, 0);

// Once a warning is on the board, the next successful slide MUST mature
// it even if a previous purchase delayed the milestone counter. Do not
// schedule another warning on that same slide.
const incoming = grid([0, warning(2)], [5, tile(3)]);
const matured = turnSpawns(incoming, new Set(), 9, rng);
assert.equal(matured.board.filter(isBlocker).length, 1);
assert.equal(matured.board.filter(isWarning).length, 0);
assert.equal(matured.warningAt, -1);

// Browser wiring ensures the HUD, bank form, shop preview, animations,
// Classic isolation and permanent/consumable interactions respect bosses.
const app = readFileSync("app.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(app, /slide\(before, direction, currentMovementRules\(\)\)/);
assert.match(app, /bossMovementRules\(state\.run\)/);
assert.match(app, /bossTargetFor\(state\.run, targetForRound\(state\.run\.round\)\)/);
assert.match(app, /bossPointsFor\(state\.run, t, bonuses\.score\)/);
assert.match(app, /applyThreeCurse\(result\.board, result\.mergeDestinations/);
assert.match(app, /bossAllowsMoveRestoration\(state\.run\)/);
assert.match(app, /turnSpawns\(curse\.board/);
assert.match(app, /currentGameEnded\(\)/);
assert.match(html, /id="bossRule"[^>]*hidden/);
assert.match(html, /id="bossName"/);
assert.match(html, /id="bossText"/);
assert.match(html, /id="shopBossPreview"[^>]*hidden/);
assert.match(html, /id="shopBossTarget"/);
assert.match(app, /tile-curse-mark/);
assert.match(shopUI, /bossForRound\(state\.run, nextRound\)/);
assert.match(shopUI, /bossTargetFor\(\{ \.\.\.state\.run, round: nextRound \}, baseTarget\)/);
assert.match(css, /\.boss-rule/);
assert.match(css, /\.tile-curse-mark/);
assert.match(app, /index-shuffle-v1/);
assert.match(app, /index-shuffle-roguelite-v1/);
console.log("All Index Shuffle eight-boss encounter tests passed.");
