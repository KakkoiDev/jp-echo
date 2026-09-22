import test from "node:test";
import assert from "node:assert/strict";
import {
  alignReading, normalizeFurigana, PRONUNCIATION_OVERRIDES, readingsToNotation,
  rubySegments, segmentsToNotation, stripFurigana, toHiragana,
} from "../core.js";

// The browser twin of jp_core.reading, kept in step with JP Core's test suite.
// A reading is a dictionary lookup, so these place one an analyser supplied and
// never invent one: a wrong reading is plausible, memorised, and said out loud.
const PAIRS = [
  ["食べる","タベル","食【た】べる"],
  ["話し合う","ハナシアウ","話【はな】し合【あ】う"],
  ["見上げる","ミアゲル","見上【みあ】げる"],
  ["取り引き","トリヒキ","取【と】り引【ひ】き"],
  ["申し込み","モウシコミ","申【もう】し込【こ】み"],
  ["受け付け","ウケツケ","受【う】け付【つ】け"],
  ["食べ物","タベモノ","食【た】べ物【もの】"],
  ["今日","キョウ","今日【きょう】"],
  ["大人","オトナ","大人【おとな】"],
  ["一日","ツイタチ","一日【ついたち】"],
  ["日本語","ニホンゴ","日本語【にほんご】"],
  ["日々","ヒビ","日々【ひび】"],
  ["お茶","オチャ","お茶【ちゃ】"],
  ["行きます","イキマス","行【い】きます"],
  ["新しい","アタラシイ","新【あたら】しい"],
  ["静かだ","シズカダ","静【しず】かだ"],
];

test("places the reading on the kanji runs inside a token", () => {
  for (const [surface, analyser, expected] of PAIRS) {
    assert.equal(readingsToNotation([[surface, analyser]]), expected, surface);
  }
});

test("what it emits parses back to what it meant", () => {
  for (const [surface, analyser, expected] of PAIRS) {
    const emitted = readingsToNotation([[surface, analyser]]);
    assert.equal(normalizeFurigana(emitted), expected, `${surface} was rewritten`);
    assert.equal(stripFurigana(emitted), surface, `${surface} did not strip back`);
    assert.ok(rubySegments(emitted).some(part => part.reading), `${surface} made no ruby`);
  }
});

test("kana-only and reading-less tokens pass through", () => {
  assert.equal(readingsToNotation([["テスト","テスト"]]), "テスト");
  assert.equal(readingsToNotation([["やる","ヤル"]]), "やる");
  assert.equal(readingsToNotation([["謎",""]]), "謎");
  assert.equal(readingsToNotation([["謎","*"]]), "謎");
});

test("refuses to guess when surface and reading disagree", () => {
  assert.equal(alignReading("食べる","のむ"), null, "the okurigana must match");
  assert.equal(alignReading("お茶","ちゃ"), null, "leading kana must match too");
  assert.equal(alignReading("見る","みる "), null, "trailing space is not a reading");
  assert.equal(alignReading("駅","えき です"), null, "nor is an explanation");
  assert.equal(alignReading("駅","eki"), null, "nor romaji");
  assert.equal(readingsToNotation([["駅","えき です"]]), "駅", "and the token comes back bare");
});

// 一階 is いっかい; the gemination exists only across the seam, so an analyser
// that splits the compound cannot recover it.
test("overrides repair a compound the analyser split", () => {
  assert.equal(readingsToNotation([["一","イチ"],["階","カイ"]]), "一階【いっかい】");
  assert.equal(readingsToNotation([["六","ロク"],["本","ホン"]]), "六本【ろっぽん】");
  assert.equal(readingsToNotation([["日本","ニッポン"]]), "日本【にほん】");
  assert.equal(readingsToNotation([["一","イチ"],["週間","シュウカン"]]), "一週間【いっしゅうかん】",
    "the longest match wins");
});

test("an override does not fire inside a larger token", () => {
  assert.equal(readingsToNotation([["八百屋","ヤオヤ"]]), "八百屋【やおや】");
});

test("ambiguous compounds are left split on purpose", () => {
  assert.equal(PRONUNCIATION_OVERRIDES["十分"], undefined,
    "じゅっぷん as a duration, じゅうぶん as enough — a token stream cannot tell");
  assert.equal(readingsToNotation([["十","ジュウ"],["分","フン"]]), "十【じゅう】分【ふん】");
});

test("caller overrides win over the built-in table", () => {
  assert.equal(readingsToNotation([["日本","ニッポン"]], {"日本":"にっぽん"}), "日本【にっぽん】");
});

// ヶ and ヵ have no hiragana anyone writes, and 一ヶ月 would come back 一ゖ月.
test("katakana becomes hiragana, counter marks excepted", () => {
  assert.equal(toHiragana("ニホンゴ"), "にほんご");
  assert.equal(toHiragana("一ヶ月"), "一ヶ月");
});

test("segments render back to notation", () => {
  assert.equal(segmentsToNotation([{text:"人",reading:"ひと"},{text:"です"}]), "人【ひと】です");
  assert.equal(segmentsToNotation([{text:"人",reading:""}]), "人", "an empty reading is written bare");
});
