import test from "node:test";
import assert from "node:assert/strict";
import {romajiToKana, searchGrammar, searchKanji, toHiragana} from "../lookup.js";

test("romaji becomes kana the way a learner types it, and non-romaji is refused", () => {
  assert.equal(romajiToKana("gaku"), "がく");
  assert.equal(romajiToKana("shimau"), "しまう");
  assert.equal(romajiToKana("kyou"), "きょう");
  assert.equal(romajiToKana("matte"), "まって");
  assert.equal(romajiToKana("kanji"), "かんじ");
  assert.equal(romajiToKana("te shimau"), "てしまう");
  assert.equal(romajiToKana("study"), null, "no syllable 'st', so not romaji");
  assert.equal(toHiragana("ガク"), "がく");
});

test("a reading finds every joyo kanji read that way, in wall order", () => {
  for (const q of ["がく", "ガク", "gaku"]) {
    const r = searchKanji(q);
    assert.equal(r.how, "read"); assert.equal(r.key, "がく");
    for (const c of ["学", "楽", "額", "岳"]) assert.ok(r.chars.includes(c), q + " finds " + c);
    assert.ok(r.chars.indexOf("学") < r.chars.indexOf("岳"), "N5 before N1");
  }
  assert.ok(searchKanji("まなぶ").chars.includes("学"), "okurigana dot stripped");
  assert.ok(searchKanji("まな").chars.includes("学"), "the stem before the dot");
});

test("a word finds kanji by meaning; a character is itself; not joyo is said apart", () => {
  const study = searchKanji("study");
  assert.equal(study.how, "mean"); assert.ok(study.chars.includes("学"));
  const typed = searchKanji("綺麗");
  assert.equal(typed.how, "are"); assert.deepEqual(typed.chars, ["麗"]); assert.deepEqual(typed.notJoyo, ["綺"]);
  assert.equal(searchKanji("   "), null);
  assert.deepEqual(searchKanji("ぬぬぬ"), {how: "read", key: "ぬぬぬ", chars: [], notJoyo: []}, "kana with no match is still a reading search, not an English one");
});

test("grammar by name, by romaji, by gloss", () => {
  assert.ok(searchGrammar("てしまう").points.some(p => p.title.includes("てしまう")));
  assert.ok(searchGrammar("te shimau").points.some(p => p.title.includes("てしまう")));
  assert.equal(searchGrammar("テシマウ").key, "てしまう");
  const question = searchGrammar("question");
  assert.equal(question.how, "mean"); assert.ok(question.points.some(p => p.title === "か"), "question is in か's gloss");
  assert.equal(searchGrammar(""), null);
});
