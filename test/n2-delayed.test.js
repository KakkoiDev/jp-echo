import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {delayedChecks, checkItems, checkDetail, audioGrade, delayedAccuracy, sentenceParts, contextNote, previousDay, CHECK_SOURCE} from "../n2-delayed.js";
import {radioEvent, listeningWeak, examplesFromDecks} from "../day-radio.js";
import {weakTargets, recallQueue, recallRecord, recallId} from "../n2-study.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const inventory = read("../n2-inventory.json");
const K = JSON.stringify;
const word = w => { const i = inventory.words.findIndex(x => x[0] === w); return ["word", ...inventory.words[i].slice(0, 2)]; };
const shunin = word("就任");
const grammar = ["grammar", inventory.grammar[0][0]];
const items = checkItems(inventory);
const at = (day, hour = 10) => new Date(day + "T" + String(hour).padStart(2, "0") + ":00:00").toISOString();

test("yesterday is the previous local day", () => {
  assert.equal(previousDay("2026-11-25"), "2026-11-24");
  assert.equal(previousDay("2026-12-01"), "2026-11-30");
});

test("the 就任 case: reading known, meaning missed in a dialogue, caught in a different dialogue the next day; only listening evidence improves", () => {
  const readingRecord = {id: recallId("reading", shunin), target: shunin, dimension: "reading", last: "instant", days: ["2026-11-23", "2026-11-24"], day: "2026-11-24",
    updatedAt: at("2026-11-24", 8), events: [{at: at("2026-11-23", 8), grade: "instant"}, {at: at("2026-11-24", 8), grade: "instant"}]};
  const missedInDialogue = radioEvent({target: shunin, kind: "recall", grade: "missed", source: "day-radio", mode: "recall", exampleId: "dialogue-a", now: new Date(at("2026-11-24", 9))});
  const examples = new Map([[K(shunin), [{id: "dialogue-a", ja: "新しい部長が就任した。", en: "A new manager took office."}, {id: "dialogue-b", ja: "社長の就任を祝う会がある。", en: ""}]]]);
  const recall = [readingRecord];
  const checks = delayedChecks({inventory, recall, events: [missedInDialogue], examples, today: "2026-11-25"});
  assert.equal(checks.length, 1);
  const [check] = checks;
  assert.equal(check.modality, "audio"); assert.equal(check.dimension, "meaning");
  assert.equal(check.example.id, "dialogue-b", "a context not heard yesterday"); assert.equal(check.context, "fresh");

  const caught = radioEvent({target: shunin, kind: "recall", grade: audioGrade("instant"), source: CHECK_SOURCE, mode: "check", exampleId: check.example.id,
    detail: checkDetail(check, {activeMs: 9000, responseMs: 4000, replays: 1}), now: new Date(at("2026-11-25", 9))});
  assert.equal(caught.context.source, CHECK_SOURCE); assert.equal(caught.context.modality, "audio");
  assert.equal(caught.context.assistance, "replayed 1"); assert.equal(caught.context.activeMs, 9000);
  const events = [missedInDialogue, caught];
  assert.equal(listeningWeak(events).get(K(shunin)).weak, false, "listening improved");
  // Written evidence did not move: the reading record is the same object, still instant.
  assert.equal(weakTargets("reading", recall, []).get(K(shunin)).weak, false);
  assert.equal(weakTargets("meaning", recall, []).has(K(shunin)), false, "no meaning record was invented");
  assert.equal(recall.length, 1);
  assert.equal(delayedChecks({inventory, recall, events, examples, today: "2026-11-25"}).length, 0, "done once today");
});

test("print misses and exam misses come back in print; listening exam misses come back by ear; a same-day retry does not cancel the check", () => {
  const row = {id: recallId("meaning", shunin), type: "meaning", item: {target: shunin, prompt: "就任", reading: "しゅうにん", answer: "inauguration"}};
  let record = recallRecord(null, row, "missed", new Date(at("2026-11-24", 9)));
  record = recallRecord(record, row, "instant", new Date(at("2026-11-24", 11)));
  const grammarMiss = {target: grammar, skill: 1, answered: true, correct: false, guessed: false, at: at("2026-11-24", 14), paper: "n2-set-5@r3", index: 40};
  const listenMiss = {target: word("周辺"), dimension: "meaning", skill: 3, answered: true, correct: false, at: at("2026-11-24", 15), paper: "adaptive-x", index: 2};
  const guessed = {target: word("終了"), dimension: "meaning", skill: 0, answered: true, correct: true, guessed: true, at: at("2026-11-24", 15), paper: "n2-set-5@r3", index: 3};
  const clean = {target: word("縮小"), dimension: "meaning", skill: 0, answered: true, correct: true, guessed: false, at: at("2026-11-24", 15), paper: "n2-set-5@r3", index: 4};
  const checks = delayedChecks({inventory, recall: [record], evidence: [grammarMiss, listenMiss, guessed, clean], today: "2026-11-25"});
  const find = t => checks.find(c => K(c.target) === K(t));
  assert.equal(find(shunin).modality, "print"); assert.equal(find(shunin).why, "missed");
  assert.equal(find(grammar).modality, "print"); assert.equal(find(grammar).dimension, "grammar");
  assert.equal(find(word("周辺")).modality, "audio");
  assert.equal(find(word("終了")).why, "guessed");
  assert.equal(find(word("縮小")), undefined, "a clean answer needs no delayed check");
  assert.ok(checks.findIndex(c => c.why === "guessed") > checks.findIndex(c => c.why === "missed"), "misses before guesses");
  // Meanings and grammar are mixed rather than blocked.
  for (let i = 1; i < checks.length; i++) if (checks[i].dimension === checks[i - 1].dimension && checks[i].modality === checks[i - 1].modality)
    assert.ok(checks.slice(i).every(c => c.dimension === checks[i].dimension && c.modality === checks[i].modality));
});

test("a print delayed check updates the recall record of its dimension and counts as done today", () => {
  const row = {id: recallId("meaning", shunin), type: "meaning", item: {target: shunin, prompt: "就任", reading: "しゅうにん", answer: "inauguration"}};
  const missed = recallRecord(null, row, "missed", new Date(at("2026-11-24", 9)));
  const [check] = delayedChecks({inventory, recall: [missed], today: "2026-11-25"});
  const fixed = recallRecord(missed, row, "instant", new Date(at("2026-11-25", 9)), checkDetail(check, {activeMs: 7000, responseMs: 3000}));
  assert.equal(fixed.events.at(-1).source, CHECK_SOURCE); assert.equal(fixed.events.at(-1).modality, "print"); assert.equal(fixed.events.at(-1).assistance, "none");
  assert.equal(weakTargets("meaning", [fixed], []).get(K(shunin)).weak, false);
  assert.equal(delayedChecks({inventory, recall: [fixed], today: "2026-11-25"}).length, 0);
  assert.deepEqual(delayedAccuracy({recall: [fixed], now: new Date(at("2026-11-25", 12))}), {n: 1, correct: 1, rate: 1});
  assert.ok(!recallQueue({type: "meaning", filter: "weak", inventory, recall: [fixed]}).length);
});

test("passive plays are lowest priority, and a single context is labelled", () => {
  const heard = radioEvent({target: shunin, kind: "exposure", source: "day-radio", mode: "listen", exampleId: "only", now: new Date(at("2026-11-24", 9))});
  const one = new Map([[K(shunin), [{id: "only", ja: "部長に就任した。", en: ""}]]]);
  const [check] = delayedChecks({inventory, events: [heard], examples: one, today: "2026-11-25"});
  assert.equal(check.why, "heard"); assert.equal(check.context, "same");
  assert.match(contextNote(check), /Only one sentence/);
  const none = delayedChecks({inventory, events: [heard], today: "2026-11-25"})[0];
  assert.equal(none.context, "none"); assert.match(contextNote(none), /word itself/);
  assert.equal(delayedChecks({inventory, events: [heard], today: "2026-11-26"}).length, 0, "only yesterday");
});

test("the hub and the session count the same batch, capped at the session size", () => {
  const events = inventory.words.slice(0, 60).map(([w, r], i) => radioEvent({target: ["word", w, r], kind: "recall", grade: "missed", source: "day-radio", mode: "recall", now: new Date(at("2026-11-24", 9) + "".slice(0, 0))}));
  const examples = examplesFromDecks(inventory, [read("../decks/n2-words.json")]);
  const counted = delayedChecks({inventory, events, today: "2026-11-25"}).length;
  const opened = delayedChecks({inventory, events, examples, today: "2026-11-25"}).length;
  assert.equal(counted, 40); assert.equal(opened, counted);
});

test("print sentences underline the target when it is written there", () => {
  const check = {...items.get(K(["meaning", shunin])), example: {id: "x", ja: "部長に就任【しゅうにん】した。"}};
  assert.deepEqual(sentenceParts(check), [{text: "部長に"}, {text: "就任", mark: true}, {text: "した。"}]);
  assert.deepEqual(sentenceParts({...check, example: {id: "y", ja: "別の文。"}}), [{text: "別の文。"}]);
});
