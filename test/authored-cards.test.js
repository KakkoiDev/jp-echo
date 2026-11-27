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
const extras = {paraphrase: items("../n2-paraphrase.json"), pairs: items("../n2-pairs.json"), ordering: items("../n2-ordering.json"), pieces: has("../n2-word-pieces.json") ? read("../n2-word-pieces.json").pieces : {}, gapWrong: has("../n2-gap-wrong.json") ? read("../n2-gap-wrong.json").wrong : {}};
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
  assert.ok(src("../n2-mock.js").includes('["./n2-paraphrase.json", "./n2-pairs.json", "./n2-ordering.json", "./n2-sets/en.json", "./n2-word-pieces.json", "./n2-gap-wrong.json"]'));
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

test("list entries with a note in their label are shown clean and get cards; their recall target stays the list's", async () => {
  const {LIST_LABEL} = await import("../n2-game-review.js");
  const examples = (await import("../day-radio.js")).examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
  const full = gamePool({inventory, examples});
  assert.equal(Object.keys(LIST_LABEL).length, 17); assert.deepEqual(inventory.words.filter(w => /[()（）]/.test(w[0])).map(w => w[0]).sort(), Object.keys(LIST_LABEL).sort(), "every labelled entry");
  for (const [label, clean] of Object.entries(LIST_LABEL)) {
    assert.ok(inventory.words.some(w => w[0] === label), label + " is in the list");
    const cards = full.filter(q => q.target?.[1] === label);
    assert.ok(cards.length >= 1, label + " has a card");
    for (const q of cards) assert.ok(q.prompt === clean.text || q.solution.word === clean.text || q.prompt === clean.answer, q.id);
    assert.ok(!/[()（）\s]/.test(clean.text) && clean.answer.length <= 40);
  }
  assert.ok(full.some(q => q.id === "a:～ごと") && full.some(q => q.id === "p:～式") && full.some(q => q.id === "m:しわ"));
  assert.ok(!full.some(q => q.kind !== "definition" && /[()（）]/.test(q.prompt || "") && q.target?.[0] === "word"), "no Japanese prompt shows a note in its label");
});

test("N2 rounds give two places to kanji-first picking; without an order the round is as before", async () => {
  const {kanjiOrderOf, KANJI_PLACES} = await import("../n2-game.js");
  const examples = (await import("../day-radio.js")).examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
  const full = gamePool({inventory, examples, parts: read("../n2-kanji-parts.json")}), order = kanjiOrderOf(full);
  assert.equal(KANJI_PLACES, 2); assert.ok(order.length > 600 && order[0] === "日", "kanji in the order of how many N2 words carry them");
  for (let n = 1; n <= 10; n++) {
    const {round} = nextRound({pool: full, state: {}, random: seeded(n), kanjiOrder: order});
    assert.equal(round.length, 10); assert.equal(round.filter(q => q.focus).length, KANJI_PLACES);
    assert.equal(new Set(round.map(q => q.id)).size, 10);
  }
  assert.deepEqual(nextRound({pool: full, state: {}, random: seeded(3)}).round.map(q => q.id), nextRound({pool: full, state: {}, random: seeded(3), kanjiOrder: ""}).round.map(q => q.id));
  const slump = {history: [{at: "x", score: -500, right: 2, n: 10}]};
  assert.equal(nextRound({pool: full, state: slump, random: seeded(2), kanjiOrder: order}).round.filter(q => q.focus).length, 0, "a recovery round is left alone");
  assert.ok(src("../n2-mock.js").includes('kanjiOrder: pool === n2Pool ? n2KanjiOrder : "",'));
});

test("a grammar gap card takes the wrong choices written for its sentence, where they passed their blind test", async () => {
  const authored = read("../n2-gap-wrong.json").wrong;
  const examples = (await import("../day-radio.js")).examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
  const gaps = gamePool({inventory, examples, extras: {gapWrong: authored}}).filter(q => q.kind === "gap");
  assert.equal(Object.keys(authored).length, 195, "196 written, one dropped: a choice failed on form");
  assert.ok(!authored["とも"]);
  let own = 0;
  for (const q of gaps) {
    const key = q.id.slice(2);
    if (authored[key]) { own++; assert.ok(q.fixedWrong); assert.deepEqual(q.wrong, authored[key]); assert.deepEqual(q.near, []); assert.deepEqual([...choicesFor(q, seeded(4), .5).choices].sort(), [q.answer, ...authored[key]].sort()); }
    else assert.ok(!q.fixedWrong && q.wrong.length >= 3, key + ": other sentences' forms, as before");
  }
  assert.ok(own >= 190);
  // Without the file the cards are as they were.
  assert.ok(gamePool({inventory, examples}).filter(q => q.kind === "gap").every(q => !q.fixedWrong));
  assert.ok(src("../sw.js").includes('"./n2-gap-wrong.json"'));
});

test("the reading sprint: short passages from papers not sat, ninety seconds, never a held-out paper", async () => {
  const {sprintCards, SPRINT} = await import("../n2-game.js");
  const {HELD_OUT} = await import("../n2-comprehension.js");
  const ids = Object.keys(read("../n2-sets/index.json")), sets = ids.map(id => read("../n2-sets/" + id + ".json")), keys = read("../n2-sets/keys.json").keys;
  const cards = sprintCards({sets, sat: new Set(["n2-set-2"]), keys, random: seeded(2)});
  assert.deepEqual(SPRINT, {size: 3, seconds: 90, mondai: [10]});
  assert.ok(cards.length > 60);
  for (const q of cards) {
    const [set, i] = q.id.slice(3).split("#"), src = read("../n2-sets/" + set + ".json").questions[i];
    assert.ok(set !== "n2-set-2" && !HELD_OUT.includes(set), q.id); assert.equal(src.mondai, 10); assert.equal(q.seconds, 90);
    assert.deepEqual(q.fixed, src.choices); assert.equal(q.answer, src.choices[src.key - 1]); assert.equal(q.sentence, src.context.replace(/【[^】]*】/g, ""));
    if (keys[set + "#" + i]) assert.equal(q.solution.ja, keys[set + "#" + i].lines.join(""), "its deciding lines in the review");
  }
  // Least recently seen first.
  const first = cards[0].id, later = sprintCards({sets, sat: new Set(["n2-set-2"]), keys, seen: {[first]: 5}, random: seeded(2)});
  assert.notEqual(later[0].id, first);
  const js = src("../n2-mock.js"), html = src("../n2-mock.html");
  assert.ok(html.includes('id="game-sprint"') && js.includes('$("game-sprint").onclick = async () => {'));
  assert.ok(js.includes("const cards = sprintCards({sets: loaded, sat, keys: bossKeys, seen: readGame().seen || {}}).slice(0, SPRINT.size);"));
  assert.equal(KIND_LABEL.sprint, "Reading sprint"); assert.equal(KIND_SKILL.sprint, "reading");
});

test("the other levels' cards follow the reviews: the expected sense, accepted readings, no synonym against its word", async () => {
  const {LEVEL_GLOSS, LEVEL_DROP, NOT_WRONG, ACCEPTED_READINGS} = await import("../n2-game-review.js");
  const m = read("../levels/manifest.json"), pools = {};
  for (const lv of ["N5", "N4", "N3", "N1"]) pools[lv] = gamePool({inventory: {words: read("../levels/" + m.version + "/" + lv.toLowerCase() + ".json").words, grammar: []}, level: lv});
  const card = (lv, id) => pools[lv].find(q => q.id === id);
  assert.equal(card("N5", "l:N5:シャツ").answer, "shirt"); assert.equal(card("N1", "d:N1:延べ").prompt, "total, cumulative"); assert.equal(card("N4", "d:N4:先輩").prompt, LEVEL_GLOSS["N4:先輩"]);
  for (const id of LEVEL_DROP) { const [lv] = id.split(":"), word = id.split("/")[0]; assert.ok(!pools[lv].some(q => id.includes("/") ? q.item === id : q.item?.startsWith(word + "/")), id + " is dropped"); }
  assert.ok(pools.N3.some(q => q.item === "N3:分/ぶん"), "分 read ぶん keeps its cards");
  assert.equal(card("N3", "r:N3:吝嗇").answer, "りんしょく", "the standard reading, not the synonym ケチ");
  for (const [lv, id, reading] of [["N5", "r:N5:本当", "ほんと"], ["N5", "r:N5:大丈夫", "だいじょぶ"]]) assert.ok(!card(lv, id).wrong.includes(reading), id + ": " + reading + " is accepted");
  assert.ok(ACCEPTED_READINGS["寂しい"].includes("さみしい"));
  for (const lv of Object.keys(pools)) for (const q of pools[lv].filter(c => c.kind === "definition")) for (const [a, b] of NOT_WRONG) {
    if (q.answer === a) assert.ok(!q.wrong.includes(b), lv + " " + a + " against " + b);
    if (q.answer === b) assert.ok(!q.wrong.includes(a), lv + " " + b + " against " + a);
  }
  assert.ok(!card("N3", "d:N3:遅刻").wrong.includes("遅れ") && !card("N3", "d:N3:助ける").wrong.includes("救助") && !card("N1", "d:N1:促進").wrong.includes("推進"));
});

test("every word of the other levels was read by a reviewer: their meanings, accepted readings and drops apply", () => {
  const rv = read("../level-review.json"), m = read("../levels/manifest.json");
  assert.ok(Object.keys(rv.gloss).length > 600 && Object.keys(rv.also).length > 100 && Object.keys(rv.drop).length > 150);
  for (const [k, v] of Object.entries(rv.gloss)) assert.ok(v.length <= 40 && !/[ぁ-んァ-ヶ一-龯]/.test(v), k);
  const pool = lv => gamePool({inventory: read("../levels/" + m.version + "/" + lv.toLowerCase() + ".json"), level: lv, review: rv});
  const n5 = pool("N5"), n3 = pool("N3"), n1 = pool("N1");
  assert.equal(n5.find(q => q.id === "m:N5:肉").answer, "meat"); assert.equal(n1.find(q => q.id === "m:N1:延べ")?.answer, rv.gloss["N1:延べ/のべ"]);
  assert.ok(!n5.some(q => q.item === "N5:イクラ/イクラ"), "dropped: the N5 word is いくら");
  assert.ok(!n5.find(q => q.id === "r:N5:七")?.wrong.includes("なな"), "a second reading is never a wrong choice");
  assert.ok(n3.length < gamePool({inventory: read("../levels/" + m.version + "/n3.json"), level: "N3"}).length);
  assert.ok(src("../n2-mock.js").includes("gamePool({inventory: inv, level: l, review: levelReview})"));
  assert.ok(src("../sw.js").includes('"./level-review.json"'));
});

test("a new player starts at N5; a boss wears the game's look", async () => {
  const {rankOf, START_RANK} = await import("../n2-game.js");
  assert.equal(START_RANK, "N5"); assert.equal(rankOf({}), "N5"); assert.equal(rankOf({answered: 1}), "N2"); assert.equal(rankOf({rank: "N3"}), "N3");
  const js = src("../n2-mock.js"), css = src("../styles.css");
  assert.ok(js.includes('document.body.dataset.from = "game"; document.body.dataset.boss = "true";'));
  assert.ok(js.includes('$("result-next").href = "?view=game"; $("result-next").textContent = "Back to Quick round";'));
  assert.ok(css.includes("body[data-boss=true] .n2-choice{") && css.includes("body[data-boss=true] #exam .drill-bar{height:14px"));
});
