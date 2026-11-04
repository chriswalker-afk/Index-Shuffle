import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";

const load=path=>readFileSync(new URL("./"+path,import.meta.url),"utf8");
const originRoots=[
  "https://chriswalker-afk.github.io/Index-Shuffle/",
  "https://indices.mrwalkermaths.com/"
];
const pages=[
  "index.html","art-preview.html","boss-gallery.html",
  "item-gallery.html","world-gallery.html"
];

assert.equal(load("CNAME").trim(),"indices.mrwalkermaths.com");
for(const page of pages){
  const html=load(page);
  assert.match(html,/<html\b/i,page+" is a real HTML document");
  assert.doesNotMatch(html,/<base\b/i,page+" must not pin a base URL");
  const refs=[...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map(match=>match[1]);
  const local=refs.filter(value=>value && !value.startsWith("#")
    && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
  assert.ok(local.length>=2,page+" should reference local assets or navigation links");
  for(const value of local){
    assert.ok(!value.startsWith("/"),page+" should not reference an absolute-root path: "+value);
    for(const root of originRoots){
      const url=new URL(value,new URL(page,root));
      assert.equal(url.origin,new URL(root).origin,page+" asset crosses site origin: "+value);
      const basePath=new URL(root).pathname;
      assert.ok(url.pathname.startsWith(basePath),page+" escapes site root: "+value);
    }
    const oldUrl=new URL(value,new URL(page,originRoots[0]));
    const relative=decodeURIComponent(oldUrl.pathname.slice(new URL(originRoots[0]).pathname.length));
    if(/\.(?:css|mjs|js|html|svg|png|jpg|jpeg|webp)$/i.test(relative)){
      assert.ok(existsSync(new URL("./"+relative,import.meta.url)),
        "Missing local page or art asset "+page+" -> "+value);
    }
  }
}
const home=load("index.html");
assert.match(home,/<link rel="canonical" href="https:\/\/indices\.mrwalkermaths\.com\/">/);
assert.match(home,/<meta property="og:url" content="https:\/\/indices\.mrwalkermaths\.com\/">/);
assert.doesNotMatch(home,/chriswalker-afk\.github\.io\/Index-Shuffle\//);
const shared=load("experience.mjs");
assert.match(shared,/Play: https:\/\/indices\.mrwalkermaths\.com\//);
assert.doesNotMatch(shared,/chriswalker-afk\.github\.io\/Index-Shuffle\//);
const game=load("app.mjs");
for(const saveKey of ["index-shuffle-v1","index-shuffle-roguelite-v1"])
  assert.ok(game.includes(saveKey),"Existing save key must remain unchanged: "+saveKey);
console.log("PASS: both GitHub Pages roots, Index Shuffle galleries, artwork, metadata, share URL, and saved-game keys");
