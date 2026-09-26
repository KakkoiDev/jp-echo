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
