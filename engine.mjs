export const SIZE = 4;
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
export function slide(board, direction) {
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
        if (b && a.value.base === b.value.base) {
          const merged = tile(a.value.base, a.value.exp + b.value.exp);
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

  // Each blocker keeps its own durability tier. One hit per merge that
  // lands orthogonally beside it; diagonal merges and simple slides do nothing.
  const damaged = [], destroyed = [];
  for (let i = 0; i < board.length; i++) {
    if (!isBlocker(board[i])) continue;
    const adjacent = adjacentIndices(i);
    const hits = mergeDestinations.filter(dest => adjacent.includes(dest)).length;
    if (!hits) continue;
    const totalHits = board[i].hits + hits;
    const strength = blockerStrength(board[i]);
    if (totalHits >= strength) {
      next[i] = null;
      destroyed.push(i);
    } else {
      next[i] = blocker(totalHits, strength);
      damaged.push(i);
    }
  }

  return {
    board: next, merges, motions, mergeDestinations, damaged, destroyed,
    changed: next.some((t, i) => keyOrNull(t) !== keyOrNull(board[i]))
  };
}

export function isBankable(t, banked, index, locked = new Set()) {
  return Boolean(t && !isObstacle(t) &&
    t.exp >= 2 && !banked.has(key(t)) && !locked.has(index));
}

export function canMove(board, banked, locked = new Set()) {
  if (board.some((t, i) => isBankable(t, banked, i, locked))) return true;
  // An empty square is not enough: blockers can isolate it so that no
  // tile can actually move. Check the four legal swipes instead.
  return ["up", "down", "left", "right"].some(direction => slide(board, direction).changed);
}

// Banking never opens a free square. The same base remains, downgraded to a
// randomly chosen smaller power that has actually been discovered this game.
// An exponent of 1 is always eligible: base tiles are available from the start.
export function bankReplacement(t, discovered, rng = Math.random) {
  if (!t || isObstacle(t) || t.exp < 2) throw new RangeError("Banking requires a power");
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
export function turnSpawns(board, discovered, moves, rng = Math.random, avoid = new Set()) {
  let next = board.slice();
  const spawned = [];
  let blockerAt = -1, warningAt = -1;

  // A warning from the preceding move becomes a solid blocker precisely
  // on the advertised ten-move milestone, retaining its planned tier.
  if (moves >= BLOCKER_START &&
      (moves - BLOCKER_START) % BLOCKER_INTERVAL === 0) {
    next = next.map((value, index) => {
      if (!isWarning(value)) return value;
      blockerAt = index;
      return blocker(0, blockerStrength(value));
    });
  }

  // At moves 9, 19, 29, ... reserve an eligible square for the next
  // successful slide, before number spawning can occupy that square.
  const previewMove = BLOCKER_START - 1;
  if (moves >= previewMove &&
      (moves - previewMove) % BLOCKER_INTERVAL === 0 &&
      next.filter(isObstacle).length < MAX_BLOCKERS) {
    const candidates = next.map((value, index) => {
      if (value || avoid.has(index)) return -1;
      const neighbours = adjacentIndices(index);
      if (neighbours.some(j => isObstacle(next[j]))) return -1;
      return neighbours.some(j => next[j] && !isObstacle(next[j])) ? index : -1;
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
    next = spawn(next, discovered, rng, moves, avoid);
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

export function initial(rng = Math.random) {
  let board = Array(SIZE * SIZE).fill(null);
  for (let i = 0; i < 3; i++) board = spawn(board, new Set(), rng);
  return board;
}

export function answerFor(t) { return BigInt(t.base) ** BigInt(t.exp); }
export function scoreFor(t) { return t.exp * 10 + (t.exp - 1) * 5; }
export function checkAnswer(t, input) {
  try { return /^\d+$/.test(input.trim()) && BigInt(input.trim()) === answerFor(t); }
  catch { return false; }
}
