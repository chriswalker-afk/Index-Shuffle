// Pass 5 final QA: accessible banking, board orientation, mobile essentials,
// low-motion/data-saving behaviour and lightweight, local artwork.
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";

const read = file => readFileSync(file, "utf8");
const html = read("index.html");
const app = read("app.mjs");
const css = read("styles.css");
const guide = read("assets/art/ART_DIRECTION.md");
const workflow = read(".github/workflows/test.yml");
const IDs = ["mobileStatus", "mobileMovesLeft", "mobileSlideCost", "mobileRoundTarget",
  "mobileRoundScore", "board", "modal", "promptTitle", "promptHelp", "answer", "bankForm",
  "close", "cancel", "titleNew", "titleContinue", "stageScene", "shopDialog",
  "bossIntroDialog", "achievementsDialog", "resultsDialog"];
for (const id of IDs) assert.match(html, new RegExp('id="' + id + '"'));
assert.match(html, /<div id="board" class="board" role="group" tabindex="-1"/,
  "The board is a group of native buttons, not an ARIA grid without rows");
assert.match(html, /<a class="skip-game-board" href="#board">Skip to the maths board<\/a>/);
assert.match(html, /<dialog id="modal" class="overlay" aria-labelledby="promptTitle"/);
assert.doesNotMatch(html, /<div id="modal" class="overlay" hidden>/);
assert.match(html, /id="answer"[\s\S]*?aria-describedby="promptHelp"/);
assert.match(html, /styles\.css\?v=frostlock-v1/);
assert.match(html, /app\.mjs\?v=bank-timer-v1/);

// Native modal handles focus containment; all exits cancel the existing timer.
assert.match(app, /if \(!\$\("modal"\)\.open\) \$\("modal"\)\.showModal\(\)/);
assert.match(app, /if \(\$\("modal"\)\.open\) \$\("modal"\)\.close\(\)/);
assert.match(app, /\$\("modal"\)\.addEventListener\("cancel", event => \{/);
assert.match(app, /clearInterval\(bankTimer\)/);
assert.match(app, /function focusAfterBank\(index\)/);
assert.match(app, /focusAfterBank\(i\)/);
assert.match(app, /\$\("answer"\)\.focus\(\)/);

// Every board square carries row/column orientation. Cloudy labels must
// still suppress base, exponent, coins, and gold.
assert.doesNotMatch(app, /button\.setAttribute\("role", "gridcell"\)/);
assert.match(app, /const position = "Row " \+ \(Math\.floor\(i \/ 4\) \+ 1\)/);
assert.match(app, /button\.setAttribute\("aria-label", position \+ "\. " \+ label\)/);
assert.match(app, /button\.replaceChildren\(\)/);
assert.match(app, /hazardTileDescription\(squareHazard/);
assert.match(app, /"Empty square"/);
assert.match(app, /correctly banked adjacent merged/);
assert.match(app, /const exponent = document\.createElement\("sup"\)/);
assert.match(app, /heading\.replaceChildren\(document\.createTextNode\(String\(t\.base\)\)/);
assert.match(app, /heading\.setAttribute\("aria-label"/);
assert.match(css, /\.dialog h2 sup/);
assert.match(css, /\.cell\.tile > span/);

// Real playable board is prioritized on narrow viewports, with a repeated
// moves budget above it and a two-column Classic fallback.
assert.match(app, /\$\("mobileMovesLeft"\)\.textContent = state\.movesLeft/);
assert.match(app, /\$\("mobileSlideCost"\)\.textContent = \$\("slideCost"\)\.textContent/);
assert.match(app, /\$\("mobileRoundTarget"\)\.hidden = !rogue/);
assert.match(css, /@media \(max-width: 650px\) \{[\s\S]*?grid-template-areas: "board" "hud" "secondary"/);
assert.match(css, /\.mobile-status\.classic\s*\{[\s\S]*?repeat\(2,/);
assert.match(css, /\.controls button\s*\{[\s\S]*?min-width: 44px/);
assert.match(css, /\.skip-game-board:focus-visible/);
assert.match(css, /\.skip-game-board\s*\{[^}]*clip-path: inset\(50%\)/,
  "Unfocused keyboard shortcut must be clipped rather than floated over the title");
assert.match(css, /\.skip-game-board:focus-visible\s*\{[^}]*clip-path: none/,
  "Keyboard-focused shortcut must appear in normal flow");
assert.doesNotMatch(css, /\.skip-game-board\s*\{[^}]*translateY\(-180%\)/,
  "Skip link must never be translated into the site heading");
assert.match(css, /dialog\.overlay:not\(\[open\]\) \{ display: none !important;/);

// The full game stays static on low-motion preferences. Don't animate
// while in the background or on metered/save-data connections.
assert.match(app, /navigator\.connection\?\.saveData === true/);
assert.match(app, /document\.hidden \|\| navigator/);
assert.match(app, /if \(prefersReducedMotion\(\) \|\| typeof Element\.prototype\.animate/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /dialog\.overlay::backdrop/);

// Title art is prioritized; secondary art is lazy or assigned when needed.
// Decorative icons do not take over names, rules or real tile notation.
assert.match(html, /assets\/art\/title-numberworld\.svg"[\s\S]{0,90}fetchpriority="high"/);
assert.match(html, /assets\/art\/stage-mist-gardens\.svg"[\s\S]{0,100}loading="lazy"/);
assert.match(html, /id="stageSceneImage"[^>]*alt=""[\s\S]{0,100}width="960"/);
assert.doesNotMatch(html, /id="stageSceneImage"[^>]*src=/);
assert.match(html, /index-merchant\.svg"[\s\S]{0,220}loading="lazy"/);
assert.match(html, /id="bossIntroPortrait" alt="" width="480"/);
assert.doesNotMatch(html, /id="bossIntroPortrait"[^>]*src=/);
assert.match(css, /\.cell\.hazard-underlay i \{ display: none; \}/);
assert.match(guide, /Pass 4/);

// Simple contrast budget for primary board values and the quick HUD.
const hexToRgb = s => s.match(/[a-f0-9]{2}/gi).map(part => parseInt(part, 16));
const luminance = rgb => {
  const c = rgb.map(v => {
    const p = v / 255;
    return p <= .04045 ? p / 12.92 : ((p + .055) / 1.055) ** 2.4;
  });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
};
const contrast = (a,b) => {
  const la = luminance(hexToRgb(a)), lb = luminance(hexToRgb(b));
  return (Math.max(la,lb)+.05) / (Math.min(la,lb)+.05);
};
for (const bg of ["78dfdf","ea876d","c8a3f9","a9e3b2","f7b6bb","b7c5ff"]) {
  assert.ok(contrast("172b3b",bg) >= 4.5,
    "Maths on base " + bg + " must meet WCAG 4.5:1");
}
assert.ok(contrast("c6ffe9","214b4a")>=4.5,"Important move budget contrast");

// Limit critical art payload without minifier build steps.
for (const filename of [
  "assets/art/title-numberworld.svg", "assets/art/stage-observatory.svg",
  "assets/art/stage-mist-gardens.svg", "assets/art/stage-fracture-forge.svg",
  "assets/art/stage-eclipse-vault.svg", "assets/art/achievement-medals.svg",
  "assets/art/item-sprites.svg"
]) {
  assert.ok(existsSync(filename), "Missing " + filename);
  assert.ok(statSync(filename).size < 34000,
    filename + " exceeds the light SVG budget");
}
assert.ok(statSync("styles.css").size < 135000);
assert.ok(!html.includes('fonts.googleapis.com'), "No external font dependency");
assert.match(workflow, /node quality-pass5\.tests\.mjs/);
console.log("Pass 5 accessibility, maths, mobile and asset-quality checks passed.");
