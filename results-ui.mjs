// DOM-only presentation for end-of-game results and the achievement gallery.
// All scoring / award logic lives in the pure milestones.mjs module.
import {
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, countUnlocked,
  progressForAchievement, isFinishedRun, finalScoreSummary
} from "./milestones.mjs?v=hazard-counter-v1";
import { bossForRound } from "./bosses.mjs?v=frostlock-v1";
import { bossPortraitFor } from "./art-catalog.mjs?v=frostlock-v1";
import { bossSceneFor } from "./boss-scenes.mjs?v=frostlock-v1";
import { achievementMedalHref, achievementVisualTheme } from "./achievement-art.mjs?v=hazard-counter-v1-art-pass4";

const $ = id => document.getElementById(id);
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
};
const pretty = number => Number(number || 0).toLocaleString();

export function renderAchievementCount(profile, visible) {
  $("rogueAchievementsShortcut").hidden = !visible;
  $("achievementCount").textContent = countUnlocked(profile) +
    " / " + ACHIEVEMENTS.length;
}

export function openAchievementGallery(profile) {
  const unlocked = countUnlocked(profile);
  $("achievementsProgressText").textContent = unlocked + " of " +
    ACHIEVEMENTS.length + " unlocked";
  $("achievementsProgressBar").max = ACHIEVEMENTS.length;
  $("achievementsProgressBar").value = unlocked;
  $("achievementsSubtitle").textContent = unlocked === ACHIEVEMENTS.length
    ? "Collection complete! Every badge has been earned."
    : "Unlock awards by banking powers, trading and surviving boss rounds.";

  const container = $("achievementsGrid");
  container.replaceChildren();
  const sorted = ACHIEVEMENTS.slice().sort((a, b) =>
    Number(Boolean(profile.unlocked[b.id])) - Number(Boolean(profile.unlocked[a.id])));
  for (const achievement of sorted) {
    const earned = Boolean(profile.unlocked[achievement.id]);
    const card = node("article", "achievement-card" + (earned ? "" : " locked"));
    const theme = achievementVisualTheme(achievement.id);
    card.dataset.theme = theme;
    const top = node("div", "achievement-card-top");
    const emblem = node("span", "achievement-medal", earned ? "" : "?");
    emblem.setAttribute("aria-hidden", "true");
    if (earned) {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 100 100");
      icon.setAttribute("focusable", "false");
      icon.classList.add("achievement-medal-icon");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", achievementMedalHref(achievement.id));
      icon.append(use);
      emblem.append(icon);
    }
    top.append(emblem, node("span", "achievement-card-status",
      earned ? "Unlocked" : "Not yet earned"));
    card.append(
      top,
      node("h3", "", achievement.name),
      node("p", "", achievement.description)
    );
    if (earned) {
      const timestamp = profile.unlocked[achievement.id];
      const date = new Date(timestamp);
      if (!Number.isNaN(date.getTime())) {
        card.append(node("small", "achievement-card-date",
          "Earned " + date.toLocaleDateString()));
      }
    } else {
      const progress = progressForAchievement(profile, achievement);
      const bottom = node("div", "achievement-card-progress");
      const bar = node("progress", "");
      bar.value = progress;
      bar.max = achievement.goal;
      bar.setAttribute("aria-label", achievement.name + " progress");
      bottom.append(bar, node("span", "",
        progress + " / " + achievement.goal));
      card.append(bottom);
    }
    container.append(card);
  }
  if (!$("achievementsDialog").open) $("achievementsDialog").showModal();
}

export function renderFinalScreen(mode, state, profile) {
  const dialog = $("resultsDialog");
  if (!isFinishedRun(mode, state)) {
    if (dialog.open) dialog.close();
    return;
  }

  const summary = finalScoreSummary(mode, state, profile);
  const rogue = mode === "roguelite";
  dialog.classList.toggle("victory", summary.won);
  $("resultsKicker").textContent = summary.won ? "RUN COMPLETE"
    : rogue ? "ROGUELIKE • GAME OVER" : "CLASSIC • GAME OVER";
  $("resultsTitle").textContent = summary.won ? "Index Master!"
    : rogue ? "Your run has ended" : "Game over";
  $("resultsSubtitle").textContent = summary.won
    ? "You cleared all 12 rounds. Here is your final run summary."
    : rogue ? "You reached round " + summary.round +
      " of 12. Here's how far your build took you."
    : "Every slide and correct bank contributed to this score.";
  $("resultsScoreLabel").textContent = rogue ? "TOTAL RUN SCORE" : "FINAL SCORE";
  $("resultsFinalScore").textContent = pretty(summary.score);
  $("resultsBestScore").textContent = rogue
    ? "Best run score: " + pretty(summary.best)
    : "Personal best: " + pretty(summary.best);

  // The final boss falls only when the twelve-round run is won. A lost
  // run never displays a boss-defeated ribbon, regardless of round number.
  const finalBoss = rogue && summary.won ? bossForRound(state.run) : null;
  $("resultsBossVictory").hidden = !finalBoss;
  $("resultsBossVictory").dataset.boss = finalBoss?.id ?? "";
  if (finalBoss) {
    const art = bossPortraitFor(finalBoss.id);
    $("resultsBossPortrait").src = art.src;
    $("resultsBossPortrait").alt = art.alt;
    $("resultsBossName").textContent = finalBoss.name;
    $("resultsBossLine").textContent = bossSceneFor(finalBoss.id)?.defeated ?? "";
  } else {
    $("resultsBossPortrait").removeAttribute("src");
    $("resultsBossPortrait").alt = "";
  }

  const statistics = rogue ? [
    ["Rounds cleared", summary.roundsCleared + " / 12"],
    ["Bosses defeated", summary.bossesDefeated + " / 4"],
    ["Successful banks", pretty(summary.banks)],
    ["Slides made", pretty(summary.slides)],
    ["Total gold earned", pretty(summary.coinsEarned)],
    ["Coins remaining", pretty(summary.coinsHeld)],
    ["Best single bank", pretty(summary.bestSingleBank) + " pts"],
    ["Blockers destroyed", pretty(summary.blockersDestroyed)],
    ["Shop items bought", pretty(summary.itemsBought)],
    ["Consumables used", pretty(summary.consumablesUsed)]
  ] : [
    ["Slides made", pretty(summary.slides)],
    ["Powers banked", pretty(summary.banks)],
    ["Highest exponent banked", summary.highestExponent
      ? String(summary.highestExponent) : "—"],
    ["Blockers destroyed", pretty(summary.blockersDestroyed)]
  ];
  const stats = $("resultsStats");
  stats.replaceChildren();
  for (const [label, value] of statistics) {
    const card = node("div", "results-stat");
    card.append(node("span", "", label), node("strong", "", value));
    stats.append(card);
  }

  $("resultsAwardsSection").hidden = !rogue;
  if (rogue) {
    const awards = $("resultsAwardsList");
    awards.replaceChildren();
    if (!summary.awards.length) {
      awards.append(node("p", "results-award-empty",
        "No new badges earned this run. Explore the collection for your next goal."));
    } else {
      for (const id of summary.awards) {
        const entry = ACHIEVEMENT_BY_ID[id];
        if (!entry) continue;
        awards.append(node("span", "results-award-chip",
          entry.icon + " " + entry.name));
      }
    }
  }
  if (!state.resultsDismissed && !dialog.open) dialog.showModal();
}
