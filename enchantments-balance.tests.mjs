import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, attemptBank } from "./engine.mjs";
import { newRogueliteRun, goldForBank, recordRogueliteBank } from "./roguelite.mjs";
import { BOSS_CATALOG, bossPointsFor, bossAllowsMoveRestoration, validBossSchedule } from "./bosses.mjs";
import { ITEM_BY_ID, RUNESTONE_SHOP_CHANCE, RUNESTONE_ITEM_IDS,
  RUNESTONE_WEIGHTS, enterRogueliteShop } from "./shop.mjs";
import { bankItemBonuses, scoreWithPrism, MAX_BANK_SCORE_MULTIPLIER } from "./effects.mjs";
import { emptyEnchantmentLayer, placeEnchantment, previewEnchantedBank,
  redeemEnchantedBank } from "./enchantments.mjs";

function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
const rng = seeded(20261030), base = newRogueliteRun(0, () => .48);
let overall = 0;
const counts = Object.fromEntries(RUNESTONE_ITEM_IDS.map(id => [id, 0]));
for (let nextRound = 4; nextRound <= 12; nextRound++) {
  let appeared = 0;
  for (let i = 0; i < 900; i++) {
    const state = { ...base, run: { ...base.run,
      round: nextRound - 1, phase: "round-clear" } };
    const shop = enterRogueliteShop(state, rng).run.shop;
    const rares = shop.consumables.filter(id => ITEM_BY_ID[id]?.rare);
    assert.ok(rares.length <= 1, "At most one rare in a visit");
    if (rares.length) {
      const id = rares[0];
      assert.ok(ITEM_BY_ID[id].unlockRound <= nextRound, "No early unlock");
      assert.equal(shop.runestoneSeen, true);
      counts[id]++; appeared++;
    }
  }
  assert.ok(Math.abs(appeared / 900 - RUNESTONE_SHOP_CHANCE) < .07,
    "Stage " + nextRound + " rare shop-rate drift: " + appeared / 900);
  overall += appeared;
}
assert.ok(Math.abs(overall / 8100 - RUNESTONE_SHOP_CHANCE) < .03);
assert.ok(counts["foundry-runestone"] > counts["mint-runestone"]);
assert.ok(counts["mint-runestone"] > 0);
assert.equal(Object.values(RUNESTONE_WEIGHTS).reduce((a, x) => a+x, 0), 14);

const mintGold = goldForBank({ ...tile(2, 4), gold: 2 }, true);
assert.equal(mintGold, 4);
assert.equal(ITEM_BY_ID["mint-runestone"].price, 3);
assert.ok(ITEM_BY_ID["mint-runestone"].price < mintGold,
  "Single-use gold item should have a viable positive coin payoff");
assert.equal(ITEM_BY_ID["shatter-runestone"].price, 3);
assert.ok(ITEM_BY_ID["shatter-runestone"].price <=
  2 * ITEM_BY_ID["block-breaker"].price);
assert.ok(2 * goldForBank({ ...tile(2, 4), gold: 1 }, true) >=
  ITEM_BY_ID["foundry-runestone"].price);

const firstRun = newRogueliteRun(0, () => .42).run;
const bonusFor = (ids, power) => bankItemBonuses({ ...firstRun,
  inventory: { ...firstRun.inventory,
    permanents: ids.map(id => id
      ? { id, pricePaid: ITEM_BY_ID[id].price } : null) }
}, power, true);
const power = tile(2, 4), ordinary = bankItemBonuses(firstRun, power, true);
assert.equal(MAX_BANK_SCORE_MULTIPLIER, 4);
assert.deepEqual(scoreWithPrism(power, ordinary, true),
  { score: 8, multiplier: 2, prismApplied: true });
assert.equal(scoreWithPrism(power, ordinary, false).score, 4);
const twoDoubles = bonusFor(["opening-act", "twin-twos"], power);
assert.equal(twoDoubles.multiplier, 4);
assert.deepEqual(scoreWithPrism(power, twoDoubles, true),
  { score: 16, multiplier: 4, prismApplied: false });
const add = bonusFor(["opening-act", "big-powers"], tile(2, 5));
assert.equal(scoreWithPrism(tile(2, 5), add, true).score, 22);
assert.equal(scoreWithPrism(tile(2, 5), add, false).score, 12);
assert.throws(() => scoreWithPrism(power, ordinary, "yes"), RangeError);

const board = Array(16).fill(null); board[0] = power;
const prismLayer = placeEnchantment(emptyEnchantmentLayer(), board,
  Array(16).fill(null), 0, "power-prism");
const preview = previewEnchantedBank(prismLayer, 0, power);
assert.equal(redeemEnchantedBank(prismLayer, 0, preview,
  { prismApplied:false, pointsAwarded:16 }).enchantments[0].chargesLeft, 2);
assert.equal(redeemEnchantedBank(prismLayer, 0, preview,
  { prismApplied:true, pointsAwarded:0 }).enchantments[0].chargesLeft, 2);
assert.equal(redeemEnchantedBank(prismLayer, 0, preview,
  { prismApplied:true, pointsAwarded:8 }).enchantments[0].chargesLeft, 1);
assert.equal(attemptBank(board, 0, "15").status, "incorrect");

const early = new Set(["blockade", "five-thief", "scorekeeper"]);
for (const boss of BOSS_CATALOG) {
  const earlyBoss = early.has(boss.id);
  const round = earlyBoss ? 3 : 6;
  const assigned = { 3: earlyBoss ? boss.id : "blockade" };
  const used = new Set([assigned[3]]);
  assigned[6] = earlyBoss
    ? BOSS_CATALOG.find(x => !used.has(x.id)).id : boss.id;
  used.add(assigned[6]);
  const unused = BOSS_CATALOG.filter(x => !used.has(x.id));
  assigned[9] = unused[0].id; assigned[12] = unused[1].id;
  assert.ok(validBossSchedule(assigned), boss.id + " schedule");
  const run = { ...firstRun, round, bosses: assigned };
  const golden = { ...tile(5, 2), gold: 1 };
  const score = scoreWithPrism(golden,
    bankItemBonuses(run, golden, true), true).score;
  const award = recordRogueliteBank(run, 0, golden,
    { merged: true, movesLeft: 8, scoreOverride: score });
  assert.equal(award.points, bossPointsFor(run, golden, score));
  assert.equal(award.bankGold, 2);
  assert.equal(bossAllowsMoveRestoration(run), boss.id !== "timekeeper");
  if (["five-thief", "power-snob"].includes(boss.id))
    assert.equal(award.points, 0, boss.id + " ignores Prism scoring");
}
const app = readFileSync("app.mjs","utf8");
assert.match(app, /scoreOverride: prismScore\.score/);
assert.match(app, /prismApplied: prismScore\.prismApplied/);
assert.doesNotMatch(app, /scoreOverride: bonuses\.score \* \(enchanted\.prism/);
console.log("Pass 4 economy, multiplier, and eight-boss tests passed (8100 shops).");
