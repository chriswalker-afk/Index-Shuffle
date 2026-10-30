import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID,
  emptyRunStats, restoreRunStats, recordRunStats, recordSuccessfulSlide,
  addEarnedToRunStats, emptyAchievementProfile, restoreAchievementProfile,
  recordAchievementEvent, progressForAchievement, countUnlocked,
  isFinishedRun, finalScoreSummary
} from "./milestones.mjs";
import { newRogueliteRun, advanceRogueliteRound } from "./roguelite.mjs";
import { enterRogueliteShop } from "./shop.mjs";

const date = Date.UTC(2026, 9, 30);
const allIds = ACHIEVEMENTS.map(item => item.id);
assert.equal(ACHIEVEMENTS.length, 16);
assert.equal(new Set(allIds).size, ACHIEVEMENTS.length);
for (const item of ACHIEVEMENTS) {
  assert.equal(ACHIEVEMENT_BY_ID[item.id], item);
  assert.ok(item.goal > 0 && Number.isSafeInteger(item.goal));
  assert.ok(item.name.length > 3 && item.description.length > 14 && item.icon.length);
}
let profile = emptyAchievementProfile();
assert.equal(countUnlocked(profile), 0);
assert.equal(progressForAchievement(profile, "boss-hunter"), 0);
assert.throws(() => progressForAchievement(profile, "unknown"), RangeError);
assert.deepEqual(restoreAchievementProfile(null), emptyAchievementProfile());

const firstBank = {
  type: "bank", points: 1, exponent: 1, goldTier: 1,
  goldCoins: 1, blockersDestroyed: 0
};
const before = structuredClone(profile);
let update = recordAchievementEvent(profile, firstBank, date);
assert.deepEqual(update.unlockedNow, ["first-deposit", "gold-digger"]);
assert.equal(update.profile.totals.banks, 1);
assert.equal(update.profile.totals.goldBanks, 1);
assert.equal(update.profile.totals.goldCoinsBanked, 1);
assert.equal(countUnlocked(update.profile), 2);
assert.deepEqual(profile, before, "Awarding an event must not mutate an earlier profile");
profile = update.profile;
assert.equal(profile.unlocked["gold-digger"], date);
assert.equal(progressForAchievement(profile, "gold-rush"), 1);
assert.equal(progressForAchievement(profile, "first-deposit"), 1);
assert.deepEqual(recordAchievementEvent(profile, {
  ...firstBank, goldTier: 0, goldCoins: 0, exponent: 2, points: 2
}, date + 1).unlockedNow, [], "Already-earned awards never unlock twice");

const doubleBank = {
  type: "bank", points: 12, exponent: 5, goldTier: 2,
  goldCoins: 4, blockersDestroyed: 3
};
update = recordAchievementEvent(profile, doubleBank, date + 1);
assert.deepEqual(update.unlockedNow, [
  "double-mint", "high-power", "ten-pointer", "block-wrecker"
]);
profile = update.profile;
assert.equal(profile.totals.maxExponent, 5);
assert.equal(profile.totals.bestBankPoints, 12);
assert.equal(profile.totals.goldCoinsBanked, 5);
assert.equal(profile.totals.blockersDestroyed, 3);
assert.equal(profile.totals.doubleGoldBanks, 1);
assert.equal(progressForAchievement(profile, "block-wrecker"), 3);
assert.equal(progressForAchievement(profile, "gold-rush"), 5);

// Gold Rush is cumulative even when the balance has been spent in a shop.
for (let i = 0; i < 3; i++) {
  profile = recordAchievementEvent(profile,
    { ...doubleBank, points: 2, exponent: 2, goldTier: 1,
      goldCoins: 4, blockersDestroyed: 0 }, date + 2 + i).profile;
}
assert.equal(profile.totals.goldCoinsBanked, 17);
assert.equal(profile.unlocked["gold-rush"], date + 4);

// A round clear is registered at the final correct bank, not at the shop
// or through rendering. Boss and efficient/close-call records are separate.
update = recordAchievementEvent(profile,
  { type: "round-clear", boss: false, victory: false, movesLeft: 5 }, date + 10);
assert.deepEqual(update.unlockedNow, ["first-clear", "move-saver"]);
profile = update.profile;
update = recordAchievementEvent(profile,
  { type: "round-clear", boss: true, victory: false, movesLeft: 1 }, date + 11);
assert.deepEqual(update.unlockedNow, ["boss-buster", "close-call"]);
profile = update.profile;
assert.equal(profile.totals.bossWins, 1);
assert.equal(profile.totals.closeClears, 1);
for (let i = 0; i < 2; i++) {
  update = recordAchievementEvent(profile,
    { type: "round-clear", boss: true, victory: false, movesLeft: 3 },
    date + 12 + i);
  profile = update.profile;
}
assert.equal(profile.totals.bossWins, 3);
assert.equal(profile.unlocked["boss-hunter"], date + 13);
update = recordAchievementEvent(profile,
  { type: "round-clear", boss: true, victory: true, movesLeft: 2 }, date + 14);
assert.deepEqual(update.unlockedNow, ["index-master"]);
profile = update.profile;
assert.equal(profile.totals.victories, 1);
assert.equal(profile.totals.roundClears, 5);

// Shop purchases and consumable use are one-off confirmed events.
for (let i = 0; i < 3; i++) {
  update = recordAchievementEvent(profile,
    { type: "purchase", fullBuild: i === 1 }, date + 20 + i);
  profile = update.profile;
}
assert.equal(profile.totals.purchases, 3);
assert.equal(profile.totals.fullBuilds, 1);
assert.ok(profile.unlocked["shop-regular"]);
assert.ok(profile.unlocked["full-house"]);
for (let i = 0; i < 5; i++) {
  profile = recordAchievementEvent(profile, { type: "consumable" },
    date + 30 + i).profile;
}
assert.equal(profile.totals.consumablesUsed, 5);
assert.ok(profile.unlocked.toolbox);
assert.equal(countUnlocked(profile), ACHIEVEMENTS.length,
  "All 16 achievements have at least one attainable event path");

// End-of-run record is awarded once by the app's resultsFinalized guard.
update = recordAchievementEvent(profile, {
  type: "finish", score: 310
}, date + 40);
profile = update.profile;
assert.equal(profile.totals.runsFinished, 1);
assert.equal(profile.totals.bestRunScore, 310);
profile = recordAchievementEvent(profile,
  { type: "finish", score: 280 }, date + 50).profile;
assert.equal(profile.totals.bestRunScore, 310);
assert.equal(profile.totals.runsFinished, 2);
const restored = restoreAchievementProfile(JSON.parse(JSON.stringify(profile)));
assert.deepEqual(restored, profile);
assert.equal(countUnlocked(restored), 16);
assert.equal(restoreAchievementProfile({
  totals: { banks: -4, bossWins: "100", goldCoinsBanked: 7 },
  unlocked: { "boss-buster": "yes", "gold-digger": 13,
    "invalid-award": 18 }
}).totals.banks, 0);
assert.equal(restoreAchievementProfile({
  unlocked: { "boss-buster": "yes", "gold-digger": 13 }
}).unlocked["boss-buster"], undefined);
assert.equal(restoreAchievementProfile({
  unlocked: { "gold-digger": 13 }
}).unlocked["gold-digger"], 13);

assert.throws(() => recordAchievementEvent(profile, {
  type: "bank", points: -1, exponent: 2, goldTier: 0,
  goldCoins: 0, blockersDestroyed: 0
}), RangeError);
assert.throws(() => recordAchievementEvent(profile,
  { type: "round-clear", boss: 1, victory: false, movesLeft: 3 }), RangeError);
assert.throws(() => recordAchievementEvent(profile, { type: "unknown" }), RangeError);
assert.throws(() => recordAchievementEvent(profile, firstBank, 0), RangeError);

// Run totals are separate from permanent achievements and survive round
// changes. Invalid/legacy snapshots restore safe defaults without wipes.
let stats = emptyRunStats();
stats = recordSuccessfulSlide(stats);
stats = recordSuccessfulSlide(stats);
stats = recordRunStats(stats, firstBank);
stats = recordRunStats(stats, doubleBank);
stats = recordRunStats(stats, {
  type: "round-clear", boss: true, victory: false, movesLeft: 2
});
stats = recordRunStats(stats, { type: "purchase", fullBuild: true });
stats = recordRunStats(stats, { type: "consumable" });
stats = addEarnedToRunStats(stats, ["gold-digger", "boss-buster", "boss-buster"]);
assert.equal(stats.slides, 2);
assert.equal(stats.banks, 2);
assert.equal(stats.goldBanks, 2);
assert.equal(stats.goldCoinsBanked, 5);
assert.equal(stats.highestExponent, 5);
assert.equal(stats.bestSingleBank, 12);
assert.equal(stats.blockersDestroyed, 3);
assert.equal(stats.roundsCleared, 1);
assert.equal(stats.bossesDefeated, 1);
assert.equal(stats.itemsBought, 1);
assert.equal(stats.consumablesUsed, 1);
assert.deepEqual(stats.awards, ["gold-digger", "boss-buster"]);
assert.deepEqual(restoreRunStats(JSON.parse(JSON.stringify(stats))), stats);
assert.deepEqual(restoreRunStats(undefined), emptyRunStats());
assert.deepEqual(restoreRunStats({
  banks: -3, highestExponent: "99", awards: ["gold-digger", "unknown-award"]
}).awards, ["gold-digger"]);
assert.equal(restoreRunStats({ banks: -3, highestExponent: "99" }).banks, 0);

// Both modes show a finished score screen. Classic uses its existing best;
// Roguelite uses the cumulative run score, not the last round's score.
const classic = {
  over: true, score: 55, best: 80, moves: 12,
  banked: ["2-2", "3-3"], stats
};
assert.equal(isFinishedRun("classic", classic), true);
assert.equal(isFinishedRun("classic", { ...classic, over: false }), false);
const classicResult = finalScoreSummary("classic", classic);
assert.equal(classicResult.score, 55);
assert.equal(classicResult.best, 80);
assert.equal(classicResult.slides, 12);
assert.equal(classicResult.banks, 2);
assert.equal(classicResult.highestExponent, 5);
assert.equal(classicResult.coinsHeld, null);
assert.equal(classicResult.won, false);
assert.throws(() => finalScoreSummary("classic", { ...classic, over: false }),
  RangeError);

const rng = () => 0;
const game = newRogueliteRun(0, rng);
assert.deepEqual(game.run.stats, emptyRunStats());
game.run.stats = stats;
game.run.phase = "victory";
game.run.round = 12;
game.run.totalScore = 220;
game.run.totalSlides = 77;
game.run.coins = 12;
game.run.totalCoinsEarned = 42;
game.score = 24; // last round only, intentionally NOT the final score.
assert.equal(isFinishedRun("roguelite", game), true);
const rogueResult = finalScoreSummary("roguelite", game, profile);
assert.equal(rogueResult.score, 220);
assert.equal(rogueResult.best, 310);
assert.equal(rogueResult.roundsCleared, 12);
assert.equal(rogueResult.round, 12);
assert.equal(rogueResult.coinsEarned, 42);
assert.equal(rogueResult.coinsHeld, 12);
assert.deepEqual(rogueResult.awards, ["gold-digger", "boss-buster"]);
assert.equal(rogueResult.won, true);
const failed = {
  ...game, over: true,
  run: { ...game.run, round: 4, phase: "playing", totalScore: 45,
    stats: { ...stats, roundsCleared: 3, bossesDefeated: 1 } }
};
const failedResult = finalScoreSummary("roguelite", failed);
assert.equal(failedResult.score, 45);
assert.equal(failedResult.roundsCleared, 3);
assert.equal(failedResult.won, false);
const legacyRunResult = finalScoreSummary("roguelite", {
  ...failed, run: { ...failed.run, round: 7, stats: undefined }
});
assert.equal(legacyRunResult.roundsCleared, 6);
assert.equal(legacyRunResult.bossesDefeated, 2,
  "A pre-achievement save in round 7 must show the two bosses already cleared");
assert.equal(isFinishedRun("roguelite", { ...game, over: false,
  run: { ...game.run, phase: "round-clear", round: 5 } }), false);

const between = newRogueliteRun(0, rng);
between.run.stats = stats;
between.run.phase = "round-clear";
between.run.lastRoundReward = { bankCoins: 0, moveCoins: 0,
  unusedMoves: 0, totalCoins: 0 };
const advanced = advanceRogueliteRound(enterRogueliteShop(between, rng), rng);
assert.deepEqual(advanced.run.stats, stats,
  "Moving between rounds must not wipe the run's achievement and scoring records");
assert.deepEqual(newRogueliteRun(0, rng).run.stats, emptyRunStats(),
  "A new run starts with empty stats but the lifetime profile is stored separately");

// Browser wiring: equal-size mode cards, results shown for both loss and
// victory, persisted one-time finish, achievements modal and notifications,
// correct-bank/round-clear/shop/consumable hooks.
const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
const app = readFileSync("app.mjs", "utf8");
const ui = readFileSync("results-ui.mjs", "utf8");
assert.match(html, /id="modeClassic" class="mode-option"/);
assert.match(html, /id="titleScreen"/);
assert.match(html, /id="newGameScreen"/);
assert.match(html, /id="continueScreen"/);
assert.match(html, /id="modeRoguelite" class="mode-option"/);
assert.match(html, /One continuous game/);
assert.match(html, /Clear 12 rounds, face bosses/);
assert.match(css, /\.mode-picker \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /min-height: 106px; height: 100%/);
assert.match(css, /\.choice-screen \.mode-picker \.mode-option \{/);
for (const id of [
  "resultsDialog", "resultsFinalScore", "resultsStats", "resultsAwardsSection",
  "resultsPlayAgain", "resultsClose", "resultsBack", "viewResults",
  "resultsBestScore", "achievementOpen", "achievementToast", "achievementsDialog",
  "achievementsGrid", "achievementsClose", "achievementsProgressBar",
  "resultsAllAchievements"
]) {
  assert.match(html, new RegExp('id="' + id + '"'));
}
assert.match(app, /const ACHIEVEMENT_SAVE = "index-shuffle-roguelite-achievements-v1"/);
assert.match(app, /state\.resultsFinalized = true/);
assert.match(app, /awardRunEvent\(bankEvent\)/);
assert.match(app, /awardRunEvent\(\{\s*type: "round-clear"/);
assert.match(app, /awardRunEvent\(\{ type: "consumable" \}\)/);
assert.match(app, /if \(kind === "purchase"\)/);
assert.match(app, /recordSuccessfulSlide\(state\.run\.stats\)/);
assert.match(app, /renderFinalScreen\(mode, state, achievementProfile\)/);
assert.match(app, /renderNavigation\(screen, saved\("classic"\), saved\("roguelite"\)/);
assert.match(app, /state\.resultsDismissed = true/);
assert.match(app, /openAchievementGallery\(achievementProfile\)/);
assert.match(app, /if \(screen !== "game" \|\| \$\("shopDialog"\)\.open/);
assert.match(ui, /dialog\.showModal\(\)/);
assert.match(ui, /state\.resultsDismissed/);
assert.match(ui, /progressForAchievement\(profile, achievement\)/);
assert.match(ui, /Coins remaining/);
assert.match(ui, /TOTAL RUN SCORE/);
assert.match(html, /results-ui\.mjs|app\.mjs/);
console.log("All Index Shuffle mode card, results and achievement tests passed.");
