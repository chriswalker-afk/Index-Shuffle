export const SIZE = 4;
export const INITIAL_MOVES_LEFT = 10;
export const MAX_MOVES_LEFT = 10;
export const MERGES_PER_BONUS_MOVE = 2;
export const BUDGET_RULES_VERSION = 2;

// Only preserve balances created under the correct-banking reward system.
// The earlier version credited unbanked merges, so its saved counter
// cannot be translated reliably. Give that run a new ten-move allowance.
export function restoreMoveBudget(saved = {}) {
  if (saved?.budgetRulesVersion !== BUDGET_RULES_VERSION) {
    return {
      movesLeft: INITIAL_MOVES_LEFT,
      mergeCredit: 0,
      budgetRulesVersion: BUDGET_RULES_VERSION
    };
  }
  return {
    movesLeft: Number.isSafeInteger(saved.movesLeft)
      ? Math.max(0, Math.min(MAX_MOVES_LEFT, saved.movesLeft))
      : INITIAL_MOVES_LEFT,
    mergeCredit: Number.isSafeInteger(saved.mergeCredit) &&
      saved.mergeCredit >= 0 && saved.mergeCredit < MERGES_PER_BONUS_MOVE
      ? saved.mergeCredit : 0,
    budgetRulesVersion: BUDGET_RULES_VERSION
  };
}

// Slides ONLY subtract moves: 1 plus one for every blocker already on
// the board. Warning tiles are not active blockers. No merge performed
// during the slide may offset this cost; the player must bank it correctly.
export function spendMove(movesLeft, activeBlockers = 0) {
  if (!Number.isSafeInteger(movesLeft) || movesLeft < 0 ||
      !Number.isSafeInteger(activeBlockers) || activeBlockers < 0) {
    throw new RangeError("Invalid move balance or active blocker count");
  }
  const cost = 1 + activeBlockers;
  return { movesLeft: Math.max(0, movesLeft - cost), cost };
}

// Only a correctly BANKED tile that genuinely originated in a merge
// advances the bonus. Correctly banking two such tiles restores one move.
// Banked random-spawn powers never count until they have merged. The bonus
// can never raise Moves Left above 10.
export function creditCorrectBank(movesLeft, mergeCredit, mergedPower) {
  if (!Number.isSafeInteger(movesLeft) || movesLeft < 0 ||
      movesLeft > MAX_MOVES_LEFT ||
      !Number.isSafeInteger(mergeCredit) || mergeCredit < 0 ||
      mergeCredit >= MERGES_PER_BONUS_MOVE ||
      typeof mergedPower !== "boolean") {
    throw new RangeError("Invalid banking bonus state");
  }
  if (movesLeft === 0 || !mergedPower) {
    return { movesLeft, mergeCredit, earned: 0 };
  }
  const progress = mergeCredit + 1;
  const possible = Math.floor(progress / MERGES_PER_BONUS_MOVE);
  const earned = Math.min(possible, MAX_MOVES_LEFT - movesLeft);
  return {
    movesLeft: movesLeft + earned,
    mergeCredit: progress % MERGES_PER_BONUS_MOVE,
    earned
  };
}
export const EXTRA_SPAWN_START = 40;
export const EXTRA_SPAWN_INTERVAL = 10;
export const BLOCKER_START = 10;
export const BLOCKER_INTERVAL = 10;
export const MAX_BLOCKERS = 2;
// A pre-existing saved blocker has no tier and retains its old three-hit rule.
export const BLOCKER_HITS = 3;
export const MAX_BLOCKER_HITS = 5;

// Move 10: one hit; 20: two; 30: three; 40: four;
// 50 onward: five. Never make a blocker impossible to clear.
export function blockerHitsForMove(moves) {
  if (moves < BLOCKER_START) return 0;
  return Math.min(MAX_BLOCKER_HITS,
    1 + Math.floor((moves - BLOCKER_START) / BLOCKER_INTERVAL));
}
export const BASES = [2, 3, 5, 7, 11, 13];
export const BASE_UNLOCKS = Object.freeze([
  { base: 7, moves: 15 },
  { base: 11, moves: 35 },
  { base: 13, moves: 60 }
]);

// Only successful board slides count. Once unlocked, a new base starts rare
// and gradually becomes as common as the original bases over twelve moves.
export function activeBases(moves = 0) {
  return BASES.filter(base =>
    !BASE_UNLOCKS.some(step => step.base === base && moves < step.moves));
}
function baseWeight(base, moves) {
  const unlock = BASE_UNLOCKS.find(step => step.base === base);
  if (!unlock) return 1;
  if (moves < unlock.moves) return 0;
  const progress = Math.min(1, Math.max(0, (moves - unlock.moves) / 12));
  return 0.3 + 0.7 * progress;
}

export const tile = (base, exp = 1) => ({ base, exp });
export const blocker = (hits = 0, strength = BLOCKER_HITS) =>
  ({ kind: "blocker", hits, strength });
export const warning = (strength = 1) => ({ kind: "warning", strength });
export const isBlocker = t => Boolean(t && t.kind === "blocker");
// A warning is not yet an active blocker, so it does not increase costs.
export const slideCost = board => 1 + board.filter(isBlocker).length;
export const isWarning = t => Boolean(t && t.kind === "warning");
export const isObstacle = t => isBlocker(t) || isWarning(t);
// Legacy saved blockers did not contain strength; keep their existing
// three-merge durability rather than silently resetting current runs.
export const blockerStrength = t =>
  Number.isSafeInteger(t?.strength) && t.strength >= 1
    ? t.strength : BLOCKER_HITS;
export const key = t => isBlocker(t)
  ? "blocker:" + blockerStrength(t) + ":" + t.hits
  : isWarning(t) ? "warning:" + blockerStrength(t)
  : t.base + "-" + t.exp;

export function adjacentIndices(index) {
  const row = Math.floor(index / SIZE), col = index % SIZE;
  const indices = [];
  if (row > 0) indices.push(index - SIZE);
  if (row < SIZE - 1) indices.push(index + SIZE);
  if (col > 0) indices.push(index - 1);
  if (col < SIZE - 1) indices.push(index + 1);
  return indices;
}

const keyOrNull = t => t ? key(t) : "";

// Each input tile maps to its destination, including both halves of a merge.
// The movements are also used for the optional, reduced-motion-aware UI animation.
export function slide(board, direction, rules = null) {
  if (!["left", "right", "up", "down"].includes(direction)) {
    throw new RangeError("Unknown slide direction");
  }
  const next = Array(SIZE * SIZE).fill(null);
  const merges = [];
  const motions = [];
  const mergeDestinations = [];

  for (let line = 0; line < SIZE; line++) {
    const ids = Array.from({ length: SIZE }, (_, i) =>
      direction === "left" ? line * SIZE + i
        : direction === "right" ? line * SIZE + SIZE - 1 - i
        : direction === "up" ? i * SIZE + line
        : (SIZE - 1 - i) * SIZE + line
    );

    // A fixed blocker divides a row or column into independent sliding
    // segments. No tile may slide or merge through the blocker.
    for (let start = 0; start < SIZE;) {
      if (isObstacle(board[ids[start]])) {
        next[ids[start]] = { ...board[ids[start]] };
        start++;
        continue;
      }
      let end = start;
      while (end < SIZE && !isObstacle(board[ids[end]])) end++;
      const segment = ids.slice(start, end);
      const packed = segment.map(from => ({ from, value: board[from] }))
        .filter(item => item.value);
      const out = [];

      for (let i = 0; i < packed.length; i++) {
        const a = packed[i], b = packed[i + 1];
        const to = segment[out.length];
        if (b && a.value.base === b.value.base &&
            !rules?.noMergeBases?.includes(a.value.base)) {
          const merged = tile(a.value.base, a.value.exp + b.value.exp);
          // Gold is tile metadata in Roguelite. It moves with a tile and
          // survives merging; two golden inputs produce a double-gold tile.
          // Classic tiles have no gold metadata, so Classic is unchanged.
          const goldA = [1, 2].includes(a.value.gold) ? a.value.gold : 0;
          const goldB = [1, 2].includes(b.value.gold) ? b.value.gold : 0;
          const gold = Math.min(2, goldA + goldB);
          if (gold) merged.gold = gold;
          out.push(merged);
          merges.push(merged);
          mergeDestinations.push(to);
          motions.push({ from: a.from, to, merged: true });
          motions.push({ from: b.from, to, merged: true });
          i++;
        } else {
          out.push({ ...a.value });
          motions.push({ from: a.from, to, merged: false });
        }
      }
      segment.forEach((id, i) => { next[id] = out[i] || null; });
      start = end;
    }
  }

  // Sliding and merging NEVER damage blockers. Damage is awarded only by
  // attemptBank() after the student gives a correct banking answer.
  return {
    board: next, merges, motions, mergeDestinations,
    damaged: [], destroyed: [],
    changed: next.some((t, i) => keyOrNull(t) !== keyOrNull(board[i]))
  };
}

// Golden number cards are cashable even at exponent 1. Unlike ordinary
// powers, a new golden copy of a previously banked base/exponent remains
// worth banking: the gold status is a new, one-time opportunity. The
// replacement always loses gold, so it cannot be banked again for free.
export function isBankable(t, banked, index, locked = new Set()) {
  if (!t || isObstacle(t) || locked.has(index)) return false;
  const golden = t.gold === 1 || t.gold === 2;
  return Number.isSafeInteger(t.exp) && (t.exp >= 2 || (golden && t.exp === 1)) &&
    (golden || !banked.has(key(t)));
}

export function canMove(board, banked, locked = new Set(), rules = null) {
  if (board.some((t, i) => isBankable(t, banked, i, locked))) return true;
  // An empty square is not enough: blockers can isolate it so that no
  // tile can actually move. Check the four legal swipes instead.
  return ["up", "down", "left", "right"].some(direction =>
    slide(board, direction, rules).changed);
}

// The move budget is an independent loss condition: available banks or
// merges cannot rescue a game once the balance has reached zero.
export function gameEnded(board, banked, locked, movesLeft, rules = null) {
  return movesLeft <= 0 || !canMove(board, banked, locked, rules);
}

// Banking never opens a free square. The same base remains, downgraded to a
// randomly chosen smaller power that has actually been discovered this game.
// An exponent of 1 is always eligible: base tiles are available from the start.
export function bankReplacement(t, discovered, rng = Math.random) {
  if (!t || isObstacle(t) || (t.exp < 2 &&
      !(t.exp === 1 && [1, 2].includes(t.gold)))) {
    throw new RangeError("Banking requires a power or a golden number");
  }
  // A golden base tile can be banked correctly for its face value;
  // converting it to a normal base tile consumes its one-off gold.
  if (t.exp === 1) return tile(t.base);
  const exponents = new Set([1]);
  for (const value of discovered) {
    const [base, exp] = value.split("-").map(Number);
    if (base === t.base && Number.isSafeInteger(exp) && exp > 1 && exp < t.exp) {
      exponents.add(exp);
    }
  }
  const unlocked = [...exponents].sort((a, b) => a - b);
  const selection = Math.min(unlocked.length - 1, Math.max(0, Math.floor(rng() * unlocked.length)));
  return tile(t.base, unlocked[selection]);
}

// Keep the familiar ~85% base / 11% square / 3% cube / 1% higher-power
// split whenever those categories are unlocked. Missing categories are
// automatically reweighted by spawn().
export function spawnOptions(discovered, moves = 0) {
  const active = activeBases(moves);
  const weighted = active.map(base => ({ base, weight: baseWeight(base, moves) }));
  const weightSum = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const options = weighted.map(({ base, weight }) =>
    ({ t: tile(base), w: 85 * weight / weightSum }));

  const pool = Array.from(discovered)
    .map(k => { const [base, exp] = k.split("-").map(Number); return tile(base, exp); })
    .filter(t => active.includes(t.base) && t.exp >= 2 && t.exp <= 6);
  const squares = pool.filter(t => t.exp === 2);
  const cubes = pool.filter(t => t.exp === 3);
  const higher = pool.filter(t => t.exp >= 4);
  if (squares.length) options.push(...squares.map(t => ({ t, w: 11 / squares.length })));
  if (cubes.length) options.push(...cubes.map(t => ({ t, w: 3 / cubes.length })));
  if (higher.length) options.push(...higher.map(t => ({ t, w: 1 / higher.length })));
  return options;
}

export function spawn(board, discovered, rng = Math.random, moves = 0, avoid = new Set()) {
  const empty = board.map((t, i) => t || avoid.has(i) ? null : i).filter(i => i !== null);
  if (!empty.length) return board.slice();
  const options = spawnOptions(discovered, moves);
  const total = options.reduce((sum, option) => sum + option.w, 0);
  let pick = rng() * total, chosen = options[0].t;
  for (const option of options) {
    pick -= option.w;
    if (pick < 0) { chosen = option.t; break; }
  }
  const next = board.slice();
  next[empty[Math.floor(rng() * empty.length)]] = tile(chosen.base, chosen.exp);
  return next;
}

function newlyOccupied(before, after) {
  return after.findIndex((t, i) => !before[i] && Boolean(t));
}

// The warning is placed one successful slide BEFORE its blocker.
// Its position is reserved, so the player knows exactly where it will appear.
// Both are fixed movement barriers, but only a mature blocker takes damage.
// All scheduled blockers MUST have been previewed, so a skipped preview
// can never surprise the player by spawning a blocker later.
export function turnSpawns(board, discovered, moves, rng = Math.random,
  avoid = new Set(), spawnProgressMoves = moves, rules = null) {
  let next = board.slice();
  const spawned = [];
  let blockerAt = -1, warningAt = -1;

  // A warning always becomes a solid blocker on the NEXT successful
  // slide, even if an item delayed the later warning schedule.
  // Classic's milestone-based timing is unchanged.
  const hadWarning = next.some(isWarning);
  if (hadWarning) {
    next = next.map((value, index) => {
      if (!isWarning(value)) return value;
      blockerAt = index;
      return blocker(0, blockerStrength(value));
    });
  }

  // At moves 9, 19, 29, ... reserve an eligible square for the next
  // successful slide, before number spawning can occupy that square.
  const previewMove = BLOCKER_START - 1;
  if (!hadWarning && moves >= previewMove &&
      (moves - previewMove) % BLOCKER_INTERVAL === 0 &&
      next.filter(isObstacle).length < MAX_BLOCKERS) {
    const candidates = next.map((value, index) => {
      if (value || avoid.has(index)) return -1;
      const neighbours = adjacentIndices(index);
      if (neighbours.some(j => isObstacle(next[j]))) return -1;
      if (!neighbours.some(j => next[j] && !isObstacle(next[j]))) return -1;
      // Do not turn the reserved square into an immediate dead end.
      // The player must retain at least one possible swipe after it is marked.
      const probe = next.slice();
      probe[index] = warning(blockerHitsForMove(moves + 1));
      return ["left", "right", "up", "down"].some(dir =>
        slide(probe, dir, rules).changed)
        ? index : -1;
    }).filter(index => index >= 0);
    if (candidates.length) {
      const chosen = Math.min(candidates.length - 1,
        Math.max(0, Math.floor(rng() * candidates.length)));
      warningAt = candidates[chosen];
      next[warningAt] = warning(blockerHitsForMove(moves + 1));
    }
  }

  const addNumber = () => {
    const before = next;
    next = spawn(next, discovered, rng, spawnProgressMoves, avoid);
    const index = newlyOccupied(before, next);
    if (index >= 0) spawned.push(index);
  };
  addNumber();
  if (moves >= EXTRA_SPAWN_START && moves % EXTRA_SPAWN_INTERVAL === 0) addNumber();

  return {
    board: next, spawned, extraSpawned: spawned.length >= 2,
    blockerAt, warningAt
  };
}

export function initial(rng = Math.random, spawnProgressMoves = 0) {
  let board = Array(SIZE * SIZE).fill(null);
  for (let i = 0; i < 3; i++) board = spawn(board, new Set(), rng, spawnProgressMoves);
  return board;
}

export function answerFor(t) { return BigInt(t.base) ** BigInt(t.exp); }
export function scoreFor(t) { return t.exp * 10 + (t.exp - 1) * 5; }
export function checkAnswer(t, input) {
  try { return /^\d+$/.test(input.trim()) && BigInt(input.trim()) === answerFor(t); }
  catch { return false; }
}

// A power becomes "merge-ready" whenever it is produced by combining
// two tiles. The provenance follows the resulting tile as it slides and
// survives further merges. Randomly spawned powers are NOT merge-ready.
export function mergeReadyAfterSlide(previous = [], motions = []) {
  const wasReady = new Set(previous);
  const ready = new Set();
  for (const movement of motions) {
    if (movement.merged || wasReady.has(movement.from)) ready.add(movement.to);
  }
  return [...ready].sort((a, b) => a - b);
}

// A successful mathematical bank is the ONLY event that can damage a
// blocker. It must be a power that genuinely came from a merge and is
// currently orthogonally next to that blocker. A spawned higher power
// may be banked for points, but it cannot damage blockers until merged.
// Incorrect answers, cancelled attempts and ordinary slides do no damage.
export function attemptBank(board, index, answer,
  { discovered = new Set(), banked = new Set(),
    locked = new Set(), mergeReady = new Set(), blockerDamage = 1 } = {},
  rng = Math.random) {
  if (!Number.isSafeInteger(blockerDamage) || blockerDamage < 1 || blockerDamage > 2) {
    throw new RangeError("Blocker banking damage must be one or two hits");
  }
  const t = board[index];
  if (!isBankable(t, banked, index, locked)) return { status: "unavailable" };
  if (!checkAnswer(t, answer)) return { status: "incorrect" };

  const replacement = bankReplacement(t, discovered, rng);
  const next = board.slice();
  next[index] = replacement;
  const damaged = [], destroyed = [];
  if (mergeReady.has(index)) {
    for (const target of adjacentIndices(index)) {
      if (!isBlocker(next[target])) continue;
      const strength = blockerStrength(next[target]);
      const hits = next[target].hits + blockerDamage;
      if (hits >= strength) {
        next[target] = null;
        destroyed.push(target);
      } else {
        next[target] = blocker(hits, strength);
        damaged.push(target);
      }
    }
  }
  return {
    status: "success", board: next, replacement,
    powerKey: key(t), points: scoreFor(t),
    creditedMerge: mergeReady.has(index),
    damaged, destroyed
  };
}
