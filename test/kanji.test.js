import test from "node:test";
import assert from "node:assert/strict";
import {bands, coverage, facts, isJoyo, kanjiIn, learned, sentenceKanji, summarise, TOTAL} from "../kanji.js";

const sentence = (id, plainTarget, createdAt) =>
  ({id, plainTarget, target: plainTarget, createdAt});

test("counts joyo kanji and nothing else", () => {
  const found = kanjiIn("駅はどこですか。");
  assert.deepEqual([...found], ["駅"]);
  // kana, punctuation and the repeater are not kanji
  assert.equal(kanjiIn("どこですか。々").size, 0);
  // a kanji outside the list is real Japanese but not on the wall
  assert.equal(isJoyo("綺"), false);
  assert.equal(kanjiIn("綺麗").size, 1, "麗 is joyo, 綺 is not");
});

test("reads every register, so both writings count", () => {
  const found = sentenceKanji({plainCasualTarget: "駅はどこ？", plainPoliteTarget: "駅前を歩く"});
  assert.deepEqual([...found].sort(), ["前", "歩", "駅"].sort());
});

test("falls back to stripping the notation when no plain form was stored", () => {
  assert.deepEqual([...sentenceKanji({target: "駅【えき】はどこですか。"})], ["駅"]);
});

test("the reading in the notation never counts as a sighting", () => {
  // えき is kana, so it cannot smuggle a kanji in; the bracket content is
  // stripped anyway, and this pins that it stays that way.
  const found = sentenceKanji({target: "山【やま】"});
  assert.deepEqual([...found], ["山"]);
});

test("coverage maps each kanji to the sentences that carry it, oldest first", () => {
  const cover = coverage([
    sentence("b", "駅前", "2026-02-01T00:00:00.000Z"),
    sentence("a", "駅はどこ", "2026-01-01T00:00:00.000Z"),
  ]);
  assert.deepEqual(cover.get("駅"), ["a", "b"], "oldest sighting leads");
  assert.deepEqual(cover.get("前"), ["b"]);
  assert.equal(cover.has("山"), false);
});

test("a sentence with no id is skipped rather than poisoning the map", () => {
  const cover = coverage([{plainTarget: "駅", createdAt: "2026-01-01T00:00:00.000Z"}]);
  assert.equal(cover.size, 0);
});

test("the bands partition the joyo list exactly", () => {
  const all = bands().flatMap(band => band.chars);
  assert.equal(all.length, TOTAL);
  assert.equal(TOTAL, 2136);
  assert.equal(new Set(all).size, TOTAL, "no kanji appears in two bands");
});

test("grade bands hold the 1,026 kyoiku kanji as currently assigned", () => {
  const graded = bands().filter(band => band.level !== null);
  assert.deepEqual(graded.map(band => band.chars.length), [80, 160, 200, 202, 193, 191]);
  assert.equal(graded.reduce((n, band) => n + band.chars.length, 0), 1026);
});

test("the twenty prefecture kanji are grade 4, where the 2017 revision put them", () => {
  const grade4 = bands().find(band => band.level === 4);
  for (const character of "茨媛岡潟岐阜熊香佐埼崎滋鹿縄沖井栃奈梨阪") assert.ok(grade4.chars.includes(character), character);
  assert.equal(bands().find(band => band.level === null).chars.length, 1110);
});

test("teaching order survives: grade 1 still opens with the numerals", () => {
  assert.equal(bands()[0].chars.slice(0, 10).join(""), "一二三四五六七八九十");
});

test("every kanji has readings and meanings without any account", () => {
  assert.deepEqual(facts("駅"), {on: ["エキ"], kun: [], en: ["station"], grade: 3});
  assert.equal(facts("𠮟").on[0], "シツ");
  assert.equal(facts("沖").grade, 4);
  assert.equal(facts("猫")?.en?.[0], "cat");
  assert.equal(facts("綺"), null, "not joyo, not carried");
});

test("summarise counts against whichever band it is given", () => {
  const cover = coverage([sentence("a", "一二三", "2026-01-01T00:00:00.000Z")]);
  assert.deepEqual(summarise(cover, "一二三四"), {met: 3, total: 4});
  assert.equal(summarise(cover).total, 2136);
  assert.equal(summarise(cover).met, 3);
});

test("𠮟 is counted once, not twice", () => {
  // The only joyo kanji outside the BMP. String.length calls it two
  // characters, which would make every total in the app one too many.
  assert.equal(TOTAL, 2136);
  assert.equal(isJoyo("𠮟"), true);
  assert.deepEqual([...kanjiIn("𠮟る")], ["𠮟"]);
  const cover = coverage([sentence("a", "𠮟る", "2026-01-01T00:00:00.000Z")]);
  assert.deepEqual(summarise(cover, "𠮟"), {met: 1, total: 1});
});

test("a kanji counts as known once a sentence carrying it reaches review", () => {
  const learnt = learned([
    {id: "a", plainTarget: "駅はどこ", srs: {state: 2}},
    {id: "b", plainTarget: "山が高い", srs: {state: 0}},
    {id: "c", plainTarget: "川を見る"},
  ]);
  assert.ok(learnt.has("駅"));
  assert.equal(learnt.has("山"), false, "still new, so met but not known");
  assert.equal(learnt.has("川"), false, "never scheduled at all");
});

import {nextUnmet, ORDER, unmetCount} from "../kanji.js";

test("the walk goes through the wall in band order, skipping what you have met", () => {
  const order = ["一", "二", "三", "四"];
  const cover = new Map([["二", ["a"]]]);
  assert.equal(nextUnmet(cover, null, 1, {order}), "一", "starts at the top");
  assert.equal(nextUnmet(cover, "一", 1, {order}), "三", "二 is met, so it is skipped");
  assert.equal(nextUnmet(cover, "三", 1, {order}), "四");
  assert.equal(nextUnmet(cover, "四", 1, {order}), null, "nothing after the last");
  assert.equal(nextUnmet(cover, "四", -1, {order}), "三", "and backwards");
  assert.equal(nextUnmet(cover, "三", -1, {order}), "一", "skipping 二 that way too");
});

test("resuming shows the one you stopped on, unless you have met it since", () => {
  const order = ["一", "二", "三"];
  assert.equal(nextUnmet(new Map(), "二", 1, {inclusive: true, order}), "二");
  assert.equal(nextUnmet(new Map([["二", ["a"]]]), "二", 1, {inclusive: true, order}), "三");
});

test("the real order is grade 1 first and every joyo kanji once", () => {
  assert.equal(ORDER[0], "一");
  assert.equal(ORDER.length, 2136);
  assert.equal(new Set(ORDER).size, 2136);
});

test("what is left is the list minus what you have met", () => {
  assert.equal(unmetCount(new Map()), 2136);
  assert.equal(unmetCount(new Map([["駅", ["a"]], ["山", ["b"]]])), 2134);
});
