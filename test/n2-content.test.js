// The authored N2 content: the realistic mock sets and the Review decks.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync, readdirSync} from "node:fs";
import {BLUEPRINT, realisticRows, bookIds} from "../n2-forms.js";
import {validateSet} from "../tools/n2-validate-set.mjs";
import {validateDeckBatch, usesWord} from "../tools/n2-validate-deck.mjs";
import {validateDeckBackup} from "../imports.js";
import {mix, validateGenerated} from "../n2-adaptive.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("the blueprint is the JLPT N2 paper: 30 vocabulary, 22 grammar, 21 reading, 32 listening", () => {
  const count = skill => BLUEPRINT.filter(b => b.skill === skill).reduce((n, b) => n + b.count, 0);
  assert.deepEqual(["Vocabulary", "Grammar", "Reading", "Listening"].map(count), [30, 22, 21, 32]);
  assert.ok(BLUEPRINT.every(b => b.instruction && b.kind));
});

test("every shipped realistic set passes the blueprint validator and becomes exam rows", () => {
  const index = read("../n2-sets/index.json");
  const files = readdirSync(new URL("../n2-sets/", import.meta.url)).filter(f => /^n2-set-\d+\.json$/.test(f));
  assert.deepEqual(Object.keys(index).sort(), files.map(f => f.slice(0, -5)).sort());
  const passages = new Set();
  for (const f of files) {
    const set = read("../n2-sets/" + f);
    assert.ok(bookIds.includes(set.id), set.id);
    assert.deepEqual(validateSet(set), [], f);
    const rows = realisticRows(set);
    assert.ok(rows.every(r => r.instruction && r.label.includes("問題") && r.skill >= 0));
    const passage = set.questions.find(q => q.skill === "Reading").context;
    assert.ok(!passages.has(passage), f + " repeats a passage"); passages.add(passage);
  }
});

test("the N2 decks import through Echo's deck door and each sentence uses its word or grammar point", () => {
  for (const name of ["n2-grammar", "n2-words"]) {
    const url = new URL("../decks/" + name + ".json", import.meta.url);
    if (!existsSync(url)) continue;
    const deck = JSON.parse(readFileSync(url, "utf8"));
    assert.equal(validateDeckBackup(deck).sentences.length, deck.sentences.length, name);
    assert.deepEqual(validateDeckBatch(deck.sentences), [], name);
  }
  assert.ok(usesWord("この町【まち】のラーメンは日本一【にほんいち】だ。", "～いち (にほんいち)"));
  assert.ok(usesWord("マラソンを最後【さいご】まで走【はし】りきった。", "～きる"));
  assert.ok(!usesWord("今日【きょう】は雨【あめ】だ。", "承認"));
});

test("generated exams keep the requested mix and only well-formed questions in real formats", () => {
  assert.deepEqual(mix("Grammar", 20, []), {Grammar: 20});
  const m = mix("mixed", 20, []);
  assert.equal(Object.values(m).reduce((a, b) => a + b, 0), 20);
  const weak = [{skill: "Listening"}, {skill: "Listening"}, {skill: "Vocabulary"}];
  assert.deepEqual(Object.keys(mix("weak", 9, weak)).sort(), ["Listening", "Vocabulary"]);
  const used = new Set(), aims = [{target: ["word", "承認", "しょうにん"], dimension: "reading"}];
  const good = validateGenerated({mondai: 1, context: "", prompt: "【承認】を得た。", choices: ["しょうにん", "じょうにん", "しょうねん", "じょうねん"], key: 1, why: "x", focusIndex: 0}, {skill: "Vocabulary", aims, used});
  assert.equal(good.kind, "漢字読み"); assert.deepEqual(good.target, aims[0].target);
  assert.equal(validateGenerated({mondai: 4, context: "女：いいですか。", prompt: "", choices: ["a", "b", "c", "d"], key: 1, why: "x"}, {skill: "Listening", aims: [], used}), null, "即時応答 has three choices");
  assert.equal(validateGenerated({mondai: 99, prompt: "x", choices: ["a", "b", "c", "d"], key: 1, why: "x"}, {skill: "Grammar", aims: [], used}), null);
});

import {priorities} from "../n2-adaptive.js";
test("targeted exams keep weaknesses separate by skill and use active radio checks", () => {
  const target = ["word", "就任", "しゅうにん"];
  const data = {papers: [], attempts: [], recall: [
    {target, dimension: "reading", last: "missed", updatedAt: "2026-11-20"},
    {target, dimension: "meaning", last: "instant", updatedAt: "2026-11-21"}
  ], events: [{target, kind: "exposure", at: "2026-11-21"},
    {target, skill: "listening", kind: "recall", grade: "missed", at: "2026-11-22"}]};
  assert.deepEqual(priorities(data).map(x => x.dimension), ["listening", "reading"]);
  data.events.push({target, skill: "listening", kind: "recall", grade: "got", at: "2026-11-23"});
  assert.deepEqual(priorities(data).map(x => x.dimension), ["reading"]);
});
