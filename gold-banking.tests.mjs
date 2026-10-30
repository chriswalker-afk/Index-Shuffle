import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, key, isBankable, bankReplacement, attemptBank, slide,
  creditCorrectBank, checkAnswer
} from "./engine.mjs";
import {
  newRogueliteRun, goldForBank, goldTier, scoreForRoguelitePower,
  recordRogueliteBank
} from "./roguelite.mjs";
import { bankItemBonuses, useConsumable } from "./effects.mjs";

const rng = () => 0;
const blank = () => Array(16).fill(null);
const banked = new Set(), locked = new Set();
const plain3 = tile(3);
const golden3 = { ...tile(3), gold: 1 };
const goldenSquare = { ...tile(3, 2), gold: 1 };

assert.equal(isBankable(plain3, banked, 0, locked), false,
  "Classic base-1 numbers stay unbankable");
assert.equal(isBankable(golden3, banked, 0, locked), true,
  "The golden base-1 card must open a banking question");
assert.equal(isBankable(goldenSquare, banked, 0, locked), true,
  "Golden powers remain bankable");
assert.equal(isBankable(golden3, new Set(["3-1"]), 0, locked), false,
  "Gold cannot bypass the one-bank-per-base-and-exponent restriction");
assert.equal(isBankable(goldenSquare, new Set(["3-2"]), 0, locked), false,
  "Previously banked powers are unavailable even when newly golden");
assert.equal(isBankable(tile(3, 2), new Set(["3-2"]), 0, locked), false,
  "Ordinary powers still respect the once-per-base-exponent rule");
assert.equal(isBankable(golden3, banked, 0, new Set([0])), false,
  "Banking cooldown still applies to golden base-1 cards");
assert.equal(isBankable({ ...plain3, gold: 0 }, banked, 0, locked), false);

assert.equal(checkAnswer(golden3, "3"), true);
assert.equal(checkAnswer(golden3, "9"), false);
assert.deepEqual(bankReplacement(golden3, new Set(), rng), tile(3));
assert.throws(() => bankReplacement(plain3, new Set(), rng), RangeError);
const firstBoard = blank();
firstBoard[0] = golden3;
assert.equal(attemptBank(firstBoard, 0, "9").status, "incorrect");
assert.deepEqual(firstBoard[0], golden3,
  "Incorrect maths answers never consume gold");
const answer = attemptBank(firstBoard, 0, "3");
assert.equal(answer.status, "success");
assert.equal(answer.powerKey, "3-1");
assert.deepEqual(answer.board[0], tile(3),
  "Banking consumes gold and leaves an ordinary base tile");
assert.equal(goldTier(answer.board[0]), 0);
assert.equal(answer.creditedMerge, false,
  "Direct banking a golden number does not simulate a merge");
assert.equal(creditCorrectBank(8, 0, answer.creditedMerge).earned, 0);
assert.equal(isBankable(answer.board[0], new Set(), 0), false,
  "Direct banking is one-use only; no repeated free cash");
const repeated = attemptBank(firstBoard, 0, "3", { banked: new Set(["3-1"]) });
assert.equal(repeated.status, "unavailable");
const repeatedSquare = attemptBank([goldenSquare, ...blank().slice(1)], 0,
  "9", { banked: new Set(["3-2"]) });
assert.equal(repeatedSquare.status, "unavailable",
  "Repeated merged gold cannot earn score, coins, credit or blocker damage");
assert.equal(isBankable({ ...tile(5, 2), gold: 2 },
  new Set(["5-2"]), 0), false,
  "Double gold also respects one bank per power");
assert.equal(isBankable({ ...tile(3, 3), gold: 1 },
  new Set(["3-2"]), 0), true,
  "The same base with a different exponent remains an eligible new power");
assert.equal(isBankable({ ...tile(5, 2), gold: 1 },
  new Set(["3-2"]), 0), true,
  "The same exponent with a different base is a distinct banking opportunity");
const lockedBank = attemptBank(firstBoard, 0, "3", { locked: new Set([0]) });
assert.equal(lockedBank.status, "unavailable");

assert.equal(scoreForRoguelitePower(golden3), 1,
  "A correctly banked golden base-1 card scores its exponent");
assert.equal(scoreForRoguelitePower(goldenSquare), 2);
assert.throws(() => scoreForRoguelitePower(plain3), RangeError,
  "Ordinary base tiles remain ineligible for scoring");
assert.equal(goldForBank(golden3, false), 1);
assert.equal(goldForBank(goldenSquare, false), 1);
assert.equal(goldForBank(goldenSquare, true), 2);
assert.equal(goldForBank({ ...tile(7, 4), gold: 1 }, true), 3);
assert.equal(goldForBank({ ...tile(3, 2), gold: 2 }, true), 4);
assert.equal(goldForBank(tile(3, 2), true), 0);

let run = newRogueliteRun(0, rng).run;
const bonuses = bankItemBonuses(run, golden3, false);
assert.equal(bonuses.score, 1);
const recorded = recordRogueliteBank(run, 0, golden3, {
  merged: answer.creditedMerge, movesLeft: 8, scoreOverride: bonuses.score,
  extraCoins: bonuses.extraCoins, counters: bonuses.counters
});
assert.equal(recorded.points, 1);
assert.equal(recorded.bankGold, 1);
assert.equal(recorded.run.coins, 1);
assert.equal(recorded.run.totalScore, 1);
assert.equal(recorded.run.scoredBanks, 1);
assert.equal(recorded.cleared, false);
// A later copy of 3¹ cannot be banked again this round; it cannot call
// the scoring function through the actual banking gate.
assert.equal(attemptBank(firstBoard, 0, "3",
  { banked: new Set([answer.powerKey]) }).status, "unavailable");

run.inventory.permanents[0] = { id: "golden-calculator", pricePaid: 7 };
const enhanced = bankItemBonuses(run, golden3, false);
assert.equal(enhanced.extraCoins, 1,
  "Golden Calculator applies to directly banked gold as well");
const enhancedBank = recordRogueliteBank(run, 0, golden3, {
  merged: false, scoreOverride: enhanced.score, extraCoins: enhanced.extraCoins,
  counters: enhanced.counters
});
assert.equal(enhancedBank.bankGold, 2);
assert.equal(enhancedBank.run.coins, 2);

// Merging still offers a higher coin payout, including double gold.
const single = blank();
single[0] = golden3;
single[1] = tile(3);
const mergedOnce = slide(single, "left");
assert.deepEqual(mergedOnce.board[0], goldenSquare);
assert.equal(attemptBank(mergedOnce.board, 0, "9",
  { mergeReady: new Set([0]) }).creditedMerge, true);
assert.equal(goldForBank(mergedOnce.board[0], true), 2);
const double = blank();
double[0] = golden3;
double[1] = golden3;
const mergedTwice = slide(double, "left");
assert.equal(goldTier(mergedTwice.board[0]), 2);
assert.equal(goldForBank(mergedTwice.board[0], true), 4);

// A Gold Touch item makes even an ordinary exponent-1 tile bankable.
// Consumables do not award coins or points until the answer is correct.
const itemState = newRogueliteRun(0, rng);
itemState.board = blank();
itemState.board[2] = tile(5);
itemState.run.inventory.consumables[0] = { id: "gold-touch", pricePaid: 4 };
const gilded = useConsumable(itemState, 0, [2]);
assert.equal(gilded.score, 0);
assert.equal(gilded.run.coins, 0);
assert.equal(isBankable(gilded.board[2], new Set(), 2), true);
assert.equal(attemptBank(gilded.board, 2, "5").status, "success");

// UI and theme regression checks: the whole tile looks golden and its
// coin and sheen layers cannot swallow the pointer/click.
const html = readFileSync("index.html", "utf8");
const style = readFileSync("styles.css", "utf8");
const app = readFileSync("app.mjs", "utf8");
assert.match(style, /\.base3 \{ background: #ea876d; \}/);
assert.doesNotMatch(style, /\.base3 \{ background: #ffce80; \}/);
assert.match(style, /\.cell\.gold-tile, \.tile-ghost\.gold-tile \{/);
assert.match(style, /background:\s*linear-gradient\(113deg,/);
assert.match(style, /\.cell\.gold-tile\.bankable \{/);
assert.match(style, /\.cell\.gold-tile\.gold-double/);
assert.match(style, /\.tile-gold-mark \{/);
assert.match(style, /pointer-events: none;/);
assert.match(app, /const available = isBankable\(t, banked, i, locked,/);
assert.match(app, /if \(available && !selection\) \{/);
assert.match(app, /button\.addEventListener\("click", \(\) => openBank\(i\)\)/);
assert.match(app, /const blocked = \(t\.exp >= 2 \|\| gold > 0\)/);
assert.match(app, /hazard-counter-v1/);
assert.match(html, /golden 3¹/i);
assert.match(html, /<b>◉<\/b>/);
assert.match(html, /styles\.css\?v=hazard-counter-v1-art-pass5/);
assert.match(html, /app\.mjs\?v=hazard-counter-v1-art-pass5/);
console.log("All Index Shuffle gold-banking and metallic-tile regression tests passed.");
