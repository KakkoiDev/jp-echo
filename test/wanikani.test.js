import test from "node:test";
import assert from "node:assert/strict";
import {scrub, SCRUB} from "../wanikani.js";

test("exclamations become exclamations", () => {
  assert.equal(scrub("Jesus, that's a big station."), "Whoa, that's a big station.");
  assert.equal(scrub("Oh my God, look at it."), "Oh wow, look at it.");
  assert.equal(scrub("Gee, I hope so."), "Whoa, I hope so.");
  assert.equal(scrub("gosh that hurt"), "wow that hurt");
});

test("a phrase is replaced whole, not word by word", () => {
  // Without phrase-first ordering this would read "oh my the Giant".
  assert.equal(scrub("oh my god"), "oh wow");
  assert.equal(scrub("Jesus Christ on a bike"), "Whoa on a bike");
});

test("the deity as a character in the story gets a stand-in", () => {
  assert.equal(scrub("God picks up the mountain and moves it."), "The Giant picks up the mountain and moves it.");
});

test("case follows the original", () => {
  assert.equal(scrub("GOD"), "THE GIANT");
  assert.equal(scrub("God"), "The Giant");
  assert.equal(scrub("god"), "the Giant");
});

test("it does not reach inside other words", () => {
  // "gee" must not touch "geese"; "god" must not touch "godown" or "Gödel".
  assert.equal(scrub("The geese flew over the pagoda."), "The geese flew over the pagoda.");
  assert.equal(scrub("a feudal lord and his lordship"), "a feudal lord and his lordship", "lord alone is a real meaning on WaniKani");
});

test("the table is visible and editable", () => {
  assert.ok(Array.isArray(SCRUB) && SCRUB.length > 10);
  assert.ok(SCRUB.every(([from, to]) => typeof from === "string" && typeof to === "string"));
});

import {mnemonicHtml} from "../wanikani.js";

test("WaniKani's own tags become spans", () => {
  assert.equal(mnemonicHtml("The <kanji>駅</kanji> is read <reading>えき</reading>."),
    'The <span class="wk-kanji">駅</span> is read <span class="wk-reading">えき</span>.');
});

test("anything else in the text is escaped, so remote markup cannot reach the page", () => {
  assert.equal(mnemonicHtml('<script>alert(1)</script><b>bold</b>'),
    "&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;bold&lt;/b&gt;");
  assert.equal(mnemonicHtml('a "quote" & an <img src=x onerror=alert(1)>'),
    "a &quot;quote&quot; &amp; an &lt;img src=x onerror=alert(1)&gt;");
});

test("a known tag wrapping hostile content still escapes the content", () => {
  assert.equal(mnemonicHtml("<kanji><img src=x></kanji>"), '<span class="wk-kanji">&lt;img src=x&gt;</span>');
});

test("tags span lines", () => {
  assert.equal(mnemonicHtml("<meaning>two\nlines</meaning>"), '<span class="wk-meaning">two\nlines</span>');
});

import {slimKanji, slimVocabulary, SCRUB_VERSION} from "../wanikani.js";

test("what is stored is already scrubbed — the raw text never reaches the disk", () => {
  const kanji = slimKanji({id: 1, data: {characters: "駅", level: 2, meanings: [{meaning: "Station", accepted_answer: true}],
    readings: [], amalgamation_subject_ids: [], meaning_mnemonic: "Jesus, a <kanji>station</kanji>.", reading_mnemonic: "Oh my God."}});
  assert.equal(kanji.meaningMnemonic, "Whoa, a <kanji>station</kanji>.");
  assert.equal(kanji.readingMnemonic, "Oh wow.");
  const word = slimVocabulary({id: 2, data: {characters: "駅", context_sentences: [{ja: "駅は遠い。", en: "Gee, it's far."}]}});
  assert.equal(word.sentences[0].en, "Whoa, it's far.");
  assert.equal(word.sentences[0].ja, "駅は遠い。", "the Japanese is untouched");
});

test("the word list has a version, so a change to it is a reason to sync again", () => {
  assert.match(SCRUB_VERSION, /^[0-9a-z]+$/);
});

import {slimRadical} from "../wanikani.js";

test("a kanji keeps the ids of its parts, and a radical keeps its name even with no character", () => {
  const k = slimKanji({id: 1, data: {characters: "駅", level: 2, meanings: [], readings: [], amalgamation_subject_ids: [], component_subject_ids: [7, 8], meaning_mnemonic: "", reading_mnemonic: ""}});
  assert.deepEqual(k.components, [7, 8]);
  const r = slimRadical({id: 8, data: {characters: null, slug: "shaku", level: 1, meanings: [{meaning: "Shaku", accepted_answer: true}]}});
  assert.deepEqual(r, {id: 8, characters: null, slug: "shaku", level: 1, meanings: ["Shaku"], hidden: false});
});
