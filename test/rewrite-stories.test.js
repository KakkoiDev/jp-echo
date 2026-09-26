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
