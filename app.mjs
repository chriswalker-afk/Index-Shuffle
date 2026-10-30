import {
  key, slide, spawn, initial, canMove, isBankable,
  bankReplacement, checkAnswer, scoreFor
} from "./engine.mjs";

const $ = id => document.getElementById(id);
const glyph = n => String(n).replace(/\d/g, d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
const BANK_SECONDS = 60;
const SLIDE_MS = 170;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fresh(best = 0) {
  return { board: initial(), discovered: [], banked: [], locked: [],
    score: 0, best, moves: 0, over: false, notice: "" };
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
  state.notice = "";
  state.over = !canMove(state.board, new Set(state.banked), new Set(state.locked));
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
  $("score").textContent = state.score;
  $("best").textContent = state.best;
  $("count").textContent = state.banked.length;
  $("moves").textContent = state.moves;
  const board = $("board");
  board.innerHTML = "";

  state.board.forEach((t, i) => {
    const button = document.createElement("button");
    button.className = "cell" + (t ? " tile base" + t.base : "");
    button.setAttribute("role", "gridcell");
    button.type = "button";
    if (t) {
      const available = isBankable(t, banked, i, locked);
      const blocked = t.exp >= 2 && locked.has(i) && !banked.has(key(t));
      button.innerHTML = tileContent(t, available
        ? '<i aria-hidden="true">✦</i>'
        : blocked ? '<i aria-hidden="true">⌛</i>' : "");
      const description = t.base + " to the power " + t.exp;
      button.title = blocked ? "Wait one slide before retrying " + description
        : available ? "Bank " + description : description;
      button.setAttribute("aria-label", button.title);
      if (blocked) button.classList.add("locked");
      if (available) {
        button.classList.add("bankable");
        button.addEventListener("click", () => openBank(i));
      }
    } else {
      button.disabled = true;
    }
    board.appendChild(button);
  });

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
  $("status").textContent = state.over
    ? "No slides or bankable powers remain. Game over!"
    : state.notice || "Tap a glowing power to bank it, or keep merging.";
  $("stage").textContent = state.over ? "GAME OVER" : "SURVIVAL MODE";
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
function animateSlide(before, motions, mergedDestinations, spawnedAt) {
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
    cells[spawnedAt]?.classList.add("spawn-flash");
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
  state.board = spawn(result.board, new Set(state.discovered));
  const spawnedAt = state.board.findIndex((t, i) => Boolean(t && !result.board[i]));
  state.moves++;
  state.locked = []; // Only a successful board slide removes a failed-attempt lock.
  state.notice = "";
  state.over = !canMove(state.board, new Set(state.banked), new Set());
  render();
  const mergedDestinations = new Set(result.motions.filter(m => m.merged).map(m => m.to));
  animateSlide(before, result.motions, mergedDestinations, spawnedAt);
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
  state.over = !canMove(state.board, new Set(state.banked), new Set(state.locked));
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
  if (!checkAnswer(t, $("answer").value)) {
    lockPending("wrong");
    return;
  }
  if (!state.board[i] || key(state.board[i]) !== key(t)) return;
  const replacement = bankReplacement(t, new Set(state.discovered));
  closeBank();
  state.board[i] = replacement; // Banking retains a tile in the occupied square.
  state.banked.push(key(t));
  const points = scoreFor(t);
  state.score += points;
  state.best = Math.max(state.best, state.score);
  state.notice = "Banked " + t.base + glyph(t.exp) + " for " + points
    + " points. " + replacement.base + glyph(replacement.exp) + " remains on the board.";
  state.over = !canMove(state.board, new Set(state.banked), new Set(state.locked));
  render();
  if (!prefersReducedMotion()) $("board").children[i]?.classList.add("bank-flash");
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
