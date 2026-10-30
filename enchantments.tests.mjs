import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, slide } from "./engine.mjs";
import { newRogueliteRun, advanceRogueliteRound } from "./roguelite.mjs";
import { useConsumable, canActivateConsumable, consumableTargets } from "./effects.mjs";
import {
  emptyEnchantmentLayer, restoreEnchantmentLayer, activeEnchantmentCount,
  canPlaceEnchantment, placeEnchantment, resolveSlideEnchantments,
  previewEnchantedBank, redeemEnchantedBank
} from "./enchantments.mjs";
const none = () => null;
const empty = () => Array(16).fill(null);
const board = empty(); board[0] = tile(2); board[1] = tile(2);
const noHazard = empty();
assert.equal(activeEnchantmentCount(emptyEnchantmentLayer()),0);
assert.deepEqual(restoreEnchantmentLayer(undefined),empty());
assert.ok(canPlaceEnchantment(empty(),board,noHazard,0,"power-prism"));
assert.ok(canPlaceEnchantment(empty(),board,noHazard,2,"gilded-foundry"));
let layer = placeEnchantment(empty(),board,noHazard,0,"gilded-foundry");
assert.equal(layer[0].chargesLeft,2);
assert.equal(layer[1],null);
assert.equal(canPlaceEnchantment(layer,board,noHazard,0,"power-prism"),false);
layer=placeEnchantment(layer,board,noHazard,2,"power-prism");
assert.equal(activeEnchantmentCount(layer),2);
assert.equal(canPlaceEnchantment(layer,board,noHazard,3,"power-prism"),false);
assert.equal(canPlaceEnchantment(empty(),board,noHazard,3,"power-prism",3),false);
let hazard=noHazard.slice();hazard[5]={type:"null"};
assert.equal(canPlaceEnchantment(empty(),board,hazard,5,"power-prism"),false);
let corrupted=layer.slice();corrupted[0]={type:"power-prism",chargesLeft:99};
assert.equal(restoreEnchantmentLayer(corrupted)[0],null);
let result=resolveSlideEnchantments(slide(board,"left"),layer);
assert.equal(result.board[0].gold,1);
assert.equal(result.enchantments[0].chargesLeft,1);
assert.equal(result.enchantmentEvents.length,1);
const bankPreview=previewEnchantedBank(result.enchantments,0,result.board[0]);
assert.equal(bankPreview.spend,null,"Already-golden merge cannot consume foundry again");
const plainPreview=previewEnchantedBank(layer,0,tile(5,2));
assert.equal(plainPreview.power.gold,1);
assert.equal(redeemEnchantedBank(layer,0,plainPreview).enchantments[0].chargesLeft,1);
assert.equal(redeemEnchantedBank(layer,0,plainPreview).used,true);
const prism=placeEnchantment(empty(),board,noHazard,0,"power-prism");
result=resolveSlideEnchantments(slide(board,"left"),prism);
assert.equal(result.board[0].prism,1);
assert.equal(result.enchantments[0].chargesLeft,1);
const next=empty();next[0]={...tile(3,2),prism:1};next[1]=tile(3);
assert.equal(slide(next,"left").board[0].prism,1,"Prism charge survives further merges");
const prismPreview=previewEnchantedBank(prism,0,tile(3,2));
assert.equal(prismPreview.prism,true);
assert.equal(redeemEnchantedBank(prism,0,prismPreview,{prismApplied:true,pointsAwarded:6}).enchantments[0].chargesLeft,1);
assert.equal(redeemEnchantedBank(prism,0,prismPreview,{prismApplied:true,pointsAwarded:0}).enchantments[0].chargesLeft,2);
let st=newRogueliteRun(0,()=>0);
st.run.round=4;st.board=board;
st.run.inventory.consumables=[{id:"foundry-runestone",pricePaid:5},{id:"prism-runestone",pricePaid:6}];
assert.equal(canActivateConsumable(st,0),true);
assert.ok(consumableTargets(st,0).includes(3),"Empty positions are legal targets");
st=useConsumable(st,0,[3]);
assert.equal(st.enchantments[3].type,"gilded-foundry");
assert.equal(st.run.inventory.consumables[0],null);
st=useConsumable(st,1,[5]);
assert.equal(st.enchantments[5].type,"power-prism");
assert.equal(activeEnchantmentCount(st.enchantments),2);
const saved=JSON.parse(JSON.stringify(st));
assert.deepEqual(restoreEnchantmentLayer(saved.enchantments,saved.board,saved.hazards),st.enchantments);
assert.equal(canPlaceEnchantment(st.enchantments,st.board,st.hazards,9,"power-prism"),false);
st.run.phase="shop";
const nextRound=advanceRogueliteRound(st,()=>0.5);
assert.equal(activeEnchantmentCount(nextRound.enchantments),0,"All enchantments reset on round advance");
const app=readFileSync("app.mjs","utf8");
const html=readFileSync("index.html","utf8");
assert.match(app,/resolveSlideEnchantments\(result, state.enchantments\)/);
assert.match(app,/redeemEnchantedBank\(state.enchantments/);
assert.match(html,/id="enchantmentStatus"/);

// Pass 2: one-charge and two-charge square definitions survive restoration.
for (const [type, charges] of [
  ["echo-seal", 1], ["twin-mint", 1],
  ["time-sanctuary", 2], ["shatter-crest", 2]
]) {
  const placement = placeEnchantment(empty(), board, noHazard, 3, type);
  assert.equal(placement[3].chargesLeft, charges, type + " initial charges");
  assert.deepEqual(restoreEnchantmentLayer(JSON.parse(JSON.stringify(placement)),
    board, noHazard), placement);
  const bad = placement.slice();
  bad[3] = { type, chargesLeft: charges + 1 };
  assert.equal(restoreEnchantmentLayer(bad)[3], null,
    type + " must reject excess save charges");
}

// Twin Mint is a MERGE-only effect and cannot be farmed by landing/banking.
const mintLayer = placeEnchantment(empty(), board, noHazard, 0, "twin-mint");
let minted = resolveSlideEnchantments(slide(board, "left"), mintLayer);
assert.equal(minted.board[0].gold, 2);
assert.equal(minted.enchantments[0], null, "Single use mint expires after merge");
assert.equal(minted.enchantmentEvents[0].type, "twin-mint");
assert.equal(previewEnchantedBank(mintLayer, 0, tile(2, 2)).spend, null,
  "A correct bank alone cannot activate Twin Mint");
const goldenInputs = empty(); goldenInputs[0] = { ...tile(2), gold: 1 };
goldenInputs[1] = tile(2);
minted = resolveSlideEnchantments(slide(goldenInputs, "left"), mintLayer);
assert.equal(minted.board[0].gold, 2, "Twin Mint upgrades ordinary gold to double");
const bothGold = empty(); bothGold[0] = { ...tile(2), gold: 1 };
bothGold[1] = { ...tile(2), gold: 1 };
minted = resolveSlideEnchantments(slide(bothGold, "left"), mintLayer);
assert.equal(minted.board[0].gold, 2);
assert.equal(minted.enchantments[0].chargesLeft, 1,
  "A naturally double-gold merge must not waste the Mint");

// Echo requires a banked combination, a valid power, and a correct answer.
const echoLayer = placeEnchantment(empty(), board, noHazard, 0, "echo-seal");
const { isBankable, attemptBank, blocker } = await import("./engine.mjs");
const previouslyBanked = new Set(["3-2"]);
const repeatedTile = tile(3, 2);
assert.equal(isBankable(repeatedTile, previouslyBanked, 0), false);
assert.equal(isBankable(repeatedTile, previouslyBanked, 0,
  new Set(), noHazard, echoLayer), true);
assert.equal(isBankable(repeatedTile, previouslyBanked, 1,
  new Set(), noHazard, echoLayer), false);
assert.equal(isBankable(repeatedTile, previouslyBanked, 0,
  new Set([0]), noHazard, echoLayer), false);
const echoPreview = previewEnchantedBank(echoLayer, 0, repeatedTile,
  { alreadyBanked: true });
assert.equal(echoPreview.repeatBank, true);
assert.equal(previewEnchantedBank(echoLayer, 0, repeatedTile,
  { alreadyBanked: false }).spend, null);
const echoBoard = empty(); echoBoard[0] = repeatedTile;
assert.equal(attemptBank(echoBoard, 0, "8", {
  banked: previouslyBanked, enchantments: echoLayer
}).status, "incorrect", "Incorrect repeat banks never score");
const repeated = attemptBank(echoBoard, 0, "9", {
  banked: previouslyBanked, enchantments: echoLayer
});
assert.equal(repeated.status, "success");
assert.equal(repeated.repeatedBank, true);
assert.equal(redeemEnchantedBank(echoLayer, 0, echoPreview,
  { repeatBanked: false }).used, false);
const echoSpent = redeemEnchantedBank(echoLayer, 0, echoPreview,
  { repeatBanked: repeated.repeatedBank });
assert.equal(echoSpent.enchantments[0], null);
assert.equal(isBankable(repeatedTile, previouslyBanked, 0,
  new Set(), noHazard, echoSpent.enchantments), false);

// Sanctuary spends a charge when the question OPENS, not when it scores.
const sanctuary = placeEnchantment(empty(), board, noHazard, 0, "time-sanctuary");
const stageTwo = previewEnchantedBank(sanctuary, 0, repeatedTile,
  { baseSeconds: 50 });
assert.equal(stageTwo.extraSeconds, 10);
assert.equal(previewEnchantedBank(sanctuary, 0, repeatedTile,
  { baseSeconds: 40 }).extraSeconds, 10);
assert.equal(previewEnchantedBank(sanctuary, 0, repeatedTile,
  { baseSeconds: 30 }).extraSeconds, 10);
const atCap = previewEnchantedBank(sanctuary, 0, repeatedTile,
  { baseSeconds: 60 });
assert.equal(atCap.extraSeconds, 0);
assert.equal(atCap.spend, null);
assert.equal(redeemEnchantedBank(sanctuary, 0, stageTwo).used, false);
let timed = redeemEnchantedBank(sanctuary, 0, stageTwo, { trigger: "open" });
assert.equal(timed.used, true);
assert.equal(timed.enchantments[0].chargesLeft, 1);
timed = redeemEnchantedBank(timed.enchantments, 0, stageTwo, { trigger: "open" });
assert.equal(timed.enchantments[0], null);
assert.equal(redeemEnchantedBank(timed.enchantments, 0, stageTwo,
  { trigger: "open" }).used, false);

// Shatter requires a bankable merged power plus an adjacent blocker.
const blockBoard = empty(); blockBoard[0] = tile(3, 2);
blockBoard[1] = blocker(0, 3);
const shatter = placeEnchantment(empty(), blockBoard, noHazard, 0, "shatter-crest");
const shatterPreview = previewEnchantedBank(shatter, 0, blockBoard[0],
  { merged: true, adjacentBlocker: true });
assert.equal(shatterPreview.extraBlockerHit, true);
assert.equal(previewEnchantedBank(shatter, 0, blockBoard[0],
  { merged: false, adjacentBlocker: true }).spend, null);
assert.equal(previewEnchantedBank(shatter, 0, blockBoard[0],
  { merged: true, adjacentBlocker: false }).spend, null);
const mergeReady = new Set([0]);
assert.equal(attemptBank(blockBoard, 0, "8", {
  mergeReady, blockerDamage: 2
}).status, "incorrect", "Wrong answers cannot trigger Shatter");
const shatterSuccess = attemptBank(blockBoard, 0, "9", {
  mergeReady, blockerDamage: 2
});
assert.equal(shatterSuccess.status, "success");
assert.equal(shatterSuccess.board[1].hits, 2, "Base hit + Shatter extra hit");
const tripleHit = attemptBank(blockBoard, 0, "9", {
  mergeReady, blockerDamage: 3
});
assert.deepEqual(tripleHit.destroyed, [1], "Blockbuster + Shatter can total 3 hits");
assert.equal(redeemEnchantedBank(shatter, 0, shatterPreview,
  { blockerApplied: false }).used, false);
assert.equal(redeemEnchantedBank(shatter, 0, shatterPreview,
  { blockerApplied: true }).enchantments[0].chargesLeft, 1);
assert.throws(() => attemptBank(blockBoard, 0, "9", {
  mergeReady, blockerDamage: 4
}), RangeError);

// All four new items use the same inventory/placement contract and preserve
// one-vs-two charge counts in saved games, with existing round cleanup.
for (const [id, type, unlock, charges] of [
  ["sanctuary-runestone", "time-sanctuary", 4, 2],
  ["echo-runestone", "echo-seal", 7, 1],
  ["shatter-runestone", "shatter-crest", 7, 2],
  ["mint-runestone", "twin-mint", 10, 1]
]) {
  let trial = newRogueliteRun(0, () => 0);
  trial.run.round = unlock;
  trial.board = board;
  trial.run.inventory.consumables = [{ id, pricePaid: 8 }, null];
  assert.equal(canActivateConsumable(trial, 0), true);
  trial = useConsumable(trial, 0, [3]);
  assert.equal(trial.run.inventory.consumables[0], null);
  assert.equal(trial.enchantments[3].type, type);
  assert.equal(trial.enchantments[3].chargesLeft, charges);
  assert.deepEqual(restoreEnchantmentLayer(trial.enchantments,
    trial.board, trial.hazards), trial.enchantments);
  trial.run.phase = "shop";
  assert.equal(activeEnchantmentCount(
    advanceRogueliteRound(trial, () => .5).enchantments), 0);
}
assert.match(app, /enchantedPreview\(i, t\)/);
assert.match(app, /repeatBanked: outcome.repeatedBank/);
assert.match(app, /blockerDamage: \(bonuses\?\.blockerHits \?\? 1\)/);
assert.match(app, /bankLimitMs = remainingMs/);
assert.match(app, /trigger: "open"/);
assert.match(app, /lockPending\("cancel"\)/);

// Pass 3 board presentation stays independent from scoring and persists
// no animation flags in the saved enchanted layer.
const overlayUI = readFileSync("enchantment-ui.mjs", "utf8");
const shopUI = readFileSync("shop-ui.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(overlayUI, /previewType = null, candidates = \[\]/);
assert.match(overlayUI, /enchantment-slot--preview/);
assert.match(overlayUI, /enchantment-preview-icon/);
assert.match(overlayUI, /board\.append\(overlay\)/);
assert.match(app, /renderEnchantmentLayer\(board, enchants, \{/);
assert.match(app, /enchantment-status-chip/);
assert.match(app, /rune-activation-flash/);
assert.match(app, /bankRuneBonus/);
assert.match(app, /ENCHANTMENT_DEFINITIONS\[redeemedRuneType\]/);
assert.match(shopUI, /RUNE_TRIGGER_LABEL/);
assert.match(css, /\.enchantment-status-chip/);
assert.match(css, /\.rune-activation-flash/);
assert.match(css, /\.bank-rune-bonus/);
assert.match(css, /\.enchantment-slot\[data-enchantment\]/);
console.log("Enchanted squares Passes 1–3 tests passed.");
