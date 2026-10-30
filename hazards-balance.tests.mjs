import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tile, blocker, isBankable, canMove, attemptBank, adjacentIndices
} from "./engine.mjs";
import {
  HAZARD_DIFFICULTY, HAZARD_TYPES, hazardDifficulty, placeHazard,
  emptyHazardLayer, resolveSlideHazards, progressHazardRound,
  activeHazardCount, removeHazard, canRescueHazardLock
} from "./hazards.mjs";
import { newRogueliteRun } from "./roguelite.mjs";
import { applyThreeCurse } from "./bosses.mjs";
import { canActivateConsumable, consumableTargets, useConsumable } from "./effects.mjs";

function boardOf(...entries) {
  const board = Array(16).fill(null);
  for (const [i, value] of entries) board[i] = value;
  return board;
}
const seeded = seed => {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
};
const basicBoard = boardOf([0, tile(2)], [5, tile(3)], [10, tile(5)]);
const rules = h => ({ hazards: h });

// Avoid forcing unwinnable banking decisions: a full board with no legal
// merge can be revived by clearing the Cloudy cover on its ONLY power.
const full = Array.from({ length: 16 }, (_, i) =>
  tile([2, 3, 5, 7][(Math.floor(i / 4) + i % 4) % 4]));
full[0] = tile(2, 2);
const cloud = placeHazard(emptyHazardLayer(), full, 0, "cloudy");
assert.equal(canMove(full, new Set(), new Set(), rules(cloud)), false);
assert.equal(canRescueHazardLock(full, cloud), true);
assert.equal(canMove(full, new Set(), new Set(), rules(removeHazard(cloud, 0))),
  true);
assert.equal(attemptBank(full, 0, "4", { hazards: cloud }).status, "unavailable");
assert.equal(attemptBank(full, 0, "4", {
  hazards: removeHazard(cloud, 0)
}).status, "success");
assert.equal(canRescueHazardLock(full, cloud,
  new Set(["2-2"])), false,
  "Already-banked golden/ordinary powers must not produce a false rescue");
assert.equal(canRescueHazardLock(full, emptyHazardLayer()), false);
assert.throws(() => canRescueHazardLock([]), RangeError);

// The same rescue works end-to-end through the existing item system.
const run = newRogueliteRun(0, () => 0);
run.board = full;
run.hazards = cloud;
run.run.round = 8;
run.run.inventory.consumables[0] = { id: "hazard-eraser", pricePaid: 3 };
run.movesLeft = 2;
assert.equal(canActivateConsumable(run, 0), true);
assert.deepEqual(consumableTargets(run, 0), [0]);
const saved = structuredClone(run);
const rescued = useConsumable(run, 0, [0]);
assert.equal(rescued.hazards[0], null);
assert.deepEqual(rescued.board, full);
assert.equal(rescued.movesLeft, 2);
assert.deepEqual(run, saved, "Consumable rescue must not mutate save inputs");
assert.equal(isBankable(rescued.board[0], new Set(), 0,
  new Set(), rescued.hazards), true);

// A golden value that was already banked once cannot be scored for a
// second time merely because an Eraser reveals it or it became double gold.
const golden = { ...tile(3, 2), gold: 2 };
const repeated = boardOf([0, golden]);
assert.equal(isBankable(golden, new Set(["3-2"]), 0), false);
assert.equal(attemptBank(repeated, 0, "9",
  { banked: new Set(["3-2"]) }).status, "unavailable");

// A Three Curse must not start on an already-banked index, even when
// that newly merged base-3 tile is golden; Cloudy cannot make it unfair.
const curseRun = newRogueliteRun(0, () => 0).run;
curseRun.round = 9;
curseRun.bosses[9] = "three-curse";
assert.equal(applyThreeCurse(boardOf([0, golden]), [0], curseRun,
  new Set(["3-2"]), emptyHazardLayer()).board[0].curseLeft, undefined);
assert.equal(applyThreeCurse(boardOf([0, tile(3, 2)]), [0], curseRun,
  new Set(), cloud).board[0].curseLeft, undefined);
assert.equal(applyThreeCurse(boardOf([0, tile(3, 2)]), [0], curseRun,
  new Set(), emptyHazardLayer()).board[0].curseLeft, 3);
const olderCurse = { ...tile(3, 2), curseLeft: 1 };
const spared = applyThreeCurse(boardOf([0, olderCurse]), [], curseRun,
  new Set(["3-2"]), emptyHazardLayer());
assert.deepEqual(spared.spared, [0]);
assert.equal(spared.board[0].curseLeft, undefined);

// Typed hazard weights are balanced within each stage, with fewer
// persistent Null/Cracked hazards than temporary Cloudy/Void in Stage 2.
assert.deepEqual(hazardDifficulty(1).types, []);
assert.deepEqual(hazardDifficulty(2).types, []);
assert.deepEqual(hazardDifficulty(4).types, ["cloudy", "void", "cracked"]);
assert.deepEqual(new Set(hazardDifficulty(10).types), new Set(HAZARD_TYPES));
for (const stage of [2, 3, 4]) {
  const difficulty = HAZARD_DIFFICULTY[stage];
  assert.equal(difficulty.types.reduce((sum, type) =>
    sum + difficulty.weights[type], 0), 100);
  assert.ok(difficulty.weights.cloudy > difficulty.weights.cracked);
  if (stage >= 3) assert.ok(difficulty.weights.cloudy > difficulty.weights.null);
}
assert.equal(HAZARD_DIFFICULTY[2].chance, 0.21);
assert.equal(HAZARD_DIFFICULTY[3].chance, 0.27);
assert.equal(HAZARD_DIFFICULTY[4].chance, 0.32);

// No fresh warning may begin when only 3 moves remain, regardless of
// stage, boss and random choice. Earlier warnings still mature normally.
for (const round of [4, 7, 10]) {
  const run = { ...curseRun, round, hazardCooldown: 0, hazardWarning: null };
  for (let remaining = 0; remaining <= 3; remaining++) {
    const check = progressHazardRound(basicBoard, emptyHazardLayer(), run,
      6, { rng: () => 0, movesLeft: remaining });
    assert.equal(check.run.hazardWarning, null);
    assert.equal(check.events.length, 0);
  }
  assert.throws(() => progressHazardRound(basicBoard,
    emptyHazardLayer(), run, 6,
    { rng: () => 0, movesLeft: -1 }), RangeError);
}

// If a difficult permanent Null/Cracked is offered, it may not be
// placed directly adjacent to an active blocker (merges are needed there).
const withBlocker = boardOf([0, tile(2)], [5, blocker(0, 1)]);
const nearBlocker = new Set(adjacentIndices(5));
for (let seed = 1; seed <= 250; seed++) {
  const run = { ...curseRun, round: 11, hazardCooldown: 0, hazardWarning: null };
  const check = progressHazardRound(withBlocker, emptyHazardLayer(), run,
    5, { rng: seeded(seed), movesLeft: 8 });
  const warning = check.run.hazardWarning;
  if (warning && ["null", "cracked"].includes(warning.type)) {
    assert.equal(nearBlocker.has(warning.index), false);
  }
}

// Statistical regression: repeated seeded representative 10-move rounds.
// This measures HAZARD EXPOSURE and boss severity, not skilled-player
// win rates or shop builds. Every simulation is deterministic.
function simulateExposure(round, boss, trials = 650) {
  const frequencies = Object.fromEntries(HAZARD_TYPES.map(type => [type, 0]));
  let warnings = 0, appearances = 0, highest = 0, lateWarnings = 0;
  for (let seed = 1; seed <= trials; seed++) {
    const rng = seeded(seed * 71 + round * 17011);
    const board = basicBoard.slice();
    let hazards = emptyHazardLayer();
    let run = { ...curseRun, round, hazardWarning: null, hazardCooldown: 0 };
    for (let move = 1; move <= 9; move++) {
      // Representative steady-state moving board with ongoing slides.
      // Resolve Cloudy expiration between scheduler ticks; avoid pretending
      // this models a human's strategic decision-making.
      const resolved = resolveSlideHazards({
        board, changed: true, mergeDestinations: [], greedyStolen: 0,
        motions: [{ from: 4, to: 5, merged: false }]
      }, hazards);
      hazards = resolved.hazards;
      const progress = progressHazardRound(board, hazards, run, move, {
        rng, boss, movesLeft: 10 - move
      });
      hazards = progress.hazards;
      run = progress.run;
      highest = Math.max(highest, activeHazardCount(hazards));
      for (const event of progress.events) {
        if (event.kind === "warning") {
          warnings++;
          frequencies[event.type]++;
          if (10 - move <= 3) lateWarnings++;
        }
        if (event.kind === "appeared") appearances++;
      }
      assert.ok(activeHazardCount(hazards) <= hazardDifficulty(round).maxActive);
      assert.ok(hazards.filter(h => ["null", "cracked"].includes(h?.type)).length <= 1);
      if (round <= 6) {
        assert.equal(hazards.some(h => ["null", "greedy"].includes(h?.type)), false);
      }
    }
  }
  return {
    averageWarnings: warnings / trials, averageAppearances: appearances / trials,
    highest, lateWarnings, frequencies
  };
}
const s1 = simulateExposure(2, false, 120);
const s2 = simulateExposure(5, false);
const s3 = simulateExposure(8, false);
const s4 = simulateExposure(11, false);
const boss2 = simulateExposure(6, true);
const boss3 = simulateExposure(9, true);
const boss4 = simulateExposure(12, true);
assert.equal(s1.averageWarnings, 0);
assert.equal(s1.averageAppearances, 0);
assert.ok(s2.averageWarnings > 0.1 && s2.averageWarnings < 1.8);
assert.ok(s3.averageWarnings > s2.averageWarnings);
assert.ok(s4.averageWarnings >= s3.averageWarnings * 0.9);
assert.ok(s2.highest <= 1);
assert.ok(s3.highest <= 2 && s4.highest <= 2);
assert.equal(s2.frequencies.null, 0);
assert.equal(s2.frequencies.greedy, 0);
assert.ok(s4.frequencies.cloudy > s4.frequencies.null);
assert.ok(boss2.averageWarnings < s2.averageWarnings);
assert.ok(boss3.averageWarnings < s3.averageWarnings);
assert.ok(boss4.averageWarnings < s4.averageWarnings);
for (const report of [s1, s2, s3, s4, boss2, boss3, boss4]) {
  assert.equal(report.lateWarnings, 0);
  assert.ok(report.averageAppearances <= report.averageWarnings);
}
console.log("Seeded hazard exposure (warnings/10-move round):",
  JSON.stringify({ stage1: s1.averageWarnings, stage2: s2.averageWarnings,
    stage3: s3.averageWarnings, stage4: s4.averageWarnings,
    boss2: boss2.averageWarnings, boss3: boss3.averageWarnings,
    boss4: boss4.averageWarnings }, null, 0));

// Visual / accessibility regressions:
const app = readFileSync("app.mjs", "utf8");
const css = readFileSync("styles.css", "utf8");
const html = readFileSync("index.html", "utf8");
const overlay = readFileSync("hazard-ui.mjs", "utf8");
assert.match(app, /canRescueHazardLock\(/);
assert.match(app, /entry\?\.id === "hazard-eraser"/);
assert.match(app, /button\.disabled = !erasing/);
assert.match(app, /eraseTargets/);
assert.match(app, /ghost\.className = hiddenAtStart \? "tile-ghost ghost-clouded"/);
assert.match(app, /button\.classList\.add\("already-banked"\)/);
assert.match(app, /hazardAlert"\)\.dataset\.hazard/);
assert.match(html, /id="boardHazardStatus"/);
assert.match(html, /id="boardHazardHelp" data-help="rules"/);
assert.match(html, /id="boardHazardDetail"/);
assert.match(html, /<strong>including golden powers<\/strong>/);
assert.match(css, /\.hazard-slot\.hazard-erase-target/);
assert.match(css, /\.cell\.gold-tile\.already-banked/);
assert.match(css, /\.tile-ghost\.ghost-clouded/);
assert.match(css, /\.board-hazard-status/);
assert.match(overlay, /square\.classList\.add\("hazard-erase-target"\)/);
assert.match(overlay, /caption\.textContent = "NEXT"/);
console.log("All Pass 4 hazard balancing, rescue and visual tests passed.");
