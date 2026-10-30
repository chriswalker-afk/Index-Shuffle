export const SIZE = 4;
export const BASES = [2, 3, 5];

export const key = t => t.base + "-" + t.exp;
export const tile = (base, exp = 1) => ({ base, exp });

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

  for (let line = 0; line < SIZE; line++) {
    const ids = Array.from({ length: SIZE }, (_, i) =>
      direction === "left" ? line * SIZE + i
        : direction === "right" ? line * SIZE + SIZE - 1 - i
        : direction === "up" ? i * SIZE + line
        : (SIZE - 1 - i) * SIZE + line
    );
    const packed = ids.map(from => ({ from, value: board[from] })).filter(item => item.value);
    const out = [];

    for (let i = 0; i < packed.length; i++) {
      const a = packed[i], b = packed[i + 1];
      const to = ids[out.length];
      if (b && a.value.base === b.value.base) {
        const merged = tile(a.value.base, a.value.exp + b.value.exp);
        out.push(merged);
        merges.push(merged);
        motions.push({ from: a.from, to, merged: true });
        motions.push({ from: b.from, to, merged: true });
        i++;
      } else {
        out.push({ ...a.value });
        motions.push({ from: a.from, to, merged: false });
      }
    }
    ids.forEach((id, i) => { next[id] = out[i] || null; });
  }

  return {
    board: next,
    merges,
    motions,
    changed: next.some((t, i) => keyOrNull(t) !== keyOrNull(board[i]))
  };
}

export function isBankable(t, banked, index, locked = new Set()) {
  return Boolean(t && t.exp >= 2 && !banked.has(key(t)) && !locked.has(index));
}

export function canMove(board, banked, locked = new Set()) {
  if (board.some(t => !t)) return true;
  if (board.some((t, i) => isBankable(t, banked, i, locked))) return true;
  return ["up", "down", "left", "right"].some(direction => slide(board, direction).changed);
}

// Banking never opens a free square. The same base remains, downgraded to a
// randomly chosen smaller power that has actually been discovered this game.
// An exponent of 1 is always eligible: base tiles are available from the start.
export function bankReplacement(t, discovered, rng = Math.random) {
  if (!t || t.exp < 2) throw new RangeError("Banking requires a power");
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

export function spawn(board, discovered, rng = Math.random) {
  const empty = board.map((t, i) => t ? null : i).filter(i => i !== null);
  if (!empty.length) return board.slice();
  const pool = Array.from(discovered)
    .map(k => { const [base, exp] = k.split("-").map(Number); return tile(base, exp); })
    .filter(t => BASES.includes(t.base) && t.exp >= 2 && t.exp <= 6);
  const options = BASES.map(base => ({ t: tile(base), w: 85 / BASES.length }));
  const squares = pool.filter(t => t.exp === 2);
  const cubes = pool.filter(t => t.exp === 3);
  const higher = pool.filter(t => t.exp >= 4);
  if (squares.length) options.push(...squares.map(t => ({ t, w: 11 / squares.length })));
  if (cubes.length) options.push(...cubes.map(t => ({ t, w: 3 / cubes.length })));
  if (higher.length) options.push(...higher.map(t => ({ t, w: 1 / higher.length })));

  const total = options.reduce((sum, item) => sum + item.w, 0);
  let pick = rng() * total, chosen = options[0].t;
  for (const option of options) {
    pick -= option.w;
    if (pick < 0) { chosen = option.t; break; }
  }
  const next = board.slice();
  next[empty[Math.floor(rng() * empty.length)]] = tile(chosen.base, chosen.exp);
  return next;
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
