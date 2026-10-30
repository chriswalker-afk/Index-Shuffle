// Player-created positive board squares. Coordinates belong to the board,
// never to a tile. Independent of hazards and the two-slot consumable inventory.
import { SIZE, isObstacle } from "./engine.mjs?v=runestones-pass2";

export const ENCHANTMENT_CELLS = SIZE * SIZE;
export const MAX_ACTIVE_ENCHANTMENTS = 2;
export const ENCHANTMENT_CHARGES = 2;
export const SANCTUARY_BONUS_SECONDS = 10;
export const MAX_SANCTUARY_SECONDS = 60;
export const ENCHANTMENT_DEFINITIONS = Object.freeze({
  "gilded-foundry": Object.freeze({
    name: "Gilded Foundry", icon: "◉", charges: ENCHANTMENT_CHARGES,
    description: "A merge here becomes golden. A correctly banked ordinary power here counts as gold."
  }),
  "power-prism": Object.freeze({
    name: "Power Prism", icon: "×2", charges: ENCHANTMENT_CHARGES,
    description: "A merge here stores a double-score charge, or a correct bank here gains a multiplier."
  }),
  "echo-seal": Object.freeze({
    name: "Echo Seal", icon: "↺", charges: 1,
    description: "Correctly bank one previously banked base-and-exponent combination on this square."
  }),
  "twin-mint": Object.freeze({
    name: "Twin Mint", icon: "◉×2", charges: 1,
    description: "The next merge finishing here turns the resulting power into double gold."
  }),
  "time-sanctuary": Object.freeze({
    name: "Time Sanctuary", icon: "+10", charges: ENCHANTMENT_CHARGES,
    description: "Open a banking question here for 10 extra seconds, up to 60 seconds."
  }),
  "shatter-crest": Object.freeze({
    name: "Shatter Crest", icon: "⚒", charges: ENCHANTMENT_CHARGES,
    description: "Correctly bank a genuinely merged power beside a blocker here for one extra hit."
  })
});
export const ENCHANTMENT_ITEMS = Object.freeze({
  "foundry-runestone": "gilded-foundry",
  "prism-runestone": "power-prism",
  "echo-runestone": "echo-seal",
  "mint-runestone": "twin-mint",
  "sanctuary-runestone": "time-sanctuary",
  "shatter-runestone": "shatter-crest"
});
const isIndex = index => Number.isSafeInteger(index) &&
  index >= 0 && index < ENCHANTMENT_CELLS;
const isBoard = board => Array.isArray(board) &&
  board.length === ENCHANTMENT_CELLS;
const isLayer = layer => Array.isArray(layer) &&
  layer.length === ENCHANTMENT_CELLS;
const isGold = power => power?.gold === 1 || power?.gold === 2;

export const emptyEnchantmentLayer = () => Array(ENCHANTMENT_CELLS).fill(null);

export function restoreEnchantmentLayer(saved, board = null, hazards = null) {
  if (board !== null && !isBoard(board)) throw new RangeError("Invalid enchantment board");
  if (hazards !== null && !isLayer(hazards)) throw new RangeError("Invalid hazard layer");
  const next = emptyEnchantmentLayer();
  if (!isLayer(saved)) return next; // Saves made before Runestones.
  let count = 0;
  for (let index = 0; index < ENCHANTMENT_CELLS; index++) {
    const entry = saved[index];
    if (!entry || !Object.hasOwn(ENCHANTMENT_DEFINITIONS, entry.type) ||
        !Number.isSafeInteger(entry.chargesLeft) ||
        entry.chargesLeft < 1 ||
        entry.chargesLeft > ENCHANTMENT_DEFINITIONS[entry.type].charges ||
        (board && isObstacle(board[index])) || hazards?.[index] ||
        count >= MAX_ACTIVE_ENCHANTMENTS) continue;
    next[index] = { type: entry.type, chargesLeft: entry.chargesLeft };
    count++;
  }
  return next;
}

export function enchantmentAt(layer, index) {
  if (!isLayer(layer) || !isIndex(index)) throw new RangeError("Invalid enchanted square");
  return layer[index] || null;
}
export function activeEnchantmentCount(layer) {
  if (!isLayer(layer)) throw new RangeError("Invalid enchantment layer");
  return layer.filter(Boolean).length;
}

export function canPlaceEnchantment(layer, board, hazards, index, type,
  forbiddenIndex = null) {
  if (!isLayer(layer) || !isBoard(board) || !isIndex(index) ||
      !Object.hasOwn(ENCHANTMENT_DEFINITIONS, type) ||
      (hazards !== null && !isLayer(hazards))) return false;
  const current = restoreEnchantmentLayer(layer, board, hazards);
  return !current[index] && !isObstacle(board[index]) &&
    !hazards?.[index] && index !== forbiddenIndex &&
    activeEnchantmentCount(current) < MAX_ACTIVE_ENCHANTMENTS;
}

export function placeEnchantment(layer, board, hazards, index, type,
  forbiddenIndex = null) {
  if (!canPlaceEnchantment(layer, board, hazards, index, type, forbiddenIndex)) {
    throw new RangeError("Enchantment cannot be placed on this square");
  }
  const next = restoreEnchantmentLayer(layer, board, hazards);
  next[index] = { type, chargesLeft: ENCHANTMENT_DEFINITIONS[type].charges };
  return next;
}

function useCharge(layer, index) {
  const next = layer.slice();
  const entry = next[index];
  if (!entry) return next;
  next[index] = entry.chargesLeft === 1
    ? null : { type: entry.type, chargesLeft: entry.chargesLeft - 1 };
  return next;
}

// Evaluate AFTER Void and Cracked; only final successful merge destinations
// activate Runestones. A charge is spent only if it actually changes a power.
export function resolveSlideEnchantments(result, saved) {
  if (!result || !isBoard(result.board) ||
      !Array.isArray(result.mergeDestinations)) {
    throw new RangeError("Invalid enchanted slide result");
  }
  let enchantments = restoreEnchantmentLayer(saved, result.board);
  const board = result.board.slice();
  const events = [];
  if (result.changed) for (const index of new Set(result.mergeDestinations)) {
    const entry = enchantments[index], power = board[index];
    if (!entry || !power || isObstacle(power)) continue;
    if (entry.type === "gilded-foundry" && !isGold(power)) {
      board[index] = { ...power, gold: 1 };
    } else if (entry.type === "power-prism" && power.prism !== 1) {
      board[index] = { ...power, prism: 1 };
    } else if (entry.type === "twin-mint" && power.gold !== 2) {
      board[index] = { ...power, gold: 2 };
    } else continue; // Already empowered, or a banking-only square.
    enchantments = useCharge(enchantments, index);
    events.push({ type: entry.type, index, kind: "merge" });
  }
  // The list of discovered powers must use the post-enchantment board.
  const merges = result.mergeDestinations.map(index => board[index]);
  return { ...result, board, merges, enchantments, enchantmentEvents: events };
}

// Pure preview: correct banking is still validated by the engine. Marked
// powers carry existing gold and prism status, never a duplicate charge.
// Echo changes repeat-banking eligibility only at its own occupied square.
export function previewEnchantedBank(layer, index, power,
  { alreadyBanked = false, merged = false, adjacentBlocker = false,
    baseSeconds = MAX_SANCTUARY_SECONDS } = {}) {
  const entry = enchantmentAt(layer, index);
  const goldFromSquare = entry?.type === "gilded-foundry" && !isGold(power);
  const prismFromSquare = entry?.type === "power-prism" && power?.prism !== 1;
  const repeatBank = entry?.type === "echo-seal" && alreadyBanked;
  const extraBlockerHit = entry?.type === "shatter-crest" &&
    merged && adjacentBlocker;
  const extraSeconds = entry?.type === "time-sanctuary"
    ? Math.max(0, Math.min(SANCTUARY_BONUS_SECONDS,
      MAX_SANCTUARY_SECONDS - baseSeconds)) : 0;
  return {
    power: goldFromSquare ? { ...power, gold: 1 } : power,
    prism: power?.prism === 1 || prismFromSquare,
    repeatBank, extraBlockerHit, extraSeconds,
    spend: goldFromSquare ? "gilded-foundry"
      : prismFromSquare ? "power-prism"
        : repeatBank ? "echo-seal"
          : extraBlockerHit ? "shatter-crest"
            : extraSeconds > 0 ? "time-sanctuary" : null
  };
}

// Redemptions are explicit and pure. Time Sanctuary consumes a charge when
// a question opens (even if subsequently cancelled/incorrect); all other
// bank-only effects consume a charge only for a mathematically correct bank.
// A score-nullifying boss must not waste a directly used Prism.
export function redeemEnchantedBank(layer, index, preview,
  { trigger = "correct", prismApplied = false, pointsAwarded = 0,
    repeatBanked = false, blockerApplied = false } = {}) {
  const current = restoreEnchantmentLayer(layer);
  const entry = enchantmentAt(current, index);
  if (!entry || entry.type !== preview?.spend) {
    return { enchantments: current, used: false };
  }
  if (entry.type === "time-sanctuary") {
    if (trigger !== "open" || preview.extraSeconds <= 0) {
      return { enchantments: current, used: false };
    }
  } else {
    if (trigger !== "correct") return { enchantments: current, used: false };
    if (entry.type === "power-prism" && (!prismApplied || pointsAwarded <= 0)) {
      return { enchantments: current, used: false };
    }
    if (entry.type === "echo-seal" && !repeatBanked) {
      return { enchantments: current, used: false };
    }
    if (entry.type === "shatter-crest" && !blockerApplied) {
      return { enchantments: current, used: false };
    }
  }
  return { enchantments: useCharge(current, index), used: true };
}
