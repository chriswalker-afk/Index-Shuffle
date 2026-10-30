import {SIZE,BASES,key,slide,spawn,initial,canMove,checkAnswer,scoreFor} from "./engine.mjs";
const $=id=>document.getElementById(id);
const glyph=n=>String(n).replace(/\d/g,d=>"⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
const saved=()=>{try{return JSON.parse(localStorage.getItem("index-shuffle-v1"));}catch{return null;}};
let state=saved();if(!state||!Array.isArray(state.board)||state.board.length!==16)state=fresh();
function fresh(){return {board:initial(),discovered:[],banked:[],score:0,best:0,moves:0,over:false};}
let pending=null;
function persist(){try{localStorage.setItem("index-shuffle-v1",JSON.stringify(state));}catch{}}
function render(){
 const banked=new Set(state.banked),discovered=new Set(state.discovered);
 $("score").textContent=state.score;$("best").textContent=state.best;$("count").textContent=state.banked.length;$("moves").textContent=state.moves;
 const board=$("board");board.innerHTML="";
 state.board.forEach((t,i)=>{const b=document.createElement("button");b.className="cell"+(t?" tile base"+t.base:"");b.setAttribute("role","gridcell");b.type="button";
  if(t){const available=t.exp>=2&&!banked.has(key(t));b.innerHTML='<span>'+t.base+(t.exp===1?'':'<sup>'+t.exp+'</sup>')+'</span>'+(available?'<i aria-hidden="true">✦</i>':'');
  b.title=available?"Bank "+t.base+" to the power "+t.exp:t.base+" to the power "+t.exp;
  b.setAttribute("aria-label",b.title+(available?", bankable":""));if(available){b.classList.add("bankable");b.addEventListener("click",()=>openBank(i));}}
  else b.disabled=true;
  board.appendChild(b);
 });
 const all=[...new Set([...state.discovered,...state.banked])].sort((a,b)=>{const [x,y]=a.split("-").map(Number),[u,v]=b.split("-").map(Number);return x-u||y-v;});
 $("collectionCount").textContent=all.length+" found";
 $("collection").innerHTML=all.length?all.map(k=>{const [base,exp]=k.split("-");return '<span class="collect '+(banked.has(k)?'done':'')+'" title="'+(banked.has(k)?'Banked':'Discovered')+'">'+base+'<sup>'+exp+'</sup> '+(banked.has(k)?'✓':'◇')+'</span>';}).join(""):'<p class="muted">Discover your first square by merging two matching bases.</p>';
 $("status").textContent=state.over?"No moves or bankable powers left. Game over!":"Tap a glowing power to bank it, or keep merging.";
 $("stage").textContent=state.over?"GAME OVER":"SURVIVAL MODE";
 persist();
}
function move(direction){
 if(state.over||pending!==null)return;
 const r=slide(state.board,direction);if(!r.changed)return;
 r.merges.forEach(t=>{if(t.exp>=2&&!state.discovered.includes(key(t)))state.discovered.push(key(t));});
 state.board=spawn(r.board,new Set(state.discovered));state.moves++;
 state.over=!canMove(state.board,new Set(state.banked));render();
}
function openBank(i){if(state.over||pending!==null)return;const t=state.board[i];if(!t||t.exp<2||state.banked.includes(key(t)))return;
 pending={i,t};$("promptTitle").textContent=t.base+glyph(t.exp)+" = ?";$("feedback").textContent="";$("answer").value="";$("modal").hidden=false;$("answer").focus();
}
function closeBank(){$("modal").hidden=true;pending=null;}
$("bankForm").addEventListener("submit",e=>{e.preventDefault();if(!pending)return;const {i,t}=pending;if(!checkAnswer(t,$("answer").value)){$("feedback").textContent="Not quite. Try multiplying "+Array(t.exp).fill(t.base).join(" × ")+".";
 $("answer").select();return;}
 if(!state.board[i]||key(state.board[i])!==key(t))return;
 state.board[i]=null;state.banked.push(key(t));state.score+=scoreFor(t);state.best=Math.max(state.best,state.score);state.over=!canMove(state.board,new Set(state.banked));closeBank();render();
});
$("close").addEventListener("click",closeBank);$("cancel").addEventListener("click",closeBank);$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeBank();});
$("new").addEventListener("click",()=>{if(!confirm("Start a new game? Your current run will be replaced."))return;const best=state.best;state=fresh();state.best=best;closeBank();render();});
const keys={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down"};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&pending!==null){closeBank();return;}if(pending!==null||["INPUT","TEXTAREA"].includes(document.activeElement.tagName))return;const dir=keys[e.key];if(dir){e.preventDefault();move(dir);}});
document.querySelectorAll("[data-dir]").forEach(b=>b.addEventListener("click",()=>move(b.dataset.dir)));
let start=null;const board=$("board");
board.addEventListener("touchstart",e=>{const t=e.touches[0];start={x:t.clientX,y:t.clientY};},{passive:true});
board.addEventListener("touchend",e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;move(Math.abs(dx)>Math.abs(dy)?dx>0?"right":"left":dy>0?"down":"up");},{passive:true});
render();
