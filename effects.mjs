// Pass 4: pure, testable Roguelite item rules. No DOM or mutable globals.
// All effects require purchases; Classic never calls this module.
import {
  tile, key, isObstacle, isBlocker, blockerStrength, canMove,
  MAX_MOVES_LEFT
} from "./engine.mjs?v=hazard-counter-v1";
import { goldTier } from "./roguelite.mjs?v=frostlock-v1";
import { ENCHANTMENT_ITEMS, canPlaceEnchantment, placeEnchantment,
  restoreEnchantmentLayer } from "./enchantments.mjs?v=runestones-pass1";
import { ITEM_BY_ID } from "./shop.mjs?v=frostlock-v1";
import { bossId, bossMovementRules } from "./bosses.mjs?v=frostlock-v1";
import {
  hazardAt, restoreHazardLayer, removeHazard
} from "./hazards.mjs?v=hazard-counter-v1";

const whole = n => Number.isSafeInteger(n) && n >= 0;
const numericTile = t => Boolean(t && !isObstacle(t) &&
  Number.isSafeInteger(t.base) && Number.isSafeInteger(t.exp));
export const MAX_POWER_SURGE_EXPONENT = 12;

export function permanentIds(run) {
  return new Set((run?.inventory?.permanents || []).filter(entry =>
    entry && ITEM_BY_ID[entry.id]?.type === "permanents").map(entry => entry.id));
}
export const hasPermanent = (run, id) => permanentIds(run).has(id);

// Pure defensive configuration. The hazard engine receives these values
// explicitly; it never imports the shop or item engine (no circular graph).
// Rates are multipliers, NOT complete immunity. At most two items can be
// equipped simultaneously under the existing permanent-slot rules.
export function hazardItemProtection(run) {
  const equipped = permanentIds(run);
  const has = id => equipped.has(id);
  return {
    warningMultiplier: has("storm-shelter") ? 0.70 : 1,
    weightMultipliers: {
      cloudy: has("mist-filter") ? 0.35 : 1,
      void: 1,
      cracked: has("fracture-ward") ? 0.40 : 1,
      greedy: has("gilded-compass") ? 0.30 : 1,
      null: has("fracture-ward") ? 0.40 : 1
    },
    downgrade: has("hazard-tamer"),
    cloudySlides: has("fog-lantern") ? 2 : 3,
    voidFloor: has("void-cushion") ? 2 : 1,
    greedyLandingOnly: has("gilded-soles")
  };
}


export function restoreEffectState(run) {
  if (!run || typeof run !== "object") throw new RangeError("Invalid run");
  return {
    ...run,
    scoredBanks: whole(run.scoredBanks) ? run.scoredBanks : 0,
    twosBanked: whole(run.twosBanked) ? run.twosBanked : 0,
    lastBankBase: [2, 3, 5, 7, 11, 13].includes(run.lastBankBase)
      ? run.lastBankBase : null,
    blockerDelay: whole(run.blockerDelay) ? Math.min(1000, run.blockerDelay) : 0,
    protectionSlides: whole(run.protectionSlides)
      ? Math.min(2, run.protectionSlides) : 0
  };
}

// Multipliers combine with each other, then additive bonuses apply.
// Example: Opening Act + Twin Twos on a first bank of 2^3 = 3 * 2 * 2 = 12.
export function bankItemBonuses(run, power, merged = false) {
  if (!numericTile(power) ||
      (power.exp < 2 && !(power.exp === 1 && goldTier(power) > 0)) ||
      typeof merged !== "boolean") {
    throw new RangeError("Bank bonuses require a bankable power");
  }
  const current = restoreEffectState(run);
  const owned = permanentIds(current);
  let multiplier = 1, additive = 0;
  const notes = [];
  const applyDouble = (id, label, works) => {
    if (owned.has(id) && works) { multiplier *= 2; notes.push(label + " ×2"); }
  };
  applyDouble("opening-act", "Opening Act", current.scoredBanks === 0);
  applyDouble("twin-twos", "Twin Twos",
    power.base === 2 && current.twosBanked < 2);
  applyDouble("five-alive", "Five Alive", power.base === 5);
  if (owned.has("big-powers") && power.exp >= 4) {
    additive += 2; notes.push("Big Powers +2");
  }
  if (owned.has("square-specialist") && power.exp === 2) {
    additive += 1; notes.push("Square Specialist +1");
  }
  if (owned.has("variety-bonus") && current.lastBankBase !== null &&
      current.lastBankBase !== power.base) {
    additive += 2; notes.push("Variety Bonus +2");
  }
  const extraCoins = owned.has("golden-calculator") &&
    goldTier(power) > 0 ? 1 : 0;
  if (extraCoins) notes.push("Golden Calculator +1 coin");
  const delay = owned.has("threes-company") && merged && power.base === 3 ? 1 : 0;
  if (delay) notes.push("Three's Company: blocker delayed");
  const hits = owned.has("blockbuster") && merged ? 2 : 1;
  if (hits === 2) notes.push("Blockbuster: double hit");
  return {
    score: power.exp * multiplier + additive,
    extraCoins, blockerHits: hits,
    notes, multiplier, additive,
    counters: {
      scoredBanks: current.scoredBanks + 1,
      twosBanked: current.twosBanked + (power.base === 2 ? 1 : 0),
      lastBankBase: power.base,
      blockerDelay: Math.min(1000, current.blockerDelay + delay)
    }
  };
}

export function goldChancesForRun(run) {
  const owned = permanentIds(run);
  const baseChance = owned.has("lucky-spawn") ? 0.27 : 0.12;
  return {
    baseChance,
    sevenChance: Math.min(0.95, Math.round((baseChance +
      (owned.has("lucky-sevens") ? 0.30 : 0)) * 100) / 100)
  };
}

export function costOfNextSlide(state) {
  const blockers = state.board.filter(isBlocker).length;
  return 1 + ((state.mode === "roguelite" &&
    restoreEffectState(state.run).protectionSlides > 0) ? 0 : blockers);
}

export const CONSUMABLE_TARGETS = Object.freeze({
  "block-breaker": 1, "power-surge": 1, "second-wind": 0,
  "alchemist": 1, "protection": 0, "gold-touch": 1,
  "position-swap": 2, "delay-tactics": 0, "clear-space": 1,
  "second-chance": 1, "hazard-eraser": 1,
  "foundry-runestone": 1, "prism-runestone": 1
});

function itemInSlot(state, slot) {
  if (state?.mode !== "roguelite" || state?.run?.phase !== "playing" ||
      state.over || state.movesLeft <= 0 ||
      !Number.isInteger(slot) || slot < 0 || slot > 1) return null;
  const entry = state.run.inventory?.consumables?.[slot];
  return entry && ITEM_BY_ID[entry.id]?.type === "consumables" ? entry.id : null;
}

export function consumableTargets(state, slot, selected = []) {
  const id = itemInSlot(state, slot);
  if (!id || !Array.isArray(selected) ||
      selected.length >= CONSUMABLE_TARGETS[id]) return [];
  const board = state.board;
  if (!Array.isArray(board) || board.length !== 16) return [];
  const locked = new Set(state.locked || []);
  const banked = new Set(state.banked || []);
  return board.map((t, i) => {
    if (selected.includes(i)) return -1;
    if (ENCHANTMENT_ITEMS[id]) return canPlaceEnchantment(
      restoreEnchantmentLayer(state.enchantments, board, state.hazards),
      board, state.hazards, i, ENCHANTMENT_ITEMS[id],
      state.run.hazardWarning?.index) ? i : -1;
    if (id === "block-breaker") return isBlocker(t) ? i : -1;
    if (id === "hazard-eraser") {
      return state.hazards && hazardAt(state.hazards, i) ? i : -1;
    }
    // A covered tile must not leak its identity through item highlighting.
    if (state.hazards?.[i]?.type === "cloudy") return -1;
    if (id === "second-chance") return locked.has(i) && numericTile(t) &&
      t.exp >= 2 && !banked.has(key(t)) ? i : -1;
    if (!numericTile(t)) return -1;
    if (id === "power-surge") return t.exp < MAX_POWER_SURGE_EXPONENT &&
      !banked.has(t.base + "-" + (t.exp + 1)) ? i : -1;
    if (id === "alchemist") return t.base === 3 &&
      (t.exp < 2 || !banked.has("5-" + t.exp)) ? i : -1;
    if (id === "gold-touch") return goldTier(t) === 0 ? i : -1;
    if (id === "position-swap") return i;
    if (id === "clear-space") {
      const probe = board.slice();
      probe[i] = null;
      return canMove(probe, banked, locked,
        { ...(bossMovementRules(state.run) || {}),
          hazards: state.hazards }) ? i : -1;
    }
    return -1;
  }).filter(i => i !== -1);
}

export function canActivateConsumable(state, slot) {
  const id = itemInSlot(state, slot);
  if (!id) return false;
  if (CONSUMABLE_TARGETS[id] > 0) return consumableTargets(state, slot).length > 0;
  if (id === "second-wind") {
    return bossId(state.run) !== "timekeeper" && state.movesLeft < MAX_MOVES_LEFT;
  }
  if (id === "protection") {
    return restoreEffectState(state.run).protectionSlides === 0;
  }
  return id === "delay-tactics";
}

const swapIndex = (indices, a, b) => indices.map(index =>
  index === a ? b : index === b ? a : index);

export function useConsumable(state, slot, selections = []) {
  const id = itemInSlot(state, slot);
  if (!id || !canActivateConsumable(state, slot) ||
      !Array.isArray(selections) ||
      selections.length !== CONSUMABLE_TARGETS[id]) {
    throw new RangeError("Consumable is unavailable or target selection is incomplete");
  }
  for (let i = 0; i < selections.length; i++) {
    if (!consumableTargets(state, slot, selections.slice(0, i))
      .includes(selections[i])) {
      throw new RangeError("Invalid or unavailable target");
    }
  }
  const board = state.board.slice();
  let hazards = restoreHazardLayer(state.hazards, board);
  let enchantments = restoreEnchantmentLayer(state.enchantments, board, hazards);
  const current = restoreEffectState(state.run);
  let locked = [...state.locked], ready = [...state.mergeReady];
  let movesLeft = state.movesLeft;
  let notice = ITEM_BY_ID[id].name + " used.";
  let run = {
    ...current,
    inventory: { ...current.inventory, consumables:
      current.inventory.consumables.map((entry, i) => i === slot ? null : entry) }
  };
  const index = selections[0];
  switch (id) {
    case "foundry-runestone":
    case "prism-runestone":
      enchantments = placeEnchantment(enchantments, board, hazards, index,
        ENCHANTMENT_ITEMS[id], state.run.hazardWarning?.index);
      notice = ITEM_BY_ID[id].name + " enchanted row " +
        (Math.floor(index / 4) + 1) + ", column " + (index % 4 + 1) +
        ". Two charges remain this round.";
      break;
    case "block-breaker":
      board[index] = null;
      notice = "Block Breaker removed a blocker.";
      break;
    case "hazard-eraser": {
      const type = hazardAt(hazards, index)?.type;
      hazards = removeHazard(hazards, index);
      notice = "Hazard Eraser cleared the " + type +
        " square without changing its number tile.";
      break;
    }
    case "power-surge":
      board[index] = { ...board[index], exp: board[index].exp + 1 };
      // A transformation is not a merge and cannot erase a banking cooldown.
      ready = ready.filter(i => i !== index);
      notice = "Power Surge increased that exponent by one. It is not a merge.";
      break;
    case "second-wind":
      movesLeft = Math.min(MAX_MOVES_LEFT, movesLeft + 2);
      notice = "Second Wind restored " + (movesLeft - state.movesLeft) + " moves.";
      break;
    case "alchemist": {
      const { curseLeft, ...original } = board[index];
      board[index] = { ...original, base: 5 };
      ready = ready.filter(i => i !== index);
      notice = "Alchemist changed base 3 to base 5 without banking.";
      break;
    }
    case "protection":
      run = { ...run, protectionSlides: 2 };
      notice = "Protection: the next two successful slides ignore blocker surcharges.";
      break;
    case "gold-touch":
      board[index] = { ...board[index], gold: 1 };
      // Gold applied after a merge cannot claim gold from that earlier merge.
      // The tile must merge again before its golden bank can pay out.
      ready = ready.filter(i => i !== index);
      notice = state.banked.includes(key(board[index]))
        ? "Gold Touch gilded this tile, but its power was already banked. Merge to a new exponent before banking."
        : "Gold Touch gilded a tile. Bank it once for 1 coin, or merge it first for a bigger reward.";
      break;
    case "position-swap": {
      const other = selections[1];
      [board[index], board[other]] = [board[other], board[index]];
      ready = swapIndex(ready, index, other);
      locked = swapIndex(locked, index, other);
      notice = "Position Swap exchanged two number tiles without using a move.";
      break;
    }
    case "delay-tactics":
      run = { ...run, blockerDelay: Math.min(1000, run.blockerDelay + 2) };
      notice = "Delay Tactics postponed the next scheduled blocker by two slides.";
      break;
    case "clear-space":
      board[index] = null;
      ready = ready.filter(i => i !== index);
      locked = locked.filter(i => i !== index);
      notice = "Clear Space removed a tile, awarding no score or coins.";
      break;
    case "second-chance":
      locked = locked.filter(i => i !== index);
      notice = "Second Chance unlocked that banking opportunity.";
      break;
    default:
      throw new RangeError("Unknown consumable effect");
  }
  // These are tools, never mathematical banks: no score, move credit, gold,
  // blocker damage or discovered powers are earned by activating an item.
  return {
    ...state, board, hazards, enchantments, locked, mergeReady: ready, movesLeft,
    run, notice
  };
}
