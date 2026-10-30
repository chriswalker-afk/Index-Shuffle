// Award art is optional presentation. Metric thresholds, dates and unlock
// persistence are exclusively owned by milestones.mjs.
export const ACHIEVEMENT_ART_IDS = Object.freeze(["first-deposit","gold-digger","double-mint","high-power","ten-pointer","first-clear","boss-buster","boss-hunter","index-master","shop-regular","full-house","gold-rush","close-call","move-saver","block-wrecker","toolbox"]);
const available = new Set(ACHIEVEMENT_ART_IDS);
export const ACHIEVEMENT_SPRITE = "assets/art/achievement-medals.svg?v=art-pass4";

export function achievementMedalHref(id) {
  return ACHIEVEMENT_SPRITE + "#award-" +
    (typeof id === "string" && available.has(id) ? id : "generic");
}

// Categories describe gallery colours only; these are not reward tiers.
export function achievementVisualTheme(id) {
  if (["gold-digger", "double-mint", "gold-rush"].includes(id)) return "gold";
  if (["boss-buster", "boss-hunter", "index-master"].includes(id)) return "boss";
  if (["shop-regular", "full-house", "toolbox"].includes(id)) return "craft";
  if (["close-call", "move-saver", "block-wrecker"].includes(id)) return "survival";
  return "banking";
}
