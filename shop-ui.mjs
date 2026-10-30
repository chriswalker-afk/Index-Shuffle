// Accessible shop and equipped-item rendering. Price, sell/replace and
// reroll effects remain in shop.mjs; this module changes presentation only.
import {
  ITEM_BY_ID, INVENTORY_SLOTS, RUNESTONE_ITEM_IDS, RUNESTONE_SHOP_CHANCE,
  shopItemPrice, purchaseShopOffer, sellPermanent, discardConsumable
} from "./shop.mjs?v=runestones-pass4";
import { targetForRound } from "./roguelite.mjs?v=runestones-pass2";
import { bossForRound, bossTargetFor } from "./bosses.mjs?v=runestones-pass2";
import { bossPortraitFor } from "./art-catalog.mjs?v=frostlock-v1";
import { itemIconHref, itemArtKind } from "./shop-art.mjs?v=runestones-pass3";
import { ENCHANTMENT_ITEMS, ENCHANTMENT_DEFINITIONS
} from "./enchantments.mjs?v=runestones-pass2";

const $ = id => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
const itemName = entry => entry ? ITEM_BY_ID[entry.id]?.name || "Unknown item" : "Empty";
const labelFor = type => type === "permanents" ? "Permanent" : "Single use";
const RUNE_TRIGGER_LABEL = Object.freeze({
  "foundry-runestone": "MERGE OR CORRECT BANK",
  "prism-runestone": "MERGE OR CORRECT BANK",
  "echo-runestone": "CORRECT REPEAT BANK",
  "mint-runestone": "MERGE ONLY",
  "sanctuary-runestone": "QUESTION OPENED",
  "shatter-runestone": "CORRECT MERGED-POWER BANK"
});
const runeData = itemId => {
  const type = ENCHANTMENT_ITEMS[itemId];
  const definition = type && ENCHANTMENT_DEFINITIONS[type];
  return definition ? { type, definition, trigger: RUNE_TRIGGER_LABEL[itemId] } : null;
};


function element(tag, className = "", content = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== "") node.textContent = content;
  return node;
}

function makeButton(label, callback, disabled = false, className = "shop-mini-button") {
  const button = element("button", className, label);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", callback);
  return button;
}

// All emblems are decorative: the adjacent item name and effect carry meaning.
function itemArtwork(itemId, kind, size = "large") {
  const frame = element("span", "shop-item-art shop-item-art--" + kind +
    " shop-item-art--" + size);
  frame.setAttribute("aria-hidden", "true");
  const icon = document.createElementNS(SVG_NS, "svg");
  icon.classList.add("shop-item-icon");
  icon.setAttribute("viewBox", "0 0 100 100");
  icon.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", itemIconHref(itemId));
  use.setAttribute("width", "100");
  use.setAttribute("height", "100");
  icon.append(use);
  frame.append(icon);
  return frame;
}

export function renderRogueliteInventory(state, isRoguelite, onUse, canUse) {
  $("rogueInventory").hidden = !isRoguelite;
  if (!isRoguelite) return;
  for (const [type, target] of [
    ["permanents", "roguePermanentSlots"],
    ["consumables", "rogueConsumableSlots"]
  ]) {
    const row = $(target);
    row.replaceChildren();
    const slots = state.run.inventory[type];
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const entry = slots[i];
      const item = entry && ITEM_BY_ID[entry.id];
      const usable = Boolean(item && type === "consumables" &&
        state.run.phase === "playing" && !state.over);
      const hazardCounter = Boolean(item && type === "permanents" &&
        item.hazardCounter);
      const chip = element(usable ? "button" : "span",
        "equip-chip" + (entry ? " equipped equip-chip--illustrated" : "") +
          (hazardCounter ? " hazard-counter-equipped" : "") +
          (item?.rare ? " runestone-equipped" : ""));
      chip.title = item
        ? item.description
        : "Empty " + labelFor(type).toLowerCase() + " slot";
      if (item) {
        chip.append(itemArtwork(item.id, itemArtKind(item), "tiny"),
          element("span", "equip-chip-name", item.name));
      } else {
        chip.textContent = "+ Empty";
      }
      if (usable) {
        chip.type = "button";
        chip.disabled = !canUse(i);
        chip.classList.add("equip-use");
        chip.setAttribute("aria-label", "Use " + item.name);
        chip.addEventListener("click", () => onUse(i));
      }
      row.appendChild(chip);
    }
  }
}

function offerCard(type, itemId, slotIndex, state, dispatch) {
  const card = element("article", "shop-offer-card");
  if (!itemId) {
    card.classList.add("sold-out");
    card.append(element("div", "shop-offer-feature",
      "")); // Empty artwork is deliberately not mistaken for a purchasable item.
    card.append(element("div", "shop-offer-type", labelFor(type) + " · Sold"));
    card.append(element("strong", "shop-item-name", "Purchased"));
    card.append(element("p", "shop-item-description",
      "This offer is sold out. Reroll for fresh stock or continue to the next round."));
    return card;
  }

  const item = ITEM_BY_ID[itemId];
  const price = shopItemPrice(state.run, item);
  const kind = itemArtKind(item);
  card.classList.add("shop-offer-card--" + kind);
  if (item.hazardCounter) card.classList.add("hazard-counter-offer");
  if (item.rare) card.classList.add("runestone-offer");

  const top = element("div", "shop-offer-feature");
  top.append(itemArtwork(itemId, kind));
  const info = element("div", "shop-offer-info");
  info.append(element("div", "shop-offer-type",
    item.hazardCounter ? "Permanent · Hazard defence"
      : item.rare ? "Single use · Rare Runestone" : labelFor(type)));
  info.append(element("strong", "shop-item-name", item.name));
  const priceLabel = element("p", "shop-price");
  priceLabel.append(element("span", "shop-price-coin", "●"),
    element("strong", "shop-price-value", String(price)),
    element("span", "shop-price-unit", price === 1 ? "coin" : "coins"));
  if (price < item.price) {
    priceLabel.append(element("span", "shop-price-original", "was " + item.price));
  }
  info.append(priceLabel);
  top.append(info);
  card.append(top, element("p", "shop-item-description", item.description));
  if (item.rare) {
    const rune = runeData(item.id);
    const note = element("p", "shop-rune-effect");
    note.append(element("span", "shop-rune-trigger", rune.trigger),
      element("span", "shop-rune-charge", rune.definition.charges +
        (rune.definition.charges === 1 ? " activation" : " activations") +
        " · stays on a chosen square"));
    card.append(note);
  }

  const owned = state.run.inventory[type];
  const freeSlot = owned.findIndex(entry => !entry);
  const actions = element("div", "shop-card-actions");
  if (freeSlot >= 0) {
    const enough = state.run.coins >= price;
    actions.append(makeButton(enough
      ? "Buy for " + price
      : "Need " + (price - state.run.coins) + " more coins",
      () => dispatch(value => purchaseShopOffer(value, type, slotIndex), "purchase"), !enough,
      "shop-buy-button"));
  } else {
    actions.append(element("p", "shop-replace-label",
      "Both slots full — choose what to replace:"));
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const occupied = owned[i];
      const refund = type === "permanents" ? Math.floor(occupied.pricePaid / 2) : 0;
      const net = price - refund;
      const enough = state.run.coins + refund >= price;
      const text = "Replace " + itemName(occupied) + " · " +
        (net <= 0 ? "refund " + (-net) : "net " + net) + " coins";
      actions.append(makeButton(text,
        () => dispatch(value => purchaseShopOffer(value, type, slotIndex, i), "purchase"),
        !enough));
    }
  }
  card.appendChild(actions);
  return card;
}

function inventoryCard(type, slot, state, dispatch) {
  const owned = state.run.inventory[type][slot];
  const item = owned && ITEM_BY_ID[owned.id];
  const cell = element("div", "shop-inventory-slot" + (owned ? " has-item" : ""));
  cell.append(element("span", "shop-slot-label", labelFor(type) + " " + (slot + 1)));
  if (item) {
    const content = element("div", "shop-slot-content");
    content.append(itemArtwork(item.id, itemArtKind(item), "small"),
      element("strong", "shop-slot-name", item.name));
    cell.append(content);
    const refund = type === "permanents" ? Math.floor(owned.pricePaid / 2) : 0;
    cell.append(makeButton(type === "permanents"
      ? "Sell for " + refund + " coins" : "Discard (no refund)", () => {
      if (type === "consumables" &&
        !window.confirm("Discard " + item.name + "? No coins will be returned.")) return;
      dispatch(value => type === "permanents"
        ? sellPermanent(value, slot) : discardConsumable(value, slot));
    }));
  } else {
    cell.append(element("span", "shop-empty-slot-mark", "+"));
    cell.append(element("span", "shop-slot-name", "Empty slot"));
    cell.append(element("span", "shop-empty-help", "Ready for a purchase"));
  }
  return cell;
}

// An optional reference rather than six more purchase options: students see
// when each Runestone unlocks, where it triggers, and how many uses it has.
function renderRunestoneGuide(nextRound) {
  const target = $("shopRunestoneGallery");
  target.replaceChildren();
  for (const id of RUNESTONE_ITEM_IDS) {
    const item = ITEM_BY_ID[id];
    const rune = runeData(id);
    const unlocked = item.unlockRound <= nextRound;
    const card = element("article", "shop-rune-guide-card" +
      (unlocked ? "" : " is-locked"));
    card.dataset.enchantment = rune.type;
    const heading = element("div", "shop-rune-guide-top");
    heading.append(itemArtwork(id, "runestone", "small"));
    const words = element("div", "shop-rune-guide-copy");
    words.append(element("strong", "", item.name),
      element("span", "shop-rune-guide-unlock", unlocked
        ? "Available from round " + item.unlockRound + " · " + item.price + " coins"
        : "Unlocks in round " + item.unlockRound));
    heading.append(words);
    card.append(heading, element("p", "shop-rune-guide-trigger", rune.trigger +
      " · " + rune.definition.charges +
      (rune.definition.charges === 1 ? " charge" : " charges")),
    element("p", "shop-rune-guide-description", item.description));
    target.append(card);
  }
}

const MERCHANT_LINES = Object.freeze([
  "A little preparation beats a lot of panic.",
  "Every power has potential. Some just need a little polish.",
  "I trade in possibilities. And occasionally very shiny numbers.",
  "Take your time. The board will be there when you're ready."
]);

export function renderRogueliteShop(state, mode, dispatch) {
  const dialog = $("shopDialog");
  const open = mode === "roguelite" && state.run.phase === "shop";
  if (!open) {
    if (dialog.open) dialog.close();
    return;
  }
  const { shop, inventory, coins, round } = state.run;
  $("shopCoins").textContent = coins;
  const nextRound = round + 1;
  const boss = bossForRound(state.run, nextRound);
  $("shopRound").textContent = "After round " + round + " · Next: " +
    (boss ? "BOSS ROUND " : "round ") + nextRound + " of 12";
  const rareOffer = shop.consumables.find(id => ITEM_BY_ID[id]?.rare);
  $("shopMerchantMessage").textContent = rareOffer
    ? "An unusual Runestone has appeared! A little magic rewards good mathematics."
    : boss ? "A tricky customer is next. Choose your tools carefully."
      : MERCHANT_LINES[(round - 1) % MERCHANT_LINES.length];
  $("shopRunestoneStatus").textContent = nextRound < 4
    ? "Runestones unlock in round 4. See the field guide for future treasures."
    : rareOffer
      ? "✦ Rare Runestone in stock: " + ITEM_BY_ID[rareOffer].name +
        ". One-use item; choose where to enchant the board."
      : shop.runestoneSeen
        ? "Runestone already revealed this shop visit. Rerolls now offer normal items."
        : "Runestones are uncommon. Each fresh stock roll has about " +
          Math.round(RUNESTONE_SHOP_CHANCE * 100) +
          "% chance of revealing one, until one has appeared.";
  $("shopRunestoneStatus").dataset.state = rareOffer ? "found"
    : shop.runestoneSeen ? "seen" : "unseen";
  renderRunestoneGuide(nextRound);
  $("shopBossPreview").hidden = !boss;
  $("shopBossPreview").dataset.boss = boss?.id ?? "";
  const portrait = boss ? bossPortraitFor(boss.id) : null;
  $("shopBossPortrait").hidden = !portrait;
  if (portrait) {
    if ($("shopBossPortrait").getAttribute("src") !== portrait.src) {
      $("shopBossPortrait").src = portrait.src;
    }
    $("shopBossPortrait").alt = portrait.alt;
  } else {
    $("shopBossPortrait").removeAttribute("src");
    $("shopBossPortrait").alt = "";
  }
  if (boss) {
    $("shopBossName").textContent = boss.name;
    $("shopBossRule").textContent = boss.detail;
    const baseTarget = targetForRound(nextRound);
    const bossTarget = bossTargetFor({ ...state.run, round: nextRound }, baseTarget);
    $("shopBossTarget").textContent = "Score target: " + bossTarget + " points" +
      (bossTarget !== baseTarget ? " (normally " + baseTarget + ")" : "") +
      ". Prepare your loadout before continuing.";
  }
  $("shopNotice").textContent = shop.notice;
  $("shopReroll").textContent = "Reroll four offers · " + shop.rerollCost +
    (shop.rerollCost === 1 ? " coin" : " coins");
  $("shopReroll").disabled = coins < shop.rerollCost;
  $("shopContinue").textContent = "Start round " + (round + 1);

  const offers = $("shopOffers");
  offers.replaceChildren();
  for (const type of ["permanents", "consumables"]) {
    const group = element("section", "shop-offer-group shop-offer-group--" +
      (type === "permanents" ? "permanent" : "consumable"));
    group.setAttribute("aria-label", type === "permanents"
      ? "Permanent upgrade offers" : "Single-use item offers");
    const heading = element("div", "shop-offer-group-heading");
    heading.append(element("strong", "", type === "permanents"
      ? "Lasting relics" : "One-use tools"),
      element("span", "", type === "permanents"
        ? "Permanent · always active · 2 slots"
        : "Use during a round · 2 slots"));
    const pair = element("div", "shop-offer-pair");
    for (let i = 0; i < 2; i++) {
      pair.append(offerCard(type, shop[type][i], i, state, dispatch));
    }
    group.append(heading, pair);
    offers.append(group);
  }

  const slots = $("shopInventory");
  slots.replaceChildren();
  for (const type of ["permanents", "consumables"]) {
    const group = element("section", "shop-inventory-group");
    group.append(element("h4", "", type === "permanents"
      ? "Your permanent relics" : "Your one-use tools"));
    const grid = element("div", "shop-inventory-grid");
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      grid.append(inventoryCard(type, i, state, dispatch));
    }
    group.appendChild(grid);
    slots.appendChild(group);
  }
  if (!dialog.open) dialog.showModal();
}
