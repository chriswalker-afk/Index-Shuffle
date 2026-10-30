// Visual presentation for Roguelike square hazards (Pass 1).
// No effects, spawning or item activation in this module. Overlay cells
// stay at their original board coordinates as numbered tiles slide.
import {
  HAZARD_CELLS, HAZARD_DEFINITIONS, hazardAt, activeHazardCount
} from "./hazards.mjs?v=hazard-layer-v1";

export function renderHazardLayer(boardElement, hazards, warning = null) {
  if (!boardElement || typeof boardElement.appendChild !== "function") {
    throw new RangeError("A board element is required");
  }
  const old = boardElement.querySelector(".hazard-layer");
  old?.remove();
  const showWarning = warning && Number.isInteger(warning.index) &&
    warning.index >= 0 && warning.index < HAZARD_CELLS &&
    HAZARD_DEFINITIONS[warning.type] && !hazards[warning.index];
  if (activeHazardCount(hazards) === 0 && !showWarning) return;

  const overlay = document.createElement("div");
  overlay.className = "hazard-layer";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("data-hazard-layer", "squares");
  for (let index = 0; index < HAZARD_CELLS; index++) {
    const square = document.createElement("div");
    square.className = "hazard-slot";
    const entry = hazardAt(hazards, index);
    if (!entry && showWarning && warning.index === index) {
      const alert = document.createElement("span");
      alert.className = "hazard-warning-symbol";
      alert.textContent = "!";
      const caption = document.createElement("small");
      caption.className = "hazard-warning-label";
      caption.textContent = HAZARD_DEFINITIONS[warning.type].name + " NEXT";
      square.classList.add("hazard-incoming");
      square.dataset.warning = warning.type;
      square.append(alert, caption);
    }
    if (entry) {
      const definition = HAZARD_DEFINITIONS[entry.type];
      square.classList.add("hazard-" + entry.type);
      square.dataset.hazard = entry.type;
      const symbol = document.createElement("span");
      symbol.className = "hazard-symbol";
      symbol.textContent = definition.icon;
      square.append(symbol);
      if (entry.type === "cloudy") {
        const obscured = document.createElement("strong");
        obscured.className = "hazard-hidden-mark";
        obscured.textContent = "?";
        square.append(obscured);
        const remaining = document.createElement("small");
        remaining.className = "hazard-cloud-timer";
        remaining.textContent = String(entry.turnsLeft);
        square.append(remaining);
      } else {
        const badge = document.createElement("small");
        badge.className = "hazard-corner-badge";
        badge.textContent = definition.badge;
        square.append(badge);
      }
    }
    overlay.append(square);
  }
  // Append after the 16 tile buttons: existing slide animation code still
  // obtains tile coordinates from children[0] through children[15].
  boardElement.appendChild(overlay);
}

// Accessible non-revealing label when an occupied square is clouded.
// This is presentation only. Banking/merge restrictions are Pass 2.
export function hazardTileDescription(entry, tilePresent) {
  if (!entry || !HAZARD_DEFINITIONS[entry.type]) return "";
  if (entry.type === "cloudy") {
    return "Cloudy square. " + (tilePresent
      ? "Occupied tile hidden by cloud."
      : "Empty square beneath cloud.") +
      " " + entry.turnsLeft + " slides shown on the cloud.";
  }
  return HAZARD_DEFINITIONS[entry.type].name + " square. " +
    HAZARD_DEFINITIONS[entry.type].description;
}
