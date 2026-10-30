// Pass 4 synthetic campaign: confirms real correct-answer validation,
// 12 round transitions, timer stages and shop/save invariants.
// This is NOT a measurement of player win rates.
import assert from "node:assert/strict";
import { tile, answerFor, attemptBank } from "./engine.mjs";
import {
  newRogueliteRun, targetForRound, bankSecondsForRound,
  recordRogueliteBank, advanceRogueliteRound, validRogueliteRun
} from "./roguelite.mjs";
import { bossTargetFor } from "./bosses.mjs";
import {
  enterRogueliteShop, restoreShopState, ITEM_BY_ID
} from "./shop.mjs";
import { activeEnchantmentCount } from "./enchantments.mjs";
function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x,1664525)+1013904223)>>>0;
    return x/4294967296;
  };
}
const rng=seeded(614);
let campaign=newRogueliteRun(0,rng);
const clocks=[60,60,60,50,50,50,40,40,40,30,30,30];
for(let round=1;round<=12;round++){
  assert.equal(campaign.run.round,round);
  assert.equal(campaign.run.phase,"playing");
  assert.equal(bankSecondsForRound(round),clocks[round-1]);
  const target=bossTargetFor(campaign.run,targetForRound(round));
  const power=tile(2,target);
  const board=campaign.board.slice();
  board[0]=power;
  const answer=attemptBank(board,0,answerFor(power).toString());
  assert.equal(answer.status,"success","Correct bank round "+round);
  const result=recordRogueliteBank(campaign.run,0,power,{
    merged:false,movesLeft:8
  });
  assert.equal(result.cleared,true);
  campaign={...campaign,board:answer.board,
    score:result.roundScore,run:result.run};
  assert.ok(validRogueliteRun(campaign.run));
  if(round===12){
    assert.equal(campaign.run.phase,"victory");
  }else{
    assert.equal(campaign.run.phase,"round-clear");
    campaign=enterRogueliteShop(campaign,rng);
    assert.equal(campaign.run.phase,"shop");
    assert.ok(campaign.run.shop.consumables.filter(
      id=>ITEM_BY_ID[id]?.rare).length<=1);
    campaign=advanceRogueliteRound(campaign,rng);
    assert.equal(activeEnchantmentCount(campaign.enchantments),0);
    assert.equal(campaign.banked.length,0);
    assert.equal(campaign.locked.length,0);
    assert.equal(campaign.movesLeft,10);
  }
}
// Old item prices survive new economy without a refund or migration glitch.
const old={...newRogueliteRun(0,()=>.5).run,coins:11,
  inventory:{permanents:[null,null],
    consumables:[{id:"mint-runestone",pricePaid:8},null]}};
const migrated=restoreShopState(old);
assert.deepEqual(migrated.inventory.consumables[0],
  {id:"mint-runestone",pricePaid:8});
assert.equal(migrated.coins,11);
console.log("Pass 4 synthetic 12-round campaign and legacy economy passed.");
