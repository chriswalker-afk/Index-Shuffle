// Safe local persistence for playable sessions with restricted or corrupt
// browser storage. Memory fallback lasts only until this tab is closed.
// Keep the existing storage keys and JSON save format unchanged.
export function createSafeStore(openStorage) {
  if (typeof openStorage !== "function") {
    throw new TypeError("A storage provider function is required");
  }
  const memory = new Map();
  const corrupted = new Set();
  let unavailable = false;

  function readText(key) {
    if (corrupted.has(key)) return null;
    if (memory.has(key)) return memory.get(key);
    try {
      return openStorage().getItem(key);
    } catch {
      unavailable = true;
      return null;
    }
  }
  function readJSON(key) {
    const text = readText(key);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      corrupted.add(key);
      return null;
    }
  }
  // Value strings are always copied into the tab's memory first.
  // A failed durable write can never erase this session's last good state.
  function writeEntries(entries, { recover = false } = {}) {
    if (!Array.isArray(entries)) throw new TypeError("Invalid save entries");
    let okay = true;
    for (const [key, value] of entries) {
      if (typeof key !== "string" || typeof value !== "string") {
        throw new TypeError("Expected a storage key and a string value");
      }
      memory.set(key, value);
      try {
        openStorage().setItem(key, value);
        corrupted.delete(key);
      } catch {
        unavailable = true;
        okay = false;
      }
    }
    if (okay && recover) unavailable = false;
    return okay;
  }
  function writeJSON(entries, opts = {}) {
    const data = [];
    try {
      for (const [key, snapshot] of entries) {
        data.push([key, JSON.stringify(snapshot)]);
      }
    } catch {
      unavailable = true;
      return false;
    }
    return writeEntries(data, opts);
  }
  function status() {
    return unavailable ? "unavailable" : corrupted.size ? "corrupt" : null;
  }
  function markCorrupt(key) {
    corrupted.add(key);
  }
  return { readText, readJSON, writeEntries, writeJSON, status, markCorrupt };
}
