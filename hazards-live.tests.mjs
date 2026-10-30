import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, blocker, warning, slide, attemptBank, isBankable,
  canMove, gameEnded, key
} from "./engine.mjs";
import {
  emptyHazardLayer, placeHazard, HAZARD_TYPES, HAZARD_DIFFICULTY,
  hazardDifficulty, resolveSlideHazards, progressHazardRound,
  restoreHazardPressure, activeHazardCount, restoreHazardLayer
} from "./hazards.mjs";
import {
  newRogueliteRun, advanceRogueliteRound
} from "./roguelite.mjs";
import {
  ITEM_BY_ID, shopItemPrice, enterRogueliteShop
} from "./shop.mjs";
import {
  consumableTargets, canActivateConsumable, useConsumable,
  CONSUMABLE_TARGETS
} from "./effects.mjs";
import { bossMovementRules, applyThreeCurse } from "./bosses.mjs";

const blank = () => Array(16).fill(null);
const grid = (...entries) => {
  const b = blank();
  for (const [index, t] of entries) b[index] = t;
  return b;
};
const seeded = () => 0;
const rules = hazards => ({ hazards });
const low = () => ({ ...newRogueliteRun(0, seeded).run, round: 4 });

// Null prevents exactly the merge whose result would be at its position,
// but does not act as a blocker and does not prevent normal movement.
let b = grid([0, tile(3)], [2, tile(3)]);
let hazards = placeHazard(emptyHazardLayer(), b, 0, "null");
let result = slide(b, "left", rules(hazards));
assert.deepEqual(result.board.slice(0, 3), [tile(3), tile(3), null]);
assert.equal(result.merges.length, 0);
assert.equal(result.changed, true);
assert.equal(slide(b, "left").board[0].exp, 2);
assert.equal(slide(b, "right", rules(hazards)).board[3].exp, 2,
  "Null only prevents a merge that actually ends on its square");
assert.equal(result.board[0].base, 3);
assert.equal(hazards[0].type, "null");

// Cracked permits the first merge, then becomes Null and rejects a later
// merge on that exact square. It must never retroactively undo the merge.
b = grid([0, tile(2)], [1, tile(2)]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "cracked");
result = resolveSlideHazards(slide(b, "left", rules(hazards)), hazards);
assert.equal(result.board[0].exp, 2);
assert.equal(result.hazards[0].type, "null");
assert.deepEqual(result.hazardEvents, [{ type: "cracked", index: 0 }]);
assert.equal(hazards[0].type, "cracked", "Slide effects are immutable");
const second = grid([0, tile(2)], [1, tile(2)]);
assert.equal(slide(second, "left", rules(result.hazards)).merges.length, 0);
assert.equal(slide(second, "right", rules(result.hazards)).merges.length, 1);

// Void triggers on arrival/merge and vanishes, using the NEW exponent
// in the answer prompt, score and discovered-power bookkeeping.
b = grid([0, tile(3, 2)], [1, tile(3, 3)]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "void");
result = resolveSlideHazards(slide(b, "left", rules(hazards)), hazards);
assert.deepEqual(result.board[0], tile(3, 4));
assert.deepEqual(result.merges, [tile(3, 4)]);
assert.equal(result.mergeDestinations[0], 0);
assert.equal(result.hazards[0], null);
assert.deepEqual(result.hazardEvents[0], {
  type: "void", index: 0, before: 5, after: 4
});
assert.equal(attemptBank(result.board, 0, "81").status, "success");
assert.equal(attemptBank(result.board, 0, "243").status, "incorrect");
assert.deepEqual(hazards[0], { type: "void" });
b = grid([1, tile(3)]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "void");
result = resolveSlideHazards(slide(b, "left", rules(hazards)), hazards);
assert.deepEqual(result.board[0], tile(3), "Void may not reduce exponent below 1");
assert.equal(result.hazards[0], null);
b = grid([0, tile(5)]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "void");
result = slide(b, "left", rules(hazards));
assert.equal(result.changed, false);
assert.equal(resolveSlideHazards(result, hazards).hazards[0].type, "void",
  "A stationary tile must not prematurely consume Void");

// Boss interaction: Void may turn a just-merged base-3 power into
// an unbankable exponent-1 tile; The Three Curse must not turn it into
// an unavoidable blocker three slides later.
const bossRun = newRogueliteRun(0, seeded).run;
bossRun.round = 9;
bossRun.bosses[9] = "three-curse";
const voidReduced = grid([0, tile(3)]);
const safeCurse = applyThreeCurse(voidReduced, [0], bossRun,
  new Set(), emptyHazardLayer());
assert.equal(safeCurse.board[0].curseLeft, undefined,
  "Void-reduced base-3 exponent-1 tiles must remain uncursed");

// Greedy strips gold for each tile that crosses or lands on its square.
// It resolves BEFORE the gold of two merging inputs is combined.
b = grid([2, { ...tile(3), gold: 1 }]);
hazards = placeHazard(emptyHazardLayer(), b, 1, "greedy");
result = slide(b, "left", rules(hazards));
assert.equal(result.board[0].gold, undefined);
assert.equal(result.greedyStolen, 1);
assert.equal(hazards[1].type, "greedy", "Greedy persists");
b = grid([1, { ...tile(3), gold: 1 }],
  [2, { ...tile(3), gold: 1 }]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "greedy");
result = slide(b, "left", rules(hazards));
assert.equal(result.merges.length, 1);
assert.equal(result.board[0].exp, 2);
assert.equal(result.board[0].gold, undefined,
  "Two gold inputs must not merge into gold after crossing Greedy");
assert.equal(result.greedyStolen, 2);
b = grid([0, { ...tile(3), gold: 1 }],
  [1, { ...tile(3), gold: 1 }]);
result = slide(b, "left", rules(hazards));
assert.equal(result.board[0].gold, 1,
  "A stationary tile on Greedy stays golden; only the arriving one loses gold");
assert.equal(result.greedyStolen, 1);
assert.equal(slide(b, "left").board[0].gold, 2,
  "Classic/no-hazard slides never lose gold");

// Cloudy suppresses tile identification and all banking, including
// golden exponent-1 tiles. It fades after exactly three successful slides.
b = grid([0, { ...tile(5), gold: 1 }]);
hazards = placeHazard(emptyHazardLayer(), b, 0, "cloudy");
assert.equal(isBankable(b[0], new Set(), 0, new Set()), true);
assert.equal(isBankable(b[0], new Set(), 0, new Set(), hazards), false);
assert.equal(attemptBank(b, 0, "5", { hazards }).status, "unavailable");
assert.equal(attemptBank(b, 0, "5").status, "success");
assert.equal(canMove(b, new Set(), new Set(), rules(hazards)), true,
  "The hidden number may still be slid out of the cloud");
let cloud = hazards;
for (const remaining of [2, 1, 0]) {
  const moved = slide(grid([0, tile(3)]), "right", rules(cloud));
  const after = resolveSlideHazards(moved, cloud);
  cloud = after.hazards;
  assert.equal(cloud[0]?.turnsLeft ?? 0, remaining);
}
assert.equal(cloud[0], null);
assert.equal(isBankable(b[0], new Set(), 0, new Set(), cloud), true);
assert.equal(resolveSlideHazards({ board: blank(), motions: [],
  mergeDestinations: [], changed: false }, hazards).hazards[0].turnsLeft, 3);
assert.throws(() => resolveSlideHazards({}, hazards), RangeError);

// Difficulty: Stage 1 has no hazards, Stage 2 has three simple types
// and one active slot; Stage 3–4 unlock all five and a second slot.
assert.equal(hazardDifficulty(1).maxActive, 0);
assert.equal(hazardDifficulty(3).chance, 0);
assert.equal(hazardDifficulty(4).maxActive, 1);
assert.deepEqual(hazardDifficulty(5).types, ["cloudy", "void", "cracked"]);
assert.equal(hazardDifficulty(7).maxActive, 2);
assert.deepEqual(new Set(hazardDifficulty(9).types), new Set(HAZARD_TYPES));
assert.deepEqual(new Set(hazardDifficulty(12).types), new Set(HAZARD_TYPES));
assert.ok(HAZARD_DIFFICULTY[4].chance > HAZARD_DIFFICULTY[3].chance);
assert.ok(HAZARD_DIFFICULTY[3].chance > HAZARD_DIFFICULTY[2].chance);
assert.throws(() => hazardDifficulty(13), RangeError);

b = grid([5, tile(2)]);
let run = low();
let stageOne = progressHazardRound(b, emptyHazardLayer(),
  { ...run, round: 3 }, 20, { rng: seeded });
assert.equal(stageOne.run.hazardWarning, null);
assert.equal(activeHazardCount(stageOne.hazards), 0);
let early = progressHazardRound(b, emptyHazardLayer(), run, 2, { rng: seeded });
assert.equal(early.run.hazardWarning, null);
let notified = progressHazardRound(b, emptyHazardLayer(), run, 3,
  { rng: seeded });
assert.deepEqual(notified.run.hazardWarning, { index: 0, type: "cloudy" });
assert.deepEqual(notified.events, [{ kind: "warning", index: 0, type: "cloudy" }]);
assert.equal(activeHazardCount(notified.hazards), 0,
  "Warnings do not count as active blockers/hazards");
let appeared = progressHazardRound(b, notified.hazards,
  notified.run, 4, { rng: seeded });
assert.equal(appeared.events[0].kind, "appeared");
assert.equal(appeared.hazards[0].type, "cloudy");
assert.equal(appeared.run.hazardWarning, null);
assert.equal(appeared.run.hazardCooldown, 4);
assert.equal(appeared.hazards.filter(Boolean).length, 1);
assert.equal(progressHazardRound(b, appeared.hazards, appeared.run, 5,
  { rng: seeded }).run.hazardWarning, null,
  "Cooldown prevents an immediate second telegraph");
assert.equal(progressHazardRound(b, appeared.hazards, appeared.run, 10,
  { rng: seeded }).run.hazardWarning, null,
  "Stage 2 never schedules beyond its one active hazard");
assert.deepEqual(run.hazardWarning, null, "Original run does not mutate");
assert.deepEqual(restoreHazardLayer(JSON.parse(JSON.stringify(appeared.hazards)), b),
  appeared.hazards);
assert.deepEqual(restoreHazardPressure({ ...run, hazardWarning: { type: "null",
  index: 0 } }, b, appeared.hazards).hazardWarning, null);
assert.deepEqual(restoreHazardPressure({ ...run, hazardWarning: { type: "cloudy",
  index: 0 } }, b, emptyHazardLayer()).hazardWarning, { type: "cloudy", index: 0 });
assert.equal(restoreHazardPressure({ ...run, hazardCooldown: -20 }, b,
  emptyHazardLayer()).hazardCooldown, 0);

// Bosses spawn hazards less often; a roll that would create a normal
// warning must not create one during a boss with the same difficulty.
const nearThreshold = () => 0.18;
run = { ...run, round: 6 };
assert.equal(progressHazardRound(b, emptyHazardLayer(), run, 3,
  { rng: nearThreshold, boss: false }).events.length, 1);
assert.equal(progressHazardRound(b, emptyHazardLayer(), run, 3,
  { rng: nearThreshold, boss: true }).events.length, 0);

// Avoid hazard placement under blockers/warnings and never create an
// instant no-moves state. Reject full, immovable boards as candidates.
b = grid([0, tile(3)], [3, blocker(0, 1)], [6, warning(1)]);
notified = progressHazardRound(b, emptyHazardLayer(),
  { ...run, round: 10 }, 3, { rng: seeded });
assert.ok(notified.run.hazardWarning);
assert.notEqual(notified.run.hazardWarning.index, 3);
assert.notEqual(notified.run.hazardWarning.index, 6);
const impossible = grid(...Array.from({ length: 16 }, (_, i) =>
  [i, tile([2, 3, 5][i % 3])]));
assert.equal(progressHazardRound(impossible, emptyHazardLayer(),
  { ...run, round: 10 }, 3, { rng: seeded }).events.length, 0);

// A pending warning cannot mature if an obstacle appears in its square.
const oldWarning = { ...low(), round: 7,
  hazardWarning: { type: "void", index: 1 }, hazardCooldown: 0 };
const warningBlocked = grid([1, blocker(0, 1)], [2, tile(2)]);
const dispelled = progressHazardRound(warningBlocked,
  emptyHazardLayer(), oldWarning, 4, { rng: seeded });
assert.equal(dispelled.run.hazardWarning, null);
assert.equal(activeHazardCount(dispelled.hazards), 0);

// Eraser costs three gold, has one target, accepts hazards under occupied
// or empty squares, and doesn't alter a tile, score, moves or merge status.
assert.equal(ITEM_BY_ID["hazard-eraser"].price, 3);
assert.equal(ITEM_BY_ID["hazard-eraser"].type, "consumables");
assert.equal(CONSUMABLE_TARGETS["hazard-eraser"], 1);
let game = newRogueliteRun(0, seeded);
game.run.round = 7;
game.board = grid([0, tile(5, 3)], [4, tile(3)]);
game.hazards = placeHazard(game.hazards, game.board, 0, "cloudy");
game.hazards = placeHazard(game.hazards, game.board, 7, "greedy");
game.run.inventory.consumables[0] = { id: "hazard-eraser", pricePaid: 3 };
game.score = 17;
game.movesLeft = 8;
game.mergeReady = [0];
assert.equal(canActivateConsumable(game, 0), true);
assert.deepEqual(consumableTargets(game, 0), [0, 7]);
const bankAfterEraser = useConsumable(game, 0, [0]);
assert.equal(bankAfterEraser.hazards[0], null);
assert.equal(bankAfterEraser.hazards[7].type, "greedy");
assert.deepEqual(bankAfterEraser.board[0], tile(5, 3));
assert.equal(bankAfterEraser.run.inventory.consumables[0], null);
assert.equal(bankAfterEraser.score, 17);
assert.equal(bankAfterEraser.movesLeft, 8);
assert.deepEqual(bankAfterEraser.mergeReady, [0]);
assert.equal(isBankable(bankAfterEraser.board[0], new Set(), 0,
  new Set(), bankAfterEraser.hazards), true);
assert.equal(game.hazards[0].type, "cloudy", "Eraser cannot mutate input");
assert.throws(() => useConsumable(game, 0, [2]), RangeError);
assert.equal(canActivateConsumable({
  ...game, hazards: emptyHazardLayer()
}, 0), false);
assert.equal(shopItemPrice(game.run, "hazard-eraser"), 3);
const once = { ...game, run: { ...game.run, phase: "round-clear",
  lastRoundReward: { bankCoins: 0, moveCoins: 0,
    unusedMoves: 0, totalCoins: 0 } } };
const shopping = enterRogueliteShop(once, seeded);
assert.equal(shopping.run.shop.consumables.length, 2);
assert.equal(shopping.run.shop.consumables.includes("hazard-eraser"), true,
  "The consumable should actually appear among shop offers");

// All active hazards, warnings, coin losses and countdowns remain a
// Roguelike-only feature; passing no hazard rules leaves Classic untouched.
b = grid([1, { ...tile(3), gold: 1 }],
  [2, { ...tile(3), gold: 1 }]);
assert.equal(slide(b, "left").board[0].gold, 2);
assert.equal(slide(b, "left").greedyStolen, 0);
assert.equal(key(slide(b, "left").board[0]), "3-2");

// Static end-to-end wiring checks for the browser code.
const app = readFileSync("app.mjs", "utf8");
const ui = readFileSync("hazard-ui.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(app, /let result = slide\(before, direction, currentMovementRules\(\)\)/);
assert.match(app, /result = resolveSlideHazards\(result, state\.hazards,/);
assert.match(app, /progressHazardRound\(state\.board, state\.hazards, state\.run, nextMove/);
assert.match(app, /hazardAvoid\.add\(state\.run\.hazardWarning\.index\)/);
assert.match(app, /state\.run = restoreHazardPressure\(state\.run, state\.board, state\.hazards\)/);
assert.match(app, /isBankable\(t, new Set\(state\.banked\), i, new Set\(state\.locked\),/);
assert.match(app, /hazards: mode === "roguelite" \? state\.hazards : null/);
assert.match(app, /renderHazardLayer\(board, state\.hazards, state\.run\.hazardWarning, eraseTargets\)/);
assert.match(app, /beforeHazards\?\.\[movement\.from\]\?\.type === "cloudy"/);
assert.match(ui, /square\.classList\.add\("hazard-incoming"\)/);
assert.match(html, /id="hazardAlert"/);
assert.match(html, /id="hazardNext"/);
assert.match(html, /Hazard Eraser/);
assert.match(html, /styles\.css\?v=release-5a/);
assert.match(css, /\.hazard-slot\.hazard-incoming/);
assert.match(css, /\.hazard-alert/);
console.log("All Index Shuffle live hazards, staged spawning and Hazard Eraser tests passed.");
