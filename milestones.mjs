// Persistent Roguelite achievements and per-run results tracking.
// Pure functions: achievements are awarded only on real gameplay events,
// never merely by restoring a save, rendering, or opening the gallery.

const METRICS = Object.freeze([
  "banks", "goldBanks", "doubleGoldBanks", "maxExponent", "bestBankPoints",
  "roundClears", "bossWins", "victories", "purchases", "fullBuilds",
  "goldCoinsBanked", "closeClears", "efficientClears", "blockersDestroyed",
  "consumablesUsed", "runsFinished", "bestRunScore"
]);
const RUN_FIELDS = Object.freeze([
  "slides", "banks", "goldBanks", "goldCoinsBanked", "roundsCleared",
  "bossesDefeated", "blockersDestroyed", "highestExponent",
  "bestSingleBank", "itemsBought", "consumablesUsed"
]);

export const ACHIEVEMENTS = Object.freeze([
  { id: "first-deposit", name: "First Deposit", icon: "✦", metric: "banks", goal: 1,
    description: "Correctly bank your first power." },
  { id: "gold-digger", name: "Gold Digger", icon: "◉", metric: "goldBanks", goal: 1,
    description: "Correctly bank a golden number." },
  { id: "double-mint", name: "Double Mint", icon: "✧", metric: "doubleGoldBanks", goal: 1,
    description: "Bank a power made from two golden tiles." },
  { id: "high-power", name: "High Power", icon: "⁵", metric: "maxExponent", goal: 5,
    description: "Correctly bank a power of exponent 5 or higher." },
  { id: "ten-pointer", name: "Double Digits", icon: "10", metric: "bestBankPoints", goal: 10,
    description: "Earn at least 10 points from one correct bank." },
  { id: "first-clear", name: "Round Trip", icon: "✓", metric: "roundClears", goal: 1,
    description: "Clear your first Roguelite round." },
  { id: "boss-buster", name: "Boss Buster", icon: "♛", metric: "bossWins", goal: 1,
    description: "Defeat a boss round." },
  { id: "boss-hunter", name: "Boss Hunter", icon: "♜", metric: "bossWins", goal: 3,
    description: "Defeat three bosses across your runs." },
  { id: "index-master", name: "Index Master", icon: "★", metric: "victories", goal: 1,
    description: "Complete all 12 Roguelite rounds." },
  { id: "shop-regular", name: "Shop Regular", icon: "¤", metric: "purchases", goal: 3,
    description: "Buy three shop items across your runs." },
  { id: "full-house", name: "Full House", icon: "◆", metric: "fullBuilds", goal: 1,
    description: "Equip both permanent upgrade slots at once." },
  { id: "gold-rush", name: "Gold Rush", icon: "◈", metric: "goldCoinsBanked", goal: 15,
    description: "Earn 15 coins by correctly banking golden tiles." },
  { id: "close-call", name: "Close Call", icon: "!", metric: "closeClears", goal: 1,
    description: "Clear a round with exactly one move remaining." },
  { id: "move-saver", name: "Move Saver", icon: "➕", metric: "efficientClears", goal: 1,
    description: "Clear a round with at least five unused moves." },
  { id: "block-wrecker", name: "Block Wrecker", icon: "▦", metric: "blockersDestroyed", goal: 3,
    description: "Destroy three blockers through correct banking." },
  { id: "toolbox", name: "Toolbox", icon: "⚒", metric: "consumablesUsed", goal: 5,
    description: "Use five single-use items across your runs." }
].map(item => Object.freeze(item)));

export const ACHIEVEMENT_BY_ID = Object.freeze(Object.fromEntries(
  ACHIEVEMENTS.map(item => [item.id, item])
));

const validCount = n => Number.isSafeInteger(n) && n >= 0;
const valueOrZero = n => validCount(n) ? n : 0;
const addCount = (n, delta) => Math.min(Number.MAX_SAFE_INTEGER,
  valueOrZero(n) + delta);
const numericFields = keys => Object.fromEntries(keys.map(key => [key, 0]));

export function emptyRunStats() {
  return { ...numericFields(RUN_FIELDS), awards: [] };
}

export function restoreRunStats(raw) {
  const stats = emptyRunStats();
  for (const field of RUN_FIELDS) stats[field] = valueOrZero(raw?.[field]);
  stats.awards = [...new Set(Array.isArray(raw?.awards)
    ? raw.awards.filter(id => typeof id === "string" && ACHIEVEMENT_BY_ID[id]) : [])];
  return stats;
}

export function emptyAchievementProfile() {
  return { version: 1, totals: numericFields(METRICS), unlocked: {} };
}

export function restoreAchievementProfile(raw) {
  const profile = emptyAchievementProfile();
  for (const metric of METRICS) {
    profile.totals[metric] = valueOrZero(raw?.totals?.[metric]);
  }
  if (raw?.unlocked && typeof raw.unlocked === "object") {
    for (const item of ACHIEVEMENTS) {
      const value = raw.unlocked[item.id];
      if (validCount(value) && value > 0) profile.unlocked[item.id] = value;
    }
  }
  return profile;
}

const requireCount = (value, label) => {
  if (!validCount(value)) throw new RangeError("Invalid " + label);
};

const EVENT_TYPES = Object.freeze([
  "bank", "round-clear", "purchase", "consumable", "finish"
]);

function validateEvent(event) {
  if (!event || !EVENT_TYPES.includes(event.type)) {
    throw new RangeError("Unknown achievement event");
  }
  const fields = event.type === "bank"
    ? ["points", "exponent", "goldTier", "goldCoins", "blockersDestroyed"]
    : event.type === "round-clear" ? ["movesLeft"]
    : event.type === "finish" ? ["score"] : [];
  for (const field of fields) requireCount(event[field], field);
  if (event.type === "bank" &&
      (event.exponent < 1 || event.goldTier > 2)) {
    throw new RangeError("Invalid bank achievement event");
  }
  if (event.type === "round-clear" &&
      (typeof event.boss !== "boolean" || typeof event.victory !== "boolean" ||
       event.movesLeft > 10)) {
    throw new RangeError("Invalid cleared-round achievement event");
  }
  if (event.type === "purchase" && typeof event.fullBuild !== "boolean") {
    throw new RangeError("Purchase must report permanent build occupancy");
  }
}

export function progressForAchievement(profile, achievement) {
  const item = typeof achievement === "string"
    ? ACHIEVEMENT_BY_ID[achievement] : achievement;
  if (!item || !ACHIEVEMENT_BY_ID[item.id]) throw new RangeError("Unknown achievement");
  return Math.min(item.goal, restoreAchievementProfile(profile).totals[item.metric]);
}

export function countUnlocked(profile) {
  return ACHIEVEMENTS.filter(item =>
    Boolean(restoreAchievementProfile(profile).unlocked[item.id])).length;
}

export function recordRunStats(raw, event) {
  validateEvent(event);
  const stats = restoreRunStats(raw);
  if (event.type === "bank") {
    stats.banks = addCount(stats.banks, 1);
    stats.goldBanks = addCount(stats.goldBanks, event.goldTier ? 1 : 0);
    stats.goldCoinsBanked = addCount(stats.goldCoinsBanked, event.goldCoins);
    stats.blockersDestroyed = addCount(stats.blockersDestroyed,
      event.blockersDestroyed);
    stats.highestExponent = Math.max(stats.highestExponent, event.exponent);
    stats.bestSingleBank = Math.max(stats.bestSingleBank, event.points);
  } else if (event.type === "round-clear") {
    stats.roundsCleared = addCount(stats.roundsCleared, 1);
    stats.bossesDefeated = addCount(stats.bossesDefeated, event.boss ? 1 : 0);
  } else if (event.type === "purchase") {
    stats.itemsBought = addCount(stats.itemsBought, 1);
  } else if (event.type === "consumable") {
    stats.consumablesUsed = addCount(stats.consumablesUsed, 1);
  }
  return stats;
}

export function recordSuccessfulSlide(raw) {
  const stats = restoreRunStats(raw);
  stats.slides = addCount(stats.slides, 1);
  return stats;
}

export function addEarnedToRunStats(raw, ids) {
  const stats = restoreRunStats(raw);
  stats.awards = [...new Set([...stats.awards, ...ids.filter(id => ACHIEVEMENT_BY_ID[id])])];
  return stats;
}

export function recordAchievementEvent(raw, event, timestamp = Date.now()) {
  validateEvent(event);
  if (!validCount(timestamp) || timestamp < 1) {
    throw new RangeError("Invalid achievement unlock timestamp");
  }
  const profile = restoreAchievementProfile(raw);
  const totals = profile.totals;
  switch (event.type) {
    case "bank":
      totals.banks = addCount(totals.banks, 1);
      totals.goldBanks = addCount(totals.goldBanks, event.goldTier ? 1 : 0);
      totals.doubleGoldBanks = addCount(totals.doubleGoldBanks,
        event.goldTier === 2 ? 1 : 0);
      totals.maxExponent = Math.max(totals.maxExponent, event.exponent);
      totals.bestBankPoints = Math.max(totals.bestBankPoints, event.points);
      totals.goldCoinsBanked = addCount(totals.goldCoinsBanked, event.goldCoins);
      totals.blockersDestroyed = addCount(totals.blockersDestroyed,
        event.blockersDestroyed);
      break;
    case "round-clear":
      totals.roundClears = addCount(totals.roundClears, 1);
      totals.bossWins = addCount(totals.bossWins, event.boss ? 1 : 0);
      totals.victories = addCount(totals.victories, event.victory ? 1 : 0);
      totals.closeClears = addCount(totals.closeClears, event.movesLeft === 1 ? 1 : 0);
      totals.efficientClears = addCount(totals.efficientClears,
        event.movesLeft >= 5 ? 1 : 0);
      break;
    case "purchase":
      totals.purchases = addCount(totals.purchases, 1);
      totals.fullBuilds = addCount(totals.fullBuilds, event.fullBuild ? 1 : 0);
      break;
    case "consumable":
      totals.consumablesUsed = addCount(totals.consumablesUsed, 1);
      break;
    case "finish":
      totals.runsFinished = addCount(totals.runsFinished, 1);
      totals.bestRunScore = Math.max(totals.bestRunScore, event.score);
      break;
  }
  const unlockedNow = [];
  for (const item of ACHIEVEMENTS) {
    if (!profile.unlocked[item.id] && totals[item.metric] >= item.goal) {
      profile.unlocked[item.id] = timestamp;
      unlockedNow.push(item.id);
    }
  }
  return { profile, unlockedNow };
}

export function isFinishedRun(mode, state) {
  return Boolean(state?.over || (mode === "roguelite" &&
    state?.run?.phase === "victory"));
}

export function finalScoreSummary(mode, state, profile = emptyAchievementProfile()) {
  if (!["classic", "roguelite"].includes(mode) || !isFinishedRun(mode, state)) {
    throw new RangeError("A final score requires a finished game");
  }
  const stats = restoreRunStats(mode === "roguelite"
    ? state.run?.stats : state.stats);
  const rogue = mode === "roguelite";
  const won = rogue && state.run.phase === "victory";
  const score = rogue ? state.run.totalScore : state.score;
  return {
    mode, won, score,
    best: rogue ? Math.max(score, restoreAchievementProfile(profile).totals.bestRunScore)
      : Math.max(score, valueOrZero(state.best)),
    round: rogue ? state.run.round : null,
    roundsCleared: rogue ? Math.max(stats.roundsCleared,
      won ? 12 : Math.max(0, state.run.round - 1)) : null,
    slides: rogue ? state.run.totalSlides : state.moves,
    banks: Math.max(stats.banks, rogue ? 0 : (state.banked || []).length),
    goldBanks: stats.goldBanks,
    goldCoinsBanked: stats.goldCoinsBanked,
    bestSingleBank: stats.bestSingleBank,
    highestExponent: stats.highestExponent,
    blockersDestroyed: stats.blockersDestroyed,
    bossesDefeated: stats.bossesDefeated,
    itemsBought: stats.itemsBought,
    consumablesUsed: stats.consumablesUsed,
    coinsEarned: rogue ? state.run.totalCoinsEarned : null,
    coinsHeld: rogue ? state.run.coins : null,
    awards: stats.awards
  };
}
