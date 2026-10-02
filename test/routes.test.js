import test from "node:test";
import assert from "node:assert/strict";
import {parseRoute,routeFor} from "../routes.js";

test("top-level routes round trip",()=>{for(const [path,state] of [["/",{view:"practice"}],["/discussion",{view:"practice",discussionMode:true}],["/review",{view:"review"}],["/mora",{view:"mora"}],["/library",{view:"library"}],["/words",{view:"map",mapView:"words"}],["/kanji",{view:"map",mapView:"kanji"}],["/grammar",{view:"map",mapView:"grammar"}]])assert.equal(routeFor(parseRoute(path)),path)});

test("resource paths preserve unicode and ids",()=>{assert.deepEqual(parseRoute("/kanji/%E8%B1%8A").modal,{kind:"kanji",id:"豊"});assert.equal(routeFor({view:"map",mapView:"kanji",modal:{kind:"kanji",id:"豊"}}),"/kanji/%E8%B1%8A");assert.equal(routeFor({view:"map",mapView:"words",modal:{kind:"word",id:"word:123"}}),"/words/word%3A123");assert.equal(parseRoute("/sentences/a%2Fb").sentenceId,"a/b")});

test("library search/filter/order are URL state",()=>{const url=routeFor({view:"library",historyQuery:"豊富",historyFilter:"skipped",historyOrder:"english",historyDirection:"asc"});assert.equal(url,"/library?q=%E8%B1%8A%E5%AF%8C&filter=skipped&order=english&direction=asc");assert.deepEqual(parseRoute(url),{view:"library",discussionMode:false,modal:null,historyQuery:"豊富",historyFilter:"skipped",historyOrder:"english",historyDirection:"asc"})});

test("tool search is URL state",()=>{assert.equal(routeFor({view:"map",mapView:"words",mapQuery:"ほうふ"}),"/words?q=%E3%81%BB%E3%81%86%E3%81%B5");assert.equal(parseRoute("/words?q=%E3%81%BB%E3%81%86%E3%81%B5").mapQuery,"ほうふ")});

test("unknown path is explicit",()=>assert.equal(parseRoute("/nope").notFound,true));

test('pretty-route restoration keeps assets rooted at the deployed app',async()=>{
 const {readFile}=await import('node:fs/promises');const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const base=html.indexOf('<base href="/">'),restore=html.indexOf('echo-pages-route');assert.ok(base>=0&&base<restore,'asset base is established before history restores a nested route');
});
