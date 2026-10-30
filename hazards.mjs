// Roguelike square hazards — permanent coordinates independent of tile
// objects. Effects, fair placement, warnings and rescue checks live here.
import { SIZE, isObstacle, canMove, adjacentIndices } from "./engine.mjs?v=runestones-pass2";

export const HAZARD_CELLS = SIZE * SIZE;
export const MAX_ACTIVE_HAZARDS = 2;
export const CLOUDY_SLIDES = 3;
export const HAZARD_DEFINITIONS = Object.freeze({
  cloudy: Object.freeze({
    id: "cloudy", name: "Cloudy", icon: "☁", badge: "?",
    description: "Conceals any tile underneath, including its gold status.",
    duration: CLOUDY_SLIDES
  }),
  void: Object.freeze({
    id: "void", name: "Void", icon: "↓", badge: "−1",
    description: "Reduces a landing tile's exponent by one, then disappears."
  }),
  null: Object.freeze({
    id: "null", name: "Null", icon: "⊘", badge: "×",
    description: "Prevents a merge from finishing on this square."
  }),
  cracked: Object.freeze({
    id: "cracked", name: "Cracked", icon: "✧", badge: "↯",
    description: "Turns into Null after a merge finishes here."
  }),
  greedy: Object.freeze({
    id: "greedy", name: "Greedy", icon: "⇣", badge: "−◉",
    description: "Steals gold from a tile travelling through it."
  })
});
export const HAZARD_TYPES = Object.freeze(Object.keys(HAZARD_DEFINITIONS));
const isCell = index => Number.isInteger(index) && index >= 0 &&
  index < HAZARD_CELLS;
const isTileBoard = board => Array.isArray(board) &&
  board.length === HAZARD_CELLS;

// Each slot is null or a serializable descriptor:
// { type: "cloudy", turnsLeft: 3 } / { type: "void" }, etc.
export function emptyHazardLayer() {
  return Array(HAZARD_CELLS).fill(null);
}

export function activeHazardCount(hazards) {
  if (!Array.isArray(hazards) || hazards.length !== HAZARD_CELLS) {
    throw new RangeError("Hazards must be a 4-by-4 layer");
  }
  return hazards.filter(Boolean).length;
}

export function hazardAt(hazards, index) {
  if (!isCell(index) || !Array.isArray(hazards) ||
      hazards.length !== HAZARD_CELLS) {
    throw new RangeError("Invalid hazard position");
  }
  return hazards[index] || null;
}

function normalise(entry) {
  // Do not silently turn an invalid or stale record into a different hazard.
  if (!entry || typeof entry !== "object" ||
      !Object.hasOwn(HAZARD_DEFINITIONS, entry.type)) return null;
  if (entry.type === "cloudy") {
    const turnsLeft = Number.isInteger(entry.turnsLeft) &&
      entry.turnsLeft >= 1 && entry.turnsLeft <= CLOUDY_SLIDES
      ? entry.turnsLeft : CLOUDY_SLIDES;
    return { type: "cloudy", turnsLeft };
  }
  return { type: entry.type };
}

// Safe migration: legacy saves have no hazard layer. Malformed entries,
// duplicate occupancy on blockers, and too many hazards are discarded.
// A Cracked square reserves the only Null-capable slot, preventing an
// eventual Cracked->Null transition from creating a second Null.
export function restoreHazardLayer(saved, board = null) {
  const next = emptyHazardLayer();
  if (!Array.isArray(saved) || saved.length !== HAZARD_CELLS) return next;
  if (board !== null && !isTileBoard(board)) {
    throw new RangeError("Invalid tile board for hazard restoration");
  }
  let count = 0, nullLike = 0;
  for (let i = 0; i < HAZARD_CELLS; i++) {
    if (count >= MAX_ACTIVE_HAZARDS) break;
    const entry = normalise(saved[i]);
    if (!entry || (board && isObstacle(board[i]))) continue;
    if (["cracked", "null"].includes(entry.type)) {
      if (nullLike >= 1) continue;
      nullLike++;
    }
    next[i] = entry;
    count++;
  }
  return next;
}

// These pure helpers support placement/removal. They deliberately
// do not change the number-tile board, move counters or player score.
export function canPlaceHazard(hazards, board, index, type) {
  if (!isCell(index) || !isTileBoard(board) ||
      !Object.hasOwn(HAZARD_DEFINITIONS, type) ||
      !Array.isArray(hazards) || hazards.length !== HAZARD_CELLS) return false;
  const current = restoreHazardLayer(hazards, board);
  if (current[index] || isObstacle(board[index]) ||
      activeHazardCount(current) >= MAX_ACTIVE_HAZARDS) return false;
  return !(["cracked", "null"].includes(type) &&
    current.some(h => h && ["cracked", "null"].includes(h.type)));
}

export function placeHazard(hazards, board, index, type) {
  if (!canPlaceHazard(hazards, board, index, type)) {
    throw new RangeError("Cannot place this hazard on the selected square");
  }
  const next = restoreHazardLayer(hazards, board);
  next[index] = normalise({ type });
  return next;
}

export function removeHazard(hazards, index) {
  const next = restoreHazardLayer(hazards);
  if (!isCell(index)) throw new RangeError("Invalid hazard position");
  next[index] = null;
  return next;
}


// Tuned stage tables: warnings are deliberately less frequent than a
// naïve roll every slide, with a three/four-slide cooldown and a late-round
// grace period. Stronger persistent hazards (Null/Cracked) are rarer than
// short-lived Void/Cloudy. Boss rounds halve all warning chances.
export const HAZARD_DIFFICULTY = Object.freeze({
  1: Object.freeze({ stage: 1, maxActive: 0, firstWarning: Infinity,
    chance: 0, cooldown: 0, types: Object.freeze([]),
    weights: Object.freeze({}) }),
  2: Object.freeze({ stage: 2, maxActive: 1, firstWarning: 3,
    chance: 0.21, cooldown: 4,
    types: Object.freeze(["cloudy", "void", "cracked"]),
    weights: Object.freeze({ cloudy: 45, void: 38, cracked: 17 }) }),
  3: Object.freeze({ stage: 3, maxActive: 2, firstWarning: 2,
    chance: 0.27, cooldown: 3,
    types: Object.freeze(["cloudy", "void", "cracked", "greedy", "null"]),
    weights: Object.freeze({
      cloudy: 32, void: 26, cracked: 18, greedy: 16, null: 8
    }) }),
  4: Object.freeze({ stage: 4, maxActive: 2, firstWarning: 2,
    chance: 0.32, cooldown: 3,
    types: Object.freeze(["cloudy", "void", "cracked", "greedy", "null"]),
    weights: Object.freeze({
      cloudy: 24, void: 22, cracked: 20, greedy: 20, null: 14
    }) })
});

export function hazardDifficulty(round) {
  if (!Number.isInteger(round) || round < 1 || round > 12) {
    throw new RangeError("Unknown Roguelike round for hazards");
  }
  return HAZARD_DIFFICULTY[Math.ceil(round / 3)];
}

export function restoreHazardPressure(run, board, hazards) {
  if (!run || typeof run !== "object" || !isTileBoard(board)) {
    throw new RangeError("Invalid saved hazard pressure");
  }
  const layer = restoreHazardLayer(hazards, board);
  const old = run.hazardWarning;
  const warning = old && isCell(old.index) &&
    Object.hasOwn(HAZARD_DEFINITIONS, old.type) &&
    !layer[old.index] && !isObstacle(board[old.index]) &&
    hazardDifficulty(run.round).types.includes(old.type)
    ? { index: old.index, type: old.type } : null;
  return { ...run,
    hazardWarning: warning,
    hazardCooldown: Number.isSafeInteger(run.hazardCooldown) &&
      run.hazardCooldown >= 0 && run.hazardCooldown <= 100
      ? run.hazardCooldown : 0
  };
}

// The slide engine handles Null and Greedy *while* determining merges.
// Then these effects resolve, in order:
// 1. Void changes the resulting exponent (never below 1) and disappears.
// 2. Cracked becomes Null only AFTER a successful merge here.
// 3. Cloudy loses one duration after every genuine successful slide.
// These are all independent from bankers, blockers, and coin awards.
export function resolveSlideHazards(result, hazards, protection = null) {
  if (!result || !isTileBoard(result.board) ||
      !Array.isArray(result.motions) ||
      !Array.isArray(result.mergeDestinations)) {
    throw new RangeError("Invalid slide result for hazards");
  }
  const layer = restoreHazardLayer(hazards, result.board);
  if (!result.changed) {
    return { ...result, board: result.board.slice(), hazards: layer,
      hazardEvents: [] };
  }
  const board = result.board.slice();
  const arrivals = new Set(result.motions
    .filter(movement => movement.from !== movement.to || movement.merged)
    .map(movement => movement.to));
  const mergedAt = new Set(result.mergeDestinations);
  const hazardEvents = [];
  for (let index = 0; index < HAZARD_CELLS; index++) {
    const existing = layer[index];
    if (!existing) continue;
    if (existing.type === "void" && arrivals.has(index) &&
        board[index] && !isObstacle(board[index])) {
      const before = board[index].exp;
      // Void Cushion protects exponent-2 powers from becoming ordinary
      // exponent-1 numbers; higher powers still lose one exponent.
      const floor = protection?.voidFloor === 2 ? 2 : 1;
      board[index] = { ...board[index],
        exp: Math.max(Math.min(before, floor), before - 1) };
      layer[index] = null;
      hazardEvents.push({ type: "void", index, before,
        after: board[index].exp });
    } else if (existing.type === "cracked" && mergedAt.has(index)) {
      layer[index] = { type: "null" };
      hazardEvents.push({ type: "cracked", index });
    } else if (existing.type === "cloudy") {
      if (existing.turnsLeft <= 1) {
        layer[index] = null;
        hazardEvents.push({ type: "cloud-cleared", index });
      } else {
        layer[index] = { type: "cloudy", turnsLeft: existing.turnsLeft - 1 };
      }
    }
  }
  if (result.greedyStolen > 0) {
    hazardEvents.push({ type: "greedy", count: result.greedyStolen });
  }
  // Void may reduce the exponent of a just-merged power; discovered powers,
  // the bank prompt and Three Curse must use the final result, not a stale
  // pre-Void merge. This also preserves original merge provenance.
  const merges = result.mergeDestinations.map(index => board[index]);
  return { ...result, board, merges, hazards: layer, hazardEvents };
}

// An Eraser can save a mathematically locked board if removing ONE
// existing hazard reveals a bankable power or enables a real slide. The
// player must hold that item and still have moves left; the app enforces
// those conditions. No free Eraser or extra move is granted.
export function canRescueHazardLock(board, hazards, banked = new Set(),
  locked = new Set(), movementRules = null) {
  if (!isTileBoard(board) || !(banked instanceof Set) ||
      !(locked instanceof Set)) {
    throw new RangeError("Invalid hazard-rescue board or bank status");
  }
  const current = restoreHazardLayer(hazards, board);
  if (canMove(board, banked, locked,
    { ...(movementRules || {}), hazards: current })) return false;
  return current.some((hazard, index) => {
    if (!hazard) return false;
    const without = removeHazard(current, index);
    return canMove(board, banked, locked,
      { ...(movementRules || {}), hazards: without });
  });
}

const chosenIndex = (rng, length) => Math.max(0,
  Math.min(length - 1, Math.floor(rng() * length)));

// Schedule at most ONE pending hazard on an empty square. The warning is
// announced for an entire successful slide before it matures. It does not
// reserve a board cell or add a blocker move surcharge. Maturation may
// create a hazard under an ordinary tile, but never under a blocker.
export function progressHazardRound(board, hazards, run, movesInRound,
  { rng = Math.random, boss = false, banked = new Set(), locked = new Set(),
    movementRules = null, movesLeft = null, protection = null,
    enchantments = null } = {}) {
  if (!isTileBoard(board) || !Array.isArray(hazards) ||
      hazards.length !== HAZARD_CELLS || !run ||
      !Number.isInteger(movesInRound) || movesInRound < 0 ||
      typeof rng !== "function" || typeof boss !== "boolean" ||
      (movesLeft !== null && (!Number.isSafeInteger(movesLeft) ||
        movesLeft < 0))) {
    throw new RangeError("Invalid hazard progression inputs");
  }
  let next = restoreHazardLayer(hazards, board);
  const current = restoreHazardPressure(run, board, next);
  const difficulty = hazardDifficulty(current.round);
  let warning = current.hazardWarning;
  const hadIncoming = Boolean(run.hazardWarning);
  let cooldown = Math.max(0, current.hazardCooldown - 1);
  const events = [];
  if (difficulty.maxActive === 0) {
    return { hazards: emptyHazardLayer(),
      run: { ...current, hazardWarning: null, hazardCooldown: 0 }, events };
  }
  if (warning) {
    const candidate = { ...warning };
    const allowed = !enchantments?.[candidate.index] &&
      canPlaceHazard(next, board, candidate.index, candidate.type);
    if (allowed) {
      const probe = placeHazard(next, board, candidate.index, candidate.type);
      const legal = canMove(board, banked, locked,
        { ...(movementRules || {}), hazards: probe });
      if (legal) {
        next = probe;
        if (candidate.type === "cloudy" && protection?.cloudySlides === 2) {
          next[candidate.index] = { type: "cloudy", turnsLeft: 2 };
        }
        events.push({ kind: "appeared", ...candidate });
        cooldown = difficulty.cooldown;
      } else {
        events.push({ kind: "dispelled", ...candidate });
      }
    } else {
      events.push({ kind: "dispelled", ...candidate });
    }
    warning = null;
  } else if (hadIncoming) {
    // A warning may be invalidated by an incoming blocker or a malformed
    // old save. It fizzles instead of instantly choosing another square
    // on the same successful slide.
    cooldown = Math.max(cooldown, 1);
  } else if (movesInRound >= difficulty.firstWarning &&
      activeHazardCount(next) < difficulty.maxActive &&
      (movesLeft === null || movesLeft > 3) &&
      cooldown === 0 && rng() < difficulty.chance * (boss ? 0.5 : 1) *
        (protection?.warningMultiplier ?? 1)) {
    // Decide among the actual valid type/position pairs so a randomly
    // chosen unavailable Null never steals the player's warning roll.
    const eligible = [];
    for (const type of difficulty.types) {
      const positions = [];
      for (let index = 0; index < HAZARD_CELLS; index++) {
        if (board[index] || enchantments?.[index] ||
            !canPlaceHazard(next, board, index, type)) continue;
        // Null/Cracked next to a fixed obstacle can remove the only viable
        // merge needed to break that obstacle. Keep those square types away
        // from live blockers and pending blocker warnings.
        if (["null", "cracked"].includes(type) &&
            adjacentIndices(index).some(j => isObstacle(board[j]))) continue;
        const preview = placeHazard(next, board, index, type);
        if (canMove(board, banked, locked,
          { ...(movementRules || {}), hazards: preview })) positions.push(index);
      }
      if (positions.length) {
        // Type-specific wards reduce conditional selection weights, never
        // to zero. Hazards of other types remain possible.
        const weight = difficulty.weights[type] *
          (protection?.weightMultipliers?.[type] ?? 1);
        if (weight > 0) eligible.push({ type, positions, weight });
      }
    }
    if (eligible.length) {
      const total = eligible.reduce((sum, option) => sum + option.weight, 0);
      let pick = rng() * total;
      let chosen = eligible[eligible.length - 1];
      for (const option of eligible) {
        pick -= option.weight;
        if (pick < 0) { chosen = option; break; }
      }
      // Hazard Tamer replaces a warning BEFORE revealing it. The warning,
      // save and eventual hazard always agree, and the downgrade retains a
      // real penalty: Cracked can still become Null; Void still takes power.
      const type = protection?.downgrade && chosen.type === "null"
        ? "cracked" : protection?.downgrade && chosen.type === "cracked"
          ? "void" : chosen.type;
      warning = {
        type, index: chosen.positions[chosenIndex(rng, chosen.positions.length)]
      };
      events.push({ kind: "warning", ...warning,
        ...(type !== chosen.type ? { downgradedFrom: chosen.type } : {}) });
    }
  }
  return { hazards: next,
    run: { ...current, hazardWarning: warning, hazardCooldown: cooldown },
    events };
}
