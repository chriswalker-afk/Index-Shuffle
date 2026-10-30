import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tile, blocker, gameEnded, canMove } from "./engine.mjs";
import { newRogueliteRun } from "./roguelite.mjs";
import { canActivateConsumable, useConsumable } from "./effects.mjs";
import { rescuableConsumables, RESCUE_ITEM_IDS } from "./rescue.mjs";
import { emptyHazardLayer } from "./hazards.mjs";
import { emptyEnchantmentLayer } from "./enchantments.mjs";

const checkerboard = () => Array.from({length:16},(_,index) =>
  tile((Math.floor(index / 4) + index % 4) % 2 === 0 ? 2 : 3));
assert.equal(canMove(checkerboard(),new Set()),false,
  "A full alternating board has neither merges nor bankable powers");
function setup(id, { board=checkerboard(), banked=[], locked=[],
  movesLeft=5, hazards=emptyHazardLayer(), over=false }={}) {
  const base=newRogueliteRun(0,()=>.43);
  return { ...base, board, banked, locked, movesLeft, hazards,
    enchantments:emptyEnchantmentLayer(), over, run:{...base.run, round:7,
      inventory:{...base.run.inventory,
        consumables:[{id,pricePaid:3},null]}} };
}
const rescuable=(id,opts={}) => {
  const state=setup(id,opts);
  assert.equal(gameEnded(state.board,new Set(state.banked),
    new Set(state.locked),state.movesLeft,
    {hazards:state.hazards,enchantments:state.enchantments}),true);
  const list=rescuableConsumables(state);
  assert.equal(list.length,1,id+" is a real last-chance rescue");
  assert.equal(list[0].id,id);
  assert.equal(list[0].slot,0);
  assert.ok(RESCUE_ITEM_IDS.has(id));
  assert.equal(state.run.inventory.consumables[0].id,id,
    "Rescue preview never spends an item");
  assert.equal(state.over,opts.over===true,
    "Rescue preview never mutates state.over");
  return state;
};
rescuable("clear-space");
rescuable("block-breaker",{
  board:(()=>{const arr=checkerboard();arr[0]=blocker(0,3);return arr;})()
});
rescuable("gold-touch");
rescuable("power-surge");
rescuable("position-swap");
rescuable("hazard-eraser",{
  board:(()=>{const arr=checkerboard();arr[0]=tile(2,2);return arr;})(),
  hazards:(()=>{const arr=emptyHazardLayer();arr[0]={type:"cloudy",turnsLeft:2};return arr;})()
});
rescuable("second-chance",{
  board:(()=>{const arr=checkerboard();arr[0]=tile(2,2);return arr;})(),
  locked:[0]
});
rescuable("alchemist",{
  board:(()=>{const arr=checkerboard();arr[1]=tile(3,2);return arr;})(),
  banked:["3-2"]
});
rescuable("echo-runestone",{
  board:(()=>{const arr=checkerboard();arr[0]=tile(2,2);return arr;})(),
  banked:["2-2"]
});
// Blocked save from the previous release: a stale over flag cannot hide
// an item capable of saving the run when a legitimate move remains.
rescuable("gold-touch",{over:true});
for(const item of ["second-wind","protection","delay-tactics",
  "prism-runestone","mint-runestone","sanctuary-runestone",
  "shatter-runestone","foundry-runestone"]){
  const state=setup(item);
  assert.deepEqual(rescuableConsumables(state),[],item+" is not a free rescue");
}
assert.deepEqual(rescuableConsumables(setup("gold-touch",{movesLeft:0})),[],
  "Zero remaining moves remains an unconditional loss");
const unlocked=setup("second-chance",{
  board:(()=>{const a=checkerboard();a[0]=tile(2,2);return a;})(),
  locked:[0]
});
const after=useConsumable(unlocked,0,[0]);
assert.equal(after.run.inventory.consumables[0],null);
assert.ok(canMove(after.board,new Set(after.banked),new Set(after.locked),
  {hazards:after.hazards,enchantments:after.enchantments}));
assert.equal(after.score,unlocked.score);
assert.equal(after.run.coins,unlocked.run.coins);
assert.equal(after.movesLeft,unlocked.movesLeft);
const app=readFileSync("app.mjs","utf8");
assert.match(app,/rescuableConsumables\(state\)/);
assert.match(app,/canRescueHazardLock\(/);
assert.match(app,/board is blocked, but /);
console.log("All held-item game-over rescue scenarios passed.");
