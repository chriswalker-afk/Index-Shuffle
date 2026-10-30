// Release 5C: repeatable repository integrity, launch metadata, asset-size
// and baseline contrast checks. This does NOT claim to replace real-device
// Safari/Android, assistive-technology or user playtesting.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";

const html=readFileSync("index.html","utf8");
const css=readFileSync("styles.css","utf8");
const app=readFileSync("app.mjs","utf8");
const icon=readFileSync("assets/art/index-shuffle-icon.svg","utf8");
assert.match(html, /<html lang="en">/);
assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.match(html, /<meta name="description" content="[^"]{75,}">/);
assert.match(html, /<meta name="color-scheme" content="dark">/);
assert.match(html, /<link rel="canonical" href="https:\/\/chriswalker-afk\.github\.io\/Index-Shuffle\/">/);
for (const name of ["og:title","og:type","og:description","og:site_name",
  "og:url"]) {
  assert.match(html,new RegExp('property="' + name + '"'),
    name + " social metadata");
}
assert.match(html, /name="twitter:card" content="summary"/);
assert.match(html, /rel="icon" href="assets\/art\/index-shuffle-icon\.svg" type="image\/svg\+xml"/);
assert.match(icon, /<svg[^>]*viewBox="0 0 64 64"/);
assert.match(icon, /<title id="title">Index Shuffle icon<\/title>/);
assert.match(icon, /fill="url\(#tile\)"/);
assert.match(html, /styles\.css\?v=release-5c/);
assert.match(html, /app\.mjs\?v=release-5c/);

// All local URL references should actually exist. Absolute canonical URLs,
// colour fragments and mailto URLs are deliberately excluded.
const localRefs=[];
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const url=match[1];
  if (/^(https?:|mailto:|tel:|data:|#)/.test(url)) continue;
  const path=url.split(/[?#]/)[0];
  assert.ok(path && !path.startsWith("/"),"Unexpected root-relative URL: "+url);
  assert.ok(existsSync(path),"Missing page asset: "+path);
  localRefs.push(path);
}
assert.ok(localRefs.includes("assets/art/index-shuffle-icon.svg"));
assert.ok(localRefs.includes("styles.css") && localRefs.includes("app.mjs"));
for (const path of readdirSync(".").filter(name=>name.endsWith(".mjs"))) {
  const source=readFileSync(path,"utf8");
  for (const match of source.matchAll(/\b(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
    const target=match[1].split("?")[0];
    assert.ok(existsSync(resolve(dirname(path),target)),
      "Broken module reference: "+path+" -> "+match[1]);
  }
}
// A duplicate ID can corrupt dialog labels, live region targets or button
// callbacks. Each explicit reference should resolve to a real static ID.
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,"Duplicate document IDs");
const idSet=new Set(ids);
for(const ref of html.matchAll(/\b(?:aria-labelledby|aria-describedby|aria-controls|for)="([^"]+)"/g)) {
  for(const part of ref[1].trim().split(/\s+/)) {
    assert.ok(idSet.has(part),"Broken aria/label reference: "+part);
  }
}
for (const anchor of html.matchAll(/href="#([^"]+)"/g)) {
  assert.ok(idSet.has(anchor[1]),"Broken in-page link: "+anchor[1]);
}
for (const tag of html.matchAll(/<img\b[^>]*>/gs)) {
  assert.match(tag[0], /\balt="[^"]*"/, "Every static image needs alt text");
}
assert.match(html, /id="board" class="board" role="group" tabindex="-1"/);
assert.match(html, /id="modal"[^>]*aria-labelledby=/);
assert.match(html, /id="resultsDialog"[^>]*aria-labelledby=/);
assert.match(html, /id="shopDialog"[^>]*aria-labelledby=/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /@media \(prefers-contrast: more\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /env\(safe-area-inset-bottom/);
assert.match(app, /\["INPUT", "TEXTAREA", "SELECT", "SUMMARY"\]/);
assert.match(app, /\$\("board"\)\.focus\(\{ preventScroll: true \}\)/);

// Useful conservative budgets, not claims about Lighthouse network speed.
// Keep the largest bootstrap files from growing unintentionally during QA.
for (const [path,max] of [
  ["index.html",60000],["styles.css",180000],["app.mjs",110000],
  ["assets/art/title-numberworld.svg",18000],
  ["assets/art/index-shuffle-icon.svg",3500]
]) assert.ok(statSync(path).size <= max,
  path+" exceeds release asset budget: "+statSync(path).size+"/"+max);

function luminance(hex) {
  const rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255);
  const linear=rgb.map(x=>x<=.04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
  return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
function contrast(a,b) {
  const x=luminance(a), y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const cssVar=name=>{
  const match=css.match(new RegExp("--"+name+"\\s*:\\s*#([0-9a-fA-F]{6})"));
  assert.ok(match, "Missing colour variable --"+name);
  return match[1];
};
assert.ok(contrast(cssVar("text"),cssVar("bg"))>=4.5);
assert.ok(contrast(cssVar("muted"),cssVar("surface"))>=4.5);
assert.ok(contrast(cssVar("muted-soft"),cssVar("surface"))>=4.5);
assert.doesNotMatch(html, /<script[^>]+src="https?:/, "No third-party runtime scripts");
console.log("Pass 5C: local paths, metadata, IDs, baseline contrast and asset budgets passed ("+
  ids.length+" IDs, "+localRefs.length+" local assets).");
