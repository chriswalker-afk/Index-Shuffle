// Distinct, pointer-transparent overlays for bought positive board squares.
// Tile buttons remain the accessible source of square names and actions.
import {
  ENCHANTMENT_CELLS, ENCHANTMENT_DEFINITIONS, activeEnchantmentCount
} from "./enchantments.mjs?v=runestones-pass2";

export function renderEnchantmentLayer(board, layer,
  { previewType = null, candidates = [] } = {}) {
  board.querySelector(".enchantment-layer")?.remove();
  const preview = ENCHANTMENT_DEFINITIONS[previewType] &&
    Array.isArray(candidates) ? new Set(candidates) : new Set();
  if (activeEnchantmentCount(layer) === 0 && preview.size === 0) return;
  const overlay = document.createElement("div");
  overlay.className = "enchantment-layer";
  overlay.setAttribute("aria-hidden", "true");
  for (let index = 0; index < ENCHANTMENT_CELLS; index++) {
    const slot = document.createElement("div");
    slot.className = "enchantment-slot";
    const entry = layer[index];
    if (entry) {
      slot.dataset.enchantment = entry.type;
      const mark = document.createElement("span");
      mark.className = "enchantment-mark";
      mark.textContent = ENCHANTMENT_DEFINITIONS[entry.type].icon;
      const remaining = document.createElement("span");
      remaining.className = "enchantment-remaining";
      remaining.textContent = String(entry.chargesLeft);
      slot.append(mark, remaining);
    } else if (preview.has(index)) {
      slot.classList.add("enchantment-slot--preview");
      slot.dataset.preview = previewType;
      const mark = document.createElement("span");
      mark.className = "enchantment-preview-icon";
      mark.textContent = ENCHANTMENT_DEFINITIONS[previewType].icon;
      const word = document.createElement("span");
      word.className = "enchantment-preview-label";
      word.textContent = "PLACE";
      slot.append(mark, word);
    }
    overlay.append(slot);
  }
  // Keep the first 16 board children as real square buttons for input/motion.
  board.append(overlay);
}
