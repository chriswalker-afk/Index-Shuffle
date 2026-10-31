import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIVITY_LIMIT, ACTIVITY_TYPES, TOUR_STEPS,
  restoreActivity, appendActivity, bankMoment, describeEnding,
  chooseRunHighlight, formatShareSummary
} from "./experience.mjs";

assert.equal(TOUR_STEPS.length, 3);
for (const step of TOUR_STEPS) {
  assert.ok(step.title.length > 5);
  assert.ok(step.instruction.length > 40);
  assert.ok(step.cue.length > 5);
}
assert.deepEqual(restoreActivity(null), []);
assert.deepEqual(restoreActivity("invalid"), []);
let history = [];
for (let i = 0; i < 20; i++) history = appendActivity(history,
  "bank", "Correct bank number " + i);
assert.equal(history.length, ACTIVITY_LIMIT);
assert.equal(history[0].message, "Correct bank number 12");
assert.equal(history.at(-1).message, "Correct bank number 19");
assert.ok(ACTIVITY_TYPES.includes("runestone"));
const earlier = history;
history = appendActivity(history, "hazard", "Void reduced a power.");
assert.equal(earlier.at(-1).message, "Correct bank number 19",
  "Adding to a history must never mutate an earlier saved array");
assert.deepEqual(appendActivity(history,"fake-type","unknown"),history);
assert.deepEqual(restoreActivity([{type:"shop",message:" Bought upgrade "},
  {type:"bank",message:"<img src=x onerror=alert(1)>"},null,
  {type:"invalid",message:"discard me"}]),
  [{type:"shop",message:"Bought upgrade"},
   {type:"bank",message:"<img src=x onerror=alert(1)>"}],
  "History keeps literal text, not executable DOM markup");
assert.ok(appendActivity([],"item","x".repeat(300))[0].message.length <= 190);
assert.equal(bankMoment({points:9,coins:2,moves:1,blockers:2}),
  "✓ +9 points · ◉ +2 gold · +1 move · 2 blockers broken");
assert.equal(bankMoment({points:0}),"✓ Correct bank");
assert.equal(bankMoment({points:4}),"✓ +4 points");

const rogue = { score:135, won:false, round:7,
  roundsCleared:6,bossesDefeated:2,banks:23,slides:36,
  bestSingleBank:14,highestExponent:5,
  blockersDestroyed:2,coinsEarned:17,coinsHeld:5 };
const out = describeEnding("roguelite",{movesLeft:0,run:{phase:"playing"}},rogue);
assert.equal(out.title,"Out of moves");
assert.match(out.detail,/bank two merged powers/);
const trapped=describeEnding("roguelite",{movesLeft:4,over:true},rogue);
assert.equal(trapped.title,"No legal actions left");
const won=describeEnding("roguelite",{movesLeft:2,run:{phase:"victory"}},
  {...rogue,won:true});
assert.equal(won.title,"Numberworld conquered");
assert.equal(chooseRunHighlight("roguelite",rogue),"Standout bank: +14 points.");
assert.match(chooseRunHighlight("roguelite",{...rogue,won:true}),/Twelve rounds/);
assert.equal(chooseRunHighlight("classic",{slides:0,banks:0}),
  "Your next run starts with a fresh board.");
const summary=formatShareSummary("roguelite",rogue,out);
assert.match(summary,/INDEX SHUFFLE · Roguelike/);
assert.match(summary,/Score: 135/);
assert.match(summary,/Rounds cleared: 6\/12/);
assert.match(summary,/Bosses defeated: 2\/4/);
assert.match(summary,/Gold earned: 17/);
assert.match(summary,/Best bank: \+14 points/);
assert.match(summary,/https:\/\/chriswalker-afk.github.io\/Index-Shuffle\//);
const classic=formatShareSummary("classic",{...rogue,score:70},trapped);
assert.match(classic,/INDEX SHUFFLE · Classic/);
assert.doesNotMatch(classic,/Bosses defeated/);

// The optional tour is not a modal. The game stays playable and existing
// save keys, score, hazards and achievement events remain unchanged.
const app=readFileSync("app.mjs","utf8");
const html=readFileSync("index.html","utf8");
const css=readFileSync("styles.css","utf8");
const resultsUI=readFileSync("results-ui.mjs","utf8");
for (const id of ["gameTour","coachPanel","coachNext","coachSkip",
  "coachProgress","coachTitle","coachInstruction","coachCue",
  "activityDetails","activityList","activityEmpty","rewardToast",
  "resultsEndingTitle","resultsEndingDetail","resultsHighlight",
  "resultsShareText","resultsCopy","resultsCopyStatus"]) {
  assert.match(html,new RegExp('id="' + id + '"'),id + " missing");
}
assert.match(app,/tourVisible = !tourSeen/);
assert.match(app,/state\.activity = restoreActivity\(state\.activity\)/);
assert.match(app,/addActivity\("bank"/);
assert.match(app,/addActivity\("gold"/);
assert.match(app,/addActivity\("blocker"/);
assert.match(app,/renderActivity\(\)/);
assert.match(app,/showMoment\("bank", bankMoment\(/);
assert.match(app,/saveStore\.writeEntries\(\[\[TOUR_SEEN_SAVE, "done"\]\]\)/);
assert.match(app,/navigator\.clipboard\.writeText\(text\)/);
assert.match(resultsUI,/describeEnding\(mode, state, summary\)/);
assert.match(resultsUI,/chooseRunHighlight\(mode, summary\)/);
assert.match(resultsUI,/formatShareSummary\(mode, summary, ending\)/);
assert.match(css,/\.coach-panel/);
assert.match(css,/\.activity-list/);
assert.match(css,/\.results-ending/);
assert.match(css,/\.results-dialog\.victory \.results-score-hero/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(html,/app\.mjs\?v=round-intermission-v1/);
assert.match(html,/styles\.css\?v=round-intermission-v1/);
console.log("Pass 5B tour, activity, moment and score summary tests passed.");
