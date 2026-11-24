import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TAGS, TAG, HELD_OUT, sourceOf, passageIds, comprehensionStats, weakestTag, tagDrill, attemptTags, CAUSES} from "../n2-comprehension.js";
import {todayPlan} from "../n2-study.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const index = read("../n2-sets/index.json");
const tagFile = read("../n2-sets/tags.json");
const sets = Object.keys(index).map(id => ({...read("../n2-sets/" + id + ".json"), id}));

test("every authored reading and listening question has 1–2 reviewed tags from the taxonomy, and nothing else is tagged", () => {
  const known = new Set(TAGS.map(t => t.id));
  assert.deepEqual(tagFile.taxonomy, TAGS.map(t => t.id));
  let need = 0;
  for (const set of sets) set.questions.forEach((q, i) => {
    const t = tagFile.tags[set.id + "#" + i];
    if (q.skill === "Reading" || q.skill === "Listening") {
      need++;
      assert.ok(Array.isArray(t) && t.length >= 1 && t.length <= 2 && t.every(x => known.has(x)), set.id + "#" + i);
    } else assert.equal(t, undefined, set.id + "#" + i + " is not comprehension");
  });
  assert.equal(Object.keys(tagFile.tags).length, need);
  // 即時応答 is about replies; a tag set that ignored it would be suspect.
  assert.ok(sets.every(set => set.questions.some((q, i) => q.skill === "Listening" && q.mondai === 4 && tagFile.tags[set.id + "#" + i][0] === "response")));
});

test("authored questions keep a stable source on full papers and on copies; passages share one identity", () => {
  assert.equal(sourceOf({book: "n2-set-5", edition: "2026.11-r3"}, {index: 60}), "n2-set-5#60");
  assert.equal(sourceOf({book: "n2-set-5", edition: "2026.11-v1"}, {index: 60}), null, "the old template form has other questions");
  assert.equal(sourceOf({book: "adaptive-x"}, {index: 2, source: "n2-set-7#81"}), "n2-set-7#81");
  assert.equal(sourceOf({book: "adaptive-x"}, {index: 2}), null);
  const ids = passageIds("n2-set-2", [{context: ""}, {context: "A"}, {context: "A"}, {context: "B"}]);
  assert.deepEqual(ids, [null, "n2-set-2#p1", "n2-set-2#p1", "n2-set-2#p3"]);
});

test("misses group by the deciding tag; guesses count, blanks do not; the weakest needs enough evidence", () => {
  const tagMap = {"n2-set-2#60": ["exception"], "n2-set-2#61": ["exception", "detail"], "n2-set-2#62": ["exception"], "n2-set-2#63": ["main"], "n2-set-2#64": ["exception"]};
  const paper = {id: "n2-set-2@r3", book: "n2-set-2", edition: "2026.11-r3", questions: Array.from({length: 70}, (_, index) => ({index}))};
  const at = "2026-11-24T10:00:00Z", now = new Date("2026-11-25T10:00:00Z");
  const row = (index, extra) => ({paper: paper.id, index, skill: 2, answered: true, correct: true, guessed: false, at, ...extra});
  const evidence = [row(60, {correct: false}), row(61, {guessed: true}), row(62), row(64, {answered: false}), row(63, {correct: false}), {paper: paper.id, index: 10, skill: 0, answered: true, correct: false, at}];
  const stats = comprehensionStats({papers: [paper], evidence, tagMap, now});
  const exception = stats.find(s => s.id === "exception");
  assert.deepEqual([exception.n, exception.wrong, exception.blank], [3, 2, 1]);
  assert.equal(stats.find(s => s.id === "detail").wrong, 1, "secondary tags count too");
  assert.equal(weakestTag(stats).id, "exception");
  assert.equal(weakestTag(stats.map(s => ({...s, n: Math.min(s.n, 2)}))), null, "two answers are not enough");
  const old = comprehensionStats({papers: [paper], evidence, tagMap, now: new Date("2026-12-20T10:00:00Z")});
  assert.equal(old.find(s => s.id === "exception").n, 0, "only the last two weeks");
});

test("a tag drill takes unseen questions with that deciding tag, never from held-out or sat sets, reading before listening", () => {
  const drill = tagDrill({tag: "exception", sets, tagMap: tagFile.tags, exclude: new Set(["n2-set-2"]), size: 8});
  assert.ok(drill.length > 0 && drill.length <= 8);
  assert.ok(drill.every(p => tagFile.tags[p.source][0] === "exception"));
  assert.ok(drill.every(p => !HELD_OUT.includes(p.set) && p.set !== "n2-set-2"));
  const firstListening = drill.findIndex(p => p.q.skill === "Listening");
  assert.ok(firstListening < 0 || drill.slice(firstListening).every(p => p.q.skill === "Listening"));
  const again = tagDrill({tag: "exception", sets, tagMap: tagFile.tags, exclude: new Set(["n2-set-2"]), seen: new Set(drill.map(p => p.source)), size: 8});
  assert.ok(again.every(p => !drill.some(d => d.source === p.source)), "a second drill uses fresh passages");
  assert.ok(new Set(drill.map(p => p.set)).size > 1, "spread across sets");
});

test("results name the distinctions an attempt slipped on; causes are one tap", () => {
  const set = sets[0];
  const paper = {book: set.id, edition: "2026.11-r3", questions: set.questions.map((q, index) => ({index, skill: ["Vocabulary", "Grammar", "Reading", "Listening"].indexOf(q.skill), key: q.key}))};
  const answers = paper.questions.map(q => q.key), guesses = paper.questions.map(() => false);
  const reading = paper.questions.find(q => q.skill === 2);
  answers[reading.index] = reading.key === 1 ? 2 : 1;
  const slips = attemptTags({paper, attempt: {answers, guesses}, tagMap: tagFile.tags});
  assert.equal(slips.length, 1); assert.equal(slips[0].id, tagFile.tags[set.id + "#" + reading.index][0]); assert.equal(slips[0].wrong, 1);
  assert.deepEqual(CAUSES.map(c => c[0]), ["words", "cue", "question", "time"]);
});

test("the plan gives the weakest distinction twenty minutes of unseen passages on a regular day", () => {
  const goal = {goal: 150, firstToday: 0, unchecked: 1500};
  const plan = todayPlan({days: 10, goal, weak: 10, comprehension: {...TAG.change, n: 5, wrong: 3}, examDate: new Date(2026, 11, 6), now: new Date(2026, 10, 26, 9)});
  const step = plan.steps.find(s => s.kind === "drill");
  assert.equal(step.tag, "change"); assert.equal(step.minutes, 20); assert.match(step.line, /3 of 5/);
  assert.ok(plan.minutes <= 360);
});
