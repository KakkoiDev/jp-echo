// The library is the learner's own. Echo seeds it once, on request, with the
// Mini Hongo starter; there is no general deck import. Grammar is explained on
// the sentence page, never injected into rows, bubbles or the sentence itself.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {isSeeded, isStarterSentence} from "../mini-imports.js";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const fn = (from, to) => { const start = app.indexOf(from); return app.slice(start, app.indexOf(to, start + from.length)); };

test("there is no general deck import: only backup restore and the starter seed", () => {
  for (const gone of ["import-ai-team", "import-example-deck", "deck-json-url", "import-deck-url"]) assert.doesNotMatch(html, new RegExp(`id="${gone}"`), gone);
  assert.doesNotMatch(app, /AI_TEAM_DECK_URL|EXAMPLE_DECK_URL|importDeckURL/);
  assert.match(html, /id="import"[^>]*>Restore</);
  assert.match(html, /id="import-minihongo"/);
  assert.equal(existsSync(new URL("../examples", import.meta.url)), false);
  assert.doesNotMatch(sw, /examples\//, "the worker no longer precaches a removed file");
});

test("the starter is recognised by provenance, and a seeded library is not offered it again", () => {
  const starter = {id: "a", provenance: {project: "Minihongo", starterVersion: 3}};
  assert.equal(isStarterSentence(starter), true);
  assert.equal(isStarterSentence({id: "b", provenance: {project: "Minihongo", starterVersion: 2}}), false, "old word cards are not the current starter");
  assert.equal(isStarterSentence({id: "c"}), false);
  assert.equal(isSeeded([{id: "mine"}, starter]), true);
  assert.equal(isSeeded([{id: "mine"}]), false);
  const offer = fn("function renderStarterOffer", "\n}");
  assert.match(offer, /targetLang\(\)==="ja"/, "Mini Hongo is Japanese; other targets never see it");
  assert.match(offer, /add\.disabled=seeded/);
});

test("an empty library invites a first sentence, with the starter as the secondary option", () => {
  assert.match(html, /id="empty-history" class="empty-panel"/);
  assert.match(html, /id="empty-practice" class="primary"/);
  assert.match(html, /id="empty-starter" class="plain"/);
  assert.match(app, /\$\("#empty-practice"\)\.onclick=/);
  assert.match(app, /\$\("#empty-starter"\)\.onclick=\(\)=>seedStarter/);
});

test("grammar UI renders only into its own host, and only the sentence page can ask for it", () => {
  assert.match(html, /<div id="sentence-grammar" class="grammar-host" hidden><\/div>/);
  assert.match(html, /<div id="review-grammar" class="grammar-host" hidden><\/div>/);
  assert.doesNotMatch(app, /root\.append\(panel\)|grammar-find|Refresh grammar|Find grammar/);
  const calls = [...app.matchAll(/enableVocabulary\([^;]*?\{grammarHost:\$\("#([\w-]+)"\)(,explain:true)?\}/g)].map(m => m[1] + (m[2] ? "+explain" : ""));
  assert.deepEqual(calls.sort(), ["review-grammar", "sentence-grammar+explain"]);
  const render = fn("function renderSentenceGrammar", "let dictionaryLookupGeneration");
  assert.match(render, /if\(explain&&!analysis&&lang==="ja"&&hasGrammar\(\)&&hasTranslator\(\)\)/, "offered once, hidden when it cannot run");
});

test("a library row opens its sentence: words inside the row are not separate buttons", () => {
  const history = fn("async function renderHistory", "const formatDate");
  assert.doesNotMatch(history, /enableVocabulary\(/);
});

test("auto-read grammar uses the same evidence-backed analysis as the explain action", () => {
  const auto = fn("async function autoTag", "async function tagUntagged");
  assert.match(auto, /analyzeSentenceGrammar\(text,GRAMMAR_POINTS/);
  assert.match(auto, /const fresh=await getSentence\(sentence\.id\);if\(!fresh\|\|isTagged\(fresh\)\)return/);
});
