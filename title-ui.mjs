// Screen presentation for the title, new-game choice and Continue slots.
// Save eligibility and descriptions are pure functions in navigation.mjs.
import { continueOptions } from "./navigation.mjs?v=hazard-counter-v1";
import { renderAchievementCount } from "./results-ui.mjs?v=hazard-counter-v1-art-pass3";

const $ = id => document.getElementById(id);

export function renderNavigation(scene, classic, roguelite, preferred, profile, resume) {
  const screens = {
    title: "titleScreen", new: "newGameScreen",
    continue: "continueScreen", game: "gameScreen"
  };
  if (!Object.hasOwn(screens, scene)) throw new RangeError("Unknown game screen");
  for (const [name, id] of Object.entries(screens)) $(id).hidden = scene !== name;
  $("headerTitle").hidden = scene !== "game";
  renderAchievementCount(profile, scene === "title");

  const slots = continueOptions(classic, roguelite, preferred);
  $("titleContinue").disabled = slots.length === 0;
  $("titleContinueHint").textContent = slots.length === 0
    ? "No unfinished games saved yet. Start a new game to begin."
    : slots.length === 1 ? "1 unfinished game ready to continue."
    : "2 unfinished games saved. Choose which one to resume.";

  if (scene !== "continue") return;
  const container = $("continueSlots");
  container.replaceChildren();
  for (const slot of slots) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "save-card";
    card.setAttribute("aria-label", "Continue " + slot.name +
      ". " + slot.status + ". " + slot.detail);
    const icon = document.createElement("span");
    icon.className = "save-card-icon" + (slot.mode === "roguelite" ? " rogue" : "");
    icon.textContent = slot.icon;
    icon.setAttribute("aria-hidden", "true");
    const content = document.createElement("span");
    content.className = "save-card-copy";
    const title = document.createElement("strong");
    title.textContent = slot.name;
    const status = document.createElement("small");
    status.className = "save-status";
    status.textContent = slot.status;
    const detail = document.createElement("span");
    detail.className = "save-card-detail";
    detail.textContent = slot.detail;
    content.append(title, status, detail);
    const arrow = document.createElement("span");
    arrow.className = "save-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    card.append(icon, content, arrow);
    card.addEventListener("click", () => resume(slot.mode));
    container.appendChild(card);
  }
}
