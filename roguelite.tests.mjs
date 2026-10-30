import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, activeBases, turnSpawns, initial, scoreFor, slide, attemptBank } from "./engine.mjs";
import {
  ROUND_TARGETS, TOTAL_ROUNDS, targetForRound, isBossRound, stageForRound,
  scoreForRoguelitePower, newRogueliteRun, recordRogueliteBank,
  advanceRogueliteRound, validRogueliteRun, markGoldSpawns, goldTier,
  goldForBank, spareMoveGold, restoreRogueliteRun, MAX_SPARE_MOVE_COINS,
  GOLD_SPAWN_CHANCE, GOLD_PITY_SLIDES
} from "./roguelite.mjs";
import { enterRogueliteShop } from "./shop.mjs";

// Every target is explicit, increasing, and based on the exponent-only scale.
assert.equal(TOTAL_ROUNDS, 12);
assert.deepEqual(ROUND_TARGETS, [8, 11, 14, 17, 20, 24, 28, 33, 39, 45, 52, 60]);
assert.ok(ROUND_TARGETS.every((target, i) => i === 0 || target > ROUND_TARGETS[i - 1]));
assert.equal(targetForRound(1), 8);
assert.equal(targetForRound(12), 60);
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  .filter(isBossRound), [3, 6, 9, 12]);
assert.equal(stageForRound(7), 3);
assert.throws(() => targetForRound(0), RangeError);
assert.throws(() => isBossRound(13), RangeError);

// Correctly banked score is the exponent, not the value or Classic score.
for (const base of [2, 3, 5, 7, 11, 13]) {
  assert.equal(scoreForRoguelitePower(tile(base, 2)), 2);
  assert.equal(scoreForRoguelitePower(tile(base, 5)), 5);
}
assert.equal(scoreFor(tile(7, 2)), 25, "Classic scoring is unchanged");
assert.throws(() => scoreForRoguelitePower(tile(2, 1)), RangeError);
assert.throws(() => scoreForRoguelitePower(null), RangeError);

const constantRng = () => 0;
let state = newRogueliteRun(0, constantRng);
assert.equal(state.mode, "roguelite");
assert.equal(state.movesLeft, 10);
assert.equal(state.score, 0);
assert.equal(state.run.totalSlides, 0);
assert.equal(state.run.totalScore, 0);
assert.equal(state.run.phase, "playing");
assert.equal(state.board.filter(Boolean).length, 3);
assert.equal(validRogueliteRun(state.run), true);
assert.equal(validRogueliteRun({ ...state.run, round: 13 }), false);
assert.equal(validRogueliteRun({ ...state.run, phase: "victory" }), false);

// Round one now takes four ordinary exponent-2 banks, not two. Coins
// from remaining moves are awarded once when the final bank clears target.
let bank = recordRogueliteBank(state.run, state.score, tile(7, 2),
  { movesLeft: 7 });
assert.deepEqual([bank.points, bank.roundScore, bank.cleared, bank.run.phase],
  [2, 2, false, "playing"]);
assert.equal(bank.run.totalScore, 2);
state = { ...state, score: bank.roundScore, run: bank.run };
for (const base of [3, 5]) {
  bank = recordRogueliteBank(state.run, state.score, tile(base, 2),
    { movesLeft: 5 });
  assert.equal(bank.cleared, false);
  state = { ...state, score: bank.roundScore, run: bank.run };
}
bank = recordRogueliteBank(state.run, state.score, tile(2, 2),
  { movesLeft: 3 });
assert.deepEqual([bank.points, bank.roundScore, bank.cleared, bank.run.phase],
  [2, 8, true, "round-clear"]);
assert.equal(bank.moveGold, 3);
assert.equal(bank.run.coins, 3);
assert.equal(bank.run.lastRoundReward.totalCoins, 3);
assert.throws(() => recordRogueliteBank(bank.run, 8, tile(2, 2)), RangeError);
state = { ...state, score: bank.roundScore, run: bank.run,
  discovered: ["7-2"], banked: ["7-2", "3-2"],
  locked: [3], mergeReady: [0], moves: 8, movesLeft: 3, mergeCredit: 1 };
const original = structuredClone(state);
assert.throws(() => advanceRogueliteRound(state), RangeError,
  "Roguelite rounds cannot be advanced without visiting the shop");
const shopping = enterRogueliteShop(state, constantRng);
assert.equal(shopping.run.phase, "shop");
const next = advanceRogueliteRound(shopping, constantRng);
assert.equal(next.run.round, 2);
assert.equal(next.run.totalScore, 8);
assert.equal(next.run.phase, "playing");
assert.equal(next.score, 0);
assert.equal(next.movesLeft, 10);
assert.equal(next.mergeCredit, 0);
assert.equal(next.moves, 0);
assert.equal(next.run.coins, 3, "unused-move coins persist between rounds");
assert.equal(next.run.roundBankCoins, 0, "only round gold resets");
assert.equal(next.run.lastRoundReward, null);
assert.deepEqual(next.discovered, ["7-2"]);
assert.deepEqual(next.banked, []);
assert.deepEqual(next.locked, []);
assert.deepEqual(next.mergeReady, []);
assert.deepEqual(state, original, "round change must not mutate the previous state");
assert.throws(() => advanceRogueliteRound(next), RangeError);

// Exponent-only points accumulate through successive rounds.
const secondBank = recordRogueliteBank(next.run, 9, tile(13, 3), { movesLeft: 6 });
assert.equal(secondBank.roundScore, 12);
assert.equal(secondBank.run.totalScore, 11);
assert.equal(secondBank.run.phase, "round-clear");

// The final bank completes a 12-round run rather than starting round 13.
const finalist = { ...next.run, round: 12, totalScore: 200, phase: "playing" };
const victory = recordRogueliteBank(finalist, 58, tile(2, 3), { movesLeft: 10 });
assert.equal(victory.run.phase, "victory");
assert.equal(victory.run.totalScore, 203);
assert.equal(victory.moveGold, 5, "victory also pays the capped unused-move reward");
assert.throws(() => advanceRogueliteRound({ ...next, run: victory.run }), RangeError);

// Spawn progression uses cumulative run slides while the blocker counter
// can restart from round slide 1. Classic default behaviour is unchanged.
assert.deepEqual(activeBases(35), [2, 3, 5, 7, 11]);
const blank = Array(16).fill(null);
const roundOne = turnSpawns(blank, new Set(), 1, () => 0.70);
const laterRound = turnSpawns(blank, new Set(), 1, () => 0.70, new Set(), 35);
assert.equal(roundOne.board.filter(Boolean).length, 1);
assert.equal(laterRound.board.filter(Boolean).length, 1);
assert.notEqual(roundOne.board.find(Boolean).base, laterRound.board.find(Boolean).base);
assert.equal(initial(() => 0, 60).filter(Boolean).length, 3);

// Verify both modes have separate saves and selection UI, and that the
// banking path only enters round-clear after a correct answer.
const app = readFileSync("app.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
assert.match(app, /index-shuffle-v1/);
assert.match(app, /index-shuffle-roguelite-v1/);
assert.match(app, /recordRogueliteBank\(state\.run, state\.score, t,\s*\{/);
assert.match(app, /advanceRogueliteRound\(state, Math\.random, goldChancesForRun\(state\.run\)\)/);
assert.match(app, /state\.run\.totalSlides\s*\+=\s*1/);
assert.match(app, /state\.over\s*=\s*currentGameEnded\(\)/);
assert.match(html, /id="modeClassic"/);
assert.match(html, /id="modeRoguelite"/);
assert.match(html, /id="rogueProgress"[^>]*hidden/);
assert.match(html, /id="roundClearPanel"[^>]*hidden/);
assert.match(html, /id="roundScoreProgress"/);

/* Pass 2: gold mechanics */
assert.equal(GOLD_SPAWN_CHANCE, 0.12);
assert.equal(GOLD_PITY_SLIDES, 5);
assert.equal(MAX_SPARE_MOVE_COINS, 5);
const empty = Array(16).fill(null);
const newTile = empty.slice();
newTile[4] = tile(3);
let gilded = markGoldSpawns(newTile, [4], 0, () => 0.01);
assert.deepEqual(gilded.board[4], { base: 3, exp: 1, gold: 1 });
assert.equal(gilded.goldSpawned, 1);
assert.equal(gilded.dryStreak, 0);
assert.deepEqual(newTile[4], tile(3), "marking gold does not mutate original");
assert.deepEqual(markGoldSpawns(newTile, [4], 0, () => 0.99).board[4], tile(3));
assert.equal(markGoldSpawns(newTile, [4], 0, () => 0.99).dryStreak, 1);
let streak = 0;
for (let n = 0; n < 5; n++) {
  const turn = markGoldSpawns(newTile, [4], streak, () => 0.99);
  streak = turn.dryStreak;
  assert.equal(turn.goldSpawned, 0);
}
assert.equal(streak, 5);
gilded = markGoldSpawns(newTile, [4], streak, () => 0.99);
assert.equal(gilded.goldSpawned, 1, "sixth slide guarantees a gold opportunity");
assert.equal(gilded.dryStreak, 0);
const twoSpawns = empty.slice();
twoSpawns[1] = tile(2);
twoSpawns[2] = tile(2);
gilded = markGoldSpawns(twoSpawns, [1, 2], 5, () => 0.99);
assert.equal(gilded.goldSpawned, 1);
assert.equal(goldTier(gilded.board[1]), 1);
assert.equal(goldTier(gilded.board[2]), 0);
assert.equal(markGoldSpawns(newTile, [4], 0, () => 0.01, false).dryStreak, 0,
  "initial board gold cannot advance the successful-slide pity counter");
assert.throws(() => markGoldSpawns(newTile, [4, 20], 0), RangeError);
assert.throws(() => markGoldSpawns(newTile, [0], 0), RangeError);

let goldBoard = empty.slice();
goldBoard[0] = { ...tile(3), gold: 1 };
goldBoard[1] = tile(3);
let merge = slide(goldBoard, "left");
assert.deepEqual(merge.board[0], { base: 3, exp: 2, gold: 1 });
assert.equal(goldTier(merge.board[0]), 1);
assert.deepEqual(goldBoard[0], { base: 3, exp: 1, gold: 1 });
const singleGold = empty.slice();
singleGold[0] = { ...tile(7, 2), gold: 1 };
const ordinaryMovement = slide(singleGold, "right");
assert.equal(goldTier(ordinaryMovement.board[3]), 1, "gold travels with sliding tile");
goldBoard = empty.slice();
goldBoard[0] = { ...tile(3), gold: 1 };
goldBoard[1] = { ...tile(3), gold: 1 };
merge = slide(goldBoard, "left");
assert.deepEqual(merge.board[0], { base: 3, exp: 2, gold: 2 });
assert.equal(goldForBank(merge.board[0], true), 4);
assert.equal(goldForBank(merge.board[0], false), 1);
assert.equal(goldForBank({ ...tile(7, 4), gold: 1 }, true), 3);
assert.equal(goldForBank({ ...tile(7, 2), gold: 1 }, true), 2);
assert.equal(goldForBank(tile(7, 5), true), 0);
assert.throws(() => goldForBank(tile(3, 2), "yes"), RangeError);

// Wrong answers never call the economy and gold is removed from the
// lower-power replacement after a successful bank.
const goldBankBoard = empty.slice();
goldBankBoard[0] = merge.board[0];
const ctx = { discovered: new Set(["3-2"]), banked: new Set(),
  locked: new Set(), mergeReady: new Set([0]) };
assert.equal(attemptBank(goldBankBoard, 0, "8", ctx).status, "incorrect");
const bankedGold = attemptBank(goldBankBoard, 0, "9", ctx, () => 0);
assert.equal(bankedGold.status, "success");
assert.equal(goldTier(bankedGold.board[0]), 0, "gold cannot be reused after banking");
let goldRun = newRogueliteRun(0, constantRng).run;
let goldAward = recordRogueliteBank(goldRun, 0, merge.board[0], {
  merged: bankedGold.creditedMerge, movesLeft: 5
});
assert.equal(goldAward.bankGold, 4);
assert.equal(goldAward.moveGold, 0);
assert.equal(goldAward.run.coins, 4);
assert.equal(goldAward.run.roundBankCoins, 4);
goldAward = recordRogueliteBank(goldAward.run, 6,
  { ...tile(5, 2), gold: 1 }, { merged: true, movesLeft: 4 });
assert.equal(goldAward.cleared, true);
assert.equal(goldAward.bankGold, 2);
assert.equal(goldAward.moveGold, 4);
assert.equal(goldAward.run.coins, 10);
assert.deepEqual(goldAward.run.lastRoundReward, {
  bankCoins: 6, moveCoins: 4, unusedMoves: 4, totalCoins: 10
});
assert.equal(restoreRogueliteRun(goldAward.run, 4).coins, 10,
  "restoring a cleared round must not pay the bonus again");
assert.equal(advanceRogueliteRound(enterRogueliteShop({
  ...next, score: 8, run: goldAward.run
}, constantRng), constantRng).run.coins, 10, "shop and round transition must not pay twice");
assert.equal(spareMoveGold(0), 0);
assert.equal(spareMoveGold(3), 3);
assert.equal(spareMoveGold(10), 5);
assert.throws(() => spareMoveGold(11), RangeError);
assert.throws(() => spareMoveGold(-1), RangeError);

// Migrate valid pass-one saves with a reward for an already completed
// round, exactly once, without replacing their board or discoveries.
const legacy = { round: 2, totalScore: 10, totalSlides: 5, phase: "round-clear" };
const migrated = restoreRogueliteRun(legacy, 6);
assert.equal(migrated.coins, 5);
assert.equal(migrated.lastRoundReward.moveCoins, 5);
assert.equal(restoreRogueliteRun(migrated, 6).coins, 5);
assert.equal(restoreRogueliteRun({
  round: 2, totalScore: 2, totalSlides: 5, phase: "playing"
}, 4).coins, 0);
assert.match(app, /markGoldSpawns\(spawned\.board, spawned\.spawned,\s*state\.run\.goldDryStreak/);
assert.match(app, /merged: outcome\.creditedMerge, movesLeft: state\.movesLeft/);
assert.match(html, /id="rogueCoins"/);
assert.match(html, /id="roundSpareCoins"/);
assert.match(html, /id="roundBankCoins"/);
assert.match(html, /id="roundRewardTotal"/);
console.log("All Index Shuffle Roguelite pass-two tests passed.");
