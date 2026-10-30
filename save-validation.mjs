// Conservative validation for untrusted or interrupted browser saves.
// Earlier versions are accepted, but malformed board objects/indices/keys
// cannot reach the render or movement engines as if they were real powers.
const BASES = new Set([2, 3, 5, 7, 11, 13]);
const POWER_KEY = /^(2|3|5|7|11|13)-([1-9]\d*)$/;
const cell = value => Number.isSafeInteger(value) &&
  value >= 0 && value < 16;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;

export function validSavedBoard(board) {
  return Array.isArray(board) && board.length === 16 &&
    board.every(t => {
      if (t === null) return true;
      if (!t || typeof t !== "object" || Array.isArray(t)) return false;
      if (t.kind === "blocker") return nonnegative(t.hits) &&
        (t.strength === undefined ||
          (Number.isSafeInteger(t.strength) && t.strength >= 1 &&
           t.strength <= 5));
      if (t.kind === "warning") return t.strength === undefined ||
        (Number.isSafeInteger(t.strength) && t.strength >= 1 &&
         t.strength <= 5);
      return t.kind === undefined && BASES.has(t.base) &&
        Number.isSafeInteger(t.exp) && t.exp >= 1 && t.exp <= 100 &&
        (t.gold === undefined || [0, 1, 2].includes(t.gold)) &&
        (t.prism === undefined || t.prism === 1) &&
        (t.curseLeft === undefined ||
          (Number.isSafeInteger(t.curseLeft) &&
            t.curseLeft >= 0 && t.curseLeft <= 3));
    });
}

const normaliseKeys = values => !Array.isArray(values) ? [] :
  [...new Set(values.filter(value => typeof value === "string" &&
    POWER_KEY.test(value) && Number.isSafeInteger(Number(value.split("-")[1]))))];
const normaliseCells = values => !Array.isArray(values) ? [] :
  [...new Set(values.filter(cell))];

export function sanitiseSavedGame(snapshot) {
  if (!snapshot || typeof snapshot !== "object" ||
      !validSavedBoard(snapshot.board)) throw new RangeError("Invalid saved board");
  const clean = { ...snapshot };
  clean.banked = normaliseKeys(snapshot.banked);
  clean.discovered = normaliseKeys(snapshot.discovered);
  clean.locked = normaliseCells(snapshot.locked);
  clean.mergeReady = normaliseCells(snapshot.mergeReady);
  clean.resultsFinalized = snapshot.resultsFinalized === true;
  clean.resultsDismissed = snapshot.resultsDismissed === true;
  clean.score = nonnegative(snapshot.score) ? snapshot.score : 0;
  clean.best = nonnegative(snapshot.best) ? snapshot.best : 0;
  clean.moves = nonnegative(snapshot.moves) ? snapshot.moves : 0;
  clean.notice = "";
  return clean;
}
