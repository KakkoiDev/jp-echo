import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {examplesFromDecks} from "../day-radio.js";
import {partRows, cutUnderline, provedBy, PROVED_MS, PAUSE, KIND_LABEL, choicesFor, gamePool, grammarBlockCard, grammarCoverage, grammarPick, nextRound,
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
  incomplete.patterns["よりほかない"].transparency = "pending"; delete incomplete.patterns["よりほかない"].solved;
  const release = validateGrammarBlocks(incomplete);
  assert.ok(release.errors.includes("まい: missing pattern"));
  assert.ok(release.errors.includes("よりほかない: invalid transparency"), "a pattern still waiting for its solve");
  assert.ok(!release.errors.includes("ざるを得ない: invalid transparency"), "solved on 27 Nov");
  assert.ok(!release.errors.some(e => /single-use/.test(e)), "no cap on single-use blocks (owner, 27 Nov)");
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
    "unknown block: not-a-block", "form を is not listed",
    "shared block cannot be marked single", "shared surface form needs a distinct literal",
    "a one-block pattern is learned whole (opaque)", "missing successful blocks+sentence solve", "missing literal",
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

test("index adds three kinds while preserving the existing cards", () => {
  const baseline = gamePool(options);
  assert.deepEqual(gamePool({...options, grammarBlocks: null}), baseline);
  assert.deepEqual(pool.filter(q => !grammarBlockCard(q)).map(({blocks, basics, ...q}) => q), baseline);
  assert.ok(block && build && infer);
  // Infer cards exist only for patterns with a recorded solve (clear or partial).
  for (const q of cards.filter(q => q.kind === "infer" && q !== infer)) assert.ok(["clear", "partial"].includes(draft.patterns[q.patternKey].transparency) && draft.patterns[q.patternKey].solved.right, q.id);
  assert.deepEqual(build.blocks, ["zaru", "wo", "enai"]);
  assert.equal(build.parts.map(p => p.text).join(""), "ざるを得ない");
  assert.deepEqual(infer.parts, build.parts, "the infer card carries the parts for the review of a miss; the play card never shows them");
  const conjugated = cards.find(q => q.id === "gb:甲斐がある");
  assert.equal(conjugated.needle, "甲斐があって");
  assert.equal(conjugated.parts.at(-1).text, "あって");
  for (const q of cards) {
    assert.ok(!q.practice, "every card of a round is scored (SCORE_ALL)");
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
  assert.equal(missing.total, 100, "scored like any card");
  assert.equal(missing.answered, 1);
  assert.equal(missing.practiced, undefined);
  const exposed = right({}, original);
  assert.deepEqual(exposed.gb.zaru, [1, 0, 0, 0, now, 0]);
  const met = {...exposed, seen: {}};
  for (const q of [original, build, infer]) {
    assert.equal(right({...met, seen: {[q.id]: now - 1}}, infer).gb.zaru[3], 0);
  }
  const proved = right(met, infer);
  for (const id of infer.blocks) assert.deepEqual(proved.gb[id], [2, 1, 0, 1, now, 0]);
  assert.equal(grammarCoverage([infer], proved).known, 2, "ざる and 得ない; を is a basic particle, taken as known and not counted");
  assert.deepEqual(infer.basics, ["wo"]);
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
  assert.ok(draftRun.kinds.build > 10, "build cards appear: " + JSON.stringify(draftRun.kinds));
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

test("audit: the solves on record; the index passes release validation", () => {
  const t = {}; for (const p of Object.values(draft.patterns)) t[p.transparency] = (t[p.transparency] || 0) + 1;
  assert.deepEqual(t, {clear: 137, partial: 21, opaque: 63}, "after the reviews of 27 Nov: 17 lowered to partial, two more learned whole, つつ(も) given its も, かねない learned whole");
  for (const [key, p] of Object.entries(draft.patterns)) if (p.transparency === "clear") assert.deepEqual(p.solved, {by: "blocks-only", right: true}, key);
  assert.equal(Object.values(draft.patterns).filter(p => p.solved?.by === "review").length, 18, "set by a reviewer, not by a solve: 17 lowered on 27 Nov, and つつ(も)");
  const release = validateGrammarBlocks(draft);
  assert.deepEqual(release.errors, []);
  assert.ok(release.counts.singleShare > 40, "reported, not capped: " + release.counts.singleShare);
  // 応じる and 応える are two verbs; 〜上 (じょう) is not うえ.
  assert.equal(draft.patterns["に応じて"].parts[1].block, "ojiru"); assert.equal(draft.patterns["に応えて"].parts[1].block, "kotaeru");
  assert.equal(draft.patterns["上"].parts[0].block, "jou");
});

test("a pattern that is one block is learned by its block card: opaque, plain gloss, no build or infer card", () => {
  const one = Object.entries(draft.patterns).filter(([, p]) => p.parts.length === 1);
  assert.equal(one.length, 63);
  for (const [key, p] of one) assert.equal(p.transparency, "opaque", key);
  const full = gamePool({...options, grammarBlocks: draft});
  for (const [key] of one) assert.ok(!full.some(q => q.id === "gb:" + key || q.id === "gi:" + key), key);
  assert.equal(draft.blocks.semete.gloss, "At least"); assert.equal(draft.blocks.douse.gloss, "anyway, after all");
  assert.ok(full.some(q => q.id === "b:semete" && q.answer === "At least"));
  const wrong = structuredClone(draft); wrong.patterns["まい"].transparency = "clear"; wrong.patterns["まい"].solved = {by: "blocks-only", right: true};
  assert.ok(validateGrammarBlocks(wrong).errors.includes("まい: a one-block pattern is learned whole (opaque)"));
});

test("N5 and N4 particles and endings are taken as known: no card of their own, met in every pattern, out of the count", () => {
  const full = gamePool({...options, grammarBlocks: draft}), cards = full.filter(grammarBlockCard);
  for (const id of ["ni", "wa", "wo", "te", "da"]) assert.ok(!cards.some(q => q.id === "b:" + id), id + " has no block card");
  assert.ok(cards.some(q => q.id === "b:zaru") && cards.some(q => q.id === "b:wake"));
  const coverage = grammarCoverage(full, {});
  assert.ok(coverage.items > 140 && coverage.items < 170, "blocks to learn: " + coverage.items);
  // A new player's first grammar cards are N2 material, not に and は.
  const pool = full.filter(q => !grammarBlockCard(q));
  let n = 3; const random = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  const first = [];
  for (let i = 0; i < 40; i++) first.push(...nextRound({pool, grammarCards: cards, state: {}, random, now}).round.filter(grammarBlockCard));
  assert.ok(first.length > 20 && first.every(q => !["ni", "wa", "wo", "ga", "no", "mo"].includes(q.blocks[0]) || q.kind !== "block"));
  // Transfer on にしろ-にしろ needs しろ met, not に.
  const infer = cards.find(q => q.kind === "infer" && q.basics?.length && q.blocks.length - q.basics.length === 1);
  const only = infer.blocks.find(id => !infer.basics.includes(id));
  assert.equal(rememberAnswer({gb: {[only]: [1, 0, 0, 0, 1, 0]}}, {q: infer, outcome: "right", now}).gb[only][3], 1, infer.id);
  assert.equal(rememberAnswer({gb: {}}, {q: infer, outcome: "right", now}).gb[only][3], 0, "the content block itself must be met");
});

test("the released index is the validated draft, part of the app, and its cards are scored by the owner's rule, not by review", async () => {
  const released = read("../n2-grammar-blocks.json");
  assert.deepEqual(released, draft, "copy tools/grammar-blocks/draft.json after it passes release validation");
  assert.deepEqual(validateGrammarBlocks(released).errors, []);
  assert.ok(readFileSync(new URL("../sw.js", import.meta.url), "utf8").includes('"./n2-grammar-blocks.json"'), "precached");
  const {REVIEWED_GRAMMAR_BLOCKS} = await import("../n2-game-review.js");
  const {SCORE_ALL} = await import("../n2-game-review.js");
  assert.equal(REVIEWED_GRAMMAR_BLOCKS, false, "the cards themselves are still unreviewed");
  assert.equal(SCORE_ALL, true, "owner, 27 Nov: every card in a round pays and costs");
  assert.ok(gamePool({...options, grammarBlocks: released}).filter(grammarBlockCard).every(q => !q.practice));
});

test("the review data handed to a reviewer is the released index, whole", () => {
  const review = read("../tools/grammar-blocks/review-data.json"), released = read("../n2-grammar-blocks.json");
  assert.deepEqual(review.counts, {blocks: 191, basicBlocks: 26, patterns: 221, oneBlockPatterns: 63});
  for (const b of review.blocks) assert.equal(b.gloss, released.blocks[b.id].gloss, b.id + ": run tools/grammar-blocks/make-review.mjs");
  for (const p of review.patterns) assert.deepEqual(p.parts.map(x => x.text), released.patterns[p.key].parts.map(x => x.text), p.key);
  assert.ok(review.patterns.every(p => p.meaning && p.sentence?.ja));
});

// ---- Board 13: grammar from its parts on the screen ----
const page = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("board 13: the parts are a ruled list in sentence order; repeats merge, a piece with no gloss gets no row", () => {
  const cards = gamePool({...options, grammarBlocks: draft}), card = key => cards.find(q => q.id === "gb:" + key);
  assert.deepEqual(partRows(card("にしても-にしても").parts).map(r => [r.text, r.times]), [["に", 2], ["して", 2], ["も", 2]], "six parts, three rows");
  assert.deepEqual(partRows(card("に気をつける").parts).map(r => r.text), ["に", "気", "を", "つけて"]);
  assert.ok(partRows(card("ところだった2").parts).every(r => r.gloss), "the っ of ところだった has no row");
  const rows = cards.filter(q => q.kind === "build").map(q => partRows(q.parts).length);
  assert.ok(Math.max(...rows) <= 5, "the worst real card is five rows: " + Math.max(...rows));
  assert.deepEqual(KIND_LABEL.block + " / " + KIND_LABEL.build + " / " + KIND_LABEL.infer, "Grammar piece / Grammar parts / New grammar");
  const css = page("../styles.css");
  assert.match(css, /\.qr-grammar-parts:not\(\[hidden\]\)\{display:grid;grid-template-columns:max-content minmax\(0,1fr\);column-gap:14px;margin-top:14px;border-top:1px solid var\(--hairline\)/);
  assert.match(css, /\.qr-grammar-parts b\{gap:6px;font-family:var\(--display\);font-size:17px;font-weight:700/);
  assert.ok(!/qr-grammar-parts \.qr-chip/.test(css), "no chips left in the row");
});

test("board 13: 得ない is hinted with its negative on the card (designer's note)", () => {
  const card = gamePool({...options, grammarBlocks: draft}).find(q => q.id === "gb:ざるを得ない");
  assert.deepEqual(card.parts.map(p => p.gloss), ["not doing (literary negative)", "marks the alternative ruled out", "cannot obtain or manage"]);
  assert.equal(card.literal, "cannot choose not to do it: must do it"); // the pieces audit's wording, 27 Nov
  assert.equal(draft.blocks.eru.gloss, "can happen or be done"); assert.equal(draft.blocks.enai.gloss, "cannot happen or be done", "得る and 得ない are two things to learn (review, 27 Nov)");
  const bad = structuredClone(draft); bad.patterns["ざるを得ない"].parts[2].gloss = "得られない";
  assert.ok(validateGrammarBlocks(bad).errors.some(e => /gloss of part 得ない must be short English/.test(e)));
});

test("board 13: the underline is cut into one segment per part, or left whole when the parts do not fit it", () => {
  const cards = gamePool({...options, grammarBlocks: draft}).filter(q => q.kind === "build");
  const cut = cutUnderline("行くにしても行かないにしても、早めに連絡してください。", ["にしても", "にしても"], [{text: "に"}, {text: "して"}, {text: "も"}, {text: "に"}, {text: "して"}, {text: "も"}]);
  assert.deepEqual(cut.filter(s => s.part).map(s => s.text + (s.cut ? "+" : "")), ["に", "して+", "も+", "に", "して+", "も+"], "3 px only between neighbours, not across the gap");
  assert.equal(cut.map(s => s.text).join(""), "行くにしても行かないにしても、早めに連絡してください。");
  assert.equal(cutUnderline("車に気をつけて歩く", "に気をつけて", [{text: "に"}, {text: "気"}, {text: "を"}, {text: "つける"}]), null);
  let whole = 0;
  for (const q of cards) { const c = cutUnderline(q.sentence, q.needle, q.parts); if (!c) { whole++; continue; } assert.equal(c.map(s => s.text).join(""), q.sentence, q.id); assert.equal(c.filter(s => s.part).length, q.parts.length, q.id); }
  assert.ok(whole < cards.length * .1, whole + " of " + cards.length + " build cards keep one underline");
});

test("board 13: the literal line, the review card, the proved beat and Home's Known strip", () => {
  const js = page("../n2-mock.js"), html = page("../n2-mock.html"), css = page("../styles.css");
  assert.match(js, /if \(q\.kind === "build" && q\.literal\) \{ line\.replaceChildren\(el\("small", \{text: "piece by piece"\}\), q\.literal\); line\.className = "qr-line literal"; line\.dataset\.tone = outcome === "right" \? "right" : ""; \}/);
  assert.match(html, /<div class="qr-ex qr-reviewparts" id="game-review-parts" hidden>[\s\S]*?<\/div>\s*<div class="qr-ex" id="game-review-sentence" hidden>/, "the parts sit between the pick and the sentence");
  assert.match(js, /const rows = \(q\.kind === "build" \|\| q\.kind === "infer"\) && q\.parts \? partList\(q\.parts\) : \[\];/);
  // Proved: only an infer card whose answer raised a block's transfer count.
  const q = {kind: "infer", blocks: ["a", "b"]};
  assert.deepEqual(provedBy({gb: {a: [1, 0, 0, 0]}}, {gb: {a: [2, 1, 0, 1], b: [1, 0, 0, 0]}}, q), ["a"]);
  assert.deepEqual(provedBy({gb: {a: [1, 0, 0, 1]}}, {gb: {a: [2, 1, 0, 1]}}, q), []);
  assert.ok(PROVED_MS === 600 && PROVED_MS > PAUSE.right, "the one answer that holds longer");
  assert.match(js, /const proved = q\.kind === "infer" && provedBy\(beforeAnswer, state, q\)\.length > 0;/);
  assert.match(js, /timer = setTimeout\(\(\) => \{ index\+\+; ask\(\); \}, proved \? PROVED_MS : /);
  assert.match(html, /<span class="qr-stamp" lang="ja" aria-hidden="true">証<\/span><div><strong>Proved in a new pattern<\/strong>/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.qr-stamp\{animation:none\}\}/, "reduced motion: the stamp appears still");
  // Home: under the run card, never inside it, and never "0 of 162".
  assert.ok(!html.includes("game-grammar-count"));
  assert.match(html, /<div class="qr-known" id="game-known" hidden><span class="qr-lbl">Known<\/span><span class="qr-knownname">Grammar pieces<\/span>/);
  assert.match(js, /\$\("game-known"\)\.hidden = !grammar\.known;/);
  // Short screens: the say line goes first on a build card.
  assert.match(css, /body\[data-view=game\] \.qr-card\[data-kind=build\] \.qr-say\{display:none\}/);
});

// ---- The content review of 27 Nov 2026 ----
test("review: a hint says what the form shown does, negation included; the rule against sharing the answer's words is gone", () => {
  const card = key => gamePool({...options, grammarBlocks: draft}).find(q => q.id === "gb:" + key);
  const hint = (key, text) => card(key).parts.find(p => p.text === text).gloss;
  assert.equal(hint("てはいられない", "いられない"), "cannot stay as one is");
  assert.equal(hint("ねばならない", "ならない"), "it will not do");
  assert.equal(hint("にほかならない", "ならない"), "is not (negative of the copula)");
  assert.equal(hint("にもかかわらず", "かかわらず"), "without regard to");
  assert.equal(hint("いつの間にか", "か"), "marks uncertainty");
  assert.equal(hint("抜きで", "抜き"), "leaving something out", "a plain hint may share the answer's words: the infer card is the test");
  assert.deepEqual(validateGrammarBlocks(draft).errors, []);
  assert.ok(!readFileSync(new URL("../tools/validate-grammar-blocks.mjs", import.meta.url), "utf8").includes("overlaps the answer\`"));
});

test("review: corrected meanings, pairs kept apart on scored cards too, and nothing silently dropped", async () => {
  const {GLOSS_FIX, GRAMMAR_CONFUSABLE} = await import("../n2-game-review.js");
  assert.equal(GLOSS_FIX["g:中を"], "through the midst of, passing through");
  assert.equal(GLOSS_FIX["g:かねない"], "there is a risk that something bad may happen");
  const pool = gamePool(options), answer = new Map(pool.filter(q => q.kind === "grammar").map(q => [q.id.slice(2), q.answer]));
  assert.equal(answer.get("を除いて"), "except for, excluding");
  const pair = (a, b) => GRAMMAR_CONFUSABLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  assert.ok(pair("ざるを得ない", "よりほかない") && pair("てならない", "てたまらない") && pair("にすぎない", "でしかない"));
  assert.ok(!pair("なにやら", "何といっても") && !pair("にしたら", "にすぎない"), "pairs the reviewer found easy to tell apart are released");
  for (const [a, b] of GRAMMAR_CONFUSABLE) for (const [x, y] of [[a, b], [b, a]]) {
    const card = pool.find(q => q.id === "g:" + x);
    if (card && answer.has(y)) assert.ok(!card.wrong.includes(answer.get(y)), "g:" + x + " offers " + y);
  }
  const review = read("../tools/grammar-blocks/reviews/2026-11-27.json"), ledger = read("../tools/grammar-blocks/reviews/2026-11-27-applied.json");
  assert.equal(review.length, 188); assert.equal(ledger.length, 188, "every finding has a disposition");
  for (const row of ledger) assert.ok(["applied", "partly", "not applied"].includes(row.status) && row.note, row.id);
});
