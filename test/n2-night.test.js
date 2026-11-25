import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nightPlan, nightRecord, keepNight, nightComparison, comparisonLine, nextDay, studyDay, NIGHT_MIN_SPLIT, eveningRecall, EVENING_SOURCE} from "../n2-night.js";
import {delayedChecks, CHECK_SOURCE} from "../n2-delayed.js";
import {radioEvent, examplesFromDecks} from "../day-radio.js";
import {recallRecord, recallId} from "../n2-study.js";
import {radioSteps} from "../radio.js";
import {mergeN2, signatures} from "../sync.js";
import {restorePreview, previewLine} from "../restore.js";
import {FILES} from "../sync.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
const inventory = read("../n2-inventory.json");
const examples = examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
const K = JSON.stringify;
const at = (day, hour = 10) => new Date(day + "T" + String(hour).padStart(2, "0") + ":00:00").toISOString();
const word = i => ["word", ...inventory.words[i].slice(0, 2)];
const missed = (i, day) => {
  const target = word(i), row = {id: recallId("meaning", target), type: "meaning", item: {target, prompt: target[1], reading: target[2], answer: inventory.words[i][2]}};
  return recallRecord(null, row, "missed", new Date(at(day)));
};

test("the night belongs to the day studied, until 5 am", () => {
  assert.equal(nextDay("2026-11-30"), "2026-12-01");
  assert.equal(studyDay(new Date("2026-11-25T23:30:00")), "2026-11-25");
  assert.equal(studyDay(new Date("2026-11-26T02:00:00")), "2026-11-25");
  assert.equal(studyDay(new Date("2026-11-26T06:00:00")), "2026-11-26");
});

test("tonight is today's misses, the batch tomorrow's checks will open, with the deck sentence studied", () => {
  const recall = [0, 1, 2].map(i => missed(i, "2026-11-25"));
  const old = missed(3, "2026-11-20");
  const plan = nightPlan({inventory, recall: [...recall, old], examples, day: "2026-11-25", compare: false});
  assert.deepEqual(plan.cued.map(i => i.key).sort(), recall.map(r => K(r.target)).sort(), "only today's work, not an old miss");
  assert.deepEqual(plan.held, []);
  const tomorrow = delayedChecks({inventory, recall: [...recall, old], today: "2026-11-26", size: Infinity}).map(c => K(c.target)).sort();
  assert.deepEqual(plan.cued.map(i => i.key).sort(), [...new Set(tomorrow)]);
  const first = plan.cued.find(i => i.key === K(word(0)));
  assert.equal(first.target, examples.get(K(word(0)))[0].ja, "the cue is the deck sentence, with its readings");
  assert.equal(first.source, examples.get(K(word(0)))[0].en);
  // In deep sleep the cue is the sentence alone (radio.js).
  assert.deepEqual(radioSteps("cues", first).filter(s => s.say).map(s => s.lang), ["ja"]);
});

test("Day Radio plays and listening misses today reach the night; nothing today means an empty night", () => {
  const heard = radioEvent({target: word(5), kind: "exposure", source: "day-radio", mode: "listen", now: new Date(at("2026-11-25"))});
  const plan = nightPlan({inventory, events: [heard], examples, day: "2026-11-25"});
  assert.deepEqual(plan.cued.map(i => i.key), [K(word(5))]);
  assert.equal(plan.compare, false, "too few to split");
  assert.deepEqual(nightPlan({inventory, events: [heard], examples, day: "2026-11-26"}).cued, []);
});

test("compare cues a fixed half and holds the rest back; the halves never overlap", () => {
  const recall = Array.from({length: 30}, (_, i) => missed(i, "2026-11-25"));
  const plan = nightPlan({inventory, recall, examples, day: "2026-11-25"});
  assert.equal(plan.compare, true);
  assert.equal(plan.cued.length + plan.held.length, 30);
  assert.ok(plan.cued.length >= 5 && plan.held.length >= 5, "roughly half each");
  const cued = new Set(plan.cued.map(i => i.key));
  assert.ok(plan.held.every(i => !cued.has(i.key)));
  const again = nightPlan({inventory, recall, examples, day: "2026-11-25"});
  assert.deepEqual(again.cued.map(i => i.key), plan.cued.map(i => i.key), "reopening keeps the same halves");
  assert.ok(NIGHT_MIN_SPLIT > 1);
});

test("the next day's checks are counted by half; a print miss or a slow ear counts as not recalled", () => {
  const record = nightRecord({day: "2026-11-25", compare: true, cued: [{key: K(word(0))}, {key: K(word(1))}], held: [{key: K(word(2))}, {key: K(word(3))}]});
  const nights = keepNight(keepNight([], {...record, cued: []}), record);
  assert.equal(nights.length, 1, "one record per day, the latest wins");
  const check = (i, grade) => {
    const target = word(i), r = missed(i, "2026-11-25");
    return {...r, events: [...r.events, {at: at("2026-11-26", 9), grade, source: CHECK_SOURCE}]};
  };
  const recall = [check(0, "instant"), check(1, "instant"), check(2, "missed")];
  const events = [radioEvent({target: word(3), kind: "recall", grade: "slow", source: CHECK_SOURCE, mode: "check", now: new Date(at("2026-11-26", 9))})];
  const tally = nightComparison({nights, recall, events});
  assert.deepEqual(tally, {cued: {right: 2, n: 2}, held: {right: 0, n: 2}, nights: 1});
  assert.match(comparisonLine(tally), /cued 2 of 2 \(100%\), not cued 0 of 2 \(0%\)\. Too few yet to tell\./);
  assert.equal(comparisonLine(nightComparison({nights: [], recall, events})), "");
});

test("the Radio screen plays the cued half only and the nights travel with the N2 data", () => {
  const app = src("../app.js"), html = src("../index.html"), sw = src("../sw.js"), mock = src("../n2-mock.js"), night = src("../n2-night.js");
  assert.match(app, /return radioSource\(\)==="n2"\?radioN2\?\.plan\.cued\|\|\[\]:radioSentences/);
  assert.match(app, /radio\.start\(queue,/);
  assert.match(app, /localStorage\.setItem\(NIGHT_KEY,JSON\.stringify\(keepNight\(readNights\(\),nightRecord\(radioN2\.plan\)\)\)\);markDirty\("n2"\)/);
  assert.match(html, /id="radio-source" class="segmented radio-source" role="tablist"/);
  assert.match(html, /id="radio-compare" type="checkbox"> Cue half, to compare tomorrow/);
  assert.match(sw, /"\.\/n2-night\.js"/);
  assert.match(mock, /comparisonLine\(nightComparison\(/);
  assert.doesNotMatch(night, /access\(|indexedDB/, "a night is a record of what played, never recall evidence");
  const progress = src("../n2-progress.js");
  assert.match(progress, /recall,events,nights:readNights\(\)\}/, "the N2 export carries the nights");
  assert.match(progress, /recall,events,nights:readNights\(\),goal:readGoal\(\)/, "the gist N2 file carries the nights");
  assert.match(progress, /localStorage\.setItem\(NIGHT_KEY,JSON\.stringify\(merged\.nights\)\)/);
});

test("nights merge by day across devices, the later save winning, and a restore names them", () => {
  const a = {id: "night-2026-11-24", day: "2026-11-24", at: "2026-11-24T22:00:00Z", compare: true, cued: ["x"], held: ["y"]};
  const b = {id: "night-2026-11-25", day: "2026-11-25", at: "2026-11-25T22:00:00Z", compare: true, cued: ["p"], held: ["q"]};
  const later = {...a, at: "2026-11-24T23:00:00Z", cued: ["x", "z"]};
  const merged = mergeN2({nights: [a]}, {nights: [later, b]});
  assert.deepEqual(merged.nights.map(n => n.day), ["2026-11-24", "2026-11-25"]);
  assert.deepEqual(merged.nights[0].cued, ["x", "z"], "the later save of a day wins");
  assert.deepEqual(mergeN2({nights: [later]}, {nights: [a]}).nights[0].cued, ["x", "z"], "in either order");
  assert.notEqual(signatures.n2({nights: [a]}), signatures.n2({nights: [later]}), "a changed night is pushed");
  assert.equal(signatures.n2(mergeN2({nights: [a]}, {nights: [a]})), signatures.n2({nights: [a]}), "an unchanged night is not");
  const preview = restorePreview({[FILES.n2]: {nights: [a]}}, {[FILES.n2]: {nights: [a, b]}});
  assert.equal(preview.nights, 1);
  assert.match(previewLine(preview), /1 Night Radio night/);
  assert.equal(nightRecord({day: "2026-11-25", compare: false, cued: [], held: []}).id, "night-2026-11-25");
});

test("evening recall takes tonight's items, both halves, in the sentence the night cues; done ones leave; it never counts as a delayed check", () => {
  const recall = Array.from({length: 12}, (_, i) => missed(i, "2026-11-25"));
  const plan = nightPlan({inventory, recall, examples, day: "2026-11-25"});
  const evening = eveningRecall({inventory, recall, examples, day: "2026-11-25"});
  assert.deepEqual(evening.map(c => K(c.target)).sort(), [...plan.cued, ...plan.held].map(i => i.key).sort(), "cued and held alike, so the comparison stays fair");
  const first = evening.find(c => K(c.target) === K(word(0)));
  assert.equal(first.example.ja, plan.cued.concat(plan.held).find(i => i.key === K(word(0))).target, "the very sentence the night plays");
  assert.equal(first.context, "night");
  // Recalled tonight (print, evening source): it leaves the evening, but tomorrow's check still asks it.
  const graded = recall.map((r, i) => i === 0 ? {...r, events: [...r.events, {at: at("2026-11-25", 22), grade: "instant", source: EVENING_SOURCE}]} : r);
  assert.equal(eveningRecall({inventory, recall: graded, examples, day: "2026-11-25"}).some(c => K(c.target) === K(word(0))), false);
  assert.ok(delayedChecks({inventory, recall: graded, today: "2026-11-26"}).some(c => K(c.target) === K(word(0))), "tomorrow still checks it");
  assert.deepEqual(nightComparison({nights: [nightRecord(plan)], recall: graded, events: []}), {cued: {right: 0, n: 0}, held: {right: 0, n: 0}, nights: 0}, "an evening grade is not a next-day check");
  assert.equal(eveningRecall({inventory, recall, examples, day: "2026-11-25", size: 5}).length, 5);
});

test("evening recall is the checks session in its own mode, linked from the hub and the Radio screen", () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html"), index = src("../index.html");
  assert.match(mock, /view === "evening" \? \(\) => checks\("evening"\)/);
  assert.match(mock, /const sourceOf = evening \? EVENING_SOURCE : CHECK_SOURCE;/);
  assert.match(mock, /source: sourceOf\};/, "print grades carry the evening source");
  assert.match(mock, /source: sourceOf, mode, exampleId/, "audio grades too");
  assert.match(mock, /\$\("check-done-go"\)\.href = evening \? "\.\/radio" : "\.\/n2-mock\.html";/);
  assert.match(html, /href="\?view=evening"><span class="library-tool-glyph" lang="ja" aria-hidden="true">夕<\/span>/);
  assert.match(index, /id="radio-evening" href="\.\/n2-mock\.html\?view=evening"/);
});
