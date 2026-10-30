import {
  key, slide, turnSpawns, initial, canMove, isBankable, isBlocker, isWarning,
  blockerStrength, blockerHitsForMove, BLOCKER_START, BLOCKER_INTERVAL, MAX_BLOCKERS,
  mergeReadyAfterSlide, attemptBank, adjacentIndices, activeBases, BASE_UNLOCKS,
  INITIAL_MOVES_LEFT, MERGES_PER_BONUS_MOVE, BUDGET_RULES_VERSION,
  restoreMoveBudget, spendMove, slideCost, creditCorrectBank, gameEnded
} from "./engine.mjs?v=roguelite-pass4-v1";
import { newRogueliteRun, targetForRound, stageForRound, isBossRound,
  recordRogueliteBank, advanceRogueliteRound, validRogueliteRun,
  restoreRogueliteRun, markGoldSpawns, goldTier, goldForBank
} from "./roguelite.mjs?v=roguelite-pass4-v1";
import {
  restoreShopState, enterRogueliteShop, rerollRogueliteShop
} from "./shop.mjs?v=roguelite-pass4-v1";
import {
  renderRogueliteInventory, renderRogueliteShop
} from "./shop-ui.mjs?v=roguelite-pass4-v1";
import {
  restoreEffectState, bankItemBonuses, goldChancesForRun,
  costOfNextSlide, canActivateConsumable, CONSUMABLE_TARGETS,
  consumableTargets, useConsumable
} from "./effects.mjs?v=roguelite-pass4-v1";
import { ITEM_BY_ID } from "./shop.mjs?v=roguelite-pass4-v1";

const $ = id => document.getElementById(id);
const glyph = n => String(n).replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
const BANK_SECONDS = 60;
const SLIDE_MS = 170;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fresh(best = 0) {
  return { board: initial(), discovered: [], banked: [], locked: [], mergeReady: [],
    score: 0, best, moves: 0, movesLeft: INITIAL_MOVES_LEFT,
    mergeCredit: 0, budgetRulesVersion: BUDGET_RULES_VERSION,
    over: false, notice: "" };
}
const CLASSIC_SAVE = "index-shuffle-v1";
const ROGUE_SAVE = "index-shuffle-roguelite-v1";
const MODE_SAVE = "index-shuffle-selected-mode-v1";
function saved(mode = "classic") {
  try { return JSON.parse(localStorage.getItem(mode === "roguelite" ? ROGUE_SAVE : CLASSIC_SAVE)); }
  catch { return null; }
}
let mode = localStorage.getItem(MODE_SAVE) === "roguelite" ? "roguelite" : "classic";
let state = saved(mode);
if (!state || !Array.isArray(state.board) || state.board.length !== 16) {
  state = mode === "roguelite" ? newRogueliteRun() : fresh();
} else {
  // Previous games did not track temporary banking lockouts.
  state.locked = Array.isArray(state.locked) ? state.locked : [];
  state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
  state.banked = Array.isArray(state.banked) ? state.banked : [];
  // Earlier saves never recorded which tiles came from genuine merges.
  // They remain playable; new merges earn bank-triggered blocker hits.
  state.mergeReady = Array.isArray(state.mergeReady) ? state.mergeReady : [];
  // Upgrade older games once without losing their board or score.
  Object.assign(state, restoreMoveBudget(state));
  state.notice = "";
  if (mode === "roguelite" && !validRogueliteRun(state.run)) state = newRogueliteRun();
  else {
    if (mode === "roguelite") state.run = restoreEffectState(restoreShopState(
      restoreRogueliteRun(state.run, state.movesLeft)));
    state.over = mode === "roguelite" && state.run.phase !== "playing" ? false
      : gameEnded(state.board, new Set(state.banked),
        new Set(state.locked), state.movesLeft);
  }
}
let pending = null;
let bankTimer = null;
let remainingMs = BANK_SECONDS * 1000;
let deadline = 0;
let animating = false;
let animationToken = 0;
let pendingItem = null;

function persist() {
  try { localStorage.setItem(mode === "roguelite" ? ROGUE_SAVE : CLASSIC_SAVE, JSON.stringify(state)); }
  catch { /* Storage may be unavailable in private mode. */ }
}

function tileContent(t, badge = "") {
  return "<span>" + t.base + (t.exp === 1 ? "" : "<sup>" + t.exp + "</sup>") + "</span>" + badge;
}
function render() {
  const rogue = mode === "roguelite";
  $("modeClassic").setAttribute("aria-pressed", String(!rogue));
  $("modeRoguelite").setAttribute("aria-pressed", String(rogue));
  $("rogueProgress").hidden = !rogue;
  $("helpRogueBlock").hidden = !rogue;
  $("rogueEndSummary").hidden = !rogue || state.run.phase !== "victory";
  $("roundClearPanel").hidden = !rogue || state.run.phase !== "round-clear";
  $("nextRound").textContent = "Visit shop";
  $("endActions").querySelector("strong").textContent = rogue && state.run.phase === "victory"
    ? "Run completed!" : "Run finished";
  if (rogue) {
    $("rogueRound").textContent = "Stage " + stageForRound(state.run.round) +
      " · Round " + state.run.round + "/12" + (isBossRound(state.run.round) ? " · Boss milestone" : "");
    const target = targetForRound(state.run.round);
    $("rogueScore").textContent = state.score + " / " + target;
    $("roundScoreProgress").value = Math.min(state.score, target);
    $("roundScoreProgress").max = target;
    $("rogueTotal").textContent = state.run.totalScore;
    $("rogueCoins").textContent = state.run.coins;
    const reward = state.run.lastRoundReward;
    $("roundClearMessage").textContent = reward
      ? "Target reached! You had " + reward.unusedMoves +
        " unused moves. Your coins carry into the next round."
      : "Round complete. Your coins carry into the next round.";
    $("roundBankCoins").textContent = "+" + (reward?.bankCoins ?? 0);
    $("roundSpareCoins").textContent = "+" + (reward?.moveCoins ?? 0);
    $("roundRewardTotal").textContent = "+" + (reward?.totalCoins ?? 0);
    $("rogueEndSummary").textContent = "All 12 rounds cleared! " +
      state.run.totalScore + " points scored and " + state.run.coins +
      " coins remaining. Final-round gold: +" + (reward?.totalCoins ?? 0) + ".";
  }
  const banked = new Set(state.banked);
  const locked = new Set(state.locked);
  const mergeReady = new Set(state.mergeReady);
  $("score").textContent = state.score;
  $("best").textContent = state.best;
  $("count").textContent = state.banked.length;
  $("moves").textContent = state.moves;
  $("movesLeft").textContent = state.movesLeft;
  $("mergeProgress").textContent = state.mergeCredit + " / " +
    MERGES_PER_BONUS_MOVE;
  $("bonusMeter").value = state.mergeCredit;
  $("bonusMeter").setAttribute("aria-valuetext",
    state.mergeCredit + " of " + MERGES_PER_BONUS_MOVE +
    " correctly banked merged powers");
  const currentSlideCost = rogue ? costOfNextSlide(state) : slideCost(state.board);
  $("slideCost").textContent = "−" + currentSlideCost +
    (currentSlideCost === 1 ? " move" : " moves");
  $("movesCard").classList.toggle("low-moves", state.movesLeft > 0 &&
    state.movesLeft <= 3);
  $("movesCard").classList.toggle("empty-moves", state.movesLeft === 0);
  const active = activeBases(rogue ? state.run.totalSlides : state.moves);
  $("activeBases").innerHTML = active.map(base =>
    '<span class="base-chip base' + base + '">' + base + '</span>').join("");
  const upcoming = BASE_UNLOCKS.find(step => (rogue ? state.run.totalSlides : state.moves) < step.moves);
  $("nextBase").textContent = upcoming
    ? "Next: " + upcoming.base + " at move " + upcoming.moves
    : "All six bases unlocked";
  const selection = rogue && pendingItem ? pendingItem : null;
  const candidates = selection ? consumableTargets(state, selection.slot, selection.targets) : [];
  $("itemPrompt").hidden = !selection;
  if (selection) {
    const item = state.run.inventory.consumables[selection.slot];
    const name = item ? ITEM_BY_ID[item.id].name : "Item";
    $("itemPromptText").textContent = selection.targets.length
      ? name + ": select a second number tile to swap."
      : name + ": select a highlighted tile.";
  }
  $("rogueEffectStatus").hidden = !rogue ||
    (state.run.protectionSlides === 0 && state.run.blockerDelay === 0);
  if (rogue) {
    const effects = [];
    if (state.run.protectionSlides > 0) effects.push(
      "Protection: " + state.run.protectionSlides + " slides");
    if (state.run.blockerDelay > 0) effects.push(
      "Blockers delayed by " + state.run.blockerDelay + " slides");
    $("rogueEffectStatus").textContent = effects.join(" · ");
  }
  const board = $("board");
  board.innerHTML = "";

  state.board.forEach((t, i) => {
    const button = document.createElement("button");
    button.className = "cell" + (isBlocker(t) ? " block-tile block-tier" + blockerStrength(t)
      : isWarning(t) ? " warning-tile warning-tier" + blockerStrength(t)
      : t ? " tile base" + t.base : "");
    button.setAttribute("role", "gridcell");
    button.type = "button";
    if (isBlocker(t)) {
      const strength = blockerStrength(t);
      const remaining = Math.max(0, strength - t.hits);
      button.innerHTML = '<span class="block-symbol" aria-hidden="true">▦</span>'
        + '<small class="block-health">' + remaining + ' / ' + strength + '</small>';
      button.title = "Tier " + strength + " fixed blocker: " + remaining
        + " adjacent " + (remaining === 1 ? "merge" : "merges") + " to break";
      button.setAttribute("aria-label", button.title);
      button.disabled = true;
    } else if (isWarning(t)) {
      const strength = blockerStrength(t);
      button.innerHTML = '<span class="warning-symbol" aria-hidden="true">!</span>'
        + '<small class="block-health">TIER ' + strength + ' NEXT</small>';
      button.title = "Incoming tier " + strength + " blocker next successful slide. "
        + "This reserved square cannot be crossed or occupied.";
      button.setAttribute("aria-label", button.title);
      button.disabled = true;
    } else if (t) {
      const available = isBankable(t, banked, i, locked);
      const blocked = t.exp >= 2 && locked.has(i) && !banked.has(key(t));
      const strike = available && mergeReady.has(i) &&
        adjacentIndices(i).some(j => isBlocker(state.board[j]));
      const gold = rogue ? goldTier(t) : 0;
      const coinBadge = gold
        ? '<small class="tile-gold-mark" aria-hidden="true">●' + (gold === 2 ? '×2' : '') + '</small>'
        : "";
      button.innerHTML = tileContent(t, coinBadge + (available
        ? '<i aria-hidden="true">' + (strike ? '⚡' : '✦') + '</i>'
        : blocked ? '<i aria-hidden="true">⌛</i>' : ""));
      const description = t.base + " to the power " + t.exp;
      const goldCoins = gold ? goldForBank(t, mergeReady.has(i)) : 0;
      const goldHint = !gold ? "" : goldCoins
        ? ". Golden power: a correct bank earns " + goldCoins + " coins."
        : ". Golden tile: merge it before banking to earn coins.";
      button.title = (blocked ? "Wait one slide before retrying " + description
        : strike ? "Bank " + description + " correctly to damage adjacent blocker"
        : available ? "Bank " + description : description) + goldHint;
      if (gold) button.classList.add("gold-tile");
      button.setAttribute("aria-label", button.title);
      if (blocked) button.classList.add("locked");
      if (strike) button.classList.add("block-strike");
      if (available && !selection) {
        button.classList.add("bankable");
        button.addEventListener("click", () => openBank(i));
      }
    } else {
      button.disabled = true;
    }
    if (selection) {
      if (candidates.includes(i)) {
        button.disabled = false;
        button.classList.add("item-target");
        button.title = "Select this tile for " +
          ITEM_BY_ID[state.run.inventory.consumables[selection.slot].id].name;
        button.setAttribute("aria-label", button.title);
        button.addEventListener("click", () => selectConsumableTarget(i));
      } else {
        button.disabled = true;
        button.classList.add("item-target-disabled");
        if (selection.targets.includes(i)) button.classList.add("item-target-selected");
      }
    }
    board.appendChild(button);
  });
  $("blockerCount").textContent =
    state.board.filter(isBlocker).length + " / " + MAX_BLOCKERS;
  const incoming = state.board.find(isWarning);
  if (incoming) {
    $("blockerNext").textContent = "Highlighted square → tier "
      + blockerStrength(incoming) + " next slide";
  } else {
    const hazardMoves = rogue ? Math.max(0, state.moves - state.run.blockerDelay) : state.moves;
    const firstWarning = BLOCKER_START - 1;
    const nextWarningMove = hazardMoves < firstWarning ? firstWarning
      : firstWarning + (Math.floor((hazardMoves - firstWarning) / BLOCKER_INTERVAL) + 1)
        * BLOCKER_INTERVAL;
    $("blockerNext").textContent = rogue
      ? "Next blocker warning in " + (nextWarningMove - hazardMoves) +
        " slides · tier " + blockerHitsForMove(nextWarningMove + 1)
      : "Next warning: move " + nextWarningMove +
        " · tier " + blockerHitsForMove(nextWarningMove + 1);
  }

  const all = [...new Set([...state.discovered, ...state.banked])].sort((a, b) => {
    const [x, y] = a.split("-").map(Number), [u, v] = b.split("-").map(Number);
    return x - u || y - v;
  });
  $("collectionCount").textContent = all.length + " found";
  $("collection").innerHTML = all.length
    ? all.map(k => {
      const [base, exp] = k.split("-");
      return '<span class="collect ' + (banked.has(k) ? "done" : "")
        + '" title="' + (banked.has(k) ? "Banked" : "Discovered") + '">'
        + base + "<sup>" + exp + "</sup> " + (banked.has(k) ? "✓" : "◇") + "</span>";
    }).join("")
    : '<p class="muted">Discover your first square by merging two matching bases.</p>';
  $("status").textContent = selection
    ? "Choose a highlighted target for your " +
      ITEM_BY_ID[state.run.inventory.consumables[selection.slot].id].name +
      ". This does not use a move."
    : rogue && state.run.phase === "round-clear"
    ? "Round cleared! Your shop visit is next."
    : rogue && state.run.phase === "shop"
    ? "Shop open: choose items, reroll, or save your coins."
    : rogue && state.run.phase === "victory"
    ? "You completed all 12 rounds!"
    : state.movesLeft === 0
    ? "Out of moves. Start a new game to try again."
    : state.over ? "No legal moves or banking options remain."
    : state.notice ||
      (state.movesLeft <= 3
        ? "Low on moves: bank merged powers correctly to recover."
        : "Swipe to merge, or select a glowing power to bank.");
  $("status").classList.toggle("is-over", state.over);
  $("stage").textContent = rogue && state.run.phase === "round-clear" ? "Round cleared"
    : rogue && state.run.phase === "shop" ? "Shopping"
    : rogue && state.run.phase === "victory" ? "Victory" : state.over ? "Game over" : "Playing";
  $("endActions").hidden = !state.over && !(rogue && state.run.phase === "victory");
  renderRogueliteInventory(state, rogue, beginConsumable, slot =>
    canActivateConsumable(state, slot));
  renderRogueliteShop(state, mode, applyShopAction);
  persist();
}

function stopMotion() {
  animationToken++;
  $("board").classList.remove("animating");
  $("board").querySelector(".motion-layer")?.remove();
  animating = false;
}

// Animate original tiles towards their destinations. The next board, including
// its new spawn, is revealed together when the 170 ms movement completes.
function animateSlide(before, motions, mergedDestinations, spawned, damaged, destroyed, blockerAt, warningAt) {
  if (prefersReducedMotion() || typeof Element.prototype.animate !== "function") return;
  const board = $("board");
  const cells = [...board.children];
  const rects = cells.map(cell => cell.getBoundingClientRect());
  const boardRect = board.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "motion-layer";
  board.appendChild(layer);
  board.classList.add("animating");
  animating = true;
  const token = ++animationToken;
  const completed = [];

  for (const movement of motions) {
    const t = before[movement.from];
    if (!t) continue;
    const from = rects[movement.from], to = rects[movement.to];
    const ghost = document.createElement("div");
    ghost.className = "tile-ghost base" + t.base +
      (mode === "roguelite" && goldTier(t) ? " gold-tile" : "");
    ghost.style.left = (from.left - boardRect.left) + "px";
    ghost.style.top = (from.top - boardRect.top) + "px";
    ghost.style.width = from.width + "px";
    ghost.style.height = from.height + "px";
    ghost.innerHTML = tileContent(t, mode === "roguelite" && goldTier(t)
      ? '<small class="tile-gold-mark" aria-hidden="true">●</small>' : "");
    layer.appendChild(ghost);
    const animation = ghost.animate([
      { transform: "translate3d(0, 0, 0)" },
      { transform: "translate3d(" + (to.left - from.left) + "px, "
          + (to.top - from.top) + "px, 0)" }
    ], { duration: SLIDE_MS, easing: "ease-out", fill: "forwards" });
    completed.push(animation.finished);
  }

  Promise.allSettled(completed).then(() => {
    if (token !== animationToken) return;
    stopMotion();
    for (const index of mergedDestinations) {
      cells[index]?.classList.add("merge-flash");
    }
    for (const index of spawned) cells[index]?.classList.add("spawn-flash");
    for (const index of damaged) cells[index]?.classList.add("block-hit-flash");
    for (const index of destroyed) cells[index]?.classList.add("block-break-flash");
    if (blockerAt >= 0) cells[blockerAt]?.classList.add("block-appear");
    if (warningAt >= 0) cells[warningAt]?.classList.add("warning-appear");
  });
}

function move(direction) {
  if (pendingItem !== null || state.over || pending !== null || animating || (mode === "roguelite" && state.run.phase !== "playing")) return;
  const before = state.board.slice();
  const result = slide(before, direction);
  if (!result.changed) return;
  for (const t of result.merges) {
    if (t.exp >= 2 && !state.discovered.includes(key(t))) state.discovered.push(key(t));
  }
  const nextMove = state.moves + 1;
  // Snapshot active blockers BEFORE the slide. A warning that matures
  // on this slide only increases the cost of the following slide.
  const protectedSlide = mode === "roguelite" && state.run.protectionSlides > 0;
  const activeBlockers = protectedSlide ? 0 : slideCost(before) - 1;
  const budget = spendMove(state.movesLeft, activeBlockers);
  state.movesLeft = budget.movesLeft;
  if (protectedSlide) state.run.protectionSlides -= 1;
  // No reward here, no matter how many tiles merged. Correct banking
  // of a merged power is the only way to advance mergeCredit.
  // Keep merge provenance attached to its tile as it slides, and mark
  // newly merged powers. Spawned powers never inherit that provenance.
  state.mergeReady = mergeReadyAfterSlide(state.mergeReady, result.motions);
  if (mode === "roguelite") state.run.totalSlides += 1;
  const hazardMoves = mode === "roguelite"
    ? Math.max(0, nextMove - state.run.blockerDelay) : nextMove;
  const spawned = turnSpawns(result.board, new Set(state.discovered),
    hazardMoves, Math.random, new Set(),
    mode === "roguelite" ? state.run.totalSlides : nextMove);
  if (mode === "roguelite") {
    const gold = markGoldSpawns(spawned.board, spawned.spawned,
      state.run.goldDryStreak, Math.random, true, goldChancesForRun(state.run));
    state.board = gold.board;
    state.run.goldDryStreak = gold.dryStreak;
  } else {
    state.board = spawned.board;
  }
  const progression = mode === "roguelite" ? state.run.totalSlides : nextMove;
  const previousProgression = mode === "roguelite" ? progression - 1 : state.moves;
  const unlockedNow = activeBases(progression)
    .filter(base => !activeBases(previousProgression).includes(base));
  state.moves = nextMove;
  // A successful slide clears the incorrect-attempt and banking cooldowns.
  state.locked = [];
  const news = [];
  if (unlockedNow.length) news.push("New base unlocked: " + unlockedNow.join(", ") + ".");
  // Merging next to a blocker does not cause damage: students must bank
  // the merged power correctly while it is adjacent to the blocker.
  if (spawned.blockerAt >= 0) {
    const strength = blockerStrength(state.board[spawned.blockerAt]);
    news.push("Tier " + strength + " blocker arrived in the highlighted square!");
  }
  if (spawned.warningAt >= 0) {
    const strength = blockerStrength(state.board[spawned.warningAt]);
    news.push("Look out! The highlighted square becomes a tier " + strength
      + " blocker after your next successful slide.");
  }
  if (spawned.extraSpawned) news.push("Extra tile spawned!");
  state.notice = news.slice(0, 2).join(" ");
  state.over = gameEnded(state.board, new Set(state.banked),
    new Set(), state.movesLeft);
  render();
  animateSlide(before, result.motions, new Set(result.mergeDestinations),
    spawned.spawned, result.damaged, result.destroyed,
    spawned.blockerAt, spawned.warningAt);
}

function updateClock() {
  const seconds = Math.ceil(remainingMs / 1000);
  $("timeLeft").textContent = Math.floor(seconds / 60) + ":"
    + String(seconds % 60).padStart(2, "0");
  $("timeProgress").style.width = (remainingMs / (BANK_SECONDS * 1000) * 100) + "%";
  $("clock").classList.toggle("running-low", remainingMs <= 15000);
}
function pauseClock() {
  if (bankTimer === null) return;
  remainingMs = Math.max(0, deadline - Date.now());
  clearInterval(bankTimer);
  bankTimer = null;
  updateClock();
}
function resumeClock() {
  if (pending === null || bankTimer !== null) return;
  deadline = Date.now() + remainingMs;
  updateClock();
  bankTimer = setInterval(() => {
    remainingMs = Math.max(0, deadline - Date.now());
    updateClock();
    if (remainingMs <= 0) lockPending("time");
  }, 120);
}
function closeBank() {
  if (bankTimer !== null) clearInterval(bankTimer);
  bankTimer = null;
  pending = null;
  $("modal").hidden = true;
}
function openBank(i) {
  if (pendingItem !== null || state.over || animating || pending !== null || (mode === "roguelite" && state.run.phase !== "playing")) return;
  const t = state.board[i];
  if (!isBankable(t, new Set(state.banked), i, new Set(state.locked))) return;
  pending = { i, t };
  remainingMs = BANK_SECONDS * 1000;
  $("promptTitle").textContent = t.base + glyph(t.exp) + " = ?";
  $("feedback").textContent = "";
  $("answer").value = "";
  document.querySelector(".bank-hint").open = false;
  const canStrike = state.mergeReady.includes(i) &&
    adjacentIndices(i).some(j => isBlocker(state.board[j]));
  const bankGold = mode === "roguelite" ? goldForBank(t, state.mergeReady.includes(i)) : 0;
  const bonuses = mode === "roguelite"
    ? bankItemBonuses(state.run, t, state.mergeReady.includes(i)) : null;
  const goldHelp = mode !== "roguelite" || !goldTier(t) ? ""
    : bankGold ? " Correct banking also earns " +
      (bankGold + (bonuses?.extraCoins ?? 0)) + " coins."
    : " This tile is golden, but must be merged before banking to earn coins.";
  $("promptHelp").textContent = (canStrike
    ? "Correct answer: bank this power and damage the nearby blocker."
    : "Calculate its exact value to bank this power.") + goldHelp +
    (bonuses ? " Correct bank scores " + bonuses.score + " points." : "");
  $("modal").hidden = false;
  if (!document.hidden) resumeClock();
  $("answer").focus();
}
function lockPending(reason) {
  if (pending === null) return;
  const { i, t } = pending;
  closeBank();
  if (state.board[i] && key(state.board[i]) === key(t) && !state.locked.includes(i)) {
    state.locked.push(i);
  }
  state.notice = reason === "time"
    ? "Time's up. Slide the board once before retrying that tile."
    : "Not quite. That tile is locked until your next successful slide.";
  state.over = gameEnded(state.board, new Set(state.banked),
    new Set(state.locked), state.movesLeft);
  render();
}
document.addEventListener("visibilitychange", () => {
  if (!pending) return;
  if (document.hidden) pauseClock();
  else resumeClock();
});
$("bankForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!pending) return;
  const { i, t } = pending;
  if (!state.board[i] || key(state.board[i]) !== key(t)) return;
  const bonuses = mode === "roguelite"
    ? bankItemBonuses(state.run, t, state.mergeReady.includes(i)) : null;
  const outcome = attemptBank(state.board, i, $("answer").value, {
    discovered: new Set(state.discovered),
    banked: new Set(state.banked),
    locked: new Set(state.locked),
    mergeReady: new Set(state.mergeReady),
    blockerDamage: bonuses?.blockerHits ?? 1
  });
  if (outcome.status === "incorrect") {
    lockPending("wrong");
    return;
  }
  if (outcome.status !== "success") return;
  closeBank();
  state.board = outcome.board;
  state.mergeReady = state.mergeReady.filter(index => index !== i);
  // A correctly banked power becomes a smaller replacement in the same
  // square, with the existing one-successful-slide banking cooldown.
  if (!state.locked.includes(i)) state.locked.push(i);
  state.banked.push(outcome.powerKey);
  // Correct answers for genuinely merged tiles are the ONLY source of
  // extra moves. A correctly banked random-spawn power earns score only.
  const award = creditCorrectBank(state.movesLeft, state.mergeCredit,
    outcome.creditedMerge);
  state.movesLeft = award.movesLeft;
  state.mergeCredit = award.mergeCredit;
  const points = mode === "roguelite"
    ? recordRogueliteBank(state.run, state.score, t, {
        merged: outcome.creditedMerge, movesLeft: state.movesLeft,
        scoreOverride: bonuses.score, extraCoins: bonuses.extraCoins,
        counters: bonuses.counters
      })
    : { points: outcome.points, roundScore: state.score + outcome.points };
  state.score = points.roundScore;
  if (mode === "roguelite") state.run = points.run;
  state.best = Math.max(state.best, state.score);
  const { replacement, damaged, destroyed } = outcome;
  state.notice = "Banked " + t.base + glyph(t.exp) + " · +" + points.points
    + " points" + (bonuses && bonuses.notes.length
      ? " (" + bonuses.notes.join(", ") + ")" : "") +
    ". " + replacement.base + glyph(replacement.exp) + " stays on the board.";
  if (mode === "roguelite" && points.bankGold) {
    state.notice += " +" + points.bankGold + " gold!";
  }
  if (mode === "roguelite" && points.cleared) {
    state.notice += " Round complete: +" + points.moveGold + " coins for unused moves!";
  }
  if (outcome.creditedMerge) {
    if (award.earned) {
      state.notice += " +1 move earned for two correctly banked merges!";
    } else if (state.mergeCredit === 1) {
      state.notice += " 1/2 correctly banked merges toward your next move.";
    } else {
      state.notice += " Bonus reached, but Moves Left is already at 10.";
    }
  }
  if (destroyed.length) {
    state.notice += " " + destroyed.length
      + (destroyed.length === 1 ? " blocker destroyed!" : " blockers destroyed!");
  } else if (damaged.length) {
    state.notice += " Blocker damaged by your correct bank!";
  }
  state.over = mode === "roguelite" && state.run.phase !== "playing" ? false :
    gameEnded(state.board, new Set(state.banked),
    new Set(state.locked), state.movesLeft);
  render();
  if (!prefersReducedMotion()) {
    $("board").children[i]?.classList.add("bank-flash");
    for (const index of damaged) {
      $("board").children[index]?.classList.add("block-hit-flash");
    }
    for (const index of destroyed) {
      $("board").children[index]?.classList.add("block-break-flash");
    }
  }
});

$("close").addEventListener("click", closeBank);
$("cancel").addEventListener("click", closeBank);
$("modal").addEventListener("click", event => {
  if (event.target === $("modal")) closeBank();
});
function startNewGame() {
  if (!state.over && !confirm("Start a new game? Your current run will be replaced.")) return;
  const best = state.best;
  stopMotion();
  closeBank();
  pendingItem = null;
  state = mode === "roguelite" ? newRogueliteRun(best) : fresh(best);
  render();
}
// Single-use items never score or advance the board. A targeted item
// waits for one or two deliberate board clicks; Escape cancels safely.
function cancelConsumable() {
  pendingItem = null;
  render();
}
$("itemCancel").addEventListener("click", cancelConsumable);

function activateConsumable(slot, targets) {
  try {
    const next = useConsumable(state, slot, targets);
    state = next;
    pendingItem = null;
    state.over = gameEnded(state.board, new Set(state.banked),
      new Set(state.locked), state.movesLeft);
  } catch (error) {
    pendingItem = null;
    state.notice = error instanceof Error ? error.message : "Unable to use that item.";
  }
  render();
}

function beginConsumable(slot) {
  if (mode !== "roguelite" || pending !== null || animating ||
      pendingItem !== null || !canActivateConsumable(state, slot)) return;
  const item = state.run.inventory.consumables[slot];
  const required = CONSUMABLE_TARGETS[item.id];
  if (required === 0) {
    activateConsumable(slot, []);
  } else {
    pendingItem = { slot, targets: [] };
    render();
  }
}

function selectConsumableTarget(index) {
  if (mode !== "roguelite" || !pendingItem) return;
  const { slot, targets } = pendingItem;
  if (!consumableTargets(state, slot, targets).includes(index)) return;
  const selected = [...targets, index];
  const item = state.run.inventory.consumables[slot];
  if (selected.length >= CONSUMABLE_TARGETS[item.id]) {
    activateConsumable(slot, selected);
  } else {
    pendingItem = { slot, targets: selected };
    render();
  }
}
$("new").addEventListener("click", startNewGame);
$("newFromEnd").addEventListener("click", startNewGame);
$("nextRound").addEventListener("click", () => {
  if (mode !== "roguelite" || state.run.phase !== "round-clear") return;
  stopMotion();
  state = enterRogueliteShop(state);
  render();
});
function applyShopAction(reducer) {
  if (mode !== "roguelite" || state.run.phase !== "shop") return;
  try {
    state = reducer(state);
  } catch (error) {
    state.run.shop.notice = error instanceof Error ? error.message : "Unable to complete that action.";
  }
  render();
}
$("shopReroll").addEventListener("click", () => {
  applyShopAction(value => rerollRogueliteShop(value));
});
$("shopContinue").addEventListener("click", () => {
  if (mode !== "roguelite" || state.run.phase !== "shop") return;
  stopMotion();
  state = advanceRogueliteRound(state, Math.random, goldChancesForRun(state.run));
  render();
});
// Escape cannot dismiss the modal while the game is in its saved shop phase.
// The Start round button is always available, even if there are no coins.
$("shopDialog").addEventListener("cancel", event => event.preventDefault());
function switchMode(selected) {
  if (selected === mode || pending !== null) return;
  if (mode === "roguelite" && state.run.phase === "playing" && !state.over ||
      mode === "classic" && !state.over) {
    // Switching does not overwrite or discard either saved game.
  }
  stopMotion();
  pendingItem = null;
  persist();
  mode = selected;
  localStorage.setItem(MODE_SAVE, mode);
  const restored = saved(mode);
  state = restored && Array.isArray(restored.board) && restored.board.length === 16 &&
    (mode === "classic" || validRogueliteRun(restored.run))
    ? restored : mode === "roguelite" ? newRogueliteRun() : fresh();
  Object.assign(state, restoreMoveBudget(state));
  state.locked = Array.isArray(state.locked) ? state.locked : [];
  state.mergeReady = Array.isArray(state.mergeReady) ? state.mergeReady : [];
  state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
  state.banked = Array.isArray(state.banked) ? state.banked : [];
  if (mode === "roguelite") state.run = restoreEffectState(restoreShopState(
    restoreRogueliteRun(state.run, state.movesLeft)));
  state.over = mode === "roguelite" && state.run.phase !== "playing" ? false
    : gameEnded(state.board, new Set(state.banked), new Set(state.locked), state.movesLeft);
  render();
}
$("modeClassic").addEventListener("click", () => switchMode("classic"));
$("modeRoguelite").addEventListener("click", () => switchMode("roguelite"));

// Learning and full instructions are optional. Switching between the
// two entry points uses one accessible native dialog and never edits
// the game state or pauses the move budget.
document.querySelectorAll("[data-help]").forEach(button => {
  button.addEventListener("click", () => {
    const maths = button.dataset.help === "maths";
    $("helpTitle").textContent = maths ? "Maths help" : "How to play";
    $("helpHow").hidden = maths;
    $("helpMaths").hidden = !maths;
    $("helpDialog").showModal();
  });
});
$("helpClose").addEventListener("click", () => $("helpDialog").close());
$("helpDialog").addEventListener("click", event => {
  if (event.target === $("helpDialog")) $("helpDialog").close();
});
const keys = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down"
};
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && pending !== null) { closeBank(); return; }
  // Let arrow keys scroll the modal shop instead of swallowing them as slides.
  if ($("shopDialog").open) return;
  if (pendingItem !== null) {
    if (event.key === "Escape") { event.preventDefault(); cancelConsumable(); }
    return;
  }
  if ($("helpDialog").open || pending !== null ||
      ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  const direction = keys[event.key];
  if (direction) { event.preventDefault(); move(direction); }
});
document.querySelectorAll("[data-dir]").forEach(button =>
  button.addEventListener("click", () => move(button.dataset.dir)));

let touchStart = null;
const board = $("board");
board.addEventListener("touchstart", event => {
  const touch = event.touches[0];
  touchStart = { x: touch.clientX, y: touch.clientY };
}, { passive: true });
board.addEventListener("touchend", event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  move(Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? "right" : "left")
    : (dy > 0 ? "down" : "up"));
}, { passive: true });
render();
