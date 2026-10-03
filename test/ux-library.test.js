// The library is the learner's: their own sentences, decks they import by file
// or URL, and the optional Mini Hongo seed. Grammar is explained on
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

test("decks import from a file or a URL; no bundled third-party decks", () => {
  assert.match(html, /id="import"[^>]*>Choose file</);
  assert.match(html, /id="deck-json-url" type="url"/);
  assert.match(html, /id="import-deck-url"/);
  assert.match(html, /href="https:\/\/github\.com\/KakkoiDev\/jp-echo\/blob\/main\/DECK-FORMAT\.md"/, "Settings links the format");
  assert.match(app, /\$\("#import-deck-url"\)\.onclick=\(\)=>importDeckURL\(/);
  for (const gone of ["import-ai-team", "import-example-deck"]) assert.doesNotMatch(html, new RegExp(`id="${gone}"`), gone);
  assert.doesNotMatch(app, /AI_TEAM_DECK_URL|EXAMPLE_DECK_URL/);
  assert.match(html, /id="import-minihongo"/, "the starter seed stays");
  assert.match(html, /id="empty-import"/, "an empty library can import a deck");
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
  assert.match(render, /else if\(explain&&lang==="ja"&&hasGrammar\(\)\)/, "offered once, before an answer exists");
  assert.match(render, /!hasTranslator\(\)\?t\("Add an AI key/, "no key: disabled, with the reason");
  assert.match(render, /!navigator\.onLine\?t\("You are offline/, "offline: disabled, with the reason");
  assert.match(render, /ask\.disabled=!!reason/);
  assert.match(render, /grammarList\(items,/, "the answer is the GrammarList");
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
