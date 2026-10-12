import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const html=read("index.html"),app=read("app.js"),worker=read("sw.js");
const css=read("styles.css");

test("Kanji screen provides a searchable family browser and linked character sheet",()=>{
  for(const id of ["family-panel","family-search","family-theme","family-list",
    "family-count","family-error","family-more","kanji-family-detail",
    "kanji-family-meaning","kanji-family-radical","kanji-family-sentences",
    "family-dictionary-query","family-dictionary-level","family-dictionary-list",
    "family-dictionary-count",
    "kanji-family-message"])assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.match(app,/function renderKanjiFamilies\(sentences\)/);
  assert.match(app,/function renderKanjiFamily\(character,sentences\)/);
  assert.match(app,/await renderKanjiFamily\(character,all\)/);
  assert.match(css,/\.family-row\s*\{/);
  assert.match(css,/\.kanji-family-detail\s*\{/);
});
test("Kanji families import one requested sentence via the existing Echo pipeline",()=>{
  const save=app.slice(app.indexOf("async function addFamilySentence"),app.indexOf("async function renderKanjiInfo"));
  assert.match(save,/importBackupData\(\{schemaVersion:2,sentences:\[card\]\}\)/);
  assert.match(save,/await openKanji\(/);
  // Browsing/displaying must never trigger import or an SRS write.
  const browse=app.slice(app.indexOf("async function renderKanjiFamilies"),app.indexOf("function bandHead"));
  const detail=app.slice(app.indexOf("async function renderKanjiFamily"),app.indexOf("async function addFamilySentence"));
  for(const area of [browse,detail]){
    assert.doesNotMatch(area,/importBackupData\(/);
    assert.doesNotMatch(area,/saveSentence\(/);
  }
});
test("offline install caches the data, module and matching stylesheet version",()=>{
  for(const path of ["./kanji-families.js","./decks/kanji-families-curriculum.json"])
    assert.ok(worker.includes('"'+path+'"'),path);
  const htmlVersion=html.match(/styles\.css\?v=(\d+)/)?.[1];
  assert.ok(htmlVersion);
  assert.ok(worker.includes('"./styles.css?v='+htmlVersion+'"'));
});

test("additional dictionary words open the existing Word sheet, without fake sentences",()=>{
 assert.match(app,/function renderKanjiFamilyDictionary\(family\)/);
 assert.match(app,/familyVocabulary\(family,REFERENCE_WORDS/);
 assert.match(app,/openWord\(entry,wordCoverage\(await listSentences\(\)\),\{route:false\}\)/);
 const source=app.slice(app.indexOf("function renderKanjiFamilyDictionary"),app.indexOf("async function addFamilySentence"));
 assert.doesNotMatch(source,/importBackupData\(/);
 assert.doesNotMatch(source,/saveSentence\(/);
});

test("kanji screen renders every matching vocabulary word without pagination",()=>{
  const ui=app.slice(app.indexOf("function renderKanjiFamilyDictionary("),
    app.indexOf("async function addFamilySentence("));
  assert.match(ui,/familyVocabulary\(family,REFERENCE_WORDS/);
  assert.match(ui,/for\(const entry of matches\)/);
  assert.match(ui,/list\.replaceChildren\(fragment\)/);
  assert.doesNotMatch(ui,/\.slice\(/);
  assert.doesNotMatch(ui,/\.limit|\.length\s*<\s*3/);
  assert.doesNotMatch(html,/id="family-dictionary-more"/);
  assert.match(html,/All vocabulary containing this kanji/);
});
