import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, blocker, warning, attemptBank, scoreFor, slide
} from "./engine.mjs";
import {
  newRogueliteRun, targetForRound, recordRogueliteBank,
  markGoldSpawns, advanceRogueliteRound
} from "./roguelite.mjs";
import { enterRogueliteShop, purchaseShopOffer, shopItemPrice } from "./shop.mjs";
import {
  permanentIds, hasPermanent, restoreEffectState, bankItemBonuses,
  goldChancesForRun, consumableTargets, canActivateConsumable,
  useConsumable, costOfNextSlide, CONSUMABLE_TARGETS
} from "./effects.mjs";

const rng = () => 0;
const blank = () => Array(16).fill(null);
function setup({ permanents = [], consumables = [], movesLeft = 8,
  board = blank(), locked = [], mergeReady = [] } = {}) {
  const state = newRogueliteRun(0, rng);
  state.board = board;
  state.movesLeft = movesLeft;
  state.locked = [...locked];
  state.mergeReady = [...mergeReady];
  state.run.inventory.permanents = [0, 1].map(i => permanents[i]
    ? { id: permanents[i], pricePaid: 6 } : null);
  state.run.inventory.consumables = [0, 1].map(i => consumables[i]
    ? { id: consumables[i], pricePaid: 3 } : null);
  return state;
}
function grid(...entries) {
  const board = blank();
  for (const [index, value] of entries) board[index] = value;
  return board;
}
const first = setup({ permanents: ["opening-act", "twin-twos"] });
assert.deepEqual([...permanentIds(first.run)].sort(), ["opening-act", "twin-twos"]);
assert.equal(hasPermanent(first.run, "opening-act"), true);
assert.equal(hasPermanent(first.run, "lucky-spawn"), false);

// Scores always start with the exponent, independently of the base.
// Multipliers combine, and only then do additive bonuses apply.
let bonus = bankItemBonuses(first.run, tile(2, 3), true);
assert.equal(bonus.score, 12, "Opening Act x Twin Twos = 3 x 2 x 2");
assert.equal(bonus.multiplier, 4);
assert.equal(bonus.additive, 0);
assert.equal(bonus.counters.scoredBanks, 1);
assert.equal(bonus.counters.twosBanked, 1);
assert.equal(bonus.counters.lastBankBase, 2);
let ordinary = bankItemBonuses(newRogueliteRun(0, rng).run, tile(13, 5));
assert.equal(ordinary.score, 5);
assert.equal(scoreFor(tile(7, 2)), 25, "Classic stays untouched");
assert.throws(() => bankItemBonuses(first.run, tile(2, 1)), RangeError);
assert.throws(() => bankItemBonuses(first.run, tile(2, 3), "yes"), RangeError);

const scoreResult = recordRogueliteBank(first.run, 0, tile(2, 3), {
  merged: true, movesLeft: 5, scoreOverride: bonus.score,
  extraCoins: bonus.extraCoins, counters: bonus.counters
});
assert.equal(scoreResult.points, 12);
assert.equal(scoreResult.roundScore, 12);
assert.equal(scoreResult.cleared, true);
assert.equal(scoreResult.run.scoredBanks, 1);
assert.equal(scoreResult.run.twosBanked, 1);
assert.equal(scoreResult.run.lastBankBase, 2);
assert.equal(scoreResult.moveGold, 5);
bonus = bankItemBonuses(scoreResult.run, tile(2, 2), true);
assert.equal(bonus.score, 4, "Second 2-bank still gets Twin Twos");
bonus = bankItemBonuses({ ...scoreResult.run, twosBanked: 2 }, tile(2, 2), true);
assert.equal(bonus.score, 2, "Third base-2 bank no longer scores double");

// Individually cover all permanent scoring effects.
const banks = [
  { id: "opening-act", power: tile(3, 2), expected: 4 },
  { id: "twin-twos", power: tile(2, 4), expected: 8 },
  { id: "five-alive", power: tile(5, 3), expected: 6 },
  { id: "big-powers", power: tile(11, 4), expected: 6 },
  { id: "square-specialist", power: tile(11, 2), expected: 3 },
  { id: "variety-bonus", power: tile(3, 3), expected: 5 }
];
for (const { id, power, expected } of banks) {
  const state = setup({ permanents: [id] });
  if (id === "variety-bonus") state.run.lastBankBase = 2;
  assert.equal(bankItemBonuses(state.run, power).score, expected, id);
}
let combined = setup({ permanents: ["big-powers", "variety-bonus"] });
combined.run.lastBankBase = 2;
assert.equal(bankItemBonuses(combined.run, tile(5, 4)).score, 8);
assert.equal(bankItemBonuses(combined.run, tile(2, 4)).score, 6,
  "Variety only applies after changing base");
const golden = { ...tile(3, 2), gold: 1 };
assert.equal(bankItemBonuses(setup({
  permanents: ["golden-calculator"]
}).run, golden, true).extraCoins, 1);
assert.equal(bankItemBonuses(setup({
  permanents: ["golden-calculator"]
}).run, golden, false).extraCoins, 1,
  "Golden Calculator also rewards directly banked gold");
const threes = bankItemBonuses(setup({
  permanents: ["threes-company"]
}).run, tile(3, 3), true);
assert.equal(threes.counters.blockerDelay, 1);
assert.equal(bankItemBonuses(setup({
  permanents: ["threes-company"]
}).run, tile(3, 3), false).counters.blockerDelay, 0);
const blockbusterRun = setup({ permanents: ["blockbuster"] }).run;
assert.equal(bankItemBonuses(blockbusterRun, tile(2, 2), true).blockerHits, 2);
assert.equal(bankItemBonuses(blockbusterRun, tile(2, 2), false).blockerHits, 1);
const nearBlocker = grid([4, tile(3, 2)], [5, blocker(1, 3)]);
const context = { banked: new Set(), locked: new Set(),
  discovered: new Set(), mergeReady: new Set([4]) };
const doubleHit = attemptBank(nearBlocker, 4, "9",
  { ...context, blockerDamage: 2 }, rng);
assert.deepEqual(doubleHit.destroyed, [5], "Blockbuster destroys 3-hit blocker at one hit left");
const normalHit = attemptBank(nearBlocker, 4, "9", context, rng);
assert.equal(normalHit.board[5].hits, 2);
assert.throws(() => attemptBank(nearBlocker, 4, "9",
  { ...context, blockerDamage: 4 }, rng), RangeError);
assert.equal(attemptBank(nearBlocker, 4, "8",
  { ...context, blockerDamage: 2 }, rng).status, "incorrect",
"Wrong answers do not damage blockers even with Blockbuster");

assert.deepEqual(goldChancesForRun(setup().run), {
  baseChance: 0.12, sevenChance: 0.12
});
assert.deepEqual(goldChancesForRun(setup({ permanents: ["lucky-sevens"] }).run), {
  baseChance: 0.12, sevenChance: 0.42
});
assert.deepEqual(goldChancesForRun(setup({ permanents: ["lucky-spawn"] }).run), {
  baseChance: 0.27, sevenChance: 0.27
});
assert.deepEqual(goldChancesForRun(setup({
  permanents: ["lucky-spawn", "lucky-sevens"]
}).run), { baseChance: 0.27, sevenChance: 0.57 });
const rateBoard = grid([0, tile(2)], [1, tile(7)]);
const lucky = markGoldSpawns(rateBoard, [0, 1], 0, () => 0.30,
  true, goldChancesForRun(setup({ permanents: ["lucky-sevens"] }).run));
assert.equal(lucky.board[0].gold, undefined);
assert.equal(lucky.board[1].gold, 1);
const globalLucky = markGoldSpawns(rateBoard, [0, 1], 0, () => 0.20,
  true, goldChancesForRun(setup({ permanents: ["lucky-spawn"] }).run));
assert.deepEqual(globalLucky.board.map(t => t?.gold), [1, 1, ...Array(14).fill(undefined)]);

// All eleven consumables are usable under the right conditions.
assert.equal(Object.keys(CONSUMABLE_TARGETS).length, 11);
const blockerBoard = grid([0, tile(2)], [5, blocker(0, 1)], [6, warning(2)]);
let st = setup({ consumables: ["block-breaker"], board: blockerBoard });
assert.deepEqual(consumableTargets(st, 0), [5]);
let used = useConsumable(st, 0, [5]);
assert.equal(used.board[5], null);
assert.deepEqual(used.board[6], warning(2));
assert.equal(used.movesLeft, st.movesLeft);
assert.equal(used.score, st.score);
assert.equal(used.run.coins, st.run.coins);
assert.equal(used.run.inventory.consumables[0], null);
assert.deepEqual(st.board[5], blocker(0, 1), "Item effect doesn't mutate input");
assert.throws(() => useConsumable(used, 0, [5]), RangeError);
assert.throws(() => useConsumable(st, 0, [6]), RangeError,
  "Warning cannot be erased with Block Breaker");
assert.throws(() => useConsumable(st, 0, []), RangeError);
assert.throws(() => useConsumable(st, 0, [5, 5]), RangeError);

st = setup({ consumables: ["second-wind"], movesLeft: 8 });
used = useConsumable(st, 0, []);
assert.equal(used.movesLeft, 10);
assert.equal(used.mergeCredit, 0, "No merge credit from item use");
assert.equal(canActivateConsumable(setup({
  consumables: ["second-wind"], movesLeft: 10
}), 0), false);

st = setup({ consumables: ["power-surge"],
  board: grid([0, tile(2, 2)]), mergeReady: [0], locked: [0] });
used = useConsumable(st, 0, [0]);
assert.deepEqual(used.board[0], tile(2, 3));
assert.deepEqual(used.mergeReady, []);
assert.deepEqual(used.locked, [0], "Power Surge does not bypass cooldown");
assert.equal(used.discovered.length, 0, "Artificial power isn't unlocked for spawn");
assert.equal(used.banked.length, 0);
st.banked = ["2-3"];
assert.deepEqual(consumableTargets(st, 0), [],
  "Power Surge may not create a previously banked power");

st = setup({ consumables: ["alchemist"],
  board: grid([0, { ...tile(3, 2), gold: 1 }]),
  mergeReady: [0], locked: [0] });
used = useConsumable(st, 0, [0]);
assert.deepEqual(used.board[0], { base: 5, exp: 2, gold: 1 });
assert.deepEqual(used.mergeReady, []);
assert.deepEqual(used.locked, [0]);
assert.equal(used.score, 0);
st.banked = ["5-2"];
assert.deepEqual(consumableTargets(st, 0), []);

st = setup({ consumables: ["gold-touch"], board: grid([0, tile(3)]), mergeReady: [0] });
used = useConsumable(st, 0, [0]);
assert.deepEqual(used.board[0], { base: 3, exp: 1, gold: 1 });
assert.deepEqual(used.mergeReady, [], "A tile gilded after merging must merge again to earn gold");
assert.equal(used.moves, 0, "Gold Touch itself is not a slide");
assert.equal(slide(used.board, "right").board[3].gold, 1);
assert.deepEqual(consumableTargets({
  ...st, board: grid([0, { ...tile(3), gold: 1 }])
}, 0), []);

st = setup({ consumables: ["protection"],
  board: grid([0, tile(2)], [5, blocker(0, 1)]) });
assert.equal(costOfNextSlide(st), 2);
used = useConsumable(st, 0, []);
assert.equal(used.run.protectionSlides, 2);
assert.equal(costOfNextSlide(used), 1);
assert.equal(canActivateConsumable({
  ...used, run: { ...used.run, inventory: st.run.inventory }
}, 0), false, "A second Protection cannot be wasted while active");

st = setup({ consumables: ["position-swap"],
  board: grid([0, { ...tile(2, 2), gold: 1 }], [6, tile(3, 2)]),
  mergeReady: [0], locked: [6] });
assert.deepEqual(consumableTargets(st, 0), [0, 6]);
assert.deepEqual(consumableTargets(st, 0, [0]), [6]);
used = useConsumable(st, 0, [0, 6]);
assert.deepEqual(used.board[6], { base: 2, exp: 2, gold: 1 });
assert.deepEqual(used.board[0], tile(3, 2));
assert.deepEqual(used.mergeReady, [6], "Merge provenance follows its tile");
assert.deepEqual(used.locked, [0], "Banking cooldown follows its tile");
assert.equal(used.movesLeft, 8);
assert.throws(() => useConsumable(st, 0, [0, 0]), RangeError);
assert.throws(() => useConsumable(st, 0, [0]), RangeError);

st = setup({ consumables: ["delay-tactics"] });
used = useConsumable(st, 0, []);
assert.equal(used.run.blockerDelay, 2);
assert.equal(used.moves, 0);
assert.equal(restoreEffectState(used.run).blockerDelay, 2);

st = setup({ consumables: ["clear-space"],
  board: grid([0, tile(2)], [1, blocker(0, 1)],
    [4, blocker(0, 1)], [6, tile(3)]) });
assert.deepEqual(consumableTargets(st, 0), [0],
  "Cannot clear the last movable square and force an instant dead end");
used = useConsumable(st, 0, [0]);
assert.equal(used.board[0], null);
assert.deepEqual(used.board[6], tile(3));
assert.equal(used.score, 0);
assert.equal(used.run.coins, 0);

st = setup({ consumables: ["second-chance"],
  board: grid([0, tile(2, 2)]), locked: [0] });
assert.deepEqual(consumableTargets(st, 0), [0]);
used = useConsumable(st, 0, [0]);
assert.deepEqual(used.locked, []);
assert.deepEqual(used.board[0], tile(2, 2));
assert.equal(used.score, 0);
st.banked = ["2-2"];
assert.deepEqual(consumableTargets(st, 0), []);

for (const id of Object.keys(CONSUMABLE_TARGETS)) {
  const invalid = setup({ consumables: [id], movesLeft: 0 });
  assert.equal(canActivateConsumable(invalid, 0), false,
    "Cannot use items after the last move has expired: " + id);
}
assert.throws(() => useConsumable(setup({
  consumables: ["second-wind"]
}), -1), RangeError);
assert.throws(() => useConsumable(setup({
  consumables: ["second-wind"]
}), 0, [0]), RangeError);

// Shop prices reflect Bulk Discount even when buying in the same visit.
// Rerolls remain a separate service, unaffected by Bulk Discount.
let buyer = setup({ permanents: ["bulk-discount"] });
buyer.run.phase = "round-clear";
buyer.run.coins = 12;
buyer.run.lastRoundReward = {
  bankCoins: 7, moveCoins: 5, unusedMoves: 5, totalCoins: 12
};
const shopping = enterRogueliteShop(buyer, rng);
assert.equal(shopItemPrice(shopping.run, "opening-act"), 5);
assert.equal(shopItemPrice(setup().run, "opening-act"), 6);
const bought = purchaseShopOffer(shopping, "permanents", 0);
assert.equal(bought.run.coins, 7);
assert.deepEqual(bought.run.inventory.permanents[1],
  { id: "opening-act", pricePaid: 5 });
assert.equal(bought.run.shop.rerollCost, 1);
assert.throws(() => shopItemPrice(shopping.run, "not-an-item"), RangeError);

// Round effects reset, but the actual purchased inventory persists.
const prior = setup({ permanents: ["opening-act", "twin-twos"] });
prior.run.phase = "round-clear";
prior.run.scoredBanks = 4;
prior.run.twosBanked = 2;
prior.run.lastBankBase = 5;
prior.run.protectionSlides = 1;
prior.run.blockerDelay = 3;
prior.run.lastRoundReward = {
  bankCoins: 0, moveCoins: 0, unusedMoves: 0, totalCoins: 0
};
const advanced = advanceRogueliteRound(enterRogueliteShop(prior, rng), rng);
assert.equal(advanced.run.scoredBanks, 0);
assert.equal(advanced.run.twosBanked, 0);
assert.equal(advanced.run.lastBankBase, null);
assert.equal(advanced.run.protectionSlides, 0);
assert.equal(advanced.run.blockerDelay, 0);
assert.deepEqual(advanced.run.inventory, prior.run.inventory);
assert.equal(restoreEffectState({}).scoredBanks, 0);
assert.equal(restoreEffectState({ scoredBanks: -5, protectionSlides: 23 }).protectionSlides, 2);

// Make sure the browser actually routes item bonuses through the successful
// bank path and no power can be granted merely by a wrong answer.
const app = readFileSync("app.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(app, /blockerDamage: bonuses\?\.blockerHits \?\? 1/);
assert.match(app, /scoreOverride: bonuses\.score/);
assert.match(app, /extraCoins: bonuses\.extraCoins/);
assert.match(app, /counters: bonuses\.counters/);
assert.match(app, /if \(outcome\.status === "incorrect"\)/);
assert.match(app, /useConsumable\(state, slot, targets\)/);
assert.match(app, /if \(pendingItem !== null\)/);
assert.match(app, /state\.run\.protectionSlides -= 1/);
assert.match(app, /nextMove - state\.run\.blockerDelay/);
assert.match(app, /goldChancesForRun\(state\.run\)/);
assert.match(html, /id="itemPrompt"[^>]*hidden/);
assert.match(html, /id="itemCancel"/);
assert.match(html, /id="rogueEffectStatus"/);
assert.match(shopUI, /shopItemPrice\(state\.run, item\)/);
assert.match(shopUI, /onUse\(i\)/);
assert.match(css, /\.cell\.item-target\b/);
assert.doesNotMatch(html, /Item effects are coming in Pass 4/);
console.log("All Index Shuffle item effect Pass 4 tests passed.");
