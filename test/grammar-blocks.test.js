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
  assert.ok(release.errors.includes("得ない: invalid transparency"), "a pattern still waiting for its solve");
  assert.ok(!release.errors.includes("ざるを得ない: invalid transparency"), "solved on 27 Nov");
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
  // Infer cards exist only for patterns with a recorded solve (clear or partial).
  for (const q of cards.filter(q => q.kind === "infer" && q !== infer)) assert.ok(["clear", "partial"].includes(draft.patterns[q.patternKey].transparency) && draft.patterns[q.patternKey].solved.right, q.id);
  assert.deepEqual(build.blocks, ["zaru", "wo", "eru"]);
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

// ---- Audit, 27 Nov 2026 ----
const solved = () => { const index = structuredClone(draft); for (const p of Object.values(index.patterns)) if (p.transparency === "pending") { p.transparency = "clear"; p.solved = {by: "blocks-only", right: true}; } return index; };
const play = (index, rounds) => {
  const full = gamePool({...options, grammarBlocks: index}), pool = full.filter(q => !grammarBlockCard(q)), cards = full.filter(grammarBlockCard);
  let n = 7, state = {}; const random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; }, kinds = {};
  for (let r = 0; r < rounds; r++) {
    const at = now + r * 5 * 3600_000;
    for (const q of nextRound({pool, grammarCards: cards, state, random, now: at}).round) { if (grammarBlockCard(q)) kinds[q.kind] = (kinds[q.kind] || 0) + 1; state = rememberAnswer(state, {q, outcome: random() < .8 ? "right" : "wrong", fast: true, now: at}); }
  }
  return {kinds, state, full};
};

test("audit: a build card is shown after its block is met (it was never picked), and proofs are not used up", () => {
  const draftRun = play(draft, 150);
  assert.ok(draftRun.kinds.build > 20, "build cards appear: " + JSON.stringify(draftRun.kinds));
  const run = play(solved(), 300);
  assert.ok(run.kinds.block > 0 && run.kinds.build > 0 && run.kinds.infer > 0, JSON.stringify(run.kinds));
  const transfers = Object.values(run.state.gb).reduce((sum, r) => sum + r[3], 0);
  assert.ok(transfers > 40, "building must leave patterns to prove on: " + transfers + " transfers");
  assert.ok(grammarCoverage(run.full, run.state).known > 30);
});

test("audit: patterns a blind solver could not tell apart are never each other's wrong choice", async () => {
  const {GRAMMAR_CONFUSABLE} = await import("../n2-game-review.js");
  assert.ok(GRAMMAR_CONFUSABLE.length >= 30);
  const keys = new Set(inventory.grammar.map(([key]) => key));
  for (const [a, b] of GRAMMAR_CONFUSABLE) assert.ok(keys.has(a) && keys.has(b) && a !== b, a + " / " + b);
  const full = gamePool({...options, grammarBlocks: solved()}), answer = new Map(full.filter(q => q.kind === "grammar").map(q => [q.id.slice(2), q.answer]));
  for (const [a, b] of GRAMMAR_CONFUSABLE) for (const [x, y] of [[a, b], [b, a]]) for (const kind of ["gb:", "gi:"]) {
    const card = full.find(q => q.id === kind + x);
    if (card && answer.has(y)) assert.ok(!card.wrong.includes(answer.get(y)), card.id + " offers " + y);
  }
  // The scored g: cards are untouched by the list.
  assert.deepEqual(gamePool(options).filter(q => q.kind === "grammar").map(q => q.wrong), full.filter(q => q.kind === "grammar").map(q => q.wrong));
});

test("audit: the solves on record, and what still blocks a release", () => {
  const t = {}; for (const p of Object.values(draft.patterns)) t[p.transparency] = (t[p.transparency] || 0) + 1;
  assert.deepEqual(t, {clear: 149, partial: 3, opaque: 30, pending: 39});
  for (const [key, p] of Object.entries(draft.patterns)) if (p.transparency === "clear") assert.deepEqual(p.solved, {by: "blocks-only", right: true}, key);
  const release = validateGrammarBlocks(draft);
  assert.equal(release.errors.filter(e => /invalid transparency/.test(e)).length, 39);
  assert.ok(release.errors.some(e => /single-use \(maximum 40%\)/.test(e)), "the cap is the owner's to decide");
  // 応じる and 応える are two verbs; 〜上 (じょう) is not うえ.
  assert.equal(draft.patterns["に応じて"].parts[1].block, "ojiru"); assert.equal(draft.patterns["に応えて"].parts[1].block, "kotaeru");
  assert.equal(draft.patterns["上"].parts[0].block, "jou");
});
