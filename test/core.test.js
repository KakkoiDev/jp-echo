import test from "node:test";
import assert from "node:assert/strict";
import {createSentence,exportBackup,mergeSentences,normalizeFurigana,rubyHtml,stripFurigana,validateTranslation,validateTranslations} from "../core.js";
test("safe ruby HTML",()=>{assert.equal(rubyHtml("<b>日本【にほん】</b>"),"&lt;b&gt;<ruby>日本<rt>にほん</rt></ruby>&lt;/b&gt;");assert.equal(stripFurigana("日本【にほん】です"),"日本です")});
test("removes redundant kana furigana",()=>{const bad="これはテスト【てすと】です、うまくいっています。";assert.equal(normalizeFurigana(bad),"これはテストです、うまくいっています。");assert.equal(normalizeFurigana("これ【これ】はテスト【てすと】です"),"これはテストです");assert.equal(rubyHtml(bad),"これはテストです、うまくいっています。");assert.equal(validateTranslation({japanese:bad}),"これはテストです、うまくいっています。")});
test("validates Japanese",()=>{assert.throws(()=>validateTranslation({japanese:"hello"}));assert.equal(validateTranslation({japanese:"日本【にほん】"}),"日本【にほん】")});
test("validates casual and polite Japanese",()=>{assert.deepEqual(validateTranslations({casualJapanese:"行【い】く",politeJapanese:"行【い】きます"}),{casualJapanese:"行【い】く",politeJapanese:"行【い】きます"});assert.deepEqual(validateTranslations({japanese:"行【い】く"}),{casualJapanese:"行【い】く",politeJapanese:"行【い】く"})});
test("backup omits provider credentials",()=>{const item=createSentence(" Japan "," 日本【にほん】 ",new Date("2026-01-01T00:00:00Z"),"one");assert.equal(item.plainJapanese,"日本");const preferences=exportBackup([item],{apiKey:"secret",providerKeys:{openai:"also-secret"},rate:1}).preferences;assert.equal(preferences.apiKey,undefined);assert.equal(preferences.providerKeys,undefined)});
test("merge is deterministic",()=>{const old={id:"x",english:"old",japanese:"古【ふる】い",echoCount:4,createdAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-02T00:00:00Z"},fresh={...old,english:"new",echoCount:2,createdAt:"2026-01-03T00:00:00Z",updatedAt:"2026-01-04T00:00:00Z"};const [merged]=mergeSentences([old],[fresh]);assert.equal(merged.english,"new");assert.equal(merged.echoCount,4);assert.equal(merged.createdAt,old.createdAt)});

test("an empty reading never reaches the screen or the voice", () => {
  const raw = "これはテスト【】の文【ぶん】だ。";
  assert.equal(normalizeFurigana(raw), "これはテストの文【ぶん】だ。");
  assert.equal(stripFurigana(raw), "これはテストの文だ。");
  assert.ok(!rubyHtml(raw).includes("【"), "no stray bracket survives into the markup");
  assert.match(rubyHtml(raw), /<ruby>文<rt>ぶん<\/rt><\/ruby>/, "a real reading still renders");
});

test("a whitespace-only reading is dropped too", () => {
  assert.equal(stripFurigana("テスト【 】です"), "テストです");
});

