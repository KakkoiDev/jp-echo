import test from "node:test";
import assert from "node:assert/strict";
import {render, request, rewrite, SYSTEM} from "../tools/rewrite-stories.mjs";

const subjects = {
  radicals: [{id: 1, characters: "馬", meanings: ["horse"]}, {id: 2, characters: null, meanings: ["shaku"]}],
  kanji: [{id: 440, characters: "駅", components: [1, 2], meaningMnemonic: "REF MEANING", readingMnemonic: "REF READING"}],
};
const good = {meaning: "A horse waits at the platform.", reading: "You call out EH-KEE to the driver."};

test("the request is facts, parts, and the reference for structure", () => {
  const text = request("駅", {en: ["station"], on: ["エキ"], kun: []}, subjects.radicals, subjects.kanji[0]);
  assert.match(text, /^Kanji: 駅\nMeaning: station\nOn'yomi: エキ\nKun'yomi: —\nParts: horse \(馬\), shaku$/m);
  assert.match(text, /For structure only — do not reuse/);
  assert.match(text, /REF MEANING/);
});

test("--fresh withholds the reference entirely", () => {
  const text = request("駅", {en: ["station"], on: ["エキ"], kun: []}, subjects.radicals, subjects.kanji[0], {fresh: true});
  assert.ok(!/REF|structure only/.test(text));
});

test("the rules are in the system prompt, so there is nothing to scrub afterwards", () => {
  assert.match(SYSTEM, /Never mention any religion, deity, or holy figure/);
  assert.match(SYSTEM, /never swear or use a euphemism/);
});

test("writes what is missing, keeps what exists, and --redo replaces", async () => {
  const asked = [];
  const ask = async text => { asked.push(text); return good; };
  const first = await rewrite({select: ["駅", "山"], subjects, ask, now: () => "T"});
  assert.equal(first.made, 2);
  assert.deepEqual(first.stories["駅"], {...good, made: "T", fresh: false});
  assert.equal(first.stories["山"].fresh, true, "no WaniKani record for 山 in the fixture, so it was written from facts alone");
  const second = await rewrite({select: ["駅", "山"], subjects, stories: first.stories, ask});
  assert.deepEqual([second.made, second.skipped], [0, 2]);
  const third = await rewrite({select: ["駅"], subjects, stories: first.stories, ask, redo: true});
  assert.equal(third.made, 1);
  assert.equal(asked.length, 3);
});

test("a story that breaks the rules is asked for again, then given up on", async () => {
  let calls = 0;
  const ask = async text => { calls++; return calls === 1 ? {meaning: "Oh my god, a horse.", reading: "x"} : good; };
  const r = await rewrite({select: ["駅"], subjects, ask});
  assert.equal(r.made, 1); assert.equal(calls, 2);
  const stubborn = await rewrite({select: ["駅"], subjects, ask: async () => ({meaning: "Jesus.", reading: "Jesus."})});
  assert.deepEqual([stubborn.made, stubborn.failed], [0, 1]);
  assert.equal(stubborn.stories["駅"], undefined, "nothing rule-breaking is kept");
});

test("--dry prints the request and calls nothing; --limit stops", async () => {
  let called = false; const logs = [];
  await rewrite({select: ["駅"], subjects, dry: true, ask: async () => { called = true; }, log: m => logs.push(m)});
  assert.equal(called, false); assert.match(logs[0], /Kanji: 駅/);
  const r = await rewrite({select: ["駅", "山", "川"], subjects, limit: 2, ask: async () => good});
  assert.equal(r.made, 2);
});

test("a non-joyo character is skipped, and the module renders in joyo order", async () => {
  const r = await rewrite({select: ["綺", "山", "一"], subjects, ask: async () => good});
  assert.deepEqual([r.made, r.skipped], [2, 1]);
  const src = render(r.stories);
  assert.ok(src.indexOf('"一"') < src.indexOf('"山"'), "一 before 山, as the joyo table has them");
  assert.match(src, /2 of 2136/);
  assert.match(src, /^export const STORIES = \{/m);
});

test("progress is saved every N stories and at the end, so a dead run keeps its work", async () => {
  const saves = [];
  const ask = async () => good;
  const {made} = await rewrite({select: [..."亜哀挨愛曖"], stories: {}, ask, saveEvery: 2, save: async s => saves.push(Object.keys(s).length)});
  assert.equal(made, 5);
  assert.deepEqual(saves, [2, 4, 5], "after the 2nd, the 4th, and once more at the end");
});

test("a failed request costs one kanji a retry after a backoff, never the run", async () => {
  let calls = 0; const waits = [];
  const ask = async () => { calls++; if (calls <= 2) throw new Error("429 Too Many Requests"); return good; };
  const log = [];
  const {stories, made, failed} = await rewrite({select: [..."亜哀"], stories: {}, ask, backoff: async a => waits.push(a), log: m => log.push(m)});
  assert.equal(made, 1, "the second kanji was written after the first gave up");
  assert.equal(failed, 1);
  assert.deepEqual(waits, [0, 1], "backed off after each failed attempt");
  assert.match(log[0], /亜: request failed \(429 Too Many Requests\), skipped/);
  assert.ok(stories["哀"] && !stories["亜"]);
});

test("workers share the selection, run in parallel, and --limit still holds", async () => {
  let inFlight = 0, peak = 0;
  const ask = async () => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 5)); inFlight--; return good; };
  const r = await rewrite({select: [..."亜哀挨愛曖悪握圧"], stories: {}, ask, workers: 3});
  assert.equal(r.made, 8, "every kanji written once");
  assert.equal(Object.keys(r.stories).length, 8);
  assert.equal(peak, 3, "three requests in flight at once, never more");
  const l = await rewrite({select: [..."亜哀挨愛曖悪握圧"], stories: {}, ask, workers: 3, limit: 4});
  assert.equal(l.made, 4, "the limit counts what is in flight, so workers cannot overshoot it");
  const s = await rewrite({select: [..."亜哀挨愛曖悪握圧"], stories: {"亜": good, "哀": good}, ask, workers: 3});
  assert.equal(s.skipped, 2); assert.equal(s.made, 6);
});

test("faults: forbidden words, markup, jargon, and the kanji's own meaning as the exception", async () => {
  const {faults, lint} = await import("../tools/rewrite-stories.mjs");
  assert.deepEqual(faults(good), []);
  assert.deepEqual(faults({meaning: "Gee, a <radical>horse</radical> radical stands at the station, waiting for the train to come.", reading: good.reading}), ["forbidden: gee", "markup", "says radical"]);
  assert.deepEqual(faults({meaning: "A god watches over the shrine gate, and that is what this kanji means: a god, a spirit.", reading: good.reading}, {en: ["gods", "mind", "soul"]}), [], "god is 神's own meaning");
  assert.deepEqual(faults({meaning: "A god watches over the shrine gate, and that is what this kanji means: a god, a spirit.", reading: good.reading}, {en: ["station"]}), ["forbidden: god"]);
  assert.deepEqual(faults(undefined), ["missing"]);
  assert.deepEqual(lint(["駅", "山"], {"駅": good}), {"山": ["missing"]});
});

test("a story that leaks markup or says gee is asked for again, and the retry names the rules", async () => {
  const asked = [];
  const ask = async text => { asked.push(text); return asked.length === 1 ? {meaning: "Gee, a <radical>horse</radical> stands on the platform of the station, waiting.", reading: good.reading} : good; };
  const r = await rewrite({select: ["駅"], subjects, stories: {}, ask});
  assert.equal(r.made, 1);
  assert.match(asked[1], /no gee, no tags, and call the pieces parts/);
});

test("神 may say god: the run accepts the story its own meaning needs", async () => {
  const ask = async () => ({meaning: "The kanji for god shows an altar on the left and a sign from above on the right: a god, a spirit that is shown to people.", reading: "Shin. The altar and the sign are seen and then shown, and shown sounds like しん."});
  const r = await rewrite({select: ["神"], stories: {}, ask});
  assert.equal(r.made, 1, "not rejected for a word that is the meaning itself");
});
