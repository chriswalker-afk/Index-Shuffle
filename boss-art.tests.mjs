// Boss art Pass 3: seven original portraits and safe, skippable encounter UI.
// No game rules, shop pricing, save keys or turn costs are imported here.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { BOSS_CATALOG, BOSS_ROUNDS } from "./bosses.mjs";
import { BOSS_ART, bossPortraitFor } from "./art-catalog.mjs";
import { BOSS_SCENES, bossSceneFor } from "./boss-scenes.mjs";

const ids = BOSS_CATALOG.map(b => b.id);
assert.equal(ids.length, 8);
assert.deepEqual(Object.keys(BOSS_ART).sort(), [...ids].sort());
assert.deepEqual(Object.keys(BOSS_SCENES).sort(), [...ids].sort());
assert.deepEqual(BOSS_ROUNDS, [3,6,9,12]);
for (const boss of BOSS_CATALOG) {
  const portrait = bossPortraitFor(boss.id);
  assert.ok(portrait, "Every boss must have artwork: " + boss.id);
  const scene = bossSceneFor(boss.id);
  assert.ok(scene && scene.entrance.length >= 20 &&
    scene.defeated.length >= 20, "Every boss needs introduction and defeat copy");
  assert.ok(portrait.alt.length >= 45);
  assert.match(portrait.src, /^assets\/art\/boss-[a-z-]+\.svg$/);
  assert.ok(existsSync(portrait.src));
  const svg = readFileSync(portrait.src, "utf8");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 480 480"/);
  assert.match(svg, /<title/);
  assert.match(svg, /<desc/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|onload=|(?:href|src)="https?:\/\//i);
  assert.ok(svg.length < 12000, "Keep portraits lightweight for Pages");
}
for (const id of ["constructor", "__proto__", "toString", "", null, undefined]) {
  assert.equal(bossPortraitFor(id), null);
  assert.equal(bossSceneFor(id), null);
}
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const resultsUI = readFileSync("results-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
const gallery = readFileSync("boss-gallery.html", "utf8");
for (const name of ["bossIntroDialog", "bossIntroName", "bossIntroRound",
  "bossIntroPortrait", "bossIntroQuote", "bossIntroRule", "bossIntroTarget",
  "bossIntroSkip", "bossIntroStart", "bossVictoryBanner", "bossVictoryPortrait",
  "bossVictoryName", "bossVictoryLine", "resultsBossVictory",
  "resultsBossPortrait", "resultsBossName", "resultsBossLine"]) {
  assert.match(html, new RegExp('id="' + name + '"'), "Missing boss scene: " + name);
}
assert.match(app, /function showBossIntro\(boss\)/);
assert.match(app, /const dialog = \$\("bossIntroDialog"\)/);
assert.match(app, /if \(!dialog\.open\) dialog\.showModal\(\)/);
assert.match(app, /\$\("bossIntroSkip"\)\.addEventListener\("click", dismissBossIntro\)/);
assert.match(app, /\$\("bossIntroStart"\)\.addEventListener\("click", dismissBossIntro\)/);
assert.match(app, /\$\("bossIntroDialog"\)\.addEventListener\("cancel"/);
assert.match(app, /if \(boss\) showBossIntro\(boss\)/);
assert.match(app, /state = advanceRogueliteRound\(state, Math\.random, goldChancesForRun\(state\.run\)\)/);
assert.match(app, /\$\("bossIntroDialog"\)\.open \|\|/);
assert.match(app, /bossCleared = state\.run\.phase === "round-clear" && boss/);
assert.match(app, /\$\("bossVictoryBanner"\)\.hidden = !bossCleared/);
assert.match(app, /\$\("bossVictoryBanner"\)\.dataset\.boss = boss\?\.id/);
assert.match(resultsUI, /finalBoss = rogue && summary\.won \? bossForRound\(state\.run\) : null/);
assert.match(resultsUI, /\$\("resultsBossVictory"\)\.hidden = !finalBoss/);
assert.match(shopUI, /\$\("shopBossPreview"\)\.dataset\.boss = boss\?\.id/);
assert.match(app, /\$\("bossRule"\)\.dataset\.boss = boss\?\.id/);
assert.match(html, /styles\.css\?v=runestones-pass3/);
assert.match(html, /app\.mjs\?v=runestones-pass4/);
assert.match(gallery, /BOSS_CATALOG/);
assert.match(gallery, /bossPortraitFor\(boss\.id\)/);
assert.match(gallery, /dialog\.showModal\(\)/);
for (const className of [".boss-intro-dialog", ".boss-intro-art", ".boss-victory-banner",
  ".results-boss-victory", ".boss-intro-start", 'data-boss="three-curse"']) {
  assert.ok(css.includes(className), "Missing scene CSS " + className);
}
assert.match(css, /prefers-reduced-motion: reduce/);
const begin = app.indexOf("function showBossIntro(boss)");
const finish = app.indexOf("function dismissBossIntro()", begin);
assert.ok(begin > -1 && finish > begin);
const intro = app.slice(begin, finish);
assert.doesNotMatch(intro, /setTimeout\(|setInterval\(|localStorage\.|state\s*=[^=]|persist\(/,
  "Boss intro must not alter saved progress or use time-based locks");
console.log("Index Shuffle all-eight-boss portraits, intro, victory and gallery checks passed.");
