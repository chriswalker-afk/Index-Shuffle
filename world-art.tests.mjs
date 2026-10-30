// Visual Pass 4: the four stages, five hazards and sixteen medals are
// presentation-only and leave actual game rules, saves and accessibility intact.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { stageForRound } from "./roguelite.mjs";
import { HAZARD_DEFINITIONS } from "./hazards.mjs";
import { ACHIEVEMENTS } from "./milestones.mjs";
import { STAGE_ART, stageArtFor } from "./stage-art.mjs";
import {
  ACHIEVEMENT_ART_IDS, ACHIEVEMENT_SPRITE,
  achievementMedalHref, achievementVisualTheme
} from "./achievement-art.mjs";

assert.deepEqual(Object.keys(STAGE_ART).map(Number), [1,2,3,4]);
for (let round = 1; round <= 12; round++) {
  const stage = stageForRound(round);
  const scene = stageArtFor(stage);
  assert.ok(scene);
  assert.equal(stage, Math.floor((round - 1) / 3) + 1);
  assert.ok(scene.title.length >= 10);
  assert.ok(scene.subtitle.length >= 12);
  assert.match(scene.art, /^assets\/art\/stage-[a-z-]+\.svg$/);
  assert.ok(existsSync(scene.art), "Missing stage art " + scene.art);
}
for (const stage of [0, 5, NaN, -1, 1.5, null, "2", "__proto__"]) {
  assert.equal(stageArtFor(stage), null);
}
const types = Object.keys(HAZARD_DEFINITIONS);
assert.deepEqual(types.sort(), ["cloudy","cracked","greedy","null","void"]);
const assets = [
  "assets/art/title-numberworld.svg",
  "assets/art/achievement-trophy.svg",
  "assets/art/achievement-medals.svg",
  ...Object.values(STAGE_ART).map(stage => stage.art),
  ...types.map(type => "assets/art/hazard-" + type + ".svg")
];
assert.equal(assets.length, 12);
for (const file of assets) {
  assert.ok(existsSync(file), "Asset exists: " + file);
  const svg = readFileSync(file, "utf8");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<title/);
  assert.match(svg, /<desc/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|onload=|(?:href|src)="https?:\/\//i);
  assert.ok(svg.length < 18000, "Single decorative SVG should remain small");
}
assert.equal(ACHIEVEMENT_ART_IDS.length, 16);
const ids = ACHIEVEMENTS.map(item => item.id);
assert.deepEqual([...ACHIEVEMENT_ART_IDS].sort(), [...ids].sort());
const sprite = readFileSync("assets/art/achievement-medals.svg", "utf8");
const icons = [...sprite.matchAll(/<symbol id="award-([a-z-]+)"/g)].map(m => m[1]);
assert.deepEqual(icons.filter(id => id !== "generic").sort(), ids.sort());
assert.equal(new Set(icons).size, 17);
for (const id of ids) {
  assert.equal(achievementMedalHref(id), ACHIEVEMENT_SPRITE + "#award-" + id);
  assert.match(achievementVisualTheme(id), /^(gold|banking|boss|craft|survival)$/);
}
assert.equal(achievementMedalHref("__proto__"), ACHIEVEMENT_SPRITE + "#award-generic");
assert.equal(achievementMedalHref(null), ACHIEVEMENT_SPRITE + "#award-generic");

const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const hazardUI = readFileSync("hazard-ui.mjs", "utf8");
const resultsUI = readFileSync("results-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
const gallery = readFileSync("world-gallery.html", "utf8");
for (const id of ["stageScene","stageSceneImage","stageSceneLabel","stageSceneTitle",
  "stageSceneSubtitle","stageSceneRound","titleRealmHeading",
  "achievementsDialog","achievementsGrid","achievementsProgressBar"]) {
  assert.match(html, new RegExp('id="' + id + '"'));
}
assert.match(html, /assets\/art\/title-numberworld\.svg/);
assert.match(html, /title-realm-grid/);
assert.match(html, /assets\/art\/achievement-trophy\.svg/);
assert.match(app, /const currentStage = rogue \? stageForRound\(state\.run\.round\) : null/);
assert.match(app, /stageArtFor\(currentStage\)/);
assert.match(app, /\$\("gameScreen"\)\.dataset\.stage = stageScene \? String\(currentStage\) : "classic"/);
assert.match(app, /\$\("stageScene"\)\.hidden = !stageScene/);
assert.match(app, /\$\("boardHazardStatus"\)\.dataset\.hazard/);
assert.match(hazardUI, /function hazardEmblem\(\)/);
assert.match(hazardUI, /square\.append\(symbol, hazardEmblem\(\)\)/);
assert.match(hazardUI, /square\.append\(alert, caption, hazardEmblem\(\)\)/);
assert.match(hazardUI, /overlay\.setAttribute\("aria-hidden", "true"\)/);
assert.match(hazardUI, /boardElement\.appendChild\(overlay\)/);
assert.match(resultsUI, /const emblem = node\("span", "achievement-medal", earned \? "" : "\?"\)/);
assert.match(resultsUI, /if \(earned\) \{/);
assert.match(resultsUI, /achievementMedalHref\(achievement\.id\)/);
assert.match(resultsUI, /progressForAchievement\(profile, achievement\)/);
assert.match(html, /styles\.css\?v=runestones-pass3/);
assert.match(html, /app\.mjs\?v=runestones-pass4/);
assert.match(app, /hazard-ui\.mjs\?v=hazard-counter-v1-art-pass4/);
for (const selector of [
  ".stage-scene", ".title-numberworld-art", ".title-realm-grid",
  ".hazard-slot.hazard-cloudy .hazard-art-emblem",
  ".hazard-slot.hazard-incoming .hazard-art-emblem",
  ".achievement-cabinet-heading", ".achievement-medal-icon",
  ".achievement-card.locked"
]) assert.ok(css.includes(selector), "Missing CSS: " + selector);
assert.match(css, /\.hazard-slot\s*\{[\s\S]*?pointer-events: none;/);
assert.match(css, /\.hazard-slot\.hazard-cloudy\s*\{/);
assert.match(css, /prefers-reduced-motion: reduce/);
for (const phrase of ["Four realms", "Five square hazards",
  "achievementMedalHref", "stageArtFor"]) {
  if (phrase !== "stageArtFor") assert.ok(gallery.includes(phrase));
}
assert.ok(existsSync("art-preview.html"));
assert.ok(existsSync("boss-gallery.html"));
assert.ok(existsSync("item-gallery.html"));
console.log("All Index Shuffle world artwork, hazard and award Pass 4 tests passed.");
