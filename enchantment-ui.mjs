// Distinct, pointer-transparent overlays for bought positive board squares.
// Tile buttons remain the accessible source of square names and actions.
import {
  ENCHANTMENT_CELLS, ENCHANTMENT_DEFINITIONS, activeEnchantmentCount
} from "./enchantments.mjs?v=runestones-pass1";

export function renderEnchantmentLayer(board, layer) {
  board.querySelector(".enchantment-layer")?.remove();
  if (activeEnchantmentCount(layer) === 0) return;
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
    }
    overlay.append(slot);
  }
  // Keep the first 16 board children as real square buttons for input/motion.
  board.append(overlay);
}
