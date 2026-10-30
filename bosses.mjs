// Roguelite boss encounters. This module is deliberately independent of
// roguelite.mjs so the round controller can apply boss rules without cycles.
import {
  blocker, isBlocker, isObstacle, isWarning, canMove, isBankable, slide,
  MAX_BLOCKERS, adjacentIndices
} from "./engine.mjs?v=runestones-pass2";

export const BOSS_ROUNDS = Object.freeze([3, 6, 9, 12]);
export const BOSS_CATALOG = Object.freeze([
  { id: "blockade", name: "The Blockade", summary: "An extra one-hit blocker starts on the board.",
    detail: "One additional blocker appears before your first slide. It costs an extra move on each slide until destroyed. Correctly bank a genuinely merged power beside it to break it." },
  { id: "five-thief", name: "The Five Thief", summary: "Base-5 powers score zero.",
    detail: "Correctly banking any base-5 power earns zero points even with scoring bonuses. It can still earn coins, restore normal merge credit, and damage adjacent blockers." },
  { id: "scorekeeper", name: "The Scorekeeper", summary: "The score target is 40% higher.",
    detail: "You must reach 140% of this round's normal score target, rounded up. All correctly banked powers and purchased scoring bonuses still work." },
  { id: "silent-seven", name: "The Silent Seven", summary: "Base-7 tiles cannot merge.",
    detail: "Two base-7 tiles cannot merge during this round. Existing bankable 7 powers may still be answered and banked. Other bases merge normally." },
  { id: "power-snob", name: "The Power Snob", summary: "Exponent-2 powers score zero.",
    detail: "Squares are worth zero points regardless of permanent scoring bonuses. Correctly banking them can still earn gold, merge credit, and blocker strikes." },
  { id: "timekeeper", name: "The Timekeeper", summary: "No extra moves can be restored.",
    detail: "Correctly banked merges cannot restore moves, and Second Wind is unavailable during this boss. Protection can still reduce blocker slide surcharges." },
  { id: "three-curse", name: "The Three Curse", summary: "Merged 3 powers expire after three slides.",
    detail: "Each newly merged base-3 power has three successful slides to be banked. Its countdown follows the tile when it moves; expiring powers become one-hit blockers if the board stays playable and the blocker cap allows it." },
  { id: "frostlock", name: "The Frostlock", summary: "One movement direction is frozen.",
    detail: "One randomly chosen slide direction is frozen. Its arrow button, keyboard shortcut and swipe cannot move the board. A frozen attempt costs no moves. The ice switches after each successful slide, correct bank or used item. The boss never freezes the only direction that could move the board." }
].map(b => Object.freeze(b)));
export const BOSS_BY_ID = Object.freeze(Object.fromEntries(
  BOSS_CATALOG.map(b => [b.id, b])
));

const EARLY_BOSSES = Object.freeze(["blockade", "five-thief", "scorekeeper"]);
const clampPick = (rng, length) => Math.max(0, Math.min(length - 1,
  Math.floor(rng() * length)));

export function createBossSchedule(rng = Math.random) {
  if (typeof rng !== "function") throw new RangeError("Boss selector requires a random function");
  const remaining = BOSS_CATALOG.map(b => b.id);
  const schedule = {};
  for (const round of BOSS_ROUNDS) {
    const eligible = remaining.filter(id => round !== 3 || EARLY_BOSSES.includes(id));
    const chosen = eligible[clampPick(rng, eligible.length)];
    schedule[round] = chosen;
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return schedule;
}

export function validBossSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") return false;
  const ids = BOSS_ROUNDS.map(round => schedule[round]);
  return ids.every(id => BOSS_BY_ID[id]) && new Set(ids).size === BOSS_ROUNDS.length &&
    EARLY_BOSSES.includes(schedule[3]);
}

// Earlier runs were saved before Pass 5. Migrate deterministically using
// existing non-secret run progress, so refreshing cannot reshuffle a boss.
export function restoreBossSchedule(run) {
  if (validBossSchedule(run?.bosses)) {
    return { ...run.bosses };
  }
  let seed = (Math.imul((run?.round ?? 1), 104729) +
    Math.imul((run?.totalSlides ?? 0), 1543) +
    Math.imul((run?.totalScore ?? 0), 193) +
    123457) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return createBossSchedule(random);
}

export function bossForRound(run, round = run?.round) {
  if (!BOSS_ROUNDS.includes(round)) return null;
  return BOSS_BY_ID[run?.bosses?.[round]] || null;
}
export const bossId = run => bossForRound(run)?.id ?? null;

export function bossTargetFor(run, normalTarget) {
  if (!Number.isSafeInteger(normalTarget) || normalTarget < 1) {
    throw new RangeError("Invalid round target");
  }
  return bossId(run) === "scorekeeper"
    ? Math.ceil(normalTarget * 1.4) : normalTarget;
}

export function bossPointsFor(run, power, normalPoints) {
  if (!Number.isSafeInteger(normalPoints) || normalPoints < 0) {
    throw new RangeError("Invalid point award");
  }
  const id = bossId(run);
  return (id === "five-thief" && power?.base === 5) ||
    (id === "power-snob" && power?.exp === 2) ? 0 : normalPoints;
}

export const bossAllowsMoveRestoration = run => bossId(run) !== "timekeeper";
export const bossMovementRules = run => bossId(run) === "silent-seven"
  ? { noMergeBases: [7] } : null;

// One extra *weak* blocker, placed only where it won't create an
// immediate no-legal-moves trap. Must start adjacent to a number tile.
export function startBossBoard(board, run, rng = Math.random) {
  if (!Array.isArray(board) || board.length !== 16 ||
      typeof rng !== "function") throw new RangeError("Invalid boss starting board");
  if (bossId(run) !== "blockade" || board.filter(isBlocker).length >= MAX_BLOCKERS) {
    return board.slice();
  }
  const eligible = board.map((t, i) => {
    if (t || !adjacentIndices(i).some(j => board[j] && !isObstacle(board[j]))) {
      return -1;
    }
    const probe = board.slice();
    probe[i] = blocker(0, 1);
    return canMove(probe, new Set(), new Set(), bossMovementRules(run)) ? i : -1;
  }).filter(i => i >= 0);
  if (!eligible.length) return board.slice();
  const next = board.slice();
  next[eligible[clampPick(rng, eligible.length)]] = blocker(0, 1);
  return next;
}

// Only actual merges of base 3 start a timer; random spawns do not.
// The newly produced power begins at 3. Existing timers decrement
// on every successful slide and remain attached to moved tiles.
// If expiry would exceed the 2-blocker cap or strand the player, the
// curse fizzles out instead of causing an unwinnable board.
export function applyThreeCurse(board, mergeDestinations, run,
  banked = new Set(), hazards = null) {
  if (!Array.isArray(board) || board.length !== 16 ||
      !Array.isArray(mergeDestinations)) {
    throw new RangeError("Invalid cursed board");
  }
  if (bossId(run) !== "three-curse") {
    return { board: board.slice(), expired: [], spared: [] };
  }
  const fresh = new Set(mergeDestinations);
  const next = board.map((t, i) => {
    if (!t || isObstacle(t)) return t;
    if (t.base !== 3) return t;
    // Only curse a power that is currently eligible to bank. This
    // includes the new once-per-index rule for gold, Void-reduced
    // exponents and any Cloudy square concealing the power.
    if (fresh.has(i)) return isBankable(t, banked, i, new Set(), hazards)
      ? { ...t, curseLeft: 3 } : t;
    if (Number.isInteger(t.curseLeft) && t.curseLeft > 0) {
      return { ...t, curseLeft: t.curseLeft - 1 };
    }
    return t;
  });
  const expired = [], spared = [];
  for (let i = 0; i < next.length; i++) {
    const t = next[i];
    if (!t || isObstacle(t) || t.base !== 3 || t.curseLeft !== 0) continue;
    // Another bank can invalidate this index before the countdown ends.
    // Never punish a player for failing an impossible banking question.
    if (!isBankable(t, banked, i, new Set(), hazards)) {
      const { curseLeft, ...ordinary } = t;
      next[i] = ordinary;
      spared.push(i);
      continue;
    }
    const probe = next.slice();
    probe[i] = blocker(0, 1);
    const occupied = next.filter(x => isBlocker(x) || isWarning(x)).length;
    if (occupied < MAX_BLOCKERS && canMove(probe, banked, new Set(),
      { ...(bossMovementRules(run) || {}), hazards })) {
      next[i] = probe[i];
      expired.push(i);
    } else {
      const { curseLeft, ...ordinary } = t;
      next[i] = ordinary;
      spared.push(i);
    }
  }
  return { board: next, expired, spared };
}


// The Frostlock freezes one cardinal slide control, never a banking or item
// control. Freezing affects keyboard, on-screen arrows and swipe identically.
// Selection is saved in run.frozenDirection; never choose a new direction in
// render(), since refreshing must not let the player reroll the boss for free.
export const FROST_DIRECTIONS = Object.freeze(["left", "up", "down", "right"]);
export const validFrozenDirection = direction => FROST_DIRECTIONS.includes(direction);

export function frozenControl(run) {
  return bossId(run) === "frostlock" && run?.phase === "playing" &&
    validFrozenDirection(run.frozenDirection) ? run.frozenDirection : null;
}

// Never freeze the one and only direction that actually slides the board.
// This avoids control soft-lock even when the only bankable tile is hidden
// by Cloudy or otherwise unavailable. No randomness is consumed by the
// eligibility calculation.
export function frostlockChoices(board, rules = null) {
  if (!Array.isArray(board) || board.length !== 16) {
    throw new RangeError("Frostlock requires a sixteen-square board");
  }
  const usable = FROST_DIRECTIONS.filter(dir => slide(board, dir, rules).changed);
  return usable.length === 1
    ? FROST_DIRECTIONS.filter(dir => dir !== usable[0])
    : FROST_DIRECTIONS.slice();
}

export function nextFrozenDirection(board, run, rng = Math.random, rules = null) {
  if (bossId(run) !== "frostlock" || run?.phase !== "playing") return null;
  if (typeof rng !== "function") throw new RangeError("Frostlock needs a random selector");
  const safe = frostlockChoices(board, rules);
  // Change the frozen control on each successful action. The initial roll
  // has no previous control, so every safe direction has equal weight.
  const candidates = safe.filter(dir => dir !== frozenControl(run));
  const pool = candidates.length ? candidates : safe;
  return pool[clampPick(rng, pool.length)];
}

// Used only when reading a legacy or malformed save. Keep a saved safe
// direction unchanged, and choose a deterministic safe alternative if that
// direction would now be the board's only playable slide.
export function restoreFrozenDirection(board, run, rules = null) {
  if (bossId(run) !== "frostlock" || run?.phase !== "playing") return null;
  const safe = frostlockChoices(board, rules);
  return safe.includes(frozenControl(run)) ? run.frozenDirection : safe[0];
}
