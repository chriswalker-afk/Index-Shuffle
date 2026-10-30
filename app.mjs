import {
  key, slide, turnSpawns, initial, canMove, isBankable, isBlocker, isWarning,
  blockerStrength, blockerHitsForMove, BLOCKER_START, BLOCKER_INTERVAL, MAX_BLOCKERS,
  mergeReadyAfterSlide, attemptBank, adjacentIndices, activeBases, BASE_UNLOCKS,
  INITIAL_MOVES_LEFT, MERGES_PER_BONUS_MOVE, BUDGET_RULES_VERSION,
  restoreMoveBudget, spendMove, slideCost, creditCorrectBank, gameEnded
} from "./engine.mjs?v=hazard-pass3-v1";
import { newRogueliteRun, targetForRound, stageForRound, isBossRound,
  recordRogueliteBank, advanceRogueliteRound, validRogueliteRun,
  restoreRogueliteRun, markGoldSpawns, goldTier, goldForBank
} from "./roguelite.mjs?v=hazard-pass3-v1";
import {
  restoreShopState, enterRogueliteShop, rerollRogueliteShop
} from "./shop.mjs?v=hazard-pass3-v1";
import {
  renderRogueliteInventory, renderRogueliteShop
} from "./shop-ui.mjs?v=hazard-pass3-v1";
import {
  restoreEffectState, bankItemBonuses, goldChancesForRun,
  costOfNextSlide, canActivateConsumable, CONSUMABLE_TARGETS,
  consumableTargets, useConsumable
} from "./effects.mjs?v=hazard-pass3-v1";
import { ITEM_BY_ID } from "./shop.mjs?v=hazard-pass3-v1";
import {
  bossForRound, bossTargetFor, bossPointsFor, bossMovementRules,
  bossAllowsMoveRestoration, applyThreeCurse
} from "./bosses.mjs?v=hazard-pass3-v1";
import {
  ACHIEVEMENTS, ACHIEVEMENT_BY_ID, emptyRunStats, restoreRunStats,
  restoreAchievementProfile, recordRunStats, recordSuccessfulSlide,
  addEarnedToRunStats, recordAchievementEvent, countUnlocked,
  progressForAchievement, isFinishedRun, finalScoreSummary
} from "./milestones.mjs?v=hazard-pass3-v1";
import {
  openAchievementGallery, renderFinalScreen
} from "./results-ui.mjs?v=hazard-pass3-v1";
import { MODE_LABELS, resumableSave } from "./navigation.mjs?v=hazard-pass3-v1";
import { renderNavigation } from "./title-ui.mjs?v=hazard-pass3-v1";
import {
  restoreHazardLayer, hazardAt, activeHazardCount, MAX_ACTIVE_HAZARDS,
  restoreHazardPressure, progressHazardRound, resolveSlideHazards,
  HAZARD_DEFINITIONS, canRescueHazardLock
} from "./hazards.mjs?v=hazard-pass3-v1";
import {
  renderHazardLayer, hazardTileDescription
} from "./hazard-ui.mjs?v=hazard-pass3-v1";

const $ = id => document.getElementById(id);
const glyph = n => String(n).replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
const BANK_SECONDS = 60;
const SLIDE_MS = 170;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fresh(best = 0) {
  return { board: initial(), discovered: [], banked: [], locked: [], mergeReady: [],
    score: 0, best, moves: 0, movesLeft: INITIAL_MOVES_LEFT,
    mergeCredit: 0, budgetRulesVersion: BUDGET_RULES_VERSION,
    stats: emptyRunStats(), resultsFinalized: false,
    resultsDismissed: false, over: false, notice: "" };
}
const CLASSIC_SAVE = "index-shuffle-v1";
const ROGUE_SAVE = "index-shuffle-roguelite-v1";
const MODE_SAVE = "index-shuffle-selected-mode-v1";
const ACHIEVEMENT_SAVE = "index-shuffle-roguelite-achievements-v1";
function savedAchievements() {
  try { return restoreAchievementProfile(JSON.parse(
    localStorage.getItem(ACHIEVEMENT_SAVE))); }
  catch { return restoreAchievementProfile(null); }
}
let achievementProfile = savedAchievements();
let recentAchievementIds = [];
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
  state.resultsFinalized = state.resultsFinalized === true;
  state.resultsDismissed = state.resultsDismissed === true;
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
    if (mode === "roguelite") {
      state.run = restoreEffectState(restoreShopState(
        restoreRogueliteRun(state.run, state.movesLeft)));
      state.hazards = restoreHazardLayer(state.hazards, state.board);
      state.run = restoreHazardPressure(state.run, state.board, state.hazards);
    } else {
      state.stats = restoreRunStats(state.stats);
    }
    state.over = mode === "roguelite" && state.run.phase !== "playing" ? false
      : currentGameEnded();
  }
}
let pending = null;
let bankTimer = null;
let remainingMs = BANK_SECONDS * 1000;
let deadline = 0;
let animating = false;
let animationToken = 0;
let pendingItem = null;
// Always open on the title screen. Starting, continuing, and playing are
// explicit navigation decisions; loading the title never writes a fake save.
let screen = "title";

function currentMovementRules() {
  return mode === "roguelite"
    ? { ...(bossMovementRules(state.run) || {}), hazards: state.hazards }
    : null;
}
function currentGameEnded() {
  const banked = new Set(state.banked), locked = new Set(state.locked);
  const ended = gameEnded(state.board, banked, locked,
    state.movesLeft, currentMovementRules());
  if (!ended || state.movesLeft <= 0 || mode !== "roguelite") return ended;
  // A held Hazard Eraser is a genuine rescue when removing a hazard
  // restores a bank or slide. Do not end the run before it can be used.
  return !(state.run.inventory?.consumables?.some(entry =>
    entry?.id === "hazard-eraser") && canRescueHazardLock(
      state.board, state.hazards, banked, locked,
      bossMovementRules(state.run)));
}

function persist() {
  try {
    localStorage.setItem(mode === "roguelite" ? ROGUE_SAVE : CLASSIC_SAVE,
      JSON.stringify(state));
    localStorage.setItem(ACHIEVEMENT_SAVE, JSON.stringify(achievementProfile));
  } catch { /* Storage may be unavailable in private mode. */ }
}

function awardRunEvent(event) {
  if (mode !== "roguelite") return;
  state.run.stats = recordRunStats(state.run.stats, event);
  const awarded = recordAchievementEvent(achievementProfile, event);
  achievementProfile = awarded.profile;
  if (awarded.unlockedNow.length) {
    state.run.stats = addEarnedToRunStats(state.run.stats, awarded.unlockedNow);
    recentAchievementIds = [...new Set([
      ...recentAchievementIds, ...awarded.unlockedNow
    ])];
  }
}

function finalizeGameIfNeeded() {
  if (!isFinishedRun(mode, state) || state.resultsFinalized) return;
  if (mode === "roguelite") {
    const awarded = recordAchievementEvent(achievementProfile,
      { type: "finish", score: state.run.totalScore });
    achievementProfile = awarded.profile;
    if (awarded.unlockedNow.length) {
      state.run.stats = addEarnedToRunStats(state.run.stats, awarded.unlockedNow);
      recentAchievementIds = awarded.unlockedNow;
    }
  }
  state.resultsFinalized = true;
}

function tileContent(t, badge = "") {
  return "<span>" + t.base + (t.exp === 1 ? "" : "<sup>" + t.exp + "</sup>") + "</span>" + badge;
}
function render() {
  renderNavigation(screen, saved("classic"), saved("roguelite"),
    mode, achievementProfile, resumeSavedGame);
  if (screen !== "game") {
    $("helpRogueBlock").hidden = false;
    return;
  }
  const rogue = mode === "roguelite";
  $("currentModeName").textContent = MODE_LABELS[mode];
  $("gameAchievements").hidden = !rogue;
  $("hazardSummary").hidden = !rogue;
  $("hazardNext").hidden = !rogue;
  if (rogue) {
    $("hazardCount").textContent = activeHazardCount(state.hazards) +
      " / " + MAX_ACTIVE_HAZARDS;
    const warning = state.run.hazardWarning;
    $("hazardNext").textContent = warning
      ? HAZARD_DEFINITIONS[warning.type].name +
        " square incoming on the next successful slide!"
      : state.run.round <= 3
        ? "Square hazards begin in Stage 2."
        : "New hazards may be warned one successful slide in advance.";
    $("hazardAlert").hidden = !warning;
    $("hazardAlert").textContent = warning
      ? "⚠ " + HAZARD_DEFINITIONS[warning.type].name +
        " hazard: marked square activates after your next slide." : "";
  } else {
    $("hazardAlert").hidden = true;
  }
  finalizeGameIfNeeded();
  $("achievementToast").hidden = !rogue || !recentAchievementIds.length;
  if (rogue && recentAchievementIds.length) {
    const names = recentAchievementIds.map(id =>
      ACHIEVEMENT_BY_ID[id]?.name).filter(Boolean);
    $("achievementToastText").textContent =
      (names.length > 1 ? "Achievements unlocked: " : "Achievement unlocked: ") +
      names.join(", ") + "!";
  }
  $("rogueProgress").hidden = !rogue;
  $("helpRogueBlock").hidden = !rogue;
  $("rogueEndSummary").hidden = !rogue || state.run.phase !== "victory";
  $("roundClearPanel").hidden = !rogue || state.run.phase !== "round-clear";
  $("nextRound").textContent = "Visit shop";
  $("endActions").querySelector("strong").textContent = rogue && state.run.phase === "victory"
    ? "Run completed!" : "Run finished";
  if (rogue) {
    $("rogueRound").textContent = "Stage " + stageForRound(state.run.round) +
      " · Round " + state.run.round + "/12" + (isBossRound(state.run.round) ? " · BOSS" : "");
    const boss = bossForRound(state.run);
    $("bossRule").hidden = !boss;
    $("bossName").textContent = boss ? boss.name : "";
    $("bossText").textContent = boss ? boss.summary : "";
    const target = bossTargetFor(state.run, targetForRound(state.run.round));
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
  const noBonusMoves = rogue && !bossAllowsMoveRestoration(state.run);
  $("mergeProgress").textContent = noBonusMoves ? "DISABLED" :
    state.mergeCredit + " / " + MERGES_PER_BONUS_MOVE;
  $("mergeMeterCaption").textContent = noBonusMoves
    ? "The Timekeeper: correct banking cannot restore moves this round."
    : "Bank two merged powers correctly to earn +1 move.";
  $("bonusMeter").value = noBonusMoves ? 0 : state.mergeCredit;
  $("bonusMeter").setAttribute("aria-valuetext", noBonusMoves
    ? "The Timekeeper prevents extra moves this round"
    : state.mergeCredit + " of " + MERGES_PER_BONUS_MOVE +
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
    const squareHazard = rogue ? hazardAt(state.hazards, i) : null;
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
      const gold = rogue ? goldTier(t) : 0;
      const available = isBankable(t, banked, i, locked,
        rogue ? state.hazards : null);
      const alreadyBanked = banked.has(key(t));
      const blocked = (t.exp >= 2 || gold > 0) && locked.has(i) &&
        (gold > 0 || !banked.has(key(t)));
      const strike = available && mergeReady.has(i) &&
        adjacentIndices(i).some(j => isBlocker(state.board[j]));
      const coinBadge = gold
        ? '<small class="tile-gold-mark" aria-hidden="true">◉' +
          (gold === 2 ? '×2' : '') + '</small>'
        : "";
      const curseBadge = rogue && Number.isInteger(t.curseLeft) && t.curseLeft > 0
        ? '<small class="tile-curse-mark" aria-hidden="true">3 · ' + t.curseLeft + '</small>'
        : "";
      button.innerHTML = tileContent(t, coinBadge + curseBadge + (available
        ? '<i aria-hidden="true">' + (strike ? '⚡' : '✦') + '</i>'
        : blocked ? '<i aria-hidden="true">⌛</i>' : ""));
      const description = t.base + " to the power " + t.exp;
      const goldCoins = gold ? goldForBank(t, mergeReady.has(i)) : 0;
      const goldHint = !gold || alreadyBanked ? "" :
        ". Golden tile: a correct bank earns " + goldCoins +
        (goldCoins === 1 ? " coin. Merge first to earn more." : " coins.");
      button.title = (alreadyBanked
        ? description + " was already banked this round. Gold does not allow it again."
        : blocked ? "Wait one slide before retrying " + description
        : strike ? "Bank " + description + " correctly to damage adjacent blocker"
        : available ? "Bank " + description : description) + goldHint +
        (curseBadge ? ". Three Curse: " + t.curseLeft +
          " successful slides until it becomes a blocker." : "");
      if (gold) {
        button.classList.add("gold-tile");
        if (gold === 2) button.classList.add("gold-double");
        if (alreadyBanked) button.classList.add("already-banked");
      }
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
    if (squareHazard) {
      button.classList.add("hazard-underlay");
      const description = hazardTileDescription(squareHazard,
        Boolean(t && !isBlocker(t) && !isWarning(t)));
      if (squareHazard.type === "cloudy") {
        // A cloud conceals its tile, but Hazard Eraser must remain a valid
        // target. Never leak base, exponent or gold via title or appearance.
        const erasing = selection && candidates.includes(i) &&
          state.run.inventory.consumables[selection.slot]?.id === "hazard-eraser";
        const label = erasing
          ? "Remove Cloudy hazard at row " + (Math.floor(i / 4) + 1) +
            ", column " + (i % 4 + 1) +
            ". The covered tile will not change." : description;
        button.title = label;
        button.setAttribute("aria-label", label);
        button.disabled = !erasing;
        button.classList.remove("bankable", "block-strike");
        button.replaceChildren();
      } else {
        button.title = (button.title ? button.title + ". " : "") + description;
        button.setAttribute("aria-label", button.title);
      }
    }
    if (rogue && state.run.hazardWarning?.index === i) {
      const type = HAZARD_DEFINITIONS[state.run.hazardWarning.type]?.name;
      if (type) {
        button.title = (button.title ? button.title + ". " : "") +
          "Incoming " + type + " square after the next slide.";
        button.setAttribute("aria-label", button.title);
      }
    }
    board.appendChild(button);
  });
  // Stationary hazard overlay comes after the 16 tiles. It never intercepts
  // banking or slide gestures, and slide animation still uses cells 0..15.
  if (rogue) {
    const eraseTargets = selection &&
      state.run.inventory.consumables[selection.slot]?.id === "hazard-eraser"
      ? candidates : [];
    renderHazardLayer(board, state.hazards, state.run.hazardWarning, eraseTargets);
  }
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
  renderFinalScreen(mode, state, achievementProfile);
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
function animateSlide(before, motions, mergedDestinations, spawned, damaged, destroyed,
  blockerAt, warningAt, beforeHazards = null) {
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
      (mode === "roguelite" && goldTier(t) ? " gold-tile" +
        (goldTier(t) === 2 ? " gold-double" : "") : "");
    ghost.style.left = (from.left - boardRect.left) + "px";
    ghost.style.top = (from.top - boardRect.top) + "px";
    ghost.style.width = from.width + "px";
    ghost.style.height = from.height + "px";
    // Never leak the identity of a tile emerging from beneath Cloudy via
    // the animation ghost. Once it has left the cloud, the real tile appears.
    const hiddenAtStart = beforeHazards?.[movement.from]?.type === "cloudy";
    ghost.innerHTML = hiddenAtStart ? '<span class="ghost-cloud-cover">☁ ?</span>'
      : tileContent(t, mode === "roguelite" && goldTier(t)
        ? '<small class="tile-gold-mark" aria-hidden="true">◉' +
          (goldTier(t) === 2 ? '×2' : '') + '</small>' : "");
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
  if (screen !== "game" || pendingItem !== null || state.over || pending !== null || animating || (mode === "roguelite" && state.run.phase !== "playing")) return;
  const before = state.board.slice();
  const beforeHazards = mode === "roguelite" ? state.hazards.slice() : null;
  let result = slide(before, direction, currentMovementRules());
  if (!result.changed) return;
  if (mode === "roguelite") {
    result = resolveSlideHazards(result, state.hazards);
    state.hazards = result.hazards;
  }
  recentAchievementIds = [];
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
  const curse = mode === "roguelite"
    ? applyThreeCurse(result.board, result.mergeDestinations,
      state.run, new Set(state.banked), state.hazards)
    : { board: result.board, expired: [], spared: [] };
  if (curse.expired.length) {
    const expired = new Set(curse.expired);
    state.mergeReady = state.mergeReady.filter(i => !expired.has(i));
  }
  if (mode === "roguelite") state.run.totalSlides += 1;
  const hazardMoves = mode === "roguelite"
    ? Math.max(0, nextMove - state.run.blockerDelay) : nextMove;
  // Blocker warnings must never be placed beneath a square hazard.
  // A pending hazard is also kept free for its one-slide preview.
  const hazardAvoid = new Set(mode === "roguelite"
    ? state.hazards.map((entry, i) => entry ? i : -1).filter(i => i >= 0)
    : []);
  if (mode === "roguelite" && state.run.hazardWarning) {
    hazardAvoid.add(state.run.hazardWarning.index);
  }
  const spawned = turnSpawns(curse.board, new Set(state.discovered),
    hazardMoves, Math.random, hazardAvoid,
    mode === "roguelite" ? state.run.totalSlides : nextMove,
    currentMovementRules());
  if (mode === "roguelite") {
    const gold = markGoldSpawns(spawned.board, spawned.spawned,
      state.run.goldDryStreak, Math.random, true, goldChancesForRun(state.run));
    state.board = gold.board;
    state.run.goldDryStreak = gold.dryStreak;
    // A Three Curse may have turned a previously hazardous number into
    // a blocker; no board hazard is allowed to remain under that obstacle.
    state.hazards = restoreHazardLayer(state.hazards, state.board);
  } else {
    state.board = spawned.board;
  }
  const hazardStep = mode === "roguelite"
    ? progressHazardRound(state.board, state.hazards, state.run, nextMove,
      { rng: Math.random, boss: isBossRound(state.run.round),
        banked: new Set(state.banked), locked: new Set(),
        movesLeft: state.movesLeft,
        movementRules: bossMovementRules(state.run) })
    : null;
  if (hazardStep) {
    state.hazards = hazardStep.hazards;
    state.run = hazardStep.run;
  }
  const progression = mode === "roguelite" ? state.run.totalSlides : nextMove;
  const previousProgression = mode === "roguelite" ? progression - 1 : state.moves;
  const unlockedNow = activeBases(progression)
    .filter(base => !activeBases(previousProgression).includes(base));
  state.moves = nextMove;
  if (mode === "roguelite") {
    state.run.stats = recordSuccessfulSlide(state.run.stats);
  } else {
    state.stats = recordSuccessfulSlide(state.stats);
  }
  // A successful slide clears the incorrect-attempt and banking cooldowns.
  state.locked = [];
  const news = [];
  if (mode === "roguelite") {
    for (const event of result.hazardEvents) {
      if (event.type === "void") news.push(
        "Void reduced a power from exponent " + event.before +
        " to " + event.after + ".");
      if (event.type === "cracked") news.push(
        "Cracked became Null after that merge.");
      if (event.type === "cloud-cleared") news.push("A Cloudy square cleared.");
      if (event.type === "greedy") news.push(
        "Greedy stole gold from " + event.count +
        (event.count === 1 ? " tile." : " tiles."));
    }
    for (const event of hazardStep.events) {
      const name = HAZARD_DEFINITIONS[event.type].name;
      if (event.kind === "warning") news.unshift(
        "Watch out! " + name + " will appear on the marked square next slide.");
      if (event.kind === "appeared") news.unshift(
        name + " hazard appeared on the warned square!");
      if (event.kind === "dispelled") news.push(
        "An incoming " + name + " hazard dissipated safely.");
    }
  }
  if (curse.expired.length) news.push(curse.expired.length +
    " cursed base-3 power" + (curse.expired.length === 1 ? " became a blocker!" :
      "s became blockers!"));
  if (curse.spared.length) news.push("A base-3 curse expired without blocking a safe path.");
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
  state.over = currentGameEnded();
  render();
  animateSlide(before, result.motions, new Set(result.mergeDestinations),
    spawned.spawned, result.damaged, result.destroyed,
    spawned.blockerAt, spawned.warningAt, beforeHazards);
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
  if (screen !== "game" || pendingItem !== null || state.over || animating || pending !== null || (mode === "roguelite" && state.run.phase !== "playing")) return;
  const t = state.board[i];
  if (!isBankable(t, new Set(state.banked), i, new Set(state.locked),
      mode === "roguelite" ? state.hazards : null)) return;
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
  const previewScore = bonuses
    ? bossPointsFor(state.run, t, bonuses.score) : null;
  const goldHelp = mode !== "roguelite" || !goldTier(t) ? "" :
    " Banking this golden tile correctly earns " +
    (bankGold + (bonuses?.extraCoins ?? 0)) +
    " " + (bankGold + (bonuses?.extraCoins ?? 0) === 1 ? "coin" : "coins") +
    (bankGold === 1 ? ". Merge it first to earn a bigger reward." : ".");
  $("promptHelp").textContent = (canStrike
    ? "Correct answer: bank this power and damage the nearby blocker."
    : "Calculate its exact value to bank this power.") + goldHelp +
    (bonuses ? " Correct bank scores " + previewScore + " points." +
      (previewScore === 0 && bonuses.score > 0
        ? " The boss prevents this power from scoring." : "") : "");
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
  state.over = currentGameEnded();
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
    blockerDamage: bonuses?.blockerHits ?? 1,
    hazards: mode === "roguelite" ? state.hazards : null
  });
  if (outcome.status === "incorrect") {
    lockPending("wrong");
    return;
  }
  if (outcome.status !== "success") return;
  recentAchievementIds = [];
  closeBank();
  state.board = outcome.board;
  state.mergeReady = state.mergeReady.filter(index => index !== i);
  // A correctly banked power becomes a smaller replacement in the same
  // square, with the existing one-successful-slide banking cooldown.
  if (!state.locked.includes(i)) state.locked.push(i);
  state.banked.push(outcome.powerKey);
  // Correct answers for genuinely merged tiles are the ONLY source of
  // extra moves. A correctly banked random-spawn power earns score only.
  const canRestore = mode !== "roguelite" || bossAllowsMoveRestoration(state.run);
  const award = canRestore
    ? creditCorrectBank(state.movesLeft, state.mergeCredit, outcome.creditedMerge)
    : { movesLeft: state.movesLeft, mergeCredit: 0, earned: 0 };
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
    if (!canRestore) {
      state.notice += " The Timekeeper blocks extra moves this round.";
    } else if (award.earned) {
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

  // Track only mathematically correct bank submissions. Gold cannot earn
  // an award from merely spawning, merging, or an incorrect answer.
  const bankEvent = {
    type: "bank", points: points.points, exponent: t.exp,
    goldTier: mode === "roguelite" ? goldTier(t) : 0,
    goldCoins: mode === "roguelite" ? points.bankGold : 0,
    blockersDestroyed: destroyed.length
  };
  if (mode === "roguelite") {
    awardRunEvent(bankEvent);
    if (points.cleared) {
      awardRunEvent({
        type: "round-clear", movesLeft: state.movesLeft,
        boss: isBossRound(state.run.round),
        victory: state.run.phase === "victory"
      });
    }
  } else {
    state.stats = recordRunStats(state.stats, bankEvent);
  }
  state.over = mode === "roguelite" && state.run.phase !== "playing" ? false :
    currentGameEnded();
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
function closeNavigationDialogs() {
  stopMotion();
  closeBank();
  pendingItem = null;
  recentAchievementIds = [];
  for (const id of ["shopDialog", "resultsDialog", "achievementsDialog"]) {
    if ($(id).open) $(id).close();
  }
}

function rememberMode(selected) {
  try { localStorage.setItem(MODE_SAVE, selected); }
  catch { /* Game still works when browser storage is disabled. */ }
}

function loadSavedGame(snapshot) {
  state = snapshot;
  Object.assign(state, restoreMoveBudget(state));
  state.resultsFinalized = state.resultsFinalized === true;
  state.resultsDismissed = state.resultsDismissed === true;
  state.locked = Array.isArray(state.locked) ? state.locked : [];
  state.mergeReady = Array.isArray(state.mergeReady) ? state.mergeReady : [];
  state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
  state.banked = Array.isArray(state.banked) ? state.banked : [];
  if (mode === "roguelite") {
    state.run = restoreEffectState(restoreShopState(
      restoreRogueliteRun(state.run, state.movesLeft)));
    state.hazards = restoreHazardLayer(state.hazards, state.board);
    state.run = restoreHazardPressure(state.run, state.board, state.hazards);
    state.over = state.run.phase === "playing" ? currentGameEnded() : false;
  } else {
    state.stats = restoreRunStats(state.stats);
    state.over = currentGameEnded();
  }
}

function beginNewMode(selected, skipConfirmation = false) {
  if (!Object.hasOwn(MODE_LABELS, selected)) return;
  const previous = saved(selected);
  if (!skipConfirmation && resumableSave(selected, previous) &&
      !window.confirm("Start a new " + MODE_LABELS[selected] +
        " game? This will replace your unfinished " + MODE_LABELS[selected] +
        " save. The other game and achievements will be kept.")) return;
  if (screen === "game") persist();
  closeNavigationDialogs();
  mode = selected;
  rememberMode(mode);
  const best = Number.isSafeInteger(previous?.best) ? previous.best : 0;
  state = mode === "roguelite" ? newRogueliteRun(best) : fresh(best);
  screen = "game";
  render();
  $("headerTitle").focus();
}

function resumeSavedGame(selected) {
  const snapshot = saved(selected);
  if (!resumableSave(selected, snapshot)) {
    screen = "continue";
    render();
    return;
  }
  if (screen === "game") persist();
  closeNavigationDialogs();
  mode = selected;
  rememberMode(mode);
  loadSavedGame(snapshot);
  screen = "game";
  render();
  // A Roguelike shop resumes in its modal, including its existing stock.
  if (!$("shopDialog").open) $("headerTitle").focus();
}

function returnToTitle() {
  if (screen === "game") {
    if (isFinishedRun(mode, state)) state.resultsDismissed = true;
    persist();
  }
  closeNavigationDialogs();
  screen = "title";
  render();
  $("titleNew").focus();
}

function navigateTo(scene) {
  if (!["title", "new", "continue"].includes(scene)) return;
  if (scene === "title") { returnToTitle(); return; }
  screen = scene;
  render();
  (scene === "new" ? $("modeClassic") : $("continueBack")).focus();
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
    recentAchievementIds = [];
    awardRunEvent({ type: "consumable" });
    state.over = currentGameEnded();
  } catch (error) {
    pendingItem = null;
    state.notice = error instanceof Error ? error.message : "Unable to use that item.";
  }
  render();
}

function beginConsumable(slot) {
  if (screen !== "game" || mode !== "roguelite" || pending !== null || animating ||
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
$("titleNew").addEventListener("click", () => navigateTo("new"));
$("titleContinue").addEventListener("click", () => navigateTo("continue"));
$("newGameBack").addEventListener("click", returnToTitle);
$("continueBack").addEventListener("click", returnToTitle);
$("headerTitle").addEventListener("click", returnToTitle);
$("returnTitleFromEnd").addEventListener("click", returnToTitle);
$("modeClassic").addEventListener("click", () => beginNewMode("classic"));
$("modeRoguelite").addEventListener("click", () => beginNewMode("roguelite"));
$("resultsPlayAgain").addEventListener("click", () => beginNewMode(mode, true));

function dismissResults() {
  state.resultsDismissed = true;
  if ($("resultsDialog").open) $("resultsDialog").close();
  persist();
}
$("resultsClose").addEventListener("click", dismissResults);
$("resultsBack").addEventListener("click", returnToTitle);
$("resultsDialog").addEventListener("cancel", () => {
  state.resultsDismissed = true;
  persist();
});
$("viewResults").addEventListener("click", () => {
  if (!isFinishedRun(mode, state)) return;
  state.resultsDismissed = false;
  render();
});
function showAchievements() {
  openAchievementGallery(achievementProfile);
}
$("achievementOpen").addEventListener("click", showAchievements);
$("gameAchievements").addEventListener("click", showAchievements);
$("achievementToastView").addEventListener("click", showAchievements);
$("resultsAllAchievements").addEventListener("click", showAchievements);
$("achievementsClose").addEventListener("click",
  () => $("achievementsDialog").close());
$("nextRound").addEventListener("click", () => {
  if (mode !== "roguelite" || state.run.phase !== "round-clear") return;
  stopMotion();
  state = enterRogueliteShop(state);
  render();
});
function applyShopAction(reducer, kind = null) {
  if (mode !== "roguelite" || state.run.phase !== "shop") return;
  try {
    state = reducer(state);
    recentAchievementIds = [];
    if (kind === "purchase") {
      awardRunEvent({ type: "purchase",
        fullBuild: state.run.inventory.permanents.every(Boolean) });
    }
  } catch (error) {
    state.run.shop.notice = error instanceof Error ? error.message : "Unable to complete that action.";
  }
  render();
}
$("shopReroll").addEventListener("click", () => {
  applyShopAction(value => rerollRogueliteShop(value));
});
$("shopReturnTitle").addEventListener("click", returnToTitle);
$("shopContinue").addEventListener("click", () => {
  if (mode !== "roguelite" || state.run.phase !== "shop") return;
  stopMotion();
  state = advanceRogueliteRound(state, Math.random, goldChancesForRun(state.run));
  recentAchievementIds = [];
  render();
});
// Escape cannot dismiss the modal while the game is in its saved shop phase.
// The Start round button is always available, even if there are no coins.
$("shopDialog").addEventListener("cancel", event => event.preventDefault());
// Title and New Game are the only places to choose a mode.
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
  if (screen !== "game" || $("shopDialog").open ||
      $("achievementsDialog").open || $("resultsDialog").open) return;
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
