import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MODE_LABELS, resumableSave, continueSummary, continueOptions
} from "./navigation.mjs";
import { newRogueliteRun } from "./roguelite.mjs";

const rng = () => 0;
const board = Array(16).fill(null);
board[0] = { base: 2, exp: 1 };
board[1] = { base: 3, exp: 1 };
const classic = {
  board, score: 180, best: 240, moves: 11,
  movesLeft: 4, over: false
};
const roguelike = newRogueliteRun(0, rng);
roguelike.run.round = 5;
roguelike.run.totalScore = 96;
roguelike.run.coins = 13;
roguelike.movesLeft = 7;

assert.deepEqual(MODE_LABELS, { classic: "Classic", roguelite: "Roguelike" });
assert.equal(resumableSave("classic", classic), true);
assert.equal(resumableSave("roguelite", roguelike), true);
assert.equal(resumableSave("something", classic), false);
assert.equal(resumableSave("classic", null), false);
assert.equal(resumableSave("classic", { board: [] }), false);
assert.equal(resumableSave("roguelite", classic), false);
assert.equal(resumableSave("classic", { ...classic, over: true }), false);
assert.equal(resumableSave("classic", { ...classic, movesLeft: 0 }), false);
assert.equal(resumableSave("classic", { ...classic, movesLeft: "4" }), false);
assert.equal(resumableSave("roguelite", { ...roguelike, over: true }), false);
assert.equal(resumableSave("roguelite", {
  ...roguelike, movesLeft: 0
}), false);
assert.equal(resumableSave("roguelite", {
  ...roguelike, run: { ...roguelike.run, round: 12, phase: "victory" }
}), false);
assert.equal(resumableSave("roguelite", {
  ...roguelike, run: { ...roguelike.run, phase: "round-clear" },
  movesLeft: 0
}), true, "A completed round must still permit a shop visit, even with no moves");
assert.equal(resumableSave("roguelite", {
  ...roguelike, run: { ...roguelike.run, phase: "shop" },
  movesLeft: 0
}), true, "A saved shop remains resumable even with zero moves remaining");
assert.equal(resumableSave("roguelite", {
  ...roguelike, run: { ...roguelike.run, round: 13 }
}), false);

const c = continueSummary("classic", classic);
assert.equal(c.name, "Classic");
assert.equal(c.status, "In progress");
assert.equal(c.detail, "Score 180 · 4 moves remaining");
const r = continueSummary("roguelite", roguelike);
assert.equal(r.name, "Roguelike");
assert.equal(r.status, "In progress");
assert.equal(r.detail, "Round 5 of 12 · 96 run points · 13 gold");
assert.equal(continueSummary("classic", { ...classic, over: true }), null);
assert.equal(continueSummary("roguelite", {
  ...roguelike, run: { ...roguelike.run, phase: "shop" }
}).status, "Shop available");
assert.equal(continueSummary("roguelite", {
  ...roguelike, run: { ...roguelike.run, phase: "round-clear" }
}).status, "Round cleared");

assert.deepEqual(continueOptions(null, null), []);
assert.deepEqual(continueOptions(classic, null).map(x => x.mode), ["classic"]);
assert.deepEqual(continueOptions(null, roguelike).map(x => x.mode), ["roguelite"]);
assert.deepEqual(continueOptions(classic, roguelike, "classic").map(x => x.mode),
  ["classic", "roguelite"]);
assert.deepEqual(continueOptions(classic, roguelike, "roguelite").map(x => x.mode),
  ["roguelite", "classic"]);
assert.deepEqual(continueOptions({ ...classic, over: true }, {
  ...roguelike, run: { ...roguelike.run, round: 12, phase: "victory" }
}), []);
assert.equal(classic.score, 180, "Continue labels must not mutate existing saves");
assert.equal(roguelike.run.coins, 13);

// Semantic contract: title -> New Game -> choose mode; title -> Continue ->
// pick resumable save; game -> Return to title; finished game -> score modal ->
// Play again or Return to title. Existing localStorage keys must stay intact.
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
const ui = readFileSync("title-ui.mjs", "utf8");
for (const id of [
  "titleScreen", "titleNew", "titleContinue", "titleContinueHint",
  "newGameScreen", "modeClassic", "modeRoguelite", "newGameBack",
  "continueScreen", "continueBack", "continueSlots",
  "gameScreen", "currentModeName", "headerTitle", "shopReturnTitle",
  "resultsDialog", "resultsPlayAgain", "resultsBack", "viewResults",
  "returnTitleFromEnd", "achievementOpen", "gameAchievements"
]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing screen element " + id);
}
assert.match(html, /<section id="titleScreen" class="landing-screen title-screen"/);
assert.match(html, /<section id="newGameScreen"[^>]*hidden/);
assert.match(html, /<section id="continueScreen"[^>]*hidden/);
assert.match(html, /<section id="gameScreen"[^>]*hidden/);
assert.ok(html.indexOf('id="titleScreen"') < html.indexOf('id="newGameScreen"'));
assert.ok(html.indexOf('id="newGameScreen"') < html.indexOf('id="gameScreen"'));
assert.match(html, /id="titleContinue"[^>]*disabled/);
assert.match(html, /id="modeRoguelite"[\s\S]*?<strong>Roguelike<\/strong>/);
assert.match(html, /id="resultsPlayAgain">Play again<\/button>/);
assert.match(html, /id="resultsBack">Return to title<\/button>/);
assert.doesNotMatch(html, /id="newFromEnd"/);
assert.doesNotMatch(html, /id="new" class="outline"/);
assert.match(html, /id="shopReturnTitle".*Return to title/);
assert.match(html, /id="rogueAchievementsShortcut"/);
assert.match(css, /\.title-hero \{/);
assert.match(css, /\.title-main-actions \{/);
assert.match(css, /\.choice-screen \.mode-picker \{/);
assert.match(css, /\.save-card \{/);
assert.match(css, /\.choice-screen \.mode-picker \.mode-option \{[\s\S]*?min-height: 196px/);
assert.match(css, /\.shop-actions #shopContinue \{ grid-column: 1 \/ -1; \}/);

assert.match(app, /let screen = "title";/);
assert.match(app, /renderNavigation\(screen, saved\("classic"\), saved\("roguelite"\)/);
assert.match(app, /if \(screen !== "game"\) \{/);
assert.match(app, /if \(screen !== "game" \|\| pendingItem !== null/);
assert.match(app, /function beginNewMode\(selected, skipConfirmation = false\)/);
assert.match(app, /resumableSave\(selected, previous\)/);
assert.match(app, /window\.confirm\(/);
assert.match(app, /const best = Number\.isSafeInteger\(previous\?\.best\)/);
assert.match(app, /function resumeSavedGame\(selected\)/);
assert.match(app, /loadSavedGame\(snapshot\)/);
assert.match(app, /restoreRogueliteRun\(state\.run, state\.movesLeft\)/);
assert.match(app, /function returnToTitle\(\)/);
assert.match(app, /if \(screen === "game"\) \{[\s\S]*?persist\(\)/);
assert.match(app, /\$\("resultsBack"\)\.addEventListener\("click", returnToTitle\)/);
assert.match(app, /\$\("shopReturnTitle"\)\.addEventListener\("click", returnToTitle\)/);
assert.match(app, /\$\("modeClassic"\)\.addEventListener\("click", \(\) => beginNewMode\("classic"\)\)/);
assert.match(app, /\$\("modeRoguelite"\)\.addEventListener\("click", \(\) => beginNewMode\("roguelite"\)\)/);
assert.match(app, /\$\("resultsPlayAgain"\)\.addEventListener\("click", \(\) => beginNewMode\(mode, true\)\)/);
assert.match(app, /\$\("achievementOpen"\)\.addEventListener\("click", showAchievements\)/);
assert.match(app, /\$\("gameAchievements"\)\.addEventListener\("click", showAchievements\)/);
assert.match(app, /const CLASSIC_SAVE = "index-shuffle-v1"/);
assert.match(app, /const ROGUE_SAVE = "index-shuffle-roguelite-v1"/);
assert.match(app, /const MODE_SAVE = "index-shuffle-selected-mode-v1"/);
assert.match(ui, /renderAchievementCount\(profile, scene === "title"\)/);
assert.match(ui, /continueOptions\(classic, roguelite, preferred\)/);
assert.match(ui, /card\.addEventListener\("click", \(\) => resume\(slot\.mode\)\)/);
assert.match(ui, /\$\("titleContinue"\)\.disabled = slots\.length === 0/);
assert.doesNotMatch(app, /function switchMode\(/);
console.log("All Index Shuffle title-screen navigation and save-routing tests passed.");
