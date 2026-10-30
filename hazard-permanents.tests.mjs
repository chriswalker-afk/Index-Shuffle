import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, slide, isBankable } from "./engine.mjs";
import {
  HAZARD_TYPES, HAZARD_DIFFICULTY, emptyHazardLayer,
  placeHazard, hazardDifficulty, progressHazardRound,
  resolveSlideHazards, restoreHazardLayer
} from "./hazards.mjs";
import {
  ITEM_BY_ID, ITEM_CATALOG, INVENTORY_SLOTS,
  enterRogueliteShop, purchaseShopOffer, rerollRogueliteShop,
  restoreShopState
} from "./shop.mjs";
import { hazardItemProtection, permanentIds, bankItemBonuses } from "./effects.mjs";
import { newRogueliteRun, targetForRound } from "./roguelite.mjs";

const zero = () => 0;
const high = () => 0.9999;
const sequence = values => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};
const boardOf = (...entries) => {
  const board = Array(16).fill(null);
  for (const [i, power] of entries) board[i] = power;
  return board;
};
const board = boardOf([5, tile(2)], [10, tile(3)]);
const equipped = (...ids) => {
  const run = newRogueliteRun(0, zero).run;
  run.inventory.permanents = [0, 1].map(index => ids[index]
    ? { id: ids[index], pricePaid: ITEM_BY_ID[ids[index]].price } : null);
  return run;
};
const protection = (...ids) => hazardItemProtection(equipped(...ids));
function warningFor(round, selection, ...items) {
  const run = { ...equipped(...items), round, hazardCooldown: 0,
    hazardWarning: null };
  return progressHazardRound(board, emptyHazardLayer(), run, 5, {
    rng: sequence([0, selection, 0]), movesLeft: 8,
    protection: hazardItemProtection(run)
  });
}
const newShop = (round, rng = high) => {
  const game = newRogueliteRun(0, zero);
  game.run.round = round;
  game.run.phase = "round-clear";
  game.run.coins = 50;
  game.run.totalCoinsEarned = 50;
  game.run.lastRoundReward = {
    bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0
  };
  return enterRogueliteShop(game, rng);
};
const COUNTER_IDS = [
  "storm-shelter", "mist-filter", "fracture-ward", "gilded-compass",
  "hazard-tamer", "fog-lantern", "void-cushion", "gilded-soles"
];
assert.equal(new Set(COUNTER_IDS).size, 8);
assert.equal(INVENTORY_SLOTS, 2);
assert.equal(ITEM_CATALOG.filter(item => item.type === "permanents").length, 20);
assert.equal(ITEM_CATALOG.filter(item => item.hazardCounter).length, 8);
for (const id of COUNTER_IDS) {
  const item = ITEM_BY_ID[id];
  assert.equal(item.type, "permanents", id);
  assert.equal(item.hazardCounter, true, id);
  assert.equal(item.unlockRound, ["gilded-compass", "gilded-soles"].includes(id)
    ? 7 : 4);
  assert.ok(item.price >= 4 && item.price <= 8);
  assert.ok(item.description.length >= 40);
}
assert.deepEqual([...permanentIds(equipped("storm-shelter", "void-cushion"))],
  ["storm-shelter", "void-cushion"]);

const normal = protection();
assert.deepEqual(normal, {
  warningMultiplier: 1,
  weightMultipliers: { cloudy: 1, void: 1, cracked: 1, greedy: 1, null: 1 },
  downgrade: false, cloudySlides: 3, voidFloor: 1,
  greedyLandingOnly: false
});
assert.equal(protection("storm-shelter").warningMultiplier, 0.7);
assert.equal(protection("mist-filter").weightMultipliers.cloudy, 0.35);
assert.equal(protection("fracture-ward").weightMultipliers.cracked, 0.4);
assert.equal(protection("fracture-ward").weightMultipliers.null, 0.4);
assert.equal(protection("gilded-compass").weightMultipliers.greedy, 0.3);
assert.equal(protection("hazard-tamer").downgrade, true);
assert.equal(protection("fog-lantern").cloudySlides, 2);
assert.equal(protection("void-cushion").voidFloor, 2);
assert.equal(protection("gilded-soles").greedyLandingOnly, true);
assert.equal(protection("storm-shelter", "mist-filter").warningMultiplier, 0.7);
assert.equal(protection("storm-shelter", "mist-filter").weightMultipliers.cloudy, 0.35,
  "Two hazard-counter items can operate at once");

// Item economy: hazards don't pollute the shop in the first three rounds.
// Offers start in the shop AFTER clearing round 3, and Greedy counters
// start only in the shop AFTER clearing round 6.
for (const round of [1, 2]) {
  let shop = newShop(round);
  for (let reroll = 0; reroll < 3; reroll++) {
    assert.ok(shop.run.shop.permanents.every(id => !ITEM_BY_ID[id].hazardCounter));
    shop = rerollRogueliteShop(shop, high);
  }
}
const firstHazardShop = newShop(3);
assert.ok(firstHazardShop.run.shop.permanents.some(
  id => ITEM_BY_ID[id].hazardCounter));
assert.ok(firstHazardShop.run.shop.permanents.every(
  id => ITEM_BY_ID[id].unlockRound <= 4 || !ITEM_BY_ID[id].hazardCounter));
const greedyShop = newShop(6);
assert.ok(greedyShop.run.shop.permanents.includes("gilded-soles"));
const purchased = purchaseShopOffer(greedyShop, "permanents", 0);
const pair = purchaseShopOffer(purchased, "permanents", 1);
assert.equal(pair.run.inventory.permanents.filter(Boolean).length, 2);
assert.ok(pair.run.inventory.permanents.every(item => ITEM_BY_ID[item.id].hazardCounter));
assert.equal(pair.run.coins, 50 -
  pair.run.inventory.permanents.reduce((sum, entry) => sum + entry.pricePaid, 0));
assert.ok(pair.run.shop.permanents.every(id => id === null));
const restored = restoreShopState(pair.run);
assert.deepEqual(restored.inventory.permanents, pair.run.inventory.permanents);
assert.deepEqual(restored.shop.lastOffers, pair.run.shop.lastOffers);
const illegallyEarly = restoreShopState({
  ...pair.run, round: 1,
  inventory: { ...pair.run.inventory, permanents: [null, null] }
}, high);
assert.ok(illegallyEarly.shop.lastOffers.permanents.every(id =>
  !ITEM_BY_ID[id].hazardCounter));
assert.deepEqual(equipped("mist-filter").inventory.permanents[1], null,
  "All hazard items use only the existing two slots");

// Hazard chance reduction is conditional, not immunity.
const regularChance = 0.21;
const regularRun = { ...equipped(), round: 4 };
const protectedRun = { ...equipped("storm-shelter"), round: 4 };
const baselineChance = progressHazardRound(board, emptyHazardLayer(),
  regularRun, 4, { rng: () => 0.17, movesLeft: 8 });
const shelteredChance = progressHazardRound(board, emptyHazardLayer(),
  protectedRun, 4, { rng: () => 0.17, movesLeft: 8,
    protection: hazardItemProtection(protectedRun) });
assert.equal(HAZARD_DIFFICULTY[2].chance, regularChance);
assert.equal(baselineChance.events[0].kind, "warning");
assert.equal(shelteredChance.events.length, 0,
  "Storm Shelter rejects a borderline warning roll");
assert.ok(warningFor(4, 0.05, "storm-shelter").events.length === 1,
  "Storm Shelter cannot make every hazard impossible");

// Targeted repellent reduces RELATIVE selection weight, with other types
// remaining available; test specific thresholds with deterministic RNG.
assert.equal(warningFor(4, 0.4).run.hazardWarning.type, "cloudy");
assert.equal(warningFor(4, 0.4, "mist-filter").run.hazardWarning.type, "void");
assert.equal(warningFor(8, 0.68).run.hazardWarning.type, "cracked");
assert.equal(warningFor(8, 0.68, "fracture-ward").run.hazardWarning.type, "void");
assert.equal(warningFor(8, 0.82).run.hazardWarning.type, "greedy");
assert.notEqual(warningFor(8, 0.82, "gilded-compass").run.hazardWarning.type,
  "greedy");
for (const [id, type, round] of [
  ["mist-filter", "cloudy", 4],
  ["fracture-ward", "cracked", 8],
  ["gilded-compass", "greedy", 8]
]) {
  let found = false;
  for (let index = 0; index <= 100; index++) {
    if (warningFor(round, index / 100, id).run.hazardWarning?.type === type) {
      found = true; break;
    }
  }
  assert.equal(found, true, id + " must reduce risk, not grant immunity");
}

// Dangerous-hazard substitution is communicated through the exact
// one-slide warning, and remains dangerous in its milder form.
const crackedNoItem = warningFor(8, 0.68);
const crackedTamed = warningFor(8, 0.68, "hazard-tamer");
assert.equal(crackedNoItem.run.hazardWarning.type, "cracked");
assert.equal(crackedTamed.run.hazardWarning.type, "void");
assert.equal(crackedTamed.events[0].downgradedFrom, "cracked");
const nullTamed = warningFor(11, 0.98, "hazard-tamer");
assert.equal(warningFor(11, 0.98).run.hazardWarning.type, "null");
assert.equal(nullTamed.run.hazardWarning.type, "cracked");
assert.equal(nullTamed.events[0].downgradedFrom, "null");
const matured = progressHazardRound(board, nullTamed.hazards, nullTamed.run, 6,
  { rng: zero, movesLeft: 7, protection: protection("hazard-tamer") });
assert.equal(matured.hazards[nullTamed.run.hazardWarning.index].type, "cracked");
assert.ok(matured.run.hazardWarning === null);
assert.equal(matured.events[0].kind, "appeared");
assert.ok(warningFor(8, 0.2, "hazard-tamer").run.hazardWarning.type === "cloudy",
  "Hazard Tamer does not turn every hazard harmless");

// Fog Lantern shortens only NEW cloudy hazards to two successful slides.
// Banking remains prohibited underneath them while they are active.
const pendingCloud = { ...equipped("fog-lantern"), round: 4,
  hazardWarning: { index: 0, type: "cloudy" } };
const fog = progressHazardRound(board, emptyHazardLayer(), pendingCloud, 4,
  { rng: zero, movesLeft: 8, protection: hazardItemProtection(pendingCloud) });
assert.equal(fog.hazards[0].turnsLeft, 2);
assert.equal(restoreHazardLayer(JSON.parse(JSON.stringify(fog.hazards)))[0]
  .turnsLeft, 2);
const plainFog = progressHazardRound(board, emptyHazardLayer(),
  { ...pendingCloud, inventory: equipped().inventory }, 4,
  { rng: zero, movesLeft: 8 });
assert.equal(plainFog.hazards[0].turnsLeft, 3);
const fogBoard = boardOf([0, tile(3, 2)], [5, tile(5)]);
assert.equal(isBankable(fogBoard[0], new Set(), 0, new Set(), fog.hazards), false);
const firstFade = resolveSlideHazards({
  changed: true, board: fogBoard, motions: [{ from: 5, to: 6, merged: false }],
  mergeDestinations: [], greedyStolen: 0
}, fog.hazards);
assert.equal(firstFade.hazards[0].turnsLeft, 1);
const secondFade = resolveSlideHazards({
  changed: true, board: fogBoard, motions: [{ from: 5, to: 6, merged: false }],
  mergeDestinations: [], greedyStolen: 0
}, firstFade.hazards);
assert.equal(secondFade.hazards[0], null);

// Void Cushion protects squares from falling to exponent 1, but leaves
// exponent-3 and higher powers exposed to the original decrement.
const incomingSquare = boardOf([1, tile(3, 2)]);
const incomingCube = boardOf([1, tile(3, 3)]);
const voidLayer = placeHazard(emptyHazardLayer(), incomingSquare, 0, "void");
const resolveVoid = (b, perks) => {
  const moved = slide(b, "left", { hazards: voidLayer });
  return resolveSlideHazards(moved, voidLayer, perks).board[0].exp;
};
assert.equal(resolveVoid(incomingSquare, protection()), 1);
assert.equal(resolveVoid(incomingSquare, protection("void-cushion")), 2);
assert.equal(resolveVoid(incomingCube, protection("void-cushion")), 2,
  "Void still penalizes higher powers");
assert.equal(resolveSlideHazards(
  slide(boardOf([1, tile(3)]), "left", { hazards: voidLayer }),
  voidLayer, protection("void-cushion")).board[0].exp, 1,
  "Void Cushion must never create an exponent from nothing");

// Gilded Soles protect gold only while PASSING through Greedy. Landing
// on Greedy still steals gold, including from a merged golden tile.
const passing = boardOf([2, { ...tile(3, 1), gold: 1 }]);
const greedMiddle = placeHazard(emptyHazardLayer(), passing, 1, "greedy");
const plainCrossing = slide(passing, "left", { hazards: greedMiddle });
const protectedCrossing = slide(passing, "left", {
  hazards: greedMiddle, greedyLandingOnly: protection("gilded-soles").greedyLandingOnly
});
assert.equal(plainCrossing.board[0].gold, undefined);
assert.equal(protectedCrossing.board[0].gold, 1);
const greedDestination = placeHazard(emptyHazardLayer(), passing, 0, "greedy");
assert.equal(slide(passing, "left", {
  hazards: greedDestination, greedyLandingOnly: true
}).board[0].gold, undefined);

// Itemless Roguelike and Classic do not change behaviour, scoring or gold.
assert.equal(hazardItemProtection(null).greedyLandingOnly, false);
assert.equal(bankItemBonuses(equipped("fog-lantern"), tile(3, 3)).score, 3);
assert.equal(slide(passing, "left").board[0].gold, 1);

// Static contracts: shop/UI/cache wiring and the absence of a new slot
// or unbounded immunity. These ensure the new items are not just labels.
const app = readFileSync("app.mjs", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(app, /hazardItemProtection\(state\.run\)/);
assert.match(app, /greedyLandingOnly: hazardItemProtection\(state\.run\)\.greedyLandingOnly/);
assert.match(app, /result = resolveSlideHazards\(result, state\.hazards,/);
assert.match(app, /protection: hazardItemProtection\(state\.run\)/);
assert.match(app, /Hazard Tamer softened incoming/);
assert.match(shopUI, /item\.hazardCounter \? "Permanent · Hazard defence"/);
assert.match(css, /\.shop-offer-card\.hazard-counter-offer/);
assert.match(css, /\.equip-chip\.hazard-counter-equipped/);
assert.match(html, /styles\.css\?v=hazard-counter-v1-art-pass3/);
console.log("All hazard-defence permanent item tests passed.");
