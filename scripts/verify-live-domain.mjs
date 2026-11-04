import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const base="https://indices.mrwalkermaths.com/";
const previous="https://chriswalker-afk.github.io/Index-Shuffle/";
const paths=[
  "index.html","styles.css","app.mjs","engine.mjs","roguelite.mjs",
  "experience.mjs","shop.mjs","bosses.mjs",
  "boss-gallery.html","item-gallery.html","world-gallery.html","art-preview.html",
  "assets/art/index-shuffle-icon.svg","assets/art/boss-frostlock.svg",
  "assets/art/title-numberworld.svg","assets/art/item-sprites.svg"
];
const sha=contents=>createHash("sha256").update(contents).digest("hex");
const fetchText=async url=>{
  const result=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(25000),headers:{"User-Agent":"IndexShuffle-CustomDomainCheck/1.0"}});
  return {result,buffer:Buffer.from(await result.arrayBuffer())};
};
const visited=[];
for(const path of paths){
  const {result,buffer}=await fetchText(new URL(path,base));
  const local=readFileSync(new URL("../"+path,import.meta.url));
  const record={path,status:result.status,finalUrl:result.url,bytes:buffer.length,
    repositoryMatch:buffer.equals(local)};
  visited.push(record);
  console.log("LIVE_ASSET="+JSON.stringify(record));
  if(result.status!==200||new URL(result.url).origin!==new URL(base).origin||!record.repositoryMatch)
    throw Error("Live website resource failed: "+JSON.stringify(record));
}
const index=visited.find(x=>x.path==="index.html");
const old=await fetchText(previous);
const oldFinal=new URL(old.result.url);
if(old.result.status!==200||oldFinal.origin!==new URL(base).origin)
  throw Error("Original address did not redirect to the live custom domain: "+JSON.stringify({
    status:old.result.status,url:old.result.url
  }));
console.log("LIVE_DOMAIN_RESULT="+JSON.stringify({
  url:base,https:true,assetsAndPagesChecked:visited.length,allRepositoryFilesMatch:true,
  hasHomePage:index.status===200,
  legacyRedirect:old.result.url,
  status:"PASS"
}));