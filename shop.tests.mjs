import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newRogueliteRun, advanceRogueliteRound,
  restoreRogueliteRun, targetForRound } from "./roguelite.mjs";
import {
  ITEM_CATALOG, ITEM_BY_ID, INVENTORY_SLOTS, SHOP_OFFERS_PER_TYPE,
  INITIAL_REROLL_COST, emptyInventory, restoreShopState, enterRogueliteShop,
  purchaseShopOffer, sellPermanent, discardConsumable, rerollRogueliteShop
} from "./shop.mjs";

const rng = () => 0;
assert.equal(INVENTORY_SLOTS, 2);
assert.equal(SHOP_OFFERS_PER_TYPE, 2);
assert.equal(INITIAL_REROLL_COST, 1);
const ids = ITEM_CATALOG.map(item => item.id);
assert.equal(new Set(ids).size, ids.length, "Every item must have a unique stable ID");
assert.equal(ITEM_CATALOG.filter(item => item.type === "permanents").length, 20);
assert.equal(ITEM_CATALOG.filter(item => item.type === "consumables").length, 17);
for (const item of ITEM_CATALOG) {
  assert.equal(ITEM_BY_ID[item.id], item);
  assert.ok(Number.isSafeInteger(item.price) && item.price > 0);
  assert.ok(item.name.length > 2 && item.description.length > 10);
}
assert.deepEqual(emptyInventory(), {
  permanents: [null, null], consumables: [null, null]
});

let base = newRogueliteRun(0, rng);
assert.deepEqual(base.run.inventory, emptyInventory());
assert.equal(base.run.shop, null);
assert.throws(() => enterRogueliteShop(base), RangeError,
  "Cannot enter the shop before clearing a round");
assert.throws(() => rerollRogueliteShop(base), RangeError);
assert.throws(() => purchaseShopOffer(base, "permanents", 0), RangeError);

const reward = { bankCoins: 3, moveCoins: 2, unusedMoves: 2, totalCoins: 5 };
base = {
  ...base,
  movesLeft: 2, score: targetForRound(1),
  run: {
    ...base.run, phase: "round-clear", totalScore: targetForRound(1),
    coins: 20, totalCoinsEarned: 20, lastRoundReward: reward
  }
};
const before = structuredClone(base);
assert.throws(() => advanceRogueliteRound(base), RangeError,
  "Shop must be visited before the next round");
let shopping = enterRogueliteShop(base, rng);
assert.equal(shopping.run.phase, "shop");
assert.equal(shopping.run.coins, 20);
assert.equal(shopping.run.totalScore, 8);
assert.deepEqual(shopping.run.shop.permanents, ["opening-act", "twin-twos"]);
assert.deepEqual(shopping.run.shop.consumables, ["block-breaker", "hazard-eraser"]);
assert.equal(shopping.run.shop.rerollCost, 1);
assert.equal(shopping.run.shop.rerolls, 0);
assert.deepEqual(base, before, "Entering the shop must not mutate a cleared run");
assert.throws(() => enterRogueliteShop(shopping), RangeError);
assert.throws(() => purchaseShopOffer(base, "permanents", 0), RangeError);
assert.throws(() => advanceRogueliteRound(shopping.run), RangeError);

// Buying an item charges its full price, fills only its own category, and
// sells out that offer without auto-replacing it.
const first = purchaseShopOffer(shopping, "permanents", 0);
assert.equal(first.run.coins, 14);
assert.equal(first.run.totalCoinsEarned, 20, "Spending never alters earned-gold history");
assert.deepEqual(first.run.inventory.permanents, [
  { id: "opening-act", pricePaid: 6 }, null
]);
assert.deepEqual(first.run.inventory.consumables, [null, null]);
assert.deepEqual(first.run.shop.permanents, [null, "twin-twos"]);
assert.equal(shopping.run.coins, 20, "Purchases are immutable");
assert.throws(() => purchaseShopOffer(first, "permanents", 0), RangeError,
  "A sold-out offer cannot be purchased twice");

let full = purchaseShopOffer(first, "permanents", 1);
assert.equal(full.run.coins, 8);
assert.deepEqual(full.run.inventory.permanents.map(x => x.id),
  ["opening-act", "twin-twos"]);
assert.throws(() => purchaseShopOffer(full, "consumables", 2), RangeError);
assert.throws(() => purchaseShopOffer(full, "unknown", 0), RangeError);
assert.throws(() => purchaseShopOffer(full, "permanents", 1), RangeError);
assert.throws(() => sellPermanent(full, -1), RangeError);
assert.throws(() => sellPermanent(full, 2), RangeError);

// First reroll costs 1, then 2, then 3. It draws two of each type,
// deliberately avoiding the current offers, equipped permanents, and duplicates.
let rolled = rerollRogueliteShop(full, rng);
assert.equal(rolled.run.coins, 7);
assert.equal(rolled.run.shop.rerollCost, 2);
assert.equal(rolled.run.shop.rerolls, 1);
assert.deepEqual(rolled.run.shop.permanents, ["lucky-sevens", "threes-company"]);
assert.deepEqual(rolled.run.shop.consumables, ["power-surge", "second-wind"]);
assert.deepEqual(full.run.shop.consumables, ["block-breaker", "hazard-eraser"]);
let rolledAgain = rerollRogueliteShop(rolled, rng);
assert.equal(rolledAgain.run.coins, 5);
assert.equal(rolledAgain.run.shop.rerollCost, 3);
assert.equal(rolledAgain.run.shop.rerolls, 2);
for (const type of ["permanents", "consumables"]) {
  assert.equal(rolledAgain.run.shop[type].length, 2);
  assert.equal(new Set(rolledAgain.run.shop[type]).size, 2);
}
assert.throws(() => rerollRogueliteShop({
  ...rolledAgain, run: { ...rolledAgain.run, coins: 0 }
}), RangeError);

// Replacing a permanent refunds floor(original price / 2) AT THE MOMENT
// of buying the new card, including when it makes an offer affordable.
const replaced = purchaseShopOffer(rolled, "permanents", 0, 0);
assert.equal(replaced.run.coins, 7 + 3 - 5);
assert.deepEqual(replaced.run.inventory.permanents, [
  { id: "lucky-sevens", pricePaid: 5 }, { id: "twin-twos", pricePaid: 6 }
]);
assert.equal(replaced.run.shop.permanents[0], null);
assert.throws(() => purchaseShopOffer(rolled, "permanents", 0), RangeError,
  "When full, a player must choose which item to replace");
assert.throws(() => purchaseShopOffer(rolled, "permanents", 0, 5), RangeError);
assert.throws(() => purchaseShopOffer({
  ...rolled, run: { ...rolled.run, coins: 1 }
}, "permanents", 0, 0), RangeError, "Refund is not enough to afford item");
assert.equal(purchaseShopOffer({
  ...rolled, run: { ...rolled.run, coins: 2 }
}, "permanents", 0, 0).run.coins, 0,
"Replacement refund may make an otherwise unaffordable card affordable");

const sold = sellPermanent(replaced, 1);
assert.equal(sold.run.coins, replaced.run.coins + 3);
assert.equal(sold.run.inventory.permanents[1], null);
assert.throws(() => sellPermanent(sold, 1), RangeError);
assert.deepEqual(sold.run.inventory.permanents[0],
  { id: "lucky-sevens", pricePaid: 5 });
assert.equal(sold.run.totalCoinsEarned, 20, "Sale refund is not earned gold");
const refilled = purchaseShopOffer(sold, "permanents", 1);
assert.equal(refilled.run.inventory.permanents[1].id, "threes-company");

// Consumables have their own separate two slots and may be replaced,
// but replacement and discard do not refund money.
let consumables = purchaseShopOffer(shopping, "consumables", 0);
consumables = purchaseShopOffer(consumables, "consumables", 1);
assert.equal(consumables.run.coins, 15);
assert.deepEqual(consumables.run.inventory.consumables.map(x => x.id),
  ["block-breaker", "hazard-eraser"]);
assert.throws(() => discardConsumable(first, 0), RangeError);
assert.throws(() => purchaseShopOffer(consumables, "consumables", 0), RangeError);
const replaceOptions = rerollRogueliteShop(consumables, rng);
assert.deepEqual(replaceOptions.run.shop.consumables, ["power-surge", "second-wind"]);
const swapped = purchaseShopOffer(replaceOptions, "consumables", 0, 0);
assert.equal(swapped.run.coins, replaceOptions.run.coins - 3);
assert.deepEqual(swapped.run.inventory.consumables.map(x => x.id),
  ["power-surge", "hazard-eraser"]);
const discarded = discardConsumable(swapped, 1);
assert.equal(discarded.run.coins, swapped.run.coins);
assert.equal(discarded.run.inventory.consumables[1], null);

// Moving to the next round keeps coins + equipped items, but clears the
// shop and resets its reroll price on the NEXT visit.
const next = advanceRogueliteRound(refilled, rng);
assert.equal(next.run.round, 2);
assert.equal(next.run.phase, "playing");
assert.equal(next.run.coins, refilled.run.coins);
assert.deepEqual(next.run.inventory, refilled.run.inventory);
assert.equal(next.run.shop, null);
assert.equal(next.score, 0);
assert.equal(next.movesLeft, 10);
assert.throws(() => rerollRogueliteShop(next), RangeError);
const secondClear = {
  ...next,
  run: { ...next.run, phase: "round-clear",
    lastRoundReward: { bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0 } }
};
const nextShop = enterRogueliteShop(secondClear, rng);
assert.equal(nextShop.run.shop.rerollCost, 1);
assert.equal(nextShop.run.shop.rerolls, 0);
assert.deepEqual(nextShop.run.inventory, refilled.run.inventory);
assert.equal(new Set(nextShop.run.shop.permanents).size, 2);
assert.ok(!nextShop.run.shop.permanents.includes("lucky-sevens"));
assert.ok(!nextShop.run.shop.permanents.includes("threes-company"));

// Reloading a genuine in-progress shop must keep the same stock and
// money. Pass-2 saves get a clean empty inventory (not a new run).
const serialized = JSON.parse(JSON.stringify(rolled));
const reload = restoreShopState(restoreRogueliteRun(serialized.run, serialized.movesLeft), () => .99);
assert.deepEqual(reload.shop, serialized.run.shop);
assert.deepEqual(reload.inventory, serialized.run.inventory);
assert.equal(reload.coins, serialized.run.coins);
const migrated = restoreShopState({
  ...base.run, inventory: undefined, shop: undefined
}, rng);
assert.deepEqual(migrated.inventory, emptyInventory());
assert.equal(migrated.shop, null);
const corruptStock = {
  ...rolled.run, shop: { ...rolled.run.shop,
    permanents: ["lucky-sevens", "lucky-sevens"] }
};
const repaired = restoreShopState(corruptStock, rng);
assert.deepEqual(repaired.shop.permanents, ["lucky-sevens", "threes-company"]);
assert.equal(repaired.coins, rolled.run.coins);
const missingSlot = restoreShopState({
  ...rolled.run, inventory: { permanents: [
    { id: "not-a-real-item", pricePaid: 99 }, { id: "opening-act", pricePaid: 6 }
  ], consumables: [{ id: "gold-touch", pricePaid: 4 }] }
}, rng);
assert.deepEqual(missingSlot.inventory.permanents, [
  null, { id: "opening-act", pricePaid: 6 }
]);
assert.deepEqual(missingSlot.inventory.consumables, [
  { id: "gold-touch", pricePaid: 4 }, null
]);

// Stage gating and rare weighted stock never expose locked Runestones,
// show at most one per shop, or dilute the 22% rare-roll probability.
const rare = ITEM_CATALOG.filter(item => item.rare);
assert.deepEqual(rare.map(item => item.id), [
  "foundry-runestone", "prism-runestone", "echo-runestone",
  "mint-runestone", "sanctuary-runestone", "shatter-runestone"
]);
assert.deepEqual(rare.map(item => item.unlockRound), [4,4,7,10,4,7]);
const runForStage = stage => ({
  ...base,
  run: { ...base.run, round: stage - 1, phase: "round-clear",
    lastRoundReward: reward }
});
const sequence = (...values) => {
  let i = 0;
  return () => values[i++] ?? .5;
};
// The first two rolls select ordinary permanents, third is rare-chance,
// fourth selects the rare type, and fifth fills the ordinary consumable slot.
let rareShop = enterRogueliteShop(runForStage(4),
  sequence(.5, .5, .15, .99, .5));
assert.ok(rareShop.run.shop.consumables.includes("sanctuary-runestone"));
assert.equal(rareShop.run.shop.consumables.filter(id => ITEM_BY_ID[id]?.rare).length, 1);
rareShop = enterRogueliteShop(runForStage(7),
  sequence(.5, .5, .15, .99, .5));
assert.ok(rareShop.run.shop.consumables.includes("shatter-runestone"));
rareShop = enterRogueliteShop(runForStage(10),
  sequence(.5, .5, .15, .55, .5));
assert.ok(rareShop.run.shop.consumables.includes("mint-runestone"));
for (const stage of [2,3]) {
  const oldShop = enterRogueliteShop(runForStage(stage),
    sequence(.5, .5, .15, .99, .5));
  assert.equal(oldShop.run.shop.consumables.some(id => ITEM_BY_ID[id]?.rare),
    false, "No early-stage Runestones");
}
const ordinaryStock = enterRogueliteShop(runForStage(10),
  sequence(.5, .5, .75, .99, .5));
assert.equal(ordinaryStock.run.shop.consumables.some(id => ITEM_BY_ID[id]?.rare),
  false, "A failed rare roll must not include rare items");

// A final victory (round 12) is not a shop visit.
const victorious = {
  ...base, run: { ...base.run, round: 12, phase: "victory" }
};
assert.throws(() => enterRogueliteShop(victorious), RangeError);
assert.throws(() => purchaseShopOffer(next, "permanents", 0), RangeError);

// Browser regression: native modal cannot be escaped; shop is reachable
// only by the round-clear action, its stock and slots are actually rendered,
// and Classic data/storage remain separate.
const html = readFileSync("index.html", "utf8");
const app = readFileSync("app.mjs", "utf8");
const ui = readFileSync("shop-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
for (const id of [
  "shopDialog", "shopTitle", "shopRound", "shopCoins", "shopNotice",
  "shopOffers", "shopInventory", "shopReroll", "shopContinue",
  "rogueInventory", "roguePermanentSlots", "rogueConsumableSlots"
]) {
  assert.match(html, new RegExp('id="' + id + '"'), "Missing shop DOM: " + id);
}
assert.match(app, /enterRogueliteShop\(state\)/);
assert.match(app, /advanceRogueliteRound\(state, Math\.random, goldChancesForRun\(state\.run\)\)/);
assert.match(app, /renderRogueliteShop\(state, mode, applyShopAction\)/);
assert.match(app, /shopDialog"\)\.addEventListener\("cancel", event => event\.preventDefault\(\)\)/);
assert.match(app, /restoreShopState\(/);
assert.match(app, /if \(screen !== "game" \|\| \$\("shopDialog"\)\.open/);
assert.match(app, /index-shuffle-v1/);
assert.match(app, /index-shuffle-roguelite-v1/);
assert.match(ui, /purchaseShopOffer\(value, type, slotIndex, i\)/);
assert.match(ui, /sellPermanent\(value, slot\)/);
assert.match(ui, /discardConsumable\(value, slot\)/);
assert.match(css, /\.shop-dialog\s*\{/);
assert.match(css, /\.shop-offers\s*\{/);
assert.match(html, /Permanent bonuses apply automatically/);
console.log("All Index Shuffle shop / inventory Pass 3 tests passed.");
