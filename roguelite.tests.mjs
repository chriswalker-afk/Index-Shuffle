import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, activeBases, turnSpawns, initial, scoreFor } from "./engine.mjs";
import {
  ROUND_TARGETS, TOTAL_ROUNDS, targetForRound, isBossRound, stageForRound,
  scoreForRoguelitePower, newRogueliteRun, recordRogueliteBank,
  advanceRogueliteRound, validRogueliteRun
} from "./roguelite.mjs";

// Every target is explicit, increasing, and based on the exponent-only scale.
assert.equal(TOTAL_ROUNDS, 12);
assert.deepEqual(ROUND_TARGETS, [4, 6, 8, 9, 11, 15, 17, 20, 25, 27, 33, 40]);
assert.ok(ROUND_TARGETS.every((target, i) => i === 0 || target > ROUND_TARGETS[i - 1]));
assert.equal(targetForRound(1), 4);
assert.equal(targetForRound(12), 40);
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

// Progressing a score is independent of base: two banks of exponent 2
// reach round one's threshold, then play must stop for round transition.
let bank = recordRogueliteBank(state.run, state.score, tile(7, 2));
assert.deepEqual([bank.points, bank.roundScore, bank.cleared, bank.run.phase],
  [2, 2, false, "playing"]);
assert.equal(bank.run.totalScore, 2);
state = { ...state, score: bank.roundScore, run: bank.run };
bank = recordRogueliteBank(state.run, state.score, tile(3, 2));
assert.deepEqual([bank.points, bank.roundScore, bank.cleared, bank.run.phase],
  [2, 4, true, "round-clear"]);
assert.throws(() => recordRogueliteBank(bank.run, 4, tile(2, 2)), RangeError);
state = { ...state, score: bank.roundScore, run: bank.run,
  discovered: ["7-2"], banked: ["7-2", "3-2"],
  locked: [3], mergeReady: [0], moves: 8, movesLeft: 3, mergeCredit: 1 };
const original = structuredClone(state);
const next = advanceRogueliteRound(state, constantRng);
assert.equal(next.run.round, 2);
assert.equal(next.run.totalScore, 4);
assert.equal(next.run.phase, "playing");
assert.equal(next.score, 0);
assert.equal(next.movesLeft, 10);
assert.equal(next.mergeCredit, 0);
assert.equal(next.moves, 0);
assert.deepEqual(next.discovered, ["7-2"]);
assert.deepEqual(next.banked, []);
assert.deepEqual(next.locked, []);
assert.deepEqual(next.mergeReady, []);
assert.deepEqual(state, original, "round change must not mutate the previous state");
assert.throws(() => advanceRogueliteRound(next), RangeError);

// Exponent-only points accumulate through successive rounds.
const secondBank = recordRogueliteBank(next.run, 4, tile(13, 3));
assert.equal(secondBank.roundScore, 7);
assert.equal(secondBank.run.totalScore, 7);
assert.equal(secondBank.run.phase, "round-clear");

// The final bank completes a 12-round run rather than starting round 13.
const finalist = { ...next.run, round: 12, totalScore: 200, phase: "playing" };
const victory = recordRogueliteBank(finalist, 37, tile(2, 3));
assert.equal(victory.run.phase, "victory");
assert.equal(victory.run.totalScore, 203);
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
assert.match(app, /recordRogueliteBank\(state\.run, state\.score, t\)/);
assert.match(app, /advanceRogueliteRound\(state\)/);
assert.match(app, /state\.run\.totalSlides\s*\+=\s*1/);
assert.match(app, /state\.over\s*=\s*gameEnded/);
assert.match(html, /id="modeClassic"/);
assert.match(html, /id="modeRoguelite"/);
assert.match(html, /id="rogueProgress"[^>]*hidden/);
assert.match(html, /id="roundClearPanel"[^>]*hidden/);
assert.match(html, /id="roundScoreProgress"/);
console.log("All Index Shuffle Roguelite pass-one tests passed.");
