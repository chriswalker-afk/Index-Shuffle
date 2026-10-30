import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSafeStore } from "./save-safety.mjs";
import { validSavedBoard, sanitiseSavedGame } from "./save-validation.mjs";
import { resumableSave } from "./navigation.mjs";
import { newRogueliteRun } from "./roguelite.mjs";

const saved=new Map();
const storage={
  getItem:key=>saved.get(key) ?? null,
  setItem:(key,value)=>saved.set(key,value)
};
const store=createSafeStore(()=>storage);
assert.equal(store.readJSON("classic"),null);
assert.equal(store.status(),null);
const sample={board:Array(16).fill(null),score:0,movesLeft:10};
sample.board[0]={base:2,exp:1};
assert.equal(store.writeJSON([["classic",sample],["achievements",{earned:[]}]],
  {recover:true}),true);
assert.deepEqual(store.readJSON("classic"),sample);
assert.deepEqual(JSON.parse(saved.get("achievements")),{earned:[]});
assert.equal(store.status(),null);
saved.set("invalid","{not a valid JSON save");
assert.equal(store.readJSON("invalid"),null);
assert.equal(store.status(),"corrupt");
assert.equal(store.readJSON("classic").movesLeft,10);
store.writeJSON([["invalid",{board:[]}]],{recover:true});
assert.deepEqual(store.readJSON("invalid"),{board:[]});
assert.equal(store.status(),null);

// Simulate private browsing / blocked localStorage (including throwing when
// the storage property itself is accessed). Play remains possible in-tab.
let blocked=true;
const unavailable=createSafeStore(()=>{
  if(blocked)throw new Error("SecurityError");
  return storage;
});
assert.equal(unavailable.readText("mode"),null);
assert.equal(unavailable.status(),"unavailable");
assert.equal(unavailable.writeJSON([["rogue",sample],["achievements",{earned:["a"]}]],
  {recover:true}),false);
assert.deepEqual(unavailable.readJSON("rogue"),sample,
  "A failed durable write preserves an in-tab backup");
assert.equal(unavailable.status(),"unavailable");
blocked=false;
assert.equal(unavailable.writeJSON([["rogue",{...sample,score:9}],
  ["achievements",{earned:["a"]}]],{recover:true}),true);
assert.equal(unavailable.status(),null);
assert.equal(JSON.parse(storage.getItem("rogue")).score,9);

// Quota errors must warn even if reads work, and both mode+achievements
// remain accessible until the tab is closed.
const quota=createSafeStore(()=>({
  getItem:key=>saved.get(key) ?? null,
  setItem:()=>{throw new Error("QuotaExceededError")}
}));
assert.equal(quota.writeJSON([["rogue",{...sample,score:17}]],
  {recover:true}),false);
assert.equal(quota.status(),"unavailable");
assert.equal(quota.readJSON("rogue").score,17);

// Corrupted or unsupported tile forms must not be continued or rendered.
// Legacy blockers without strength remain valid and are restored elsewhere.
assert.ok(validSavedBoard(sample.board));
const legacy=sample.board.slice();
legacy[1]={kind:"blocker",hits:1};
assert.ok(validSavedBoard(legacy));
assert.equal(validSavedBoard([null]),false);
assert.equal(validSavedBoard(Array(16).fill({base:2,exp:-5})),false);
assert.equal(validSavedBoard(Array(16).fill({base:999,exp:2})),false);
assert.equal(validSavedBoard(Array(16).fill("untrusted")),false);
assert.equal(resumableSave("classic",{...sample,board:["bad"]}),false);
const trimmed=sanitiseSavedGame({...sample,
  locked:[0,0,-1,99,"1"], mergeReady:[2,2,19],
  discovered:["2-2","2-2","<img src=x>","7-3"],
  banked:["3-2","3-2","5-no","0-3"],
  notice:"stale feedback",resultsFinalized:"yes"
});
assert.deepEqual(trimmed.locked,[0]);
assert.deepEqual(trimmed.mergeReady,[2]);
assert.deepEqual(trimmed.discovered,["2-2","7-3"]);
assert.deepEqual(trimmed.banked,["3-2"]);
assert.equal(trimmed.notice,"");
assert.equal(trimmed.resultsFinalized,false);
assert.equal(sample.board[0].base,2, "Input not mutated");
assert.throws(()=>sanitiseSavedGame({board:[]}),RangeError);
const old=newRogueliteRun(0,()=>0);
delete old.enchantments;
delete old.hazards;
assert.ok(validSavedBoard(old.board),
  "Pre-hazard/pre-Runestone boards still pass conservative validation");
const app=readFileSync("app.mjs","utf8");
const html=readFileSync("index.html","utf8");
const css=readFileSync("styles.css","utf8");
assert.match(html,/id="saveWarning"/);
assert.match(css,/\.save-warning\[hidden\]/);
assert.match(app,/createSafeStore\(\(\) => window\.localStorage\)/);
assert.match(app,/if \(screen === "game"\) persist\(\)/);
assert.match(app,/saveStore\.writeJSON\(/);
assert.match(app,/saveStore\.readText\(MODE_SAVE\)/);
assert.match(app,/lockPending\("cancel"\)/);
assert.doesNotMatch(app,/if \(event\.key === "Escape" && pending !== null\) \{\s*event\.preventDefault\(\);\s*closeBank\(\)/);
console.log("Release Pass 5A storage, save validation and Escape safety passed.");
