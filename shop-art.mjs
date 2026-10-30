// Lightweight icon registry: all shop offer and inventory illustrations are
// presentation-only. The stable IDs remain owned by shop.mjs; no save schema
// or purchase reducer depends on this module.
export const SHOP_ICON_IDS = Object.freeze([
  "opening-act",
  "twin-twos",
  "lucky-sevens",
  "threes-company",
  "big-powers",
  "square-specialist",
  "five-alive",
  "variety-bonus",
  "golden-calculator",
  "blockbuster",
  "lucky-spawn",
  "bulk-discount",
  "storm-shelter",
  "mist-filter",
  "fracture-ward",
  "gilded-compass",
  "hazard-tamer",
  "fog-lantern",
  "void-cushion",
  "gilded-soles",
  "block-breaker",
  "hazard-eraser",
  "power-surge",
  "second-wind",
  "alchemist",
  "protection",
  "gold-touch",
  "position-swap",
  "delay-tactics",
  "clear-space",
  "second-chance",
  "foundry-runestone",
  "prism-runestone"
]);
export const ITEM_SPRITE_URL = "assets/art/item-sprites.svg?v=runestones-pass2";
const available = new Set(SHOP_ICON_IDS);

// Unmapped items render a neutral numbered tile instead of a broken image.
export function itemIconHref(itemId) {
  const symbol = typeof itemId === "string" && available.has(itemId)
    ? itemId : "generic";
  return `${ITEM_SPRITE_URL}#item-${symbol}`;
}

// A visual distinction, not an invented rarity tier.
export function itemArtKind(item) {
  return item?.hazardCounter ? "ward"
    : item?.type === "consumables" ? "consumable" : "permanent";
}
