import test from "node:test";
import assert from "node:assert/strict";
import {ALL, bands, carries, coverage, kindOf, learned, LEVELS, marks, sentenceWords, summarise, TOTAL, word, wordsIn} from "../words.js";

const by = form => ALL.find(w => w.w === form || w.k === form);
const names = text => [...wordsIn(text)].map(id => word(id).w);
const sentence = (id, plainTarget, createdAt, state) => ({id, plainTarget, target: plainTarget, createdAt, srs: state === undefined ? undefined : {state}});

test("the dictionary is the common subset plus every JLPT list, banded N5 first", () => {
  assert.ok(TOTAL > 20000);
  assert.deepEqual(LEVELS, ["N5", "N4", "N3", "N2", "N1", "+"]);
  const all = bands();
  assert.equal(all.length, 6);
  assert.equal(all.reduce((n, b) => n + b.words.length, 0), TOTAL, "every word is in exactly one band");
  assert.ok(all[0].words.length > 500 && all[0].words.every(w => w.jlpt === "N5"));
  assert.ok(all[5].words.every(w => !w.jlpt), "the last band is the common words on no list");
  assert.equal(by("食べる").jlpt, "N5");
  assert.equal(word(by("食べる").id), by("食べる"));
  assert.equal(word("nope"), null);
});

test("a word is named in a learner's words", () => {
  assert.equal(kindOf(by("食べる")), "transitive verb");
  assert.equal(kindOf(by("行く")), "intransitive verb");
  assert.equal(kindOf(by("勉強")), "noun · する verb");
  assert.equal(kindOf(by("静か")), "な-adjective");
  assert.equal(kindOf(by("高い")), "い-adjective");
  assert.equal(kindOf({pos: []}), "");
});

test("a conjugated verb or adjective is found by its stem", () => {
  assert.ok(names("昨日は友達と映画を見に行った。").includes("行く"), "行った is 行く");
  assert.ok(names("書いてください。").includes("書く"), "書いて is 書く");
  assert.ok(names("高かったので買わなかった。").includes("高い"), "高かった is 高い");
  assert.ok(names("高かったので買わなかった。").includes("買う"), "買わなかった is 買う");
  assert.ok(names("電車が来た。").includes("来る"));
  assert.ok(names("日本語を勉強しています。").includes("勉強"));
  assert.ok(names("日本語を勉強しています。").includes("いる"), "ている after て");
  assert.ok(names("犬がいた。").includes("いる"), "いた after a particle");
  assert.ok(names("宿題をした。").includes("する"), "をした is する");
});

test("a word inside another is not a sighting, and kana runs do not spell words", () => {
  const found = names("日本語を勉強しています。");
  assert.ok(!found.includes("日"), "日 in 日本語 stands in a kanji run");
  assert.ok(!found.includes("語"));
  assert.ok(names("昨日は友達と映画を見に行った。").every(w => w !== "行"), "行った is not 行 the row");
  assert.ok(!names("高かったので買わなかった。").includes("わ"), "買わ is not わ");
  assert.ok(!names("今日はいい天気ですね。").includes("はい"), "は + いい is not はい");
  assert.ok(names("今日はいい天気ですね。").includes("いい"));
  assert.ok(!names("今日はいい天気ですね。").includes("すね"), "です + ね is not すね");
  assert.ok(names("はい、そうです。").includes("はい"));
  assert.ok(!names("猫はかわいい。").includes("か"), "か at the start of かわいい");
  assert.ok(names("猫はかわいい。").includes("かわいい"));
  assert.ok(!names("友達に会いたい。").includes("いる"), "会いたい is 会う, not 会 + いる");
});

test("marks give the whole word first, then the stem", () => {
  assert.deepEqual(marks(by("食べる")), ["食べる", "食べ"]);
  assert.ok(marks(by("やはり")).includes("やはり"));
  assert.ok(carries("パンを食べた。", by("食べる")));
  assert.ok(!carries("パンを買った。", by("食べる")));
});

test("coverage and learned read the library, every register, oldest first", () => {
  const eat = by("食べる").id, buy = by("買う").id;
  const a = sentence("a", "パンを食べた。", "2024-01-02", 0), b = {id: "b", plainCasualTarget: "パンを買う", plainPoliteTarget: "パンを食べます", createdAt: "2024-01-01", srs: {state: 2}};
  const cover = coverage([a, b]);
  assert.deepEqual(cover.get(eat), ["b", "a"]);
  assert.deepEqual(cover.get(buy), ["b"]);
  assert.ok(sentenceWords({target: "駅【えき】で待【ま】つ"}).has(by("駅").id), "the notation is stripped first");
  const known = learned([a, b]);
  assert.ok(known.has(eat) && known.has(buy) && !known.has(by("駅").id));
  assert.deepEqual(summarise(cover, [by("食べる"), by("駅")]), {met: 1, total: 2});
});
