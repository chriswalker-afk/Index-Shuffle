// Presentation-only helpers. No scores, timers, moves or achievement
// counters change in this module.
export const ACTIVITY_LIMIT = 8;
export const ACTIVITY_TYPES = Object.freeze([
  "merge", "bank", "gold", "blocker", "hazard", "runestone",
  "item", "shop", "round", "system"
]);
const knownTypes = new Set(ACTIVITY_TYPES);
const safeInteger = value => Number.isSafeInteger(value) && value >= 0;
const number = value => safeInteger(value) ? value : 0;
const pretty = value => number(value).toLocaleString("en-GB");

export const TOUR_STEPS = Object.freeze([
  Object.freeze({
    title: "Slide to combine",
    instruction: "Use the arrow keys, WASD or direction buttons. Matching bases merge into higher powers: 2 and 2 become 2². A successful slide spends moves; a slide that changes nothing costs nothing.",
    cue: "Try a direction arrow when you are ready."
  }),
  Object.freeze({
    title: "Bank the mathematics",
    instruction: "A glowing power can be selected. Enter its exact value before the clock runs out: 2³ = 8. Only a correct answer awards points. Incorrect, timed-out and cancelled questions lock that tile until a successful slide.",
    cue: "Choose a glowing tile when one appears."
  }),
  Object.freeze({
    title: "Keep your moves alive",
    instruction: "You start with 10 moves. Banking two powers genuinely made by merges correctly earns one move, up to 10. Fixed blockers add to slide costs and are damaged by correctly banked adjacent merged powers.",
    cue: "Keep an eye on Moves left and the merge-credit meter."
  })
]);

export function restoreActivity(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(entry => entry && typeof entry === "object" &&
    knownTypes.has(entry.type) && typeof entry.message === "string" &&
    entry.message.trim().length > 0)
    .slice(-ACTIVITY_LIMIT)
    .map(entry => ({
      type: entry.type,
      message: entry.message.trim().slice(0, 190)
    }));
}

export function appendActivity(raw, type, message) {
  if (!knownTypes.has(type) || typeof message !== "string" ||
      !message.trim()) return restoreActivity(raw);
  return [...restoreActivity(raw), {
    type, message: message.trim().slice(0, 190)
  }].slice(-ACTIVITY_LIMIT);
}

export function bankMoment({ points = 0, coins = 0,
  moves = 0, blockers = 0 } = {}) {
  const items = ["✓ " + (points > 0 ? "+" + pretty(points) + " points"
    : "Correct bank")];
  if (coins > 0) items.push("◉ +" + pretty(coins) + " gold");
  if (moves > 0) items.push("+" + pretty(moves) +
    (moves === 1 ? " move" : " moves"));
  if (blockers > 0) items.push(pretty(blockers) +
    (blockers === 1 ? " blocker broken" : " blockers broken"));
  return items.join(" · ");
}

export function describeEnding(mode, state, summary) {
  if (summary?.won) return {
    title: "Numberworld conquered",
    detail: "All 12 rounds cleared and the final boss defeated."
  };
  if (state?.movesLeft === 0) return {
    title: "Out of moves",
    detail: "Your move budget reached zero. Correctly bank two merged powers to earn a move in your next run."
  };
  return {
    title: "No legal actions left",
    detail: "There were no legal slides, banks or held rescue tools remaining."
  };
}

export function chooseRunHighlight(mode, summary) {
  if (!summary || typeof summary !== "object") return "Every correct bank counts.";
  if (summary.won) return "Four bosses overcome. Twelve rounds mastered.";
  if (number(summary.bestSingleBank) > 0) {
    return "Standout bank: +" + pretty(summary.bestSingleBank) + " points.";
  }
  if (number(summary.blockersDestroyed) > 0) {
    return pretty(summary.blockersDestroyed) + " blockers destroyed.";
  }
  if (number(summary.banks) > 0) {
    return pretty(summary.banks) + " correct banks completed.";
  }
  return number(summary.slides) > 0
    ? pretty(summary.slides) + " slides made. Keep building powers."
    : "Your next run starts with a fresh board.";
}

export function formatShareSummary(mode, summary, ending) {
  const rogue = mode === "roguelite";
  const rows = [
    "INDEX SHUFFLE · " + (rogue ? "Roguelike" : "Classic"),
    ending.title,
    "Score: " + pretty(summary.score)
  ];
  if (rogue) {
    rows.push("Rounds cleared: " + number(summary.roundsCleared) + "/12",
      "Bosses defeated: " + number(summary.bossesDefeated) + "/4",
      "Gold earned: " + pretty(summary.coinsEarned));
  }
  rows.push("Correct banks: " + pretty(summary.banks),
    "Slides: " + pretty(summary.slides),
    "Best bank: +" + pretty(summary.bestSingleBank) + " points",
    "Play: https://chriswalker-afk.github.io/Index-Shuffle/");
  return rows.join("\n");
}
