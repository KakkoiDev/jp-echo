import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {gamePool, choicesFor, nextRound, rememberAnswer, answerSpeech, SECONDS, KIND_LABEL, KIND_SKILL, ORDER_STAR} from "../n2-game.js";
import {CONNECTIVES, OVERLAP, jobOf} from "../n2-connectives.js";
import {SET_EDITIONS, SETS_EDITION, editionOf, realisticPaperId} from "../n2-forms.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
const has = p => existsSync(new URL(p, import.meta.url));
const inventory = read("../n2-inventory.json");
const plain = s => String(s || "").replace(/【[^】]*】/g, "");
const seeded = (n = 1) => () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
const items = f => has(f) ? read(f).items : [];
const extras = {paraphrase: items("../n2-paraphrase.json"), pairs: items("../n2-pairs.json"), ordering: items("../n2-ordering.json"), pieces: has("../n2-word-pieces.json") ? read("../n2-word-pieces.json").pieces : {}};
const pool = gamePool({inventory, extras});

test("sentence order (問題8): four tiles, the one on ★; only items a second reader rebuilt the same way", () => {
  const cards = pool.filter(q => q.kind === "order");
  assert.ok(cards.length >= 100, "the file holds what passed the blind rebuild");
  assert.equal(ORDER_STAR, 2); assert.equal(SECONDS.order, 8); assert.equal(KIND_LABEL.order, "Sentence order · ★"); assert.equal(KIND_SKILL.order, "grammar");
  for (const q of cards) {
    assert.equal(q.tiles.length, 4); assert.equal(q.answer, q.tiles[2]); assert.deepEqual([...q.wrong].sort(), q.tiles.filter((_, i) => i !== 2).sort());
    assert.equal(q.lead + q.tiles.join("") + q.tail, q.sentence, q.id); assert.equal(q.sentence, plain(q.solution.ja));
    assert.equal(new Set(choicesFor(q, seeded(2), .5).choices).size, 4); assert.ok(!q.practice && q.target === null);
    assert.ok(q.solution.meaning && !/[ぁ-んァ-ヶ一-龯]/.test(q.solution.meaning), q.id + ": its English");
    assert.equal(q.say, q.solution.ja, "the whole sentence is spoken in the review, with its readings");
  }
  assert.ok(!cards.some(q => q.id === "or:or-025"), "an item with a second possible order is not asked");
  const js = src("../n2-mock.js");
  assert.ok(js.includes('if (q.kind === "order") $("game-sentence").replaceChildren(q.lead, ...[0, 1, 2, 3].flatMap(i =>'));
  assert.ok(js.includes('if (q.kind === "order") $("game-sentence").replaceChildren(q.lead, ...q.tiles.map((t, i) => i === 2 ? el("u", {class: "n2-mark", text: t}) : t), q.tail);'));
});

test("clause pairs: a gap between two short clauses, wrong choices from jobs that cannot stand in", () => {
  const cards = pool.filter(q => q.kind === "pair");
  assert.ok(cards.length >= 150, "what passed the blind test");
  assert.equal(SECONDS.pair, 6); assert.equal(KIND_SKILL.pair, "reading");
  for (const q of cards) {
    const job = jobOf(q.answer), blocked = new Set(OVERLAP[job] || [job]);
    assert.equal(q.sentence.split("（　）、").length, 2, q.id); assert.ok(!q.sentence.includes(q.answer), q.id);
    for (const w of q.wrong) assert.ok(!blocked.has(jobOf(w)), q.id + ": " + w + " could do the same job");
    assert.ok(q.wrong.length >= 3 && !q.en, "no English on the card: it would name the relation");
    assert.equal(answerSpeech(q), q.answer); assert.ok(q.solution.en && q.solution.why);
  }
});

test("paraphrase: one sentence, the choice that says the same", () => {
  const cards = pool.filter(q => q.kind === "para");
  assert.ok(cards.length >= 230, "what passed the blind test");
  assert.ok(src("../sw.js").includes('"./n2-paraphrase.json"'));
  assert.equal(SECONDS.para, 8); assert.equal(KIND_LABEL.para, "Same meaning"); assert.equal(KIND_SKILL.para, "reading");
  for (const q of cards) {
    assert.equal(q.wrong.length, 3); assert.ok(!q.wrong.includes(q.answer)); assert.equal(q.sentence, plain(q.solution.ja));
    assert.equal(new Set(choicesFor(q, seeded(2), .5).choices).size, 4); assert.ok(q.solution.meaning && q.solution.why);
  }
});

test("authored cards are answers like any other: scored, counted, and a miss comes back", () => {
  const q = pool.find(c => c.kind === "order");
  const st = rememberAnswer({}, {q, outcome: "wrong", points: -200});
  assert.equal(st.total, -200); assert.equal(st.answered, 1); assert.deepEqual(st.comeback, [q.id]);
  assert.ok(nextRound({pool, state: st, random: seeded(1)}).round[0].id === q.id);
  // Without the files the pool is what it was.
  assert.equal(gamePool({inventory}).filter(c => ["para", "pair", "order"].includes(c.kind)).length, 0);
  assert.ok(src("../n2-mock.js").includes('["./n2-paraphrase.json", "./n2-pairs.json", "./n2-ordering.json", "./n2-sets/en.json", "./n2-word-pieces.json"]'));
  for (const f of ["./n2-ordering.json", "./n2-pairs.json", "./n2-sets/en.json", "./n2-word-pieces.json"]) assert.ok(src("../sw.js").includes('"' + f + '"'), f + " is precached");
});

test("the audited word pieces reach the cards of their word", () => {
  const n = Object.keys(extras.pieces).length;
  assert.ok(n >= 600, "614 dissections passed the blind solve");
  for (const [word, p] of Object.entries(extras.pieces)) { assert.equal(p.parts.map(x => x[0]).join(""), word, word); assert.ok(p.parts.length >= 2 && p.literal); }
  const hiki = pool.filter(q => q.pieces && q.solution.word === "引き出す");
  assert.ok(hiki.length >= 2 && hiki.every(q => q.pieces.parts.length === 2), "on every card of the word");
  assert.ok(pool.filter(q => q.pieces).length > 1500);
  assert.ok(!gamePool({inventory}).some(q => q.solution?.word === "引き出す" && q.pieces), "only when the file is given");
});

test("the papers' sentences have their English, shown in the review of a paper's question", () => {
  const {en} = read("../n2-sets/en.json"), want = read("../tools/content/exam-sentences.json");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(want).sort()); assert.equal(Object.keys(en).length, 798);
  for (const [k, v] of Object.entries(en)) assert.ok(v.length >= 6 && v.length <= 140 && !/[ぁ-んァ-ヶ一-龯]/.test(v), k);
  assert.match(en["n2-set-2#31"], /Now that/);
  assert.ok(src("../n2-mock.js").includes('examEn?.en?.[source] || ""].filter(Boolean).join(" · ")'));
});

test("a paper revised on its own has its own edition; the others keep theirs and their sittings", () => {
  assert.equal(editionOf("n2-set-2"), SETS_EDITION); assert.equal(realisticPaperId("n2-set-2"), "n2-set-2@" + SETS_EDITION, "Mock 02 sittings stay attached to their lines");
  assert.deepEqual(Object.keys(SET_EDITIONS).sort(), ["n2-set-10", "n2-set-14", "n2-set-20", "n2-set-4", "n2-set-5", "n2-set-8", "n2-set-9"]);
  assert.equal(realisticPaperId("n2-set-8"), "n2-set-8@2026.11-r4");
  const q = (n, i) => read("../n2-sets/n2-set-" + n + ".json").questions[i];
  // A second natural answer is gone from each of the eight.
  assert.ok(!q(4, 33).choices.includes("ものの")); assert.ok(!q(10, 19).choices.includes("交換")); assert.ok(!q(14, 39).choices.includes("に先立って")); assert.ok(!q(20, 36).choices.includes("を通して"));
  for (const [n, i, lead] of [[5, 46, "母が"], [8, 42, "ここ十年で"], [8, 45, "ついでにこの手紙を"], [9, 45, "今日は"]]) {
    const x = q(n, i); assert.ok(x.prompt.includes(lead), n + "#" + i + ": the movable phrase is fixed in the frame"); assert.equal(new Set(x.choices).size, 4);
    assert.ok(x.why.includes(x.choices[x.key - 1]) && /★ = /.test(x.why), n + "#" + i);
    assert.ok(!x.choices.includes("ここ十年で") && !x.choices.includes("今日は") && !x.choices.includes("田舎から"));
  }
  for (const [n, i] of [[4, 33], [10, 19], [14, 39], [20, 36]]) assert.equal(q(n, i).choices.length, 4);
});

test("Home shows the last boss by section, and the round's end asks once why a card was flagged", () => {
  const html = src("../n2-mock.html"), js = src("../n2-mock.js");
  assert.ok(html.includes('id="game-home-sections" hidden') && html.includes('id="game-flagwhy" hidden'));
  assert.ok(js.includes('const lastRun = [...(st.runs || [])].reverse().map(run => examOf(run)).find(e => e?.complete);'));
  assert.ok(js.includes('(s.ok === false ? " (under " + (s.min ?? SECTION_MIN) + ")" : "")'), "a section under its minimum says so");
  // The reason is one tap, after the round, on the report already filed; never asked during play.
  assert.ok(js.includes("try { next.report = await reportHistory.edit(next.report, {reasons: [reason]}); } catch {}"));
  assert.ok(js.includes("roundFlags.push(entry)") && js.includes("misses = []; marks = []; ups = []; roundFlags = [];"));
  const why = js.match(/const FLAG_WHY = (\[.*\]);/)[1];
  for (const r of ["answer", "meaning", "reading", "voice", "unnatural", "other"]) assert.ok(why.includes('"' + r + '"'), r);
});
