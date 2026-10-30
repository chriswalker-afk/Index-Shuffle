// Pass 4 collision and correctness invariants across enchantments/hazards.
import assert from "node:assert/strict";
import { tile, blocker, attemptBank, slide } from "./engine.mjs";
import {
  newRogueliteRun, goldForBank, recordRogueliteBank
} from "./roguelite.mjs";
import {
  emptyEnchantmentLayer, placeEnchantment, previewEnchantedBank,
  redeemEnchantedBank, resolveSlideEnchantments, canPlaceEnchantment
} from "./enchantments.mjs";
import {
  emptyHazardLayer, progressHazardRound
} from "./hazards.mjs";
import { bankItemBonuses } from "./effects.mjs";
const board=Array(16).fill(null);
board[0]=tile(3); board[1]=tile(3);
const nil=emptyHazardLayer();
const layer=placeEnchantment(emptyEnchantmentLayer(),board,nil,0,"gilded-foundry");
const finished=resolveSlideEnchantments(slide(board,"left"),layer);
assert.equal(finished.board[0].gold,1);
assert.equal(finished.enchantments[0].chargesLeft,1);
assert.equal(finished.enchantmentEvents.length,1);
assert.equal(attemptBank(finished.board,0,"8").status,"incorrect");
const run=newRogueliteRun(0,()=>.51).run;
const incoming={...run,round:7,
  hazardWarning:{type:"cloudy",index:0},hazardCooldown:0};
const progressed=progressHazardRound(board,nil,incoming,3,{
  movesLeft:8,rng:()=>.99,enchantments:layer
});
assert.equal(progressed.hazards[0],null);
assert.equal(progressed.run.hazardWarning,null);
assert.ok(progressed.events.some(x=>x.kind==="dispelled"));
const hasNull=nil.slice();hasNull[0]={type:"null"};
assert.equal(canPlaceEnchantment(emptyEnchantmentLayer(),board,
  hasNull,0,"power-prism"),false);
const obstructed=board.slice();obstructed[3]=blocker(0,3);
assert.equal(canPlaceEnchantment(emptyEnchantmentLayer(),obstructed,
  nil,3,"shatter-crest"),false);
// A valid Golden Calculator plus Foundry bank earns exactly the gold
// difference, never duplicated gold from a mere placement.
const permanentRun={...run,round:4,
  inventory:{...run.inventory,permanents:[
    {id:"golden-calculator",pricePaid:7},null]}};
const eligible=tile(3,3);
const goldPreview=previewEnchantedBank(layer,0,eligible);
const bonuses=bankItemBonuses(permanentRun,goldPreview.power,true);
const bonusCoins=bonuses.extraCoins+
  goldForBank(goldPreview.power,true)-goldForBank(eligible,true);
const recorded=recordRogueliteBank(permanentRun,0,eligible,{
  merged:true,scoreOverride:bonuses.score,extraCoins:bonusCoins
});
assert.equal(recorded.bankGold,3);
assert.equal(redeemEnchantedBank(layer,0,goldPreview,{
  pointsAwarded:recorded.points
}).enchantments[0].chargesLeft,1);
// Wrong answers, nullified scoring and cancelled questions cannot redeem
// Shatter, Echo or Prism in ways the bank engine did not authorise.
const shatter=placeEnchantment(emptyEnchantmentLayer(),board,nil,0,"shatter-crest");
const shatterPreview=previewEnchantedBank(shatter,0,tile(3,2),{
  merged:true,adjacentBlocker:true
});
assert.equal(redeemEnchantedBank(shatter,0,shatterPreview,{
  blockerApplied:false
}).enchantments[0].chargesLeft,2);
console.log("Pass 4 hazard placement and gold/charge invariants passed.");
