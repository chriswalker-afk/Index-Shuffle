// Small, accessible DOM renderer for the Pass 3 shop. All economic
// mutations are delegated to pure reducers in shop.mjs.
import {
  ITEM_BY_ID, INVENTORY_SLOTS, purchaseShopOffer, sellPermanent, discardConsumable
} from "./shop.mjs?v=roguelite-pass3-v1";

const $ = id => document.getElementById(id);
const itemName = entry => entry ? ITEM_BY_ID[entry.id]?.name || "Unknown item" : "Empty";
const labelFor = type => type === "permanents" ? "Permanent" : "Single use";

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

export function renderRogueliteInventory(state, isRoguelite) {
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
      const chip = element("span", "equip-chip" + (entry ? " equipped" : ""), entry
        ? ITEM_BY_ID[entry.id].name : "+ Empty");
      chip.title = entry
        ? ITEM_BY_ID[entry.id].description + " (effects available in Pass 4)"
        : "Empty " + labelFor(type).toLowerCase() + " slot";
      row.appendChild(chip);
    }
  }
}

function offerCard(type, itemId, slotIndex, state, dispatch) {
  const card = element("article", "shop-offer-card");
  if (!itemId) {
    card.classList.add("sold-out");
    card.append(element("div", "shop-offer-type", labelFor(type)));
    card.append(element("strong", "shop-item-name", "Purchased"));
    card.append(element("p", "shop-item-description", "This offer is sold out. Reroll for fresh stock."));
    return card;
  }
  const item = ITEM_BY_ID[itemId];
  card.append(element("div", "shop-offer-type", labelFor(type)));
  card.append(element("strong", "shop-item-name", item.name));
  card.append(element("p", "shop-item-description", item.description));
  card.append(element("p", "shop-price", "● " + item.price + " coins"));
  const owned = state.run.inventory[type];
  const freeSlot = owned.findIndex(entry => !entry);
  const actions = element("div", "shop-card-actions");
  if (freeSlot >= 0) {
    const enough = state.run.coins >= item.price;
    actions.append(makeButton(enough
      ? "Buy for " + item.price
      : "Need " + (item.price - state.run.coins) + " more coins",
      () => dispatch(value => purchaseShopOffer(value, type, slotIndex)), !enough,
      "shop-buy-button"));
  } else {
    actions.append(element("p", "shop-replace-label", "Both slots full — choose what to replace:"));
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      const occupied = owned[i];
      const refund = type === "permanents" ? Math.floor(occupied.pricePaid / 2) : 0;
      const net = item.price - refund;
      const enough = state.run.coins + refund >= item.price;
      const text = "Replace " + itemName(occupied) + " · " +
        (net <= 0 ? "refund " + (-net) : "net " + net) + " coins";
      actions.append(makeButton(text,
        () => dispatch(value => purchaseShopOffer(value, type, slotIndex, i)),
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
  const subtitle = labelFor(type) + " " + (slot + 1);
  cell.append(element("span", "shop-slot-label", subtitle));
  cell.append(element("strong", "shop-slot-name", owned ? item.name : "Empty slot"));
  if (owned) {
    const refund = type === "permanents" ? Math.floor(owned.pricePaid / 2) : 0;
    cell.append(makeButton(type === "permanents"
      ? "Sell for " + refund + " coins" : "Discard (no refund)", () => {
      if (type === "consumables" &&
        !window.confirm("Discard " + item.name + "? No coins will be returned.")) return;
      dispatch(value => type === "permanents"
        ? sellPermanent(value, slot) : discardConsumable(value, slot));
    }));
  } else {
    cell.append(element("span", "shop-empty-help", "Ready for a purchase"));
  }
  return cell;
}

export function renderRogueliteShop(state, mode, dispatch) {
  const dialog = $("shopDialog");
  const open = mode === "roguelite" && state.run.phase === "shop";
  if (!open) {
    if (dialog.open) dialog.close();
    return;
  }
  const { shop, inventory, coins, round } = state.run;
  $("shopCoins").textContent = coins;
  $("shopRound").textContent = "After round " + round + " · Next: round " + (round + 1) +
    " of 12";
  $("shopNotice").textContent = shop.notice;
  $("shopReroll").textContent = "Reroll four offers · " + shop.rerollCost +
    (shop.rerollCost === 1 ? " coin" : " coins");
  $("shopReroll").disabled = coins < shop.rerollCost;
  $("shopContinue").textContent = "Start round " + (round + 1);
  const offers = $("shopOffers");
  offers.replaceChildren();
  for (const type of ["permanents", "consumables"]) {
    for (let i = 0; i < 2; i++) {
      offers.append(offerCard(type, shop[type][i], i, state, dispatch));
    }
  }
  const slots = $("shopInventory");
  slots.replaceChildren();
  for (const type of ["permanents", "consumables"]) {
    const group = element("section", "shop-inventory-group");
    group.append(element("h4", "", labelFor(type) + " slots"));
    const grid = element("div", "shop-inventory-grid");
    for (let i = 0; i < INVENTORY_SLOTS; i++) {
      grid.append(inventoryCard(type, i, state, dispatch));
    }
    group.appendChild(grid);
    slots.appendChild(group);
  }
  if (!dialog.open) dialog.showModal();
}
