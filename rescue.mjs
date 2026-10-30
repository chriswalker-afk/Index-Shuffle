// Release reliability: a held consumable must be usable before declaring
// a board mechanically lost. Only real, legal, one-use item actions count.
// This module never mutates the run and never grants a free item or move.
import { gameEnded } from "./engine.mjs?v=hazard-counter-v1";
import { bossMovementRules } from "./bosses.mjs?v=frostlock-v1";
import {
  canActivateConsumable, consumableTargets, useConsumable,
  CONSUMABLE_TARGETS, hazardItemProtection
} from "./effects.mjs?v=release-5a";

// A move budget of zero is still an unconditional loss, as designed.
// The only items worth checking are those which can change legal actions.
export const RESCUE_ITEM_IDS = Object.freeze(new Set([
  "block-breaker", "hazard-eraser", "clear-space", "second-chance",
  "power-surge", "alchemist", "gold-touch", "position-swap",
  "echo-runestone"
]));

function movementRules(state) {
  return {
    ...(bossMovementRules(state.run) || {}),
    hazards: state.hazards,
    enchantments: state.enchantments,
    greedyLandingOnly: hazardItemProtection(state.run).greedyLandingOnly
  };
}

function canPlay(state) {
  return !gameEnded(state.board, new Set(state.banked),
    new Set(state.locked), state.movesLeft, movementRules(state));
}

function candidateRescues(state, slot) {
  // In this scenario the board is mechanically locked, but the item is
  // still available. Clear only the derived over flag on a *copy*.
  const proposed = { ...state, over: false };
  if (!canActivateConsumable(proposed, slot)) return false;
  const entry = state.run.inventory.consumables[slot];
  const required = CONSUMABLE_TARGETS[entry.id];
  const works = targets => {
    try {
      return canPlay(useConsumable(proposed, slot, targets));
    } catch {
      return false; // Inconsistent/old inventory must never crash a render.
    }
  };
  if (required === 0) return works([]);
  for (const first of consumableTargets(proposed, slot)) {
    if (required === 1 && works([first])) return true;
    if (required === 2) {
      for (const second of consumableTargets(proposed, slot, [first])) {
        if (works([first, second])) return true;
      }
    }
  }
  return false;
}

export function rescuableConsumables(state) {
  if (state?.mode !== "roguelite" || state?.run?.phase !== "playing" ||
      !Number.isSafeInteger(state.movesLeft) || state.movesLeft <= 0 ||
      !Array.isArray(state.board) || state.board.length !== 16 ||
      !Array.isArray(state.run.inventory?.consumables)) return [];
  if (canPlay(state)) return []; // No rescue is needed yet.
  const rescue = [];
  for (let slot = 0; slot < 2; slot++) {
    const id = state.run.inventory.consumables[slot]?.id;
    if (!RESCUE_ITEM_IDS.has(id)) continue;
    if (candidateRescues(state, slot)) rescue.push({ slot, id });
  }
  return rescue;
}
