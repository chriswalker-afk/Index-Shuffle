// Roguelite progression and economy. Classic keeps its original scoring and rules.
import {
  initial, INITIAL_MOVES_LEFT, MAX_MOVES_LEFT, BUDGET_RULES_VERSION
} from "./engine.mjs?v=hazard-counter-v1";
import {
  createBossSchedule, restoreBossSchedule, bossPointsFor,
  bossTargetFor, startBossBoard, nextFrozenDirection, validFrozenDirection
} from "./bosses.mjs?v=hazard-counter-v1";
import { emptyRunStats, restoreRunStats } from "./milestones.mjs?v=hazard-counter-v1";
import { emptyHazardLayer } from "./hazards.mjs?v=hazard-counter-v1";

export const ROUND_TARGETS = Object.freeze([
  8, 11, 14, 17, 20, 24, 28, 33, 39, 45, 52, 60
]);
export const TOTAL_ROUNDS = ROUND_TARGETS.length;
export const GOLD_SPAWN_CHANCE = 0.12;
export const GOLD_PITY_SLIDES = 5;
export const MAX_SPARE_MOVE_COINS = 5;

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

// Gold is carried by number tiles, not by a separate obstacle. Two golden
// tiles merged together create a double-gold power; repeated merges cap at 2.
export function goldTier(power) {
  return power?.gold === 2 ? 2 : power?.gold === 1 ? 1 : 0;
}

// Run this on the indices of newly spawned number tiles, AFTER the ordinary
// spawning logic. Pity is based on successful slides, not how many number
// tiles appeared during a slide. A gold opportunity is guaranteed on the
// sixth successful slide if the preceding five produced no gold.
export function markGoldSpawns(board, spawnedIndices, dryStreak = 0,
  rng = Math.random, countAsSlide = true, rates = null) {
  if (!Array.isArray(board) || board.length !== 16 ||
      !Array.isArray(spawnedIndices) ||
      !Number.isSafeInteger(dryStreak) || dryStreak < 0 ||
      typeof rng !== "function") {
    throw new RangeError("Invalid gold spawn inputs");
  }
  const defaultChance = GOLD_SPAWN_CHANCE;
  const baseChance = rates?.baseChance ?? defaultChance;
  const sevenChance = rates?.sevenChance ?? baseChance;
  if (![baseChance, sevenChance].every(rate =>
    Number.isFinite(rate) && rate >= 0 && rate <= 1)) {
    throw new RangeError("Invalid gold spawn probabilities");
  }
  const next = board.slice();
  const unique = [...new Set(spawnedIndices)];
  let goldSpawned = 0;
  for (const index of unique) {
    if (!Number.isInteger(index) || index < 0 || index >= board.length ||
        !board[index] || !Number.isInteger(board[index].base) ||
        goldTier(board[index]) !== 0) {
      throw new RangeError("Gold may only be added to new ordinary number tiles");
    }
    const force = dryStreak >= GOLD_PITY_SLIDES && goldSpawned === 0;
    const chance = board[index].base === 7 ? sevenChance : baseChance;
    if (force || rng() < chance) {
      next[index] = { ...board[index], gold: 1 };
      goldSpawned++;
    }
  }
  return {
    board: next, goldSpawned,
    dryStreak: countAsSlide
      ? (goldSpawned ? 0 : Math.min(GOLD_PITY_SLIDES, dryStreak + 1)) : 0
  };
}

function startingBoard(rng, progress = 0, rates = null) {
  const board = initial(rng, progress);
  const indices = board.map((value, index) => value ? index : -1).filter(i => i >= 0);
  return markGoldSpawns(board, indices, 0, rng, false, rates).board;
}

// Any golden number can be correctly banked for a small coin reward.
// Banking a genuinely merged golden power pays more, rewarding the risk of
// keeping it on the board. Replacement tiles lose gold and cannot be farmed.
export function goldForBank(power, merged) {
  if (typeof merged !== "boolean") throw new RangeError("Invalid merge status");
  const gold = goldTier(power);
  if (!gold) return 0;
  if (!merged) return 1;
  if (gold === 2) return 4;
  return power.exp >= 4 ? 3 : 2;
}

export function spareMoveGold(movesLeft) {
  if (!Number.isSafeInteger(movesLeft) || movesLeft < 0 ||
      movesLeft > MAX_MOVES_LEFT) {
    throw new RangeError("Invalid remaining move count");
  }
  return Math.min(movesLeft, MAX_SPARE_MOVE_COINS);
}

// Each correct bank awards its exponent irrespective of base. Ordinary
// banking still requires exp >= 2, but golden exp-1 cards are now bankable.
export function scoreForRoguelitePower(power) {
  if (!power || !Number.isSafeInteger(power.exp) ||
      (power.exp < 2 && !(power.exp === 1 && goldTier(power) > 0)) ||
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
      !["playing", "round-clear", "shop", "victory"].includes(run.phase)) return false;
  if (["round-clear", "shop"].includes(run.phase) && run.round === TOTAL_ROUNDS) return false;
  if (run.phase === "victory" && run.round !== TOTAL_ROUNDS) return false;
  return true;
}

const nonnegativeInteger = value =>
  Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Pass-one saves did not have an economy. Preserve their game and grant an
// outstanding spare-move reward exactly once if a round was already cleared.
export function restoreRogueliteRun(run, movesLeft = 0) {
  if (!validRogueliteRun(run)) throw new RangeError("Invalid Roguelite save");
  const coins = nonnegativeInteger(run.coins);
  const roundBankCoins = nonnegativeInteger(run.roundBankCoins);
  const totalCoinsEarned = Math.max(coins, nonnegativeInteger(run.totalCoinsEarned));
  const goldDryStreak = Math.min(GOLD_PITY_SLIDES, nonnegativeInteger(run.goldDryStreak));
  const previousReward = run.lastRoundReward;
  const validReward = previousReward && [ "bankCoins", "moveCoins", "unusedMoves", "totalCoins" ]
    .every(key => Number.isSafeInteger(previousReward[key]) && previousReward[key] >= 0);
  const restored = {
    ...run, coins, roundBankCoins, totalCoinsEarned, goldDryStreak,
    // Preserve a previously rolled freeze; repairs for boards with only
    // one legal slide happen after the saved board/hazards are restored.
    frozenDirection: validFrozenDirection(run.frozenDirection) ? run.frozenDirection : null,
    stats: restoreRunStats(run.stats),
    bosses: restoreBossSchedule(run),
    lastRoundReward: validReward ? { ...previousReward } : null
  };
  if (run.phase !== "playing" && !restored.lastRoundReward) {
    const bonus = spareMoveGold(movesLeft);
    restored.coins += bonus;
    restored.totalCoinsEarned += bonus;
    restored.lastRoundReward = {
      bankCoins: restored.roundBankCoins, moveCoins: bonus,
      unusedMoves: movesLeft, totalCoins: restored.roundBankCoins + bonus
    };
  }
  return restored;
}

export function newRogueliteRun(best = 0, rng = Math.random) {
  return {
    mode: "roguelite",
    board: startingBoard(rng), hazards: emptyHazardLayer(),
    discovered: [], banked: [], locked: [], mergeReady: [],
    score: 0, best: Number.isSafeInteger(best) && best > 0 ? best : 0,
    moves: 0, movesLeft: INITIAL_MOVES_LEFT, mergeCredit: 0,
    budgetRulesVersion: BUDGET_RULES_VERSION, over: false, notice: "",
    resultsFinalized: false, resultsDismissed: false,
    run: {
      round: 1, totalScore: 0, totalSlides: 0, phase: "playing",
      stats: emptyRunStats(),
      coins: 0, totalCoinsEarned: 0, roundBankCoins: 0,
      goldDryStreak: 0, lastRoundReward: null,
      scoredBanks: 0, twosBanked: 0, lastBankBase: null,
      protectionSlides: 0, blockerDelay: 0,
      hazardWarning: null, hazardCooldown: 0,
      bosses: createBossSchedule(rng),
      frozenDirection: null,
      inventory: { permanents: [null, null], consumables: [null, null] },
      shop: null
    }
  };
}

// Invoked ONLY after the correct-answer banking engine succeeds. The
// final successful bank also awards the spare-move bonus, including any
// +1 move earned by that bank before this function is called.
export function recordRogueliteBank(run, previousScore, power,
  { merged = false, movesLeft = 0, scoreOverride = null,
    extraCoins = 0, counters = null } = {}) {
  if (!validRogueliteRun(run) || run.phase !== "playing" ||
      !Number.isSafeInteger(previousScore) || previousScore < 0 ||
      typeof merged !== "boolean" || (scoreOverride !== null &&
        (!Number.isSafeInteger(scoreOverride) || scoreOverride < 0)) ||
      !Number.isSafeInteger(extraCoins) || extraCoins < 0 ||
      (counters !== null && (typeof counters !== "object" ||
        !["scoredBanks", "twosBanked", "blockerDelay"].every(field =>
          Number.isSafeInteger(counters[field]) && counters[field] >= 0) ||
        ![null, 2, 3, 5, 7, 11, 13].includes(counters.lastBankBase)))) {
    throw new RangeError("Cannot score outside an active Roguelite round");
  }
  const current = restoreRogueliteRun(run);
  const points = bossPointsFor(current, power,
    scoreOverride ?? scoreForRoguelitePower(power));
  const bankGold = goldForBank(power, merged) + extraCoins;
  const roundScore = previousScore + points;
  const cleared = roundScore >= bossTargetFor(current, targetForRound(run.round));
  const phase = !cleared ? "playing"
    : run.round === TOTAL_ROUNDS ? "victory" : "round-clear";
  const moveGold = cleared ? spareMoveGold(movesLeft) : 0;
  const roundBankCoins = current.roundBankCoins + bankGold;
  const next = {
    ...current, ...(counters || {}), totalScore: current.totalScore + points, phase,
    roundBankCoins, coins: current.coins + bankGold + moveGold,
    totalCoinsEarned: current.totalCoinsEarned + bankGold + moveGold,
    lastRoundReward: cleared ? {
      bankCoins: roundBankCoins, moveCoins: moveGold,
      unusedMoves: movesLeft, totalCoins: roundBankCoins + moveGold
    } : null
  };
  return { points, roundScore, cleared, bankGold, moveGold, run: next };
}

// Currency, discoveries and lifetime slides persist. Round bank locks,
// tile gold, dry streak, blockers, moves, and round score all reset.
export function advanceRogueliteRound(state, rng = Math.random, rates = null) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "shop") {
    throw new RangeError("Advance only after visiting the Roguelite shop");
  }
  const nextRound = state.run.round + 1;
  const run = restoreRogueliteRun(state.run, state.movesLeft);
  const nextRun = {
    ...run, round: nextRound, phase: "playing",
    roundBankCoins: 0, goldDryStreak: 0, lastRoundReward: null, shop: null,
    scoredBanks: 0, twosBanked: 0, lastBankBase: null,
    protectionSlides: 0, blockerDelay: 0,
    hazardWarning: null, hazardCooldown: 0, frozenDirection: null
  };
  const nextBoard = startBossBoard(startingBoard(rng, run.totalSlides, rates),
    nextRun, rng);
  // A boss round starts with one fair, saved freeze. Ordinary rounds and
  // other bosses have no frozen movement controls.
  nextRun.frozenDirection = nextFrozenDirection(nextBoard, nextRun, rng);
  return {
    ...state,
    board: nextBoard,
    hazards: emptyHazardLayer(),
    discovered: [...state.discovered],
    banked: [], locked: [], mergeReady: [],
    score: 0, moves: 0, movesLeft: INITIAL_MOVES_LEFT, mergeCredit: 0,
    budgetRulesVersion: BUDGET_RULES_VERSION,
    over: false,
    notice: "Round " + nextRound + ". Reach " +
      bossTargetFor(nextRun, targetForRound(nextRound)) +
      " points by banking powers correctly.",
    run: nextRun
  };
}
