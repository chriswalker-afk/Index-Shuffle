import { roundCompletionSummary } from "./round-complete.mjs?v=round-intermission-v1";
import { bossPortraitFor } from "./art-catalog.mjs?v=frostlock-v1";

const $ = id => document.getElementById(id);
const count = (n, word) => n + " " + word + (n === 1 ? "" : "s");

// The saved phase is authoritative. A refreshed game after round clear
// shows the same choices until the player actively selects a next action.
// This UI does not mutate gameplay data or make its own reward decisions.
export function renderRoundCompleteDialog(state, mode, screen) {
  const dialog = $("roundCompleteDialog");
  const data = screen === "game" && mode === "roguelite"
    ? roundCompletionSummary(state) : null;
  if (!data) {
    if (dialog.open) dialog.close();
    return;
  }
  $("roundCompleteRound").textContent = "STAGE " + data.stage +
    " · ROUND " + data.round + " / 12";
  $("roundCompleteTitle").textContent = data.defeatedBoss
    ? "Boss defeated!" : "Round complete!";
  $("roundCompleteDescription").textContent = data.defeatedBoss
    ? "Challenge conquered. Collect your rewards and prepare for the next stage."
    : "Target reached! Collect your rewards and choose your next move.";
  $("roundCompleteScore").textContent = data.score;
  $("roundCompleteTarget").textContent = "Target " + data.target + " points";
  $("roundCompleteGold").textContent = "+" + data.totalCoins;
  $("roundCompleteWallet").textContent = data.coins;
  $("roundCompleteBankCoins").textContent = "+" + data.bankCoins;
  $("roundCompleteMoveCoins").textContent = "+" + data.moveCoins;
  $("roundCompleteGoldTotal").textContent = "+" + data.totalCoins;
  $("roundCompleteUnusedLabel").textContent = data.unusedMoves +
    " unused " + (data.unusedMoves === 1 ? "move" : "moves") +
    " (up to 5 gold)";

  const defeated = $("roundCompleteBossVictory");
  defeated.hidden = !data.defeatedBoss;
  if (data.defeatedBossId) {
    const portrait = bossPortraitFor(data.defeatedBossId);
    $("roundCompleteBossPortrait").src = portrait.src;
    $("roundCompleteBossPortrait").alt = portrait.alt;
    $("roundCompleteDefeatedName").textContent = data.defeatedBoss;
  } else {
    $("roundCompleteBossPortrait").removeAttribute("src");
    $("roundCompleteBossPortrait").alt = "";
  }

  const bossNow = data.roundsToBoss === 1;
  $("roundCompleteBossLabel").textContent = bossNow
    ? "Next round: " + (data.nextBossName || "Boss encounter")
    : "Next boss · Round " + data.nextBossRound;
  $("roundCompleteBossDetail").textContent = bossNow
    ? "The next round is a boss battle. Visit the shop to prepare, or continue."
    : count(data.roundsToBoss, "round") +
      " until the next boss encounter (round " + data.nextBossRound + ").";
  $("roundCompleteBossCount").textContent = data.progress + " / " + data.steps;
  const bar = $("roundCompleteBossProgress");
  bar.max = data.steps;
  bar.value = data.progress;
  bar.setAttribute("aria-valuetext", data.progress + " of " + data.steps +
    " rounds completed toward the boss in round " + data.nextBossRound);

  const steps = $("roundCompleteBossSteps");
  steps.replaceChildren();
  for (let step = 1; step <= data.steps; step++) {
    const round = data.nextBossRound - data.steps + step;
    const completed = step <= data.progress;
    const item = document.createElement("li");
    item.className = "round-complete-boss-step" +
      (completed ? " is-complete" : "") +
      (round === data.nextBossRound ? " is-boss" : "");
    const mark = document.createElement("span");
    mark.className = "round-complete-boss-dot";
    mark.textContent = completed ? "✓" : round === data.nextBossRound ? "♛" : String(step);
    mark.setAttribute("aria-hidden", "true");
    const caption = document.createElement("span");
    caption.textContent = "Round " + round +
      (round === data.nextBossRound ? " · Boss" : completed ? " · Cleared" : "");
    item.append(mark, caption);
    steps.append(item);
  }
  $("roundCompleteContinue").textContent = "Skip shop · Start round " + data.nextRound;
  if (!dialog.open) dialog.showModal();
}
