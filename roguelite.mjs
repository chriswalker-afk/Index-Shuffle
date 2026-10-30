// Roguelite round progression, deliberately independent of Classic scoring.
// Later passes can extend bank bonuses, shops, gold and boss effects here.
import { initial, INITIAL_MOVES_LEFT, BUDGET_RULES_VERSION } from "./engine.mjs?v=roguelite-pass1-v1";

export const ROUND_TARGETS = Object.freeze([
  4, 6, 8, 9, 11, 15, 17, 20, 25, 27, 33, 40
]);
export const TOTAL_ROUNDS = ROUND_TARGETS.length;

export function targetForRound(round) {
  if (!Number.isInteger(round) || round < 1 || round > TOTAL_ROUNDS) {
    throw new RangeError("Unknown Roguelite round");
  }
  return ROUND_TARGETS[round - 1];
}

export function isBossRound(round) {
  targetForRound(round);
  return round % 3 === 0;
}

export function stageForRound(round) {
  targetForRound(round);
  return Math.ceil(round / 3);
}

// A correct bank always earns its exponent, irrespective of the base.
// Future items and boss conditions will modify this score at bank time.
export function scoreForRoguelitePower(power) {
  if (!power || !Number.isSafeInteger(power.exp) || power.exp < 2 ||
      !Number.isSafeInteger(power.base) || power.base < 2) {
    throw new RangeError("Roguelite scoring requires a bankable power");
  }
  return power.exp;
}

export function validRogueliteRun(run) {
  if (!run || !Number.isInteger(run.round) || run.round < 1 ||
      run.round > TOTAL_ROUNDS ||
      !Number.isSafeInteger(run.totalScore) || run.totalScore < 0 ||
      !Number.isSafeInteger(run.totalSlides) || run.totalSlides < 0 ||
      !["playing", "round-clear", "victory"].includes(run.phase)) return false;
  if (run.phase === "round-clear" && run.round === TOTAL_ROUNDS) return false;
  if (run.phase === "victory" && run.round !== TOTAL_ROUNDS) return false;
  return true;
}

export function newRogueliteRun(best = 0, rng = Math.random) {
  return {
    mode: "roguelite",
    board: initial(rng), discovered: [], banked: [], locked: [], mergeReady: [],
    score: 0, best: Number.isSafeInteger(best) && best > 0 ? best : 0,
    moves: 0, movesLeft: INITIAL_MOVES_LEFT, mergeCredit: 0,
    budgetRulesVersion: BUDGET_RULES_VERSION, over: false, notice: "",
    run: { round: 1, totalScore: 0, totalSlides: 0, phase: "playing" }
  };
}

// Invoked only after the existing exact-answer banking engine succeeds.
export function recordRogueliteBank(run, previousScore, power) {
  if (!validRogueliteRun(run) || run.phase !== "playing" ||
      !Number.isSafeInteger(previousScore) || previousScore < 0) {
    throw new RangeError("Cannot score outside an active Roguelite round");
  }
  const points = scoreForRoguelitePower(power);
  const roundScore = previousScore + points;
  const cleared = roundScore >= targetForRound(run.round);
  const phase = !cleared ? "playing"
    : run.round === TOTAL_ROUNDS ? "victory" : "round-clear";
  return {
    points, roundScore, cleared,
    run: { ...run, totalScore: run.totalScore + points, phase }
  };
}

// Keep purchased upgrades/coins here in later passes. For now, the
// banked-power registry, move budget and hazards reset for each round,
// while discovered powers and cumulative slides survive the transition.
export function advanceRogueliteRound(state, rng = Math.random) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "round-clear") {
    throw new RangeError("Advance only after clearing a Roguelite round");
  }
  const nextRound = state.run.round + 1;
  return {
    ...state,
    board: initial(rng, state.run.totalSlides),
    discovered: [...state.discovered],
    banked: [], locked: [], mergeReady: [],
    score: 0, moves: 0, movesLeft: INITIAL_MOVES_LEFT, mergeCredit: 0,
    budgetRulesVersion: BUDGET_RULES_VERSION,
    over: false,
    notice: "Round " + nextRound + ". Reach " + targetForRound(nextRound) +
      " points by banking powers correctly.",
    run: { ...state.run, round: nextRound, phase: "playing" }
  };
}
