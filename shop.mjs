// Roguelite shop and two-slot inventory system. Gameplay effects are applied in effects.mjs.
// Pure reducers make purchases, resale, replacement and rerolls testable.
import { validRogueliteRun } from "./roguelite.mjs?v=runestones-pass2";

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
  // Hazard-counter permanents deliberately occupy the SAME two upgrade
  // slots as scoring bonuses. Earliest offers occur in the shop immediately
  // BEFORE a stage that can spawn the relevant hazard.
  { id: "storm-shelter", name: "Storm Shelter", type: "permanents", price: 8, unlockRound: 4, hazardCounter: true,
    description: "30% fewer hazard warnings. Does not prevent all hazards or affect blockers." },
  { id: "mist-filter", name: "Mist Filter", type: "permanents", price: 4, unlockRound: 4, hazardCounter: true,
    description: "Cloudy's selection weight is 65% lower; it can still appear." },
  { id: "fracture-ward", name: "Fracture Ward", type: "permanents", price: 6, unlockRound: 4, hazardCounter: true,
    description: "Cracked and Null each have 60% lower selection weight; both remain possible." },
  { id: "gilded-compass", name: "Gilded Compass", type: "permanents", price: 5, unlockRound: 7, hazardCounter: true,
    description: "Greedy's selection weight is 70% lower, but it can still steal gold." },
  { id: "hazard-tamer", name: "Hazard Tamer", type: "permanents", price: 8, unlockRound: 4, hazardCounter: true,
    description: "Incoming Null becomes Cracked; incoming Cracked becomes Void. They can still cause damage." },
  { id: "fog-lantern", name: "Fog Lantern", type: "permanents", price: 5, unlockRound: 4, hazardCounter: true,
    description: "New Cloudy squares last 2 slides instead of 3. They still hide tiles and prevent banking." },
  { id: "void-cushion", name: "Void Cushion", type: "permanents", price: 5, unlockRound: 4, hazardCounter: true,
    description: "Void cannot reduce exponent 2 to 1. Higher exponents still lose one." },
  { id: "gilded-soles", name: "Gilded Soles", type: "permanents", price: 5, unlockRound: 7, hazardCounter: true,
    description: "Greedy steals gold only when a tile lands on its square, not when it passes through." },
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
  { id: "second-chance", name: "Second Chance", type: "consumables", price: 2, description: "Unlock one temporarily locked banking attempt." },
  { id: "foundry-runestone", name: "Gilded Foundry", type: "consumables", price: 5, unlockRound: 4, rare: true, description: "Place a golden foundry on one safe board square. Two useful merges or correct banks there become golden." },
  { id: "prism-runestone", name: "Power Prism", type: "consumables", price: 6, unlockRound: 4, rare: true, description: "Place a prism on one safe board square. Two merges or correct banks there can gain double scoring." },
  { id: "echo-runestone", name: "Echo Seal", type: "consumables", price: 7, unlockRound: 7, rare: true,
    description: "Enchant one square. Once, a correct answer there may bank a power already scored this round." },
  { id: "mint-runestone", name: "Twin Mint", type: "consumables", price: 8, unlockRound: 10, rare: true,
    description: "Enchant one square. Its next eligible merge becomes double gold; one charge." },
  { id: "sanctuary-runestone", name: "Time Sanctuary", type: "consumables", price: 5, unlockRound: 4, rare: true,
    description: "Enchant one square. Two questions opened there gain 10 seconds each (maximum 60)." },
  { id: "shatter-runestone", name: "Shatter Crest", type: "consumables", price: 5, unlockRound: 7, rare: true,
    description: "Enchant one square. Two correctly banked merges beside blockers deal an extra hit." }
].map(item => Object.freeze(item)));
export const ITEM_BY_ID = Object.freeze(
  Object.fromEntries(ITEM_CATALOG.map(item => [item.id, item]))
);

// Distinguish two kinds of rarity: a chance for a Runestone to appear,
// and a weighted choice among Runestones available at the next round.
// Twin Mint is intentionally much rarer than the entry-level Runestones.
export const RUNESTONE_SHOP_CHANCE = 0.22;
export const RUNESTONE_WEIGHTS = Object.freeze({
  "foundry-runestone": 3,
  "prism-runestone": 3,
  "echo-runestone": 2,
  "mint-runestone": 1,
  "sanctuary-runestone": 3,
  "shatter-runestone": 2
});
export const RUNESTONE_ITEM_IDS = Object.freeze(
  ITEM_CATALOG.filter(item => item.rare).map(item => item.id)
);
function pickWeightedRunestone(items, rng) {
  const sum = items.reduce((total, item) =>
    total + (RUNESTONE_WEIGHTS[item.id] || 0), 0);
  if (!(sum > 0)) return null;
  let roll = Math.max(0, Math.min(.999999999999, rng())) * sum;
  for (const item of items) {
    roll -= RUNESTONE_WEIGHTS[item.id];
    if (roll < 0) return item.id;
  }
  return items[items.length - 1].id;
}

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

function drawOffers(type, inventory, rng, previous = [], nextRound = 1,
  allowRunestone = true) {
  checkType(type);
  const owned = new Set(type === "permanents"
    ? inventory.permanents.filter(Boolean).map(entry => entry.id) : []);
  const last = new Set(previous.filter(Boolean));
  // Rerolls can reveal a Runestone only until the FIRST rare appearance
  // during a shop visit. A bought/sold-out rare still counts as seen.
  // Zero is reserved as a deterministic "ordinary shop" seed for older tests.
  const rareEnabled = allowRunestone && type === "consumables" &&
    nextRound >= 4 &&
    (() => { const roll = rng(); return roll > 0 && roll < RUNESTONE_SHOP_CHANCE; })();
  const rareItems = ITEM_CATALOG.filter(item => item.rare &&
    item.unlockRound <= nextRound);
  const selectedRare = rareEnabled ? pickWeightedRunestone(rareItems, rng) : null;
  const valid = ITEM_CATALOG.filter(item =>
    item.type === type && !owned.has(item.id) &&
    (!item.rare || item.id === selectedRare) &&
    (item.unlockRound === undefined || nextRound >= item.unlockRound));
  const fresh = valid.filter(item => !last.has(item.id));
  const pool = (fresh.length >= SHOP_OFFERS_PER_TYPE ? fresh : valid).slice();
  const offered = selectedRare ? [selectedRare] : [];
  if (selectedRare) {
    const index = pool.findIndex(item => item.id === selectedRare);
    if (index >= 0) pool.splice(index, 1);
  }
  while (offered.length < SHOP_OFFERS_PER_TYPE) {
    const randomIndex = Math.min(pool.length - 1,
      Math.max(0, Math.floor(rng() * pool.length)));
    const [pick] = pool.splice(randomIndex, 1);
    offered.push(pick.id);
  }
  return offered;
}

function makeShop(inventory, rng, previous = null, nextRound = 1) {
  // Remember the ORIGINAL offer IDs even after a purchase empties a slot.
  // Otherwise, rerolling two sold-out cards could immediately offer the
  // exact same items the player just bought.
  const priorIds = previous?.lastOffers || previous;
  const alreadySeen = Boolean(previous?.runestoneSeen ||
    priorIds?.consumables?.some(id => ITEM_BY_ID[id]?.rare));
  const permanents = drawOffers("permanents", inventory, rng,
    priorIds?.permanents, nextRound);
  const consumables = drawOffers("consumables", inventory, rng,
    priorIds?.consumables, nextRound, !alreadySeen);
  const runestoneSeen = alreadySeen ||
    consumables.some(id => ITEM_BY_ID[id]?.rare);
  return {
    permanents, consumables, runestoneSeen,
    lastOffers: { permanents: [...permanents], consumables: [...consumables] },
    rerolls: previous ? previous.rerolls + 1 : 0,
    rerollCost: previous ? previous.rerolls + 2 : INITIAL_REROLL_COST,
    notice: previous ? "New stock is ready." : "Welcome! Choose your upgrades or keep your coins."
  };
}

function validShop(shop, inventory, nextRound = 1) {
  if (!shop || !Number.isSafeInteger(shop.rerolls) || shop.rerolls < 0 ||
      shop.rerolls > 10000 || shop.rerollCost !== shop.rerolls + INITIAL_REROLL_COST ||
      typeof shop.notice !== "string" ||
      (shop.runestoneSeen !== undefined && typeof shop.runestoneSeen !== "boolean") ||
      (shop.runestoneSeen === false &&
        shop.lastOffers?.consumables?.some(id => ITEM_BY_ID[id]?.rare))) return false;
  return SHOP_TYPES.every(type => {
    const offers = shop[type];
    const lastOffers = shop.lastOffers?.[type];
    const ids = (offers || []).filter(Boolean);
    return Array.isArray(offers) && offers.length === SHOP_OFFERS_PER_TYPE &&
      Array.isArray(lastOffers) && lastOffers.length === SHOP_OFFERS_PER_TYPE &&
      lastOffers.every(id => ITEM_BY_ID[id]?.type === type &&
        (ITEM_BY_ID[id].unlockRound === undefined ||
          nextRound >= ITEM_BY_ID[id].unlockRound)) &&
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
    shop = validShop(run.shop, inventory, run.round + 1)
      ? { ...run.shop, permanents: [...run.shop.permanents],
        consumables: [...run.shop.consumables],
        lastOffers: { permanents: [...run.shop.lastOffers.permanents],
          consumables: [...run.shop.lastOffers.consumables] },
        runestoneSeen: Boolean(run.shop.runestoneSeen ||
          run.shop.lastOffers.consumables.some(id => ITEM_BY_ID[id]?.rare)),
        notice: run.shop.notice.slice(0, 200) }
      : makeShop(inventory, rng, null, run.round + 1);
  }
  return { ...run, inventory, shop };
}

function shopState(state) {
  if (state?.mode !== "roguelite" || !validRogueliteRun(state.run) ||
      state.run.phase !== "shop" || !validCoinCount(state.run.coins)) {
    throw new RangeError("Shop actions are only allowed during a Roguelite shop visit");
  }
  const run = restoreShopState(state.run);
  if (!validShop(run.shop, run.inventory, run.round + 1)) {
    throw new RangeError("Invalid shop inventory");
  }
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
    shop: makeShop(run.inventory, rng, null, run.round + 1) } };
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
  const shop = makeShop(run.inventory, rng, run.shop, run.round + 1);
  return { ...state, run: { ...run, coins: run.coins - cost, shop } };
}
