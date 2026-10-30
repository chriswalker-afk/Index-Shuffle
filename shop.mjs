// Roguelite shop and two-slot inventory system. Gameplay effects are applied in effects.mjs.
// Pure reducers make purchases, resale, replacement and rerolls testable.
import { validRogueliteRun } from "./roguelite.mjs?v=hazard-pass4-v1";

export const INVENTORY_SLOTS = 2;
export const SHOP_OFFERS_PER_TYPE = 2;
export const INITIAL_REROLL_COST = 1;
export const SHOP_TYPES = Object.freeze(["permanents", "consumables"]);

// Stable IDs and purchase prices ensure upgrades survive save migrations.
export const ITEM_CATALOG = Object.freeze([
  { id: "opening-act", name: "Opening Act", type: "permanents", price: 6, description: "First scored power each round earns double points." },
  { id: "twin-twos", name: "Twin Twos", type: "permanents", price: 6, description: "First two correctly banked base-2 powers each round score double." },
  { id: "lucky-sevens", name: "Lucky Sevens", type: "permanents", price: 5, description: "Base-7 tiles are more likely to spawn gold." },
  { id: "threes-company", name: "Three's Company", type: "permanents", price: 5, description: "Banking a merged base-3 power delays the next blocker." },
  { id: "big-powers", name: "Big Powers", type: "permanents", price: 7, description: "Banking exponent-4 or higher powers earns 2 bonus points." },
  { id: "square-specialist", name: "Square Specialist", type: "permanents", price: 4, description: "Banking squares earns 1 bonus point." },
  { id: "five-alive", name: "Five Alive", type: "permanents", price: 4, description: "Base-5 powers score double points." },
  { id: "variety-bonus", name: "Variety Bonus", type: "permanents", price: 6, description: "Bank a different base from last time for 2 extra points." },
  { id: "golden-calculator", name: "Golden Calculator", type: "permanents", price: 7, description: "Every correctly banked golden tile earns an extra coin, including exponent 1." },
  { id: "blockbuster", name: "Blockbuster", type: "permanents", price: 6, description: "Correctly banked merged powers deal an extra hit to adjacent blockers." },
  { id: "lucky-spawn", name: "Lucky Spawn", type: "permanents", price: 8, description: "New tiles have a higher chance of being golden." },
  { id: "bulk-discount", name: "Bulk Discount", type: "permanents", price: 7, description: "All future shop items cost one coin less (minimum one)." },
  { id: "block-breaker", name: "Block Breaker", type: "consumables", price: 2, description: "Remove one active blocker." },
  { id: "hazard-eraser", name: "Hazard Eraser", type: "consumables", price: 3, description: "Remove one active Cloudy, Void, Null, Cracked or Greedy square without changing its tile." },
  { id: "power-surge", name: "Power Surge", type: "consumables", price: 3, description: "Raise the exponent of one power by 1." },
  { id: "second-wind", name: "Second Wind", type: "consumables", price: 3, description: "Restore 2 moves, up to the maximum." },
  { id: "alchemist", name: "Alchemist", type: "consumables", price: 2, description: "Change one base-3 number tile into base 5." },
  { id: "protection", name: "Protection", type: "consumables", price: 3, description: "Ignore blocker move surcharges for the next two slides." },
  { id: "gold-touch", name: "Gold Touch", type: "consumables", price: 4, description: "Make one number tile golden." },
  { id: "position-swap", name: "Position Swap", type: "consumables", price: 3, description: "Swap the positions of two number tiles." },
  { id: "delay-tactics", name: "Delay Tactics", type: "consumables", price: 2, description: "Delay the next scheduled blocker by two slides." },
  { id: "clear-space", name: "Clear Space", type: "consumables", price: 2, description: "Remove one ordinary number tile without scoring." },
  { id: "second-chance", name: "Second Chance", type: "consumables", price: 2, description: "Unlock one temporarily locked banking attempt." }
].map(item => Object.freeze(item)));
export const ITEM_BY_ID = Object.freeze(
  Object.fromEntries(ITEM_CATALOG.map(item => [item.id, item]))
);

// The permanent discount applies only when it was already equipped before
// this purchase. Refunds use the actual amount paid, not the catalogue price.
export function shopItemPrice(run, itemOrId) {
  const item = typeof itemOrId === "string" ? ITEM_BY_ID[itemOrId] : itemOrId;
  if (!item || !ITEM_BY_ID[item.id]) throw new RangeError("Unknown shop item");
  const discounted = run?.inventory?.permanents?.some(entry =>
    entry?.id === "bulk-discount");
  return Math.max(1, item.price - (discounted ? 1 : 0));
}

export function emptyInventory() {
  return { permanents: [null, null], consumables: [null, null] };
}

function checkType(type) {
  if (!SHOP_TYPES.includes(type)) throw new RangeError("Unknown shop item category");
}
function checkSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS) {
    throw new RangeError("Invalid inventory slot");
  }
}
const validCoinCount = value => Number.isSafeInteger(value) && value >= 0;
const validOwned = (entry, type) => {
  const item = entry?.id && ITEM_BY_ID[entry.id];
  return item?.type === type && validCoinCount(entry.pricePaid) && entry.pricePaid <= 100;
};
function restoreSlots(entries, type) {
  const slots = [null, null];
  if (!Array.isArray(entries)) return slots;
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const entry = entries[i];
    if (!validOwned(entry, type)) continue;
    if (type === "permanents" && slots.some(other => other?.id === entry.id)) continue;
    slots[i] = { id: entry.id, pricePaid: entry.pricePaid };
  }
  return slots;
}

function drawOffers(type, inventory, rng, previous = []) {
  checkType(type);
  const owned = new Set(type === "permanents"
    ? inventory.permanents.filter(Boolean).map(entry => entry.id) : []);
  const last = new Set(previous.filter(Boolean));
  const valid = ITEM_CATALOG.filter(item => item.type === type && !owned.has(item.id));
  const fresh = valid.filter(item => !last.has(item.id));
  const pool = (fresh.length >= SHOP_OFFERS_PER_TYPE ? fresh : valid).slice();
  const offered = [];
  while (offered.length < SHOP_OFFERS_PER_TYPE) {
    const randomIndex = Math.min(pool.length - 1,
      Math.max(0, Math.floor(rng() * pool.length)));
    const [pick] = pool.splice(randomIndex, 1);
    offered.push(pick.id);
  }
  return offered;
}

function makeShop(inventory, rng, previous = null) {
  // Remember the ORIGINAL offer IDs even after a purchase empties a slot.
  // Otherwise, rerolling two sold-out cards could immediately offer the
  // exact same items the player just bought.
  const priorIds = previous?.lastOffers || previous;
  const permanents = drawOffers("permanents", inventory, rng, priorIds?.permanents);
  const consumables = drawOffers("consumables", inventory, rng, priorIds?.consumables);
  return {
    permanents, consumables,
    lastOffers: { permanents: [...permanents], consumables: [...consumables] },
    rerolls: previous ? previous.rerolls + 1 : 0,
    rerollCost: previous ? previous.rerolls + 2 : INITIAL_REROLL_COST,
    notice: previous ? "New stock is ready." : "Welcome! Choose your upgrades or keep your coins."
  };
}

function validShop(shop, inventory) {
  if (!shop || !Number.isSafeInteger(shop.rerolls) || shop.rerolls < 0 ||
      shop.rerolls > 10000 || shop.rerollCost !== shop.rerolls + INITIAL_REROLL_COST ||
      typeof shop.notice !== "string") return false;
  return SHOP_TYPES.every(type => {
    const offers = shop[type];
    const lastOffers = shop.lastOffers?.[type];
    const ids = (offers || []).filter(Boolean);
    return Array.isArray(offers) && offers.length === SHOP_OFFERS_PER_TYPE &&
      Array.isArray(lastOffers) && lastOffers.length === SHOP_OFFERS_PER_TYPE &&
      lastOffers.every(id => ITEM_BY_ID[id]?.type === type) &&
      lastOffers.length === new Set(lastOffers).size &&
      ids.length === new Set(ids).size &&
      offers.every((id, i) => id === null || id === lastOffers[i]) &&
      ids.every(id => ITEM_BY_ID[id]?.type === type &&
        (type !== "permanents" ||
          !inventory.permanents.some(entry => entry?.id === id)));
  });
}

// Backwards-compatible with Pass 1/2 saves, including reopened shops.
// Restoring a valid shop must not reshuffle its stock or grant free currency.
export function restoreShopState(run, rng = Math.random) {
  if (!validRogueliteRun(run) || typeof rng !== "function") {
    throw new RangeError("Invalid Roguelite shop save");
  }
  const inventory = {
    permanents: restoreSlots(run.inventory?.permanents, "permanents"),
    consumables: restoreSlots(run.inventory?.consumables, "consumables")
  };
  let shop = null;
  if (run.phase === "shop") {
    shop = validShop(run.shop, inventory)
      ? { ...run.shop, permanents: [...run.shop.permanents],
        consumables: [...run.shop.consumables],
        lastOffers: { permanents: [...run.shop.lastOffers.permanents],
          consumables: [...run.shop.lastOffers.consumables] },
        notice: run.shop.notice.slice(0, 200) }
      : makeShop(inventory, rng);
  }
  return { ...run, inventory, shop };
}

function shopState(state) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "shop" || !validCoinCount(state.run.coins)) {
    throw new RangeError("Shop actions are only allowed during a Roguelite shop visit");
  }
  const run = restoreShopState(state.run);
  if (!validShop(run.shop, run.inventory)) throw new RangeError("Invalid shop inventory");
  return run;
}

// This is the only route from a successful round to the next one.
// Round 12 is a victory, so there is no thirteenth shop.
export function enterRogueliteShop(state, rng = Math.random) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "round-clear") {
    throw new RangeError("The shop is available only after clearing a round");
  }
  const run = restoreShopState(state.run, rng);
  return { ...state, run: { ...run, phase: "shop",
    shop: makeShop(run.inventory, rng) } };
}

export function purchaseShopOffer(state, type, offerIndex, replaceSlot = null) {
  checkType(type);
  checkSlot(offerIndex);
  const run = shopState(state);
  const itemId = run.shop[type][offerIndex];
  const item = ITEM_BY_ID[itemId];
  if (!item || item.type !== type) throw new RangeError("That shop offer is sold out");
  if (type === "permanents" &&
      run.inventory.permanents.some(entry => entry?.id === itemId)) {
    throw new RangeError("Already equipped");
  }
  const owned = run.inventory[type];
  const slot = replaceSlot === null ? owned.findIndex(entry => entry === null) : replaceSlot;
  checkSlot(slot);
  if (replaceSlot === null && owned[slot] !== null) {
    throw new RangeError("Choose an occupied slot to replace");
  }
  const replaced = owned[slot];
  const refund = replaced && type === "permanents"
    ? Math.floor(replaced.pricePaid / 2) : 0;
  const price = shopItemPrice(run, item);
  if (run.coins + refund < price) throw new RangeError("Not enough coins");
  const inventory = {
    ...run.inventory,
    [type]: owned.map((entry, index) =>
      index === slot ? { id: item.id, pricePaid: price } : entry)
  };
  const shop = {
    ...run.shop, [type]: run.shop[type].map((id, index) =>
      index === offerIndex ? null : id),
    notice: replaced
      ? "Replaced " + ITEM_BY_ID[replaced.id].name + " with " + item.name + "."
      : "Bought " + item.name + " for " + price + " coins."
  };
  return {
    ...state,
    run: { ...run, coins: run.coins + refund - price, inventory, shop }
  };
}

export function sellPermanent(state, slot) {
  checkSlot(slot);
  const run = shopState(state);
  const owned = run.inventory.permanents[slot];
  if (!owned) throw new RangeError("Nothing to sell in that slot");
  const refund = Math.floor(owned.pricePaid / 2);
  return {
    ...state,
    run: {
      ...run, coins: run.coins + refund,
      inventory: { ...run.inventory,
        permanents: run.inventory.permanents.map((entry, i) => i === slot ? null : entry) },
      shop: { ...run.shop, notice: "Sold " + ITEM_BY_ID[owned.id].name +
        " for " + refund + " coins." }
    }
  };
}

export function discardConsumable(state, slot) {
  checkSlot(slot);
  const run = shopState(state);
  const owned = run.inventory.consumables[slot];
  if (!owned) throw new RangeError("Nothing to discard in that slot");
  return {
    ...state,
    run: {
      ...run,
      inventory: { ...run.inventory,
        consumables: run.inventory.consumables.map((entry, i) => i === slot ? null : entry) },
      shop: { ...run.shop, notice: "Discarded " + ITEM_BY_ID[owned.id].name +
        " (no refund)." }
    }
  };
}

export function rerollRogueliteShop(state, rng = Math.random) {
  const run = shopState(state);
  const cost = run.shop.rerollCost;
  if (run.coins < cost) throw new RangeError("Not enough coins to reroll");
  // Always replace all four stock positions, including bought-out offers.
  const shop = makeShop(run.inventory, rng, run.shop);
  return { ...state, run: { ...run, coins: run.coins - cost, shop } };
}
