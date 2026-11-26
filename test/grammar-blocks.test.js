import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {examplesFromDecks} from "../day-radio.js";
import {choicesFor, gamePool, grammarBlockCard, grammarCoverage, grammarPick, nextRound,
  recallsMiss, rememberAnswer, sameSense} from "../n2-game.js";
import {exampleSegments} from "../n2-delayed.js";
import {EXCLUDED} from "../n2-game-review.js";
import {mergeGame} from "../sync.js";
import {inventory, validateGrammarBlocks} from "../tools/validate-grammar-blocks.mjs";

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const draft = read("../tools/grammar-blocks/draft.json");
const options = {inventory, examples: examplesFromDecks(inventory, [read("../decks/n2-grammar.json")])};
const now = Date.parse("2026-11-27T12:00:00Z");

test("draft structure is valid; the release validator rejects an unfinished inventory", () => {
  const {errors, counts} = validateGrammarBlocks(draft, {draft: true});
  assert.deepEqual(errors, []);
  assert.ok(counts.sharedPatterns > 0);
  assert.equal(counts.patterns, inventory.grammar.length);
  const incomplete = structuredClone(draft);
  delete incomplete.patterns["まい"];
  const release = validateGrammarBlocks(incomplete);
  assert.ok(release.errors.includes("まい: missing pattern"));
  assert.ok(release.errors.includes("ざるを得ない: invalid transparency"));
  assert.ok(release.errors.some(e => /maximum 40%/.test(e)));
});

test("validator rejects malformed parts, readings, senses, metadata, and solve evidence", () => {
  const patch = structuredClone(draft);
  patch.blocks["UpperCase"] = patch.blocks.wo;
  patch.blocks.wo.forms = ["に"];
  patch.blocks.wo.gloss = "Cannot help";
  patch.blocks.wo.level = "N1";
  patch.blocks.wo.ja = "本を読【よ】みます。";
  patch.blocks.zaru.single = true;
  patch.patterns["得ない"].parts.push({text: "余分"});
  patch.patterns["に沿って"].parts[1].block = "not-a-block";
  patch.patterns["一応2"].literal = patch.patterns["一応1"].literal;
  patch.patterns["どうせ"].transparency = "clear";
  patch.patterns["ざるを得ない"].transparency = "partial";
  patch.patterns["ざるを得ない"].solved = {by: "blocks-only", right: true};
  delete patch.patterns["ざるを得ない"].literal;
  const {errors} = validateGrammarBlocks(patch, {draft: true});
  for (const message of [
    "invalid block id", "forms must be distinct and include form", "level does not match inventory",
    "example must be one annotated sentence", "parts do not reconstruct", "non-kana or long glue",
    "unknown block: not-a-block", "form を is not listed", "overlaps the answer",
    "shared block cannot be marked single", "shared surface form needs a distinct literal",
    "a whole word is opaque", "missing successful blocks+sentence solve", "missing literal",
  ]) assert.ok(errors.some(e => e.includes(message)), message);
});

const reviewedFixture = structuredClone(draft);
reviewedFixture.patterns["ざるを得ない"].transparency = "clear";
reviewedFixture.patterns["ざるを得ない"].solved = {by: "blocks-only", right: true};
const pool = gamePool({...options, grammarBlocks: reviewedFixture});
const cards = pool.filter(grammarBlockCard);
const infer = cards.find(c => c.id === "gi:ざるを得ない");
const block = cards.find(c => c.kind === "block");
const build = cards.find(c => c.id === "gb:ざるを得ない");

test("index adds three practice kinds while preserving the existing cards", () => {
  const baseline = gamePool(options);
  assert.deepEqual(gamePool({...options, grammarBlocks: null}), baseline);
  assert.deepEqual(pool.filter(q => !grammarBlockCard(q)).map(({blocks, ...q}) => q), baseline);
  assert.ok(block && build && infer);
  assert.ok(!cards.some(q => q.kind === "infer" && q !== infer));
  assert.deepEqual(build.blocks, ["zaru", "wo", "dekiru-e"]);
  assert.equal(build.parts.map(p => p.text).join(""), "ざるを得ない");
  assert.equal(infer.parts, undefined);
  const conjugated = cards.find(q => q.id === "gb:甲斐がある");
  assert.equal(conjugated.needle, "甲斐があって");
  assert.equal(conjugated.parts.at(-1).text, "あって");
  for (const q of cards) {
    assert.ok(q.practice && q.record);
    assert.ok(!EXCLUDED[q.id] && !EXCLUDED["g:" + q.patternKey]);
    assert.ok(exampleSegments(q.sentence, [q.needle]).some(s => s.mark), q.id);
    assert.ok(!recallsMiss(q, "wrong"), q.id);
    const {choices, key} = choicesFor(q);
    assert.equal(new Set(choices).size, 4, q.id);
    assert.equal(choices[key], q.answer, q.id);
    assert.ok(q.wrong.every(choice => !sameSense(choice, q.answer)), q.id);
  }
});

const right = (state, q) => rememberAnswer(state, {q, outcome: "right", points: 100, now});

test("pattern exposures update met; transfer requires a new pattern and every block already met", () => {
  const original = pool.find(q => q.id === "g:ざるを得ない");
  const missing = right({}, infer);
  assert.deepEqual(missing.gb.zaru, [1, 1, 0, 0, now, 0]);
  assert.equal(missing.total, 0);
  assert.equal(missing.answered, 1);
  assert.equal(missing.practiced, 1);
  const exposed = right({}, original);
  assert.deepEqual(exposed.gb.zaru, [1, 0, 0, 0, now, 0]);
  const met = {...exposed, seen: {}};
  for (const q of [original, build, infer]) {
    assert.equal(right({...met, seen: {[q.id]: now - 1}}, infer).gb.zaru[3], 0);
  }
  const proved = right(met, infer);
  for (const id of infer.blocks) assert.deepEqual(proved.gb[id], [2, 1, 0, 1, now, 0]);
  assert.equal(grammarCoverage([infer], proved).known, 3);
  assert.equal(right(proved, infer).gb.zaru[3], 1);
});

test("a miss weakens the block; three block answers make it known; merge keeps counts and latest weakness", () => {
  const id = block.blocks[0], wrong = rememberAnswer({}, {q: block, outcome: "wrong", now});
  assert.deepEqual(wrong.gb[id], [1, 0, 1, 0, now, 1]);
  const learned = right(right(right({}, block), block), block);
  assert.equal(grammarCoverage([block], learned).known, 1);
  const merged = mergeGame(wrong, {gb: {...learned.gb, another: [1, 0, 0, 0, now, 0],
    [id]: [3, 3, 0, 0, now + 1, 0]}});
  assert.deepEqual(merged.gb[id], [3, 3, 1, 0, now + 1, 0]);
  assert.ok(merged.gb.another);
});

test("only ordinary grammar slots are reassigned and proof never picks seen patterns", () => {
  const original = pool.filter(q => !grammarBlockCard(q));
  const seed = () => .19;
  const state = {gb: Object.fromEntries(infer.blocks.map(id => [id, [1]]))};
  const opts = {pool: original, state, random: seed, now};
  const before = nextRound(opts).round;
  const after = nextRound({...opts, grammarCards: cards}).round;
  assert.equal(after.length, before.length);
  assert.ok(after.some(grammarBlockCard));
  before.forEach((q, i) => {
    if (q.kind !== "grammar") assert.equal(after[i].id, q.id);
  });
  assert.ok(after.filter(grammarBlockCard).every(q => !q.bonus));
  const recovery = {...opts, state: {...state, history: [{n: 10, right: 3}]}};
  assert.deepEqual(nextRound({...recovery, grammarCards: cards}), nextRound(recovery));
  const slot = original.find(q => q.kind === "grammar");
  assert.equal(grammarPick({pool: [infer], slots: [slot], skip: [], now, state})[0].id, infer.id);
  assert.equal(grammarPick({pool: [infer], slots: [slot], skip: [], now,
    state: {...state, seen: {"gb:ざるを得ない": 1}}})[0].id, slot.id);
});
