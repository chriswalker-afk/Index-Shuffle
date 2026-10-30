import assert from "node:assert/strict";
import {tile,key,slide,spawn,canMove,checkAnswer,answerFor,scoreFor,initial} from "./engine.mjs";
const blank=()=>Array(16).fill(null);
function put(...entries){const b=blank();for(const [i,base,exp=1] of entries)b[i]=tile(base,exp);return b;}
let b=put([0,3],[1,3]);let r=slide(b,"left");assert.deepEqual(r.board[0],tile(3,2));assert.equal(r.board[1],null);assert.equal(r.merges.length,1);
b=put([0,3,2],[1,3,3],[2,3,1]);r=slide(b,"left");assert.deepEqual(r.board[0],tile(3,5));assert.deepEqual(r.board[1],tile(3,1));assert.equal(r.merges.length,1,"merged tiles cannot merge twice in the same swipe");
b=put([0,2],[1,3],[2,2]);r=slide(b,"left");assert.deepEqual(r.board[0],tile(2));assert.deepEqual(r.board[1],tile(3));assert.deepEqual(r.board[2],tile(2));
b=put([0,2],[4,2]);r=slide(b,"up");assert.equal(r.changed,false);r=slide(b,"down");assert.deepEqual(r.board[12],tile(2,2));
const discovered=new Set(["3-2"]);b=put([0,5]);let s=spawn(b,discovered,()=>0.99);assert.equal(s.filter(Boolean).length,2);assert.ok([2,3,5].includes(s.find((t,i)=>i!==0&&t)?.base));
assert.equal(initial(()=>0).filter(Boolean).length,3);
assert.equal(checkAnswer(tile(3,4),"81"),true);assert.equal(checkAnswer(tile(3,4),"80"),false);assert.equal(checkAnswer(tile(3,4),"81.0"),false);
assert.equal(answerFor(tile(5,8)),390625n);assert.ok(scoreFor(tile(3,4))>scoreFor(tile(3,2)));
const full=Array.from({length:16},(_,i)=>tile([2,3,5][(i+Math.floor(i/4))%3],2));
assert.equal(canMove(full,new Set(["2-2","3-2","5-2"])),false,"full board with no adjacent equal bases and all tiles banked ends game");
assert.equal(canMove(full,new Set()),true,"bankable tile prevents game over");
assert.equal(key(tile(3,4)),"3-4");
console.log("All Index Shuffle engine tests passed.");
