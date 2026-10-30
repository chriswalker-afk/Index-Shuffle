// Roguelite boss encounters. This module is deliberately independent of
// roguelite.mjs so the round controller can apply boss rules without cycles.
import {
  blocker, isBlocker, isObstacle, isWarning, canMove,
  MAX_BLOCKERS, adjacentIndices
} from "./engine.mjs?v=hazard-pass3-v1";

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
    detail: "Each newly merged base-3 power has three successful slides to be banked. Its countdown follows the tile when it moves; expiring powers become one-hit blockers if the board stays playable and the blocker cap allows it." }
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
  banked = new Set()) {
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
    if (fresh.has(i)) return { ...t, curseLeft: 3 };
    if (Number.isInteger(t.curseLeft) && t.curseLeft > 0) {
      return { ...t, curseLeft: t.curseLeft - 1 };
    }
    return t;
  });
  const expired = [], spared = [];
  for (let i = 0; i < next.length; i++) {
    const t = next[i];
    if (!t || isObstacle(t) || t.base !== 3 || t.curseLeft !== 0) continue;
    const probe = next.slice();
    probe[i] = blocker(0, 1);
    const occupied = next.filter(x => isBlocker(x) || isWarning(x)).length;
    if (occupied < MAX_BLOCKERS && canMove(probe, banked, new Set(), bossMovementRules(run))) {
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
