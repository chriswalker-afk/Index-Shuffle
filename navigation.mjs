// Navigation rules for the title screen. The internal "roguelite" save key
// is intentionally unchanged even though the mode's display name is Roguelike.
import { validRogueliteRun } from "./roguelite.mjs?v=frostlock-v1";
import { isFinishedRun } from "./milestones.mjs?v=hazard-counter-v1";
import { validSavedBoard } from "./save-validation.mjs?v=release-5a";

export const MODE_LABELS = Object.freeze({
  classic: "Classic",
  roguelite: "Roguelike"
});

const positive = number => Number.isSafeInteger(number) && number >= 0;
const display = number => positive(number) ? number.toLocaleString() : "0";

export function resumableSave(gameMode, snapshot) {
  if (!(gameMode in MODE_LABELS) || !snapshot ||
      !validSavedBoard(snapshot.board)) return false;
  if (gameMode === "roguelite" && !validRogueliteRun(snapshot.run)) return false;
  if (isFinishedRun(gameMode, snapshot)) return false;
  if (gameMode === "roguelite" && snapshot.run.phase !== "playing") return true;
  return Number.isSafeInteger(snapshot.movesLeft) && snapshot.movesLeft > 0;
}

export function continueSummary(gameMode, snapshot) {
  if (!resumableSave(gameMode, snapshot)) return null;
  const rogue = gameMode === "roguelite";
  const run = rogue ? snapshot.run : null;
  const status = !rogue ? "In progress"
    : run.phase === "shop" ? "Shop available"
    : run.phase === "round-clear" ? "Round cleared" : "In progress";
  const detail = !rogue
    ? "Score " + display(snapshot.score) + " · " +
      snapshot.movesLeft + " moves remaining"
    : "Round " + run.round + " of 12 · " +
      display(run.totalScore) + " run points · " + display(run.coins) + " gold";
  return {
    mode: gameMode,
    name: MODE_LABELS[gameMode],
    status, detail,
    icon: rogue ? "♛" : "∞"
  };
}

export function continueOptions(classic, roguelite, preferred = "classic") {
  const saves = [
    continueSummary("classic", classic),
    continueSummary("roguelite", roguelite)
  ].filter(Boolean);
  return saves.sort((a, b) =>
    Number(b.mode === preferred) - Number(a.mode === preferred));
}
