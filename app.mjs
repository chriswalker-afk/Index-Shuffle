import {
  key, slide, turnSpawns, initial, canMove, isBankable, isBlocker, isWarning,
  blockerStrength, blockerHitsForMove, BLOCKER_START, BLOCKER_INTERVAL, MAX_BLOCKERS,
  mergeReadyAfterSlide, attemptBank, adjacentIndices, activeBases, BASE_UNLOCKS,
  INITIAL_MOVES_LEFT, MAX_MOVES_LEFT, MERGES_PER_BONUS_MOVE,
  spendMove, slideCost, creditCorrectBank, gameEnded
} from "./engine.mjs?v=banked-moves-v2";

const $ = id => document.getElementById(id);
const glyph = n => String(n).replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
const BANK_SECONDS = 60;
const SLIDE_MS = 170;
const BUDGET_RULES_VERSION = 2;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fresh(best = 0) {
  return { board: initial(), discovered: [], banked: [], locked: [], mergeReady: [],
    score: 0, best, moves: 0, movesLeft: INITIAL_MOVES_LEFT,
    mergeCredit: 0, budgetRulesVersion: BUDGET_RULES_VERSION,
    over: false, notice: "" };
}
function saved() {
  try { return JSON.parse(localStorage.getItem("index-shuffle-v1")); }
  catch { return null; }
}
let state = saved();
if (!state || !Array.isArray(state.board) || state.board.length !== 16) {
  state = fresh();
} else {
  // Previous games did not track temporary banking lockouts.
  state.locked = Array.isArray(state.locked) ? state.locked : [];
  state.discovered = Array.isArray(state.discovered) ? state.discovered : [];
  state.banked = Array.isArray(state.banked) ? state.banked : [];
  // Earlier saves never recorded which tiles came from genuine merges.
  // They remain playable; new merges earn bank-triggered blocker hits.
  state.mergeReady = Array.isArray(state.mergeReady) ? state.mergeReady : [];
  // Version 1 awarded moves for unbanked merges. Reset just that old
  // balance and progress once; preserve the board, score and slide count.
  if (state.budgetRulesVersion !== BUDGET_RULES_VERSION) {
    state.movesLeft = INITIAL_MOVES_LEFT;
    state.mergeCredit = 0;
    state.budgetRulesVersion = BUDGET_RULES_VERSION;
  } else {
    state.movesLeft = Number.isSafeInteger(state.movesLeft)
      ? Math.min(MAX_MOVES_LEFT, Math.max(0, state.movesLeft))
      : INITIAL_MOVES_LEFT;
    state.mergeCredit = Number.isSafeInteger(state.mergeCredit) &&
      state.mergeCredit >= 0 && state.mergeCredit < MERGES_PER_BONUS_MOVE
      ? state.mergeCredit : 0;
  }
  state.notice = "";
  state.over = gameEnded(state.board, new Set(state.banked),
    new Set(state.locked), state.movesLeft);
}
let pending = null;
let bankTimer = null;
let remainingMs = BANK_SECONDS * 1000;
let deadline = 0;
let animating = false;
let animationToken = 0;

function persist() {
  try { localStorage.setItem("index-shuffle-v1", JSON.stringify(state)); }
  catch { /* Storage may be unavailable in private mode. */ }
}

function tileContent(t, badge = "") {
  return "<span>" + t.base + (t.exp === 1 ? "" : "<sup>" + t.exp + "</sup>") + "</span>" + badge;
}
function render() {
  const banked = new Set(state.banked);
  const locked = new Set(state.locked);
  const mergeReady = new Set(state.mergeReady);
  $("score").textContent = state.score;
  $("best").textContent = state.best;
  $("count").textContent = state.banked.length;
  $("moves").textContent = state.moves;
  $("movesLeft").textContent = state.movesLeft;
  $("mergeProgress").textContent = state.mergeCredit + " / " +
    MERGES_PER_BONUS_MOVE + " correctly banked merges";
  const currentSlideCost = slideCost(state.board);
  $("slideCost").textContent = "Next slide costs " + currentSlideCost +
    (currentSlideCost === 1 ? " move" : " moves");
  $("movesCard").classList.toggle("low-moves", state.movesLeft > 0 &&
    state.movesLeft <= 3);
  $("movesCard").classList.toggle("empty-moves", state.movesLeft === 0);
  const active = activeBases(state.moves);
  $("activeBases").innerHTML = active.map(base =>
    '<span class="base-chip base' + base + '">' + base + '</span>').join("");
  const upcoming = BASE_UNLOCKS.find(step => state.moves < step.moves);
  $("nextBase").textContent = upcoming
    ? "Next: " + upcoming.base + " at move " + upcoming.moves
    : "All six bases unlocked";
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
      button.innerHTML = tileContent(t, available
        ? '<i aria-hidden="true">' + (strike ? '⚡' : '✦') + '</i>'
        : blocked ? '<i aria-hidden="true">⌛</i>' : "");
      const description = t.base + " to the power " + t.exp;
      button.title = blocked ? "Wait one slide before retrying " + description
        : strike ? "Bank " + description + " correctly to damage adjacent blocker"
        : available ? "Bank " + description : description;
      button.setAttribute("aria-label", button.title);
      if (blocked) button.classList.add("locked");
      if (strike) button.classList.add("block-strike");
      if (available) {
        button.classList.add("bankable");
        button.addEventListener("click", () => openBank(i));
      }
    } else {
      button.disabled = true;
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
    const firstWarning = BLOCKER_START - 1;
    const nextWarningMove = state.moves < firstWarning ? firstWarning
      : firstWarning + (Math.floor((state.moves - firstWarning) / BLOCKER_INTERVAL) + 1)
        * BLOCKER_INTERVAL;
    $("blockerNext").textContent = "Next warning: move " + nextWarningMove
      + " · tier " + blockerHitsForMove(nextWarningMove + 1);
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
  $("status").textContent = state.movesLeft === 0
    ? "Out of moves! Game over. Bank two merged powers correctly to earn a move."
    : state.over ? "No legal slides or bankable powers remain. Game over!"
    : state.notice ||
      (state.movesLeft <= 3
        ? "Low on moves! Correctly bank two merged powers to regain one."
        : "Slide to merge powers, then bank them correctly for move bonuses.");
  $("stage").textContent = state.movesLeft === 0
    ? "OUT OF MOVES" : state.over ? "GAME OVER" : "SURVIVAL MODE";
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
    ghost.className = "tile-ghost base" + t.base;
    ghost.style.left = (from.left - boardRect.left) + "px";
    ghost.style.top = (from.top - boardRect.top) + "px";
    ghost.style.width = from.width + "px";
    ghost.style.height = from.height + "px";
    ghost.innerHTML = tileContent(t);
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
  if (state.over || pending !== null || animating) return;
  const before = state.board.slice();
  const result = slide(before, direction);
  if (!result.changed) return;
  for (const t of result.merges) {
    if (t.exp >= 2 && !state.discovered.includes(key(t))) state.discovered.push(key(t));
  }
  const nextMove = state.moves + 1;
  // Snapshot active blockers BEFORE the slide. A warning that matures
  // on this slide only increases the cost of the following slide.
  const activeBlockers = slideCost(before) - 1;
  const budget = spendMove(state.movesLeft, activeBlockers);
  state.movesLeft = budget.movesLeft;
  // No reward here, no matter how many tiles merged. Correct banking
  // of a merged power is the only way to advance mergeCredit.
  // Keep merge provenance attached to its tile as it slides, and mark
  // newly merged powers. Spawned powers never inherit that provenance.
  state.mergeReady = mergeReadyAfterSlide(state.mergeReady, result.motions);
  const spawned = turnSpawns(result.board, new Set(state.discovered),
    nextMove, Math.random);
  state.board = spawned.board;
  const unlockedNow = activeBases(nextMove)
    .filter(base => !activeBases(state.moves).includes(base));
  state.moves = nextMove;
  // A successful slide clears the incorrect-attempt and banking cooldowns.
  state.locked = [];
  const news = [];
  news.push("Slide cost: " + budget.cost +
    (budget.cost === 1 ? " move." : " moves."));
  if (unlockedNow.length) news.push("Unlocked base " + unlockedNow.join(", ") + "!");
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
  state.notice = news.join(" ");
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
  if (state.over || animating || pending !== null) return;
  const t = state.board[i];
  if (!isBankable(t, new Set(state.banked), i, new Set(state.locked))) return;
  pending = { i, t };
  remainingMs = BANK_SECONDS * 1000;
  $("promptTitle").textContent = t.base + glyph(t.exp) + " = ?";
  $("feedback").textContent = "";
  $("answer").value = "";
  const canStrike = state.mergeReady.includes(i) &&
    adjacentIndices(i).some(j => isBlocker(state.board[j]));
  $("promptHelp").textContent = canStrike
    ? "Bank this merged power correctly to damage the nearby blocker. "
      + "You have 60 seconds; an incorrect answer or timeout locks this tile "
      + "until your next valid slide."
    : "You have 60 seconds to enter the exact value. "
      + "Only correctly banking a merged power beside a blocker can damage it. "
      + "An incorrect answer or timeout locks this tile until your next valid slide.";
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
  const outcome = attemptBank(state.board, i, $("answer").value, {
    discovered: new Set(state.discovered),
    banked: new Set(state.banked),
    locked: new Set(state.locked),
    mergeReady: new Set(state.mergeReady)
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
  state.score += outcome.points;
  state.best = Math.max(state.best, state.score);
  const { replacement, damaged, destroyed } = outcome;
  state.notice = "Banked " + t.base + glyph(t.exp) + " for " + outcome.points
    + " points. " + replacement.base + glyph(replacement.exp)
    + " remains. Slide once before banking that replacement.";
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
  state.over = gameEnded(state.board, new Set(state.banked),
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
$("new").addEventListener("click", () => {
  if (!confirm("Start a new game? Your current run will be replaced.")) return;
  const best = state.best;
  stopMotion();
  closeBank();
  state = fresh(best);
  render();
});
const keys = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  a: "left", d: "right", w: "up", s: "down"
};
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && pending !== null) { closeBank(); return; }
  if (pending !== null || ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
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
