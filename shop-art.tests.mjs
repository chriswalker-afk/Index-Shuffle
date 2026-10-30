// Visual-only Pass 2 contracts: original SVG artwork for every shop item,
// harmless fallback for unknown IDs, shop action wiring and responsive styles.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ITEM_CATALOG } from "./shop.mjs";
import { SHOP_ICON_IDS, ITEM_SPRITE_URL, itemIconHref, itemArtKind } from "./shop-art.mjs";

const ids = ITEM_CATALOG.map(item => item.id);
const imageIDs = new Set(SHOP_ICON_IDS);
assert.equal(ids.length, 31, "Update count if shop catalogue expands");
assert.equal(imageIDs.size, ids.length, "No duplicate art IDs");
assert.deepEqual([...imageIDs].sort(), [...ids].sort(),
  "Each purchasable item must have an original emblem");
assert.equal(itemIconHref("block-breaker"), ITEM_SPRITE_URL + "#item-block-breaker");
assert.equal(itemIconHref("__proto__"), ITEM_SPRITE_URL + "#item-generic");
assert.equal(itemIconHref(null), ITEM_SPRITE_URL + "#item-generic");
assert.equal(itemArtKind({ type: "permanents" }), "permanent");
assert.equal(itemArtKind({ type: "consumables" }), "consumable");
assert.equal(itemArtKind({ type: "permanents", hazardCounter: true }), "ward");

const sprite = readFileSync("assets/art/item-sprites.svg", "utf8");
assert.match(sprite, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
assert.match(sprite, /<title/);
assert.match(sprite, /<desc/);
assert.doesNotMatch(sprite, /<script|<foreignObject|<image|onload=|(?:href|src)="https?:\/\//i);
const spriteIDs = [...sprite.matchAll(/<symbol id="item-([a-z-]+)"/g)].map(m => m[1]);
assert.equal(spriteIDs.length, 32, "31 items plus a fallback symbol");
assert.equal(new Set(spriteIDs).size, spriteIDs.length);
assert.deepEqual(spriteIDs.filter(id => id !== "generic").sort(), ids.sort());
assert.ok(sprite.length < 44000, "Keep sprite compact");

const shopUI = readFileSync("shop-ui.mjs", "utf8");
const app = readFileSync("app.mjs", "utf8");
const html = readFileSync("index.html", "utf8");
const css = readFileSync("styles.css", "utf8");
assert.match(shopUI, /itemIconHref\(itemId\)/);
assert.match(shopUI, /createElementNS\(SVG_NS, "svg"\)/);
assert.match(shopUI, /"aria-hidden", "true"/);
assert.match(shopUI, /pair\.append\(offerCard\(type, shop\[type\]\[i\], i, state, dispatch\)\)/);
assert.match(shopUI, /purchaseShopOffer\(value, type, slotIndex, i\)/);
assert.match(shopUI, /sellPermanent\(value, slot\)/);
assert.match(shopUI, /discardConsumable\(value, slot\)/);
assert.match(shopUI, /if \(!dialog\.open\) dialog\.showModal\(\)/);
assert.match(html, /id="shopMerchantMessage"/);
assert.match(html, /<details class="shop-guide">/);
assert.match(html, /id="shopCoins"/);
assert.match(html, /id="shopReroll"/);
assert.match(html, /id="shopContinue"/);
assert.match(html, /styles\.css\?v=frostlock-v1/);
assert.match(html, /app\.mjs\?v=bank-timer-v1/);
assert.match(app, /shop-ui\.mjs\?v=frostlock-v1/);
for (const selector of [".shop-offer-pair", ".shop-item-art--ward",
  ".shop-item-art--consumable", ".shop-price-original",
  ".shop-inventory-slot", ".equip-chip--illustrated"]) {
  assert.ok(css.includes(selector), "Missing class " + selector);
}
assert.ok(existsSync("item-gallery.html"));
console.log("Index Shuffle shop art Pass 2 checks passed.");
