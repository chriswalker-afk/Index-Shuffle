// Roguelike square hazards — Pass 1 (data / layout only).
// Unlike blockers and tiles, hazards are anchored to one of 16 board
// coordinates. Later passes will add resolution during slides, spawning,
// difficulty and a one-use Hazard Eraser. NONE is active in Pass 1.
import { SIZE, isObstacle } from "./engine.mjs?v=hazard-layer-v1";

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
    id: "greedy", name: "Greedy", icon: "◉", badge: "◉",
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

// Pass 2/3 use these pure helpers for placement/removal. They deliberately
// do not change the number-tile board, move counters or player score.
export function canPlaceHazard(hazards, board, index, type) {
  if (!isCell(index) || !isTileBoard(board) ||
      !HAZARD_DEFINITIONS[type] ||
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
