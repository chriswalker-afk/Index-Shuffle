import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, blocker, warning, slide, attemptBank
} from "./engine.mjs";
import {
  HAZARD_CELLS, MAX_ACTIVE_HAZARDS, CLOUDY_SLIDES,
  HAZARD_DEFINITIONS, HAZARD_TYPES,
  emptyHazardLayer, restoreHazardLayer, activeHazardCount,
  hazardAt, canPlaceHazard, placeHazard, removeHazard
} from "./hazards.mjs";
import {
  renderHazardLayer, hazardTileDescription
} from "./hazard-ui.mjs";
import {
  newRogueliteRun, advanceRogueliteRound
} from "./roguelite.mjs";
import { enterRogueliteShop } from "./shop.mjs";

const rng = () => 0;
const blank = () => Array(16).fill(null);
const board = blank();
board[0] = tile(3, 2);
board[1] = { ...tile(5, 2), gold: 1 };
board[12] = blocker(0, 1);
board[13] = warning(1);

assert.equal(HAZARD_CELLS, 16);
assert.equal(MAX_ACTIVE_HAZARDS, 2);
assert.equal(CLOUDY_SLIDES, 3);
assert.deepEqual(HAZARD_TYPES, ["cloudy", "void", "null", "cracked", "greedy"]);
assert.equal(new Set(HAZARD_TYPES).size, 5);
for (const id of HAZARD_TYPES) {
  assert.equal(HAZARD_DEFINITIONS[id].id, id);
  assert.ok(HAZARD_DEFINITIONS[id].name.length >= 4);
  assert.ok(HAZARD_DEFINITIONS[id].icon.length > 0);
  assert.ok(HAZARD_DEFINITIONS[id].badge.length > 0);
  assert.ok(HAZARD_DEFINITIONS[id].description.length > 25);
}
let hazards = emptyHazardLayer();
assert.equal(hazards.length, 16);
assert.equal(hazards.every(entry => entry === null), true);
assert.notEqual(emptyHazardLayer(), hazards,
  "New runs must never share one mutable array");
assert.equal(activeHazardCount(hazards), 0);
assert.equal(hazardAt(hazards, 0), null);
assert.throws(() => hazardAt(hazards, -1), RangeError);
assert.throws(() => hazardAt(hazards, 16), RangeError);
assert.throws(() => activeHazardCount([]), RangeError);

// Hazards can exist underneath a number, rather than replacing that tile.
// They cannot be placed in the same square as an immovable blocker/warning.
for (const id of HAZARD_TYPES) {
  const placed = placeHazard(hazards, board, 0, id);
  assert.equal(placed[0].type, id);
  assert.deepEqual(hazards, emptyHazardLayer(),
    "Adding a hazard must not mutate the original array");
  assert.deepEqual(board[0], tile(3, 2),
    "Hazard placement must never replace or modify its number tile");
  assert.equal(activeHazardCount(placed), 1);
  assert.equal(placed.slice(1).every(entry => entry === null), true);
  assert.equal(canPlaceHazard(placed, board, 0, id), false,
    "Cannot stack multiple hazards on one square");
  assert.throws(() => placeHazard(placed, board, 0, id), RangeError);
  const removed = removeHazard(placed, 0);
  assert.deepEqual(removed, emptyHazardLayer());
  assert.notEqual(removed, placed);
  assert.equal(placed[0].type, id,
    "Removing a hazard does not mutate the original layer");
  assert.deepEqual(board[0], tile(3, 2));
}
assert.equal(placeHazard(hazards, board, 0, "cloudy")[0].turnsLeft, 3);
assert.equal(canPlaceHazard(hazards, board, 12, "void"), false);
assert.equal(canPlaceHazard(hazards, board, 13, "cloudy"), false);
assert.equal(canPlaceHazard(hazards, board, 16, "greedy"), false);
assert.equal(canPlaceHazard(hazards, board, 0, "unknown"), false);
assert.equal(canPlaceHazard(hazards, board, 0, "__proto__"), false);
assert.throws(() => placeHazard(hazards, board, 12, "void"), RangeError);
assert.throws(() => placeHazard(hazards, board, 0, "__proto__"), RangeError);
assert.throws(() => removeHazard(hazards, 99), RangeError);

// Two simultaneous hazards maximum; Cracked reserves the lone Null slot.
hazards = placeHazard(hazards, board, 0, "cloudy");
hazards = placeHazard(hazards, board, 2, "void");
assert.equal(activeHazardCount(hazards), 2);
assert.equal(canPlaceHazard(hazards, board, 3, "greedy"), false);
assert.throws(() => placeHazard(hazards, board, 3, "greedy"), RangeError);
let nullLayer = placeHazard(emptyHazardLayer(), board, 1, "null");
assert.equal(canPlaceHazard(nullLayer, board, 2, "cracked"), false);
assert.equal(canPlaceHazard(nullLayer, board, 2, "null"), false);
assert.equal(canPlaceHazard(nullLayer, board, 2, "greedy"), true);
let crackLayer = placeHazard(emptyHazardLayer(), board, 0, "cracked");
assert.equal(canPlaceHazard(crackLayer, board, 1, "null"), false);
assert.equal(canPlaceHazard(crackLayer, board, 1, "greedy"), true);

// Migrate any older saves with no layer. Normalize invalid types, timers,
// impossible placement, too many hazards and null/cracked conflicts.
assert.deepEqual(restoreHazardLayer(undefined, board), emptyHazardLayer());
assert.deepEqual(restoreHazardLayer(null, board), emptyHazardLayer());
assert.deepEqual(restoreHazardLayer([1, 2, 3], board), emptyHazardLayer());
assert.throws(() => restoreHazardLayer(hazards, []), RangeError);
const saved = emptyHazardLayer();
saved[0] = { type: "cloudy", turnsLeft: 2 };
saved[1] = { type: "greedy" };
saved[2] = { type: "void" };
const restored = restoreHazardLayer(saved, board);
assert.deepEqual(restored[0], { type: "cloudy", turnsLeft: 2 });
assert.deepEqual(restored[1], { type: "greedy" });
assert.equal(restored[2], null,
  "A corrupted or future save cannot sneak in more than two hazards");
assert.equal(activeHazardCount(restored), 2);
assert.notEqual(restored[0], saved[0],
  "Restore must copy each descriptor");
const bad = emptyHazardLayer();
bad[0] = { type: "null" };
bad[1] = { type: "cracked" };
bad[2] = { type: "__proto__" };
bad[12] = { type: "void" };
bad[13] = { type: "cloudy" };
const checked = restoreHazardLayer(bad, board);
assert.equal(checked[0].type, "null");
assert.equal(checked[1], null);
assert.equal(checked[2], null);
assert.equal(checked[12], null);
assert.equal(checked[13], null);
const cloudSave = emptyHazardLayer();
cloudSave[0] = { type: "cloudy", turnsLeft: 99 };
assert.deepEqual(restoreHazardLayer(cloudSave)[0],
  { type: "cloudy", turnsLeft: 3 });
assert.equal(restoreHazardLayer(JSON.parse(JSON.stringify(saved)), board)[0].turnsLeft, 2);

// Core game rules do not change merely because a hazard descriptor exists;
// activating actual effects will be covered by the next implementation pass.
const slideBoard = blank();
slideBoard[0] = tile(3);
slideBoard[1] = tile(3);
const ordinaryMerge = slide(slideBoard, "left");
assert.deepEqual(ordinaryMerge.board[0], tile(3, 2));
assert.deepEqual(attemptBank(
  ordinaryMerge.board, 0, "9").board[0], tile(3));
assert.deepEqual(slideBoard[0], tile(3));
assert.equal(hazards[0].type, "cloudy");
assert.equal(hazards[2].type, "void");

// Roguelike creates a distinct empty overlay per round, not a new obstacle
// in its existing board array; all items, coins and discoveries carry forward.
let game = newRogueliteRun(0, rng);
assert.deepEqual(game.hazards, emptyHazardLayer());
assert.equal(game.board.length, 16);
assert.equal(game.board.filter(Boolean).length, 3);
game.hazards = placeHazard(game.hazards, game.board, 6, "greedy");
game.run = { ...game.run, phase: "round-clear",
  roundBankCoins: 0, lastRoundReward: {
    bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0
  }, coins: 7 };
const shopping = enterRogueliteShop(game, rng);
assert.equal(shopping.hazards[6].type, "greedy",
  "Entering the shop preserves the just-finished round");
const next = advanceRogueliteRound(shopping, rng);
assert.deepEqual(next.hazards, emptyHazardLayer(),
  "All square hazards must reset between rounds");
assert.equal(next.run.coins, 7);
assert.equal(next.run.round, 2);
assert.equal(next.board.length, 16);
assert.deepEqual(game.hazards[6], { type: "greedy" });

// Use a tiny test DOM to exercise the real overlay renderer, without
// requiring jsdom, OCR or a full browser.
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.attrs = {};
    this.dataset = {};
    this.className = "";
    this.classList = { add: (...tokens) => {
      const existing = new Set(this.className.split(" ").filter(Boolean));
      tokens.forEach(token => existing.add(token));
      this.className = [...existing].join(" ");
    } };
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(...nodes) { for (const node of nodes) {
    node.parent = this; this.children.push(node);
  } }
  appendChild(node) { this.append(node); }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(c => c !== this);
    this.parent = null;
  }
  querySelector(selector) {
    if (selector !== ".hazard-layer") throw Error("Unexpected selector");
    return this.children.find(c => c.className.includes("hazard-layer")) ?? null;
  }
}
const oldDocument = globalThis.document;
globalThis.document = { createElement: tag => new FakeNode(tag) };
try {
  const fakeBoard = new FakeNode("div");
  for (let i = 0; i < 16; i++) fakeBoard.appendChild(new FakeNode("button"));
  const layer = emptyHazardLayer();
  layer[0] = { type: "cloudy", turnsLeft: 2 };
  layer[15] = { type: "greedy" };
  renderHazardLayer(fakeBoard, layer);
  assert.equal(fakeBoard.children.length, 17,
    "Renderer must append one separate overlay after the 16 tile buttons");
  const overlay = fakeBoard.children[16];
  assert.equal(overlay.children.length, 16);
  assert.equal(overlay.attrs["aria-hidden"], "true");
  assert.equal(overlay.dataset.hazard, undefined);
  assert.equal(overlay.children[0].dataset.hazard, "cloudy");
  assert.equal(overlay.children[15].dataset.hazard, "greedy");
  // Pass 4 adds a decorative, aria-hidden hazard emblem after the existing
  // semantic glyph; the cloud concealment and impact badges remain intact.
  assert.equal(overlay.children[0].children[1].className, "hazard-art-emblem");
  assert.equal(overlay.children[0].children[1].attrs["aria-hidden"], "true");
  assert.equal(overlay.children[0].children[2].textContent, "?");
  assert.equal(overlay.children[0].children[3].textContent, "2");
  assert.equal(overlay.children[15].children[1].className, "hazard-art-emblem");
  assert.equal(overlay.children[15].children[2].textContent, "−◉");
  assert.ok(fakeBoard.children.slice(0, 16).every(c => c.tag === "button"));
  renderHazardLayer(fakeBoard, emptyHazardLayer());
  assert.equal(fakeBoard.children.length, 16,
    "Empty/Classic board must have no overlay, not an invisible click target");
  renderHazardLayer(fakeBoard, layer);
  assert.equal(fakeBoard.children.length, 17,
    "Rerender must not duplicate a hazard overlay");
} finally {
  globalThis.document = oldDocument;
}
const maskedLabel = hazardTileDescription({ type: "cloudy", turnsLeft: 2 }, true);
assert.match(maskedLabel, /Occupied tile hidden by cloud/);
assert.doesNotMatch(maskedLabel, /base 3|exponent 2|golden/i);
assert.match(hazardTileDescription({ type: "null" }, true),
  /Prevents a merge/);
assert.equal(hazardTileDescription(null, true), "");

// Static UI contracts: help shows the five distinct visual previews,
// hazard layer never intercepts input, and Classic stays unmodified.
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
for (const id of [
  "hazardGuideTitle", "hazardCount", "hazardSummary"
]) assert.match(html, new RegExp('id="' + id + '"'));
for (const type of HAZARD_TYPES) {
  assert.match(html, new RegExp('class="hazard-example hazard-' + type + '"'));
  assert.match(css, new RegExp('\\.hazard-' + type + ' \\{'));
}
assert.match(html, /Hazards start in Stage 2/);
assert.match(html, /square warns/);
assert.match(css, /\.hazard-layer\s*\{[\s\S]*?pointer-events: none;/);
assert.match(css, /\.hazard-slot\s*\{[\s\S]*?pointer-events: none;/);
assert.match(css, /\.hazard-slot\.hazard-cloudy/);
assert.match(css, /\.hazard-preview-grid/);
assert.match(css, /@media \(max-width: 580px\)/);
assert.match(app, /state\.hazards = restoreHazardLayer\(state\.hazards, state\.board\)/);
assert.match(app, /const squareHazard = rogue \? hazardAt\(state\.hazards, i\) : null/);
assert.match(app, /renderHazardLayer\(board, state\.hazards, state\.run\.hazardWarning, eraseTargets\)/);
assert.match(app, /button\.replaceChildren\(\)/,
  "Cloudy must hide source content in addition to the opaque overlay");
assert.match(app, /button\.setAttribute\("aria-label", label\)/);
assert.match(app, /state\.board\.forEach\(\(t, i\) =>/);
assert.match(app, /let result = slide\(before, direction, currentMovementRules\(\)\)/);
assert.match(app, /progressHazardRound\(state\.board, state\.hazards, state\.run, nextMove/,
  "Hazard spawning now activates after a successful slide");
assert.match(html, /styles\.css\?v=runestones-pass3/);
assert.match(html, /app\.mjs\?v=runestones-pass4/);
console.log("All Index Shuffle hazard foundation Pass 1 tests passed.");
