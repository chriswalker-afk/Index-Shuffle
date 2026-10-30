export const SIZE=4, BASES=[2,3,5];
export const key=t=>t.base+"-"+t.exp;
export const tile=(base,exp=1)=>({base,exp});
export function slide(board,direction){
  const next=Array(16).fill(null);let merges=[];
  for(let line=0;line<4;line++){
    const ids=Array.from({length:4},(_,i)=>direction==="left"?line*4+i:direction==="right"?line*4+3-i:direction==="up"?i*4+line:(3-i)*4+line);
    const packed=ids.map(i=>board[i]).filter(Boolean),out=[];
    for(let i=0;i<packed.length;i++){
      const a=packed[i],b=packed[i+1];
      if(b&&a.base===b.base){const t=tile(a.base,a.exp+b.exp);out.push(t);merges.push(t);i++;}
      else out.push({...a});
    }
    ids.forEach((id,i)=>next[id]=out[i]||null);
  }
  return {board:next,merges,changed:next.some((t,i)=>keyOrNull(t)!==keyOrNull(board[i]))};
}
function keyOrNull(t){return t?key(t):"";}
export function canMove(board,banked){
  if(board.some(t=>!t))return true;
  if(board.some(t=>t.exp>=2&&!banked.has(key(t))))return true;
  return ["up","down","left","right"].some(d=>slide(board,d).changed);
}
export function spawn(board,discovered,rng=Math.random){
  const empty=board.map((t,i)=>t?null:i).filter(i=>i!==null);
  if(!empty.length)return board.slice();
  const pool=Array.from(discovered).map(k=>{const [base,exp]=k.split("-").map(Number);return tile(base,exp);}).filter(t=>BASES.includes(t.base)&&t.exp>=2&&t.exp<=6);
  let options=BASES.map(base=>({t:tile(base),w:85/BASES.length}));
  const squares=pool.filter(t=>t.exp===2),cubes=pool.filter(t=>t.exp===3),higher=pool.filter(t=>t.exp>=4);
  if(squares.length)options.push(...squares.map(t=>({t,w:11/squares.length})));
  if(cubes.length)options.push(...cubes.map(t=>({t,w:3/cubes.length})));
  if(higher.length)options.push(...higher.map(t=>({t,w:1/higher.length})));
  const total=options.reduce((s,o)=>s+o.w,0);
  let pick=rng()*total,chosen=options[0].t;
  for(const o of options){pick-=o.w;if(pick<0){chosen=o.t;break;}}
  const next=board.slice();next[empty[Math.floor(rng()*empty.length)]]=tile(chosen.base,chosen.exp);return next;
}
export function initial(rng=Math.random){
  let board=Array(16).fill(null);const found=new Set();
  for(let i=0;i<3;i++)board=spawn(board,found,rng);
  return board;
}
export function answerFor(t){return BigInt(t.base)**BigInt(t.exp);}
export function scoreFor(t){return t.exp*10+(t.exp-1)*5;}
export function checkAnswer(t,input){try{return /^\d+$/.test(input.trim())&&BigInt(input.trim())===answerFor(t);}catch{return false;}}
