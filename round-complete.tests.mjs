import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  newRogueliteRun, skipRogueliteShop, advanceRogueliteRound,
  targetForRound, validRogueliteRun
} from "./roguelite.mjs";
import { bossForRound, bossTargetFor, BOSS_ROUNDS } from "./bosses.mjs";
import { roundCompletionSummary } from "./round-complete.mjs";

const reward = Object.freeze({
  bankCoins: 1, moveCoins: 5, unusedMoves: 5, totalCoins: 6
});
const initial = newRogueliteRun(0, () => .41);
const makeClear = round => {
  const run = { ...initial.run, round, phase: "round-clear",
    lastRoundReward: { ...reward }, roundBankCoins: 1, coins: 17,
    totalCoinsEarned: 17, totalScore: 45 };
  assert.ok(validRogueliteRun(run), "Round " + round + " fixture is valid");
  return { ...initial, score: bossTargetFor(run, targetForRound(round)),
    moves: 7, movesLeft: 5, banked: ["2-2"],
    locked: [0], mergeReady: [1], discovered: ["2-2", "3-2"],
    run };
};

for (let round = 1; round <= 11; round++) {
  const saved = makeClear(round);
  const summary = roundCompletionSummary(saved);
  assert.ok(summary);
  assert.equal(summary.round, round);
  assert.equal(summary.nextRound, round + 1);
  assert.equal(summary.score, saved.score);
  assert.equal(summary.target, saved.score);
  assert.equal(summary.bankCoins, 1);
  assert.equal(summary.moveCoins, 5);
  assert.equal(summary.unusedMoves, 5);
  assert.equal(summary.totalCoins, 6);
  assert.equal(summary.coins, 17);
  assert.equal(summary.defeatedBoss !== null, BOSS_ROUNDS.includes(round));
  const nextBoss = BOSS_ROUNDS.find(value => value > round);
  const lastBoss = [...BOSS_ROUNDS].reverse().find(value => value <= round) || 0;
  assert.equal(summary.nextBossRound, nextBoss);
  assert.equal(summary.roundsToBoss, nextBoss - round);
  assert.equal(summary.steps, 3);
  assert.equal(summary.progress, round - lastBoss);
  assert.ok(summary.progress >= 0 && summary.progress <= 2);
  if (round + 1 === nextBoss) {
    assert.equal(summary.nextBossName, bossForRound(saved.run, nextBoss)?.name);
  } else assert.equal(summary.nextBossName, null,
    "The next boss name remains a surprise until the adjacent round");
  assert.deepEqual(saved.run.lastRoundReward, reward,
    "Showing the pop-in never spends the reward");
}
assert.equal(roundCompletionSummary(makeClear(1)).progress, 1);
assert.equal(roundCompletionSummary(makeClear(2)).progress, 2);
assert.equal(roundCompletionSummary(makeClear(3)).progress, 0,
  "Defeating a boss begins a fresh three-round boss tracker");
assert.equal(roundCompletionSummary(makeClear(6)).progress, 0);
assert.equal(roundCompletionSummary(makeClear(9)).progress, 0);
assert.equal(roundCompletionSummary(makeClear(11)).progress, 2);
const completed = makeClear(11);
assert.equal(roundCompletionSummary({...completed,run:{
  ...completed.run,phase:"victory",round:12}}),null);
assert.equal(roundCompletionSummary({...completed,mode:"classic"}),null);
assert.equal(roundCompletionSummary({...completed,run:{
  ...completed.run,phase:"shop"}}),null);

function rng(seed) {
  let value = seed >>> 0;
  let calls = 0;
  const draw = () => {
    calls++;
    value = (Math.imul(value,1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  draw.count = () => calls;
  return draw;
}
for (let round = 1; round < 12; round++) {
  const before = makeClear(round);
  const original = structuredClone(before);
  const directRng = rng(301 + round), normalRng = rng(301 + round);
  const skipped = skipRogueliteShop(before,directRng);
  const visited = advanceRogueliteRound({
    ...before,run:{...before.run,phase:"shop",shop:null}
  },normalRng);
  assert.deepEqual(skipped,visited,
    "Skipping produces the same board and round progress as a visit with no purchases");
  assert.equal(directRng.count(),normalRng.count(),
    "Skipping must not secretly roll shop inventory");
  assert.equal(skipped.run.phase,"playing");
  assert.equal(skipped.run.round,round+1);
  assert.equal(skipped.run.shop,null);
  assert.equal(skipped.run.coins,17,"Skipping does not pay or spend extra coins");
  assert.equal(skipped.run.totalCoinsEarned,17);
  assert.deepEqual(skipped.run.inventory,before.run.inventory);
  assert.deepEqual(skipped.discovered,before.discovered);
  assert.deepEqual(skipped.banked,[]);
  assert.deepEqual(skipped.locked,[]);
  assert.deepEqual(skipped.mergeReady,[]);
  assert.equal(skipped.movesLeft,10);
  assert.equal(skipped.score,0);
  assert.equal(skipped.run.lastRoundReward,null);
  assert.deepEqual(before,original,"Skipping must not mutate a saved round-clear snapshot");
}
assert.throws(() => skipRogueliteShop(initial),RangeError);
assert.throws(() => skipRogueliteShop({...initial,mode:"classic",
  run:makeClear(3).run}),RangeError);
assert.throws(() => skipRogueliteShop({...makeClear(4),
  run:{...makeClear(4).run,phase:"shop"}}),RangeError);
assert.throws(() => skipRogueliteShop({...makeClear(11),
  run:{...makeClear(11).run,round:12,phase:"victory"}}),RangeError);
assert.throws(() => advanceRogueliteRound(makeClear(4)),RangeError,
  "The shop-only progression API remains protected against accidental bypass");

const app=readFileSync("app.mjs","utf8");
const html=readFileSync("index.html","utf8");
const ui=readFileSync("round-complete-ui.mjs","utf8");
const css=readFileSync("styles.css","utf8");
for (const id of ["roundCompleteDialog","roundCompleteTitle",
  "roundCompleteDescription","roundCompleteRound","roundCompleteScore",
  "roundCompleteTarget","roundCompleteGold","roundCompleteWallet",
  "roundCompleteBankCoins","roundCompleteMoveCoins",
  "roundCompleteUnusedLabel","roundCompleteGoldTotal","roundCompleteBossVictory",
  "roundCompleteDefeatedName","roundCompleteBossLabel",
  "roundCompleteBossProgress","roundCompleteBossSteps","roundCompleteBossCount",
  "roundCompleteContinue","roundCompleteShop","roundCompleteReturn"]) {
  assert.match(html,new RegExp('id="' + id + '"'),id);
}
assert.match(ui,/roundCompletionSummary\(state\)/);
assert.match(ui,/if \(!dialog\.open\) dialog\.showModal\(\)/);
assert.match(ui,/roundCompleteBossProgress/);
assert.match(app,/renderRoundCompleteDialog\(state, mode, screen\)/);
assert.match(app,/skipRogueliteShop\(state, Math\.random, goldChancesForRun\(state\.run\)\)/);
assert.match(app,/state = enterRogueliteShop\(state\)/);
assert.match(app,/\$\("roundCompleteDialog"\)\.addEventListener\("cancel", event => event\.preventDefault\(\)\)/);
assert.match(css,/\.round-complete-dialog::backdrop/);
assert.match(css,/@media \(max-width: 540px\)/);
assert.match(css, /prefers-reduced-motion: reduce/);
console.log("Round-complete intermission test passed: all eleven choice points, four boss milestones, no-shop progression and UI contracts.");
