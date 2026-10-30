// Static and data-contract checks for the optional Pass 1 art layer.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { BOSS_BY_ID } from "./bosses.mjs";
import { BOSS_ART, MERCHANT_ART, bossPortraitFor } from "./art-catalog.mjs";

assert.deepEqual(Object.keys(BOSS_ART).sort(), Object.keys(BOSS_BY_ID).sort());
assert.equal(bossPortraitFor("blockade"), BOSS_ART.blockade);
assert.equal(bossPortraitFor("five-thief"), BOSS_ART["five-thief"]);
assert.equal(bossPortraitFor("scorekeeper"), BOSS_ART.scorekeeper);
assert.equal(bossPortraitFor("timekeeper"), BOSS_ART.timekeeper);
assert.equal(bossPortraitFor("missing"), null);
assert.equal(bossPortraitFor("constructor"), null);
assert.equal(bossPortraitFor(null), null);
assert.equal(bossPortraitFor("__proto__"), null);
for (const bossId of Object.keys(BOSS_ART)) {
  assert.ok(BOSS_BY_ID[bossId], "Artwork must match a real boss ID");
}
for (const image of [MERCHANT_ART, ...Object.values(BOSS_ART)]) {
  assert.ok(image.alt.length > 30, "Portrait needs descriptive alternative text");
  assert.match(image.src, /^assets\/art\/[a-z-]+\.svg$/);
  assert.ok(existsSync(image.src), "Portrait asset must be committed");
  const svg = readFileSync(image.src, "utf8");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 480 480"/);
  assert.match(svg, /<title/);
  assert.match(svg, /<desc/);
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /<script|<foreignObject|https?:\/\/[^"]+\.(?:js|woff|png)/i);
}
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(html, /id="shopMerchant"/);
assert.match(html, /id="bossPortrait"/);
assert.match(html, /id="shopBossPortrait"/);
assert.match(html, /assets\/art\/index-merchant\.svg/);
assert.match(app, /bossPortraitFor\(boss\.id\)/);
assert.match(shopUI, /bossPortraitFor\(boss\.id\)/);
assert.match(app, /\$\("bossPortrait"\)\.hidden = !portrait/);
assert.match(shopUI, /\$\("shopBossPortrait"\)\.hidden = !portrait/);
assert.match(css, /\.shop-merchant-strip/);
assert.match(css, /\.boss-rule-portrait/);
assert.ok(existsSync("art-preview.html"));
assert.ok(existsSync("assets/art/ART_DIRECTION.md"));
assert.match(html, /styles\.css\?v=runestones-pass3/);
assert.match(html, /app\.mjs\?v=runestones-pass4/);
console.log("Index Shuffle all-eight-boss art catalogue checks passed.");
