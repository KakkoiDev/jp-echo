import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gamePool, bossCards, bossQueue, bossReview, BOSS_REVIEW, resting, endRest, REST_ENDS, nextRound, rememberAnswer, BOSS_PLACES, BOSS_WORDS, ROUND_SIZE} from "../n2-game.js";
import {examplesFromDecks} from "../day-radio.js";
import {mergeGame} from "../sync.js";
import {checkKey, LIMITS} from "../tools/n2-build-keys.mjs";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
const inventory = read("../n2-inventory.json");
const examples = examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
const set = read("../n2-sets/n2-set-2.json");
const pool = gamePool({inventory, examples, sets: [set], sat: new Set([set.id])});
const seeded = (n = 1) => () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
const line = i => set.questions[i].context.split("\n").map(l => l.replace(/^[男女][０-９0-9１２]?[：:]/, "")).find(l => l.length > 8 && l.length < 100);
const keyOf = i => ({lines: [line(i)], en: "The meaning of the deciding line", wrong: ["A first misreading of it", "A second misreading of it", "A third misreading of it"]});
const keys = {"n2-set-2#60": keyOf(60), "n2-set-2#80": keyOf(80)};

test("a vocabulary or grammar miss brings the card of what it tested, never the question again", () => {
  const cards = bossCards({set, missed: [0, 30], pool});
  // 険しい has no reading card (no fair traps), so its meaning card stands in; a grammar question brings the grammar card.
  assert.deepEqual(cards.map(q => q.id), ["m:険しい", "g:ところを見ると"]);
  assert.ok(cards.every(q => !q.practice && pool.some(p => p.id === q.id)), "scored cards of the pool");
  const read = set.questions.findIndex(q => q.dimension === "reading" && q.target && pool.some(p => p.kind === "reading" && p.target?.[1] === q.target[1]));
  assert.equal(bossCards({set, missed: [read], pool}).at(-1).kind, "reading");
});

test("no card of the queue asks a boss question again: that would teach its answer", () => {
  const all = set.questions.map((_, i) => i), cards = bossCards({set, missed: all, keys, pool});
  assert.ok(cards.length > 50);
  assert.ok(!cards.some(q => q.kind === "exam" || q.fixed || /^(e|kl|kq):/.test(q.id)));
  // Each card's sentence is its own deck example, not the paper's.
  for (const q of cards) if (q.sentence) assert.ok(!set.questions.some(x => x.prompt === q.sentence || (x.context || "").includes(q.sentence)), q.id);
  assert.ok(cards.every(q => pool.some(p => p.id === q.id)), "only cards the game already had");
});

test("a reading or listening miss brings the N2 words and whole patterns of its passage, the deciding lines' first", () => {
  const cards = bossCards({set, missed: [60], keys, pool});
  assert.ok(cards.length && cards.every(q => q.passage === "n2-set-2#60" && ["meaning", "grammar"].includes(q.kind)));
  const text = set.questions[60].context + set.questions[60].choices.join("");
  for (const q of cards) assert.ok(text.includes(q.kind === "grammar" ? q.prompt.replace(/[〜～]/g, "") : q.prompt), q.id);
  const inLine = cards.filter(q => keys["n2-set-2#60"].lines[0].includes(q.prompt));
  assert.deepEqual(cards.slice(0, inLine.length).map(q => q.id), inLine.map(q => q.id));
  // A pattern is found only where it is written whole, three characters or more.
  for (const q of bossCards({set, missed: set.questions.map((_, i) => i), pool}).filter(c => c.kind === "grammar" && c.passage)) assert.ok(q.prompt.replace(/[〜～]/g, "").length >= 3, q.prompt);
});

test("the queue keeps a passage's unknown words, three at most, and drops what is done", () => {
  const cards = bossCards({set, missed: [0, 60], keys, pool}), words = cards.filter(q => q.passage);
  assert.ok(words.length > BOSS_WORDS, "the passage holds more N2 words than a round should take");
  const first = bossQueue({cards, state: {}, key: "a1"});
  assert.equal(first.filter(q => q.passage).length, BOSS_WORDS);
  assert.ok(first.every(q => q.boss === "a1"));
  const known = first.find(q => q.passage).id;
  const next = bossQueue({cards, state: {lv: {[known]: 3}}, key: "a1"});
  assert.ok(!next.some(q => q.id === known)); assert.equal(next.filter(q => q.passage).length, BOSS_WORDS);
  const done = bossQueue({cards, state: {bossDone: {key: "a1", ids: {"m:険しい": 1}}}, key: "a1"});
  assert.ok(!done.some(q => q.id === "m:険しい"));
  assert.equal(bossQueue({cards, state: {bossDone: {key: "a1", ids: {"m:険しい": 1}}}, key: "b2"}).filter(q => q.id === "m:険しい").length, 1);
});

test("a round gives the boss's misses a few places, and none in a recovery round", () => {
  const cards = bossCards({set, missed: [0, 2, 5, 30, 60, 80], keys, pool}), boss = bossQueue({cards, state: {}, key: "a1"});
  const {round} = nextRound({pool, boss, state: {}, random: seeded(3)});
  const mine = round.filter(q => q.boss);
  assert.equal(round.length, ROUND_SIZE); assert.equal(mine.length, BOSS_PLACES);
  assert.equal(new Set(mine.map(q => JSON.stringify(q.target))).size, mine.length);
  const slump = {history: [{at: "2026-11-27T00:00:00Z", score: -500, right: 2, n: 10}]};
  assert.equal(nextRound({pool, boss, state: slump, random: seeded(3)}).round.filter(q => q.boss).length, 0);
  assert.deepEqual(nextRound({pool, state: {}, random: seeded(3)}).round.map(q => q.id), nextRound({pool, boss: [], state: {}, random: seeded(3)}).round.map(q => q.id));
});

test("a miss is cleared by a right answer; a wrong one leaves it in the queue; it is scored like any card", () => {
  const cards = bossCards({set, missed: [0], pool}), [q] = bossQueue({cards, state: {}, key: "a1"});
  const wrong = rememberAnswer({}, {q, outcome: "wrong", points: -200});
  assert.equal(wrong.bossDone, undefined); assert.equal(wrong.answered, 1); assert.equal(wrong.total, -200);
  assert.ok(bossQueue({cards, state: wrong, key: "a1"}).some(c => c.id === q.id));
  const right = rememberAnswer(wrong, {q, outcome: "right", points: 300});
  assert.deepEqual(right.bossDone, {key: "a1", ids: {[q.id]: 1}}); assert.equal(right.answered, 2); assert.equal(right.total, 100);
  assert.ok(!bossQueue({cards, state: right, key: "a1"}).some(c => c.id === q.id));
  assert.equal(rememberAnswer({}, {q: {...q, boss: undefined}, outcome: "right"}).bossDone, undefined);
  assert.deepEqual(rememberAnswer(right, {q: {...q, boss: "b2"}, outcome: "right"}).bossDone, {key: "b2", ids: {[q.id]: 1}});
});

test("the boss review lists every wrong or unsure answer, as a card to read", () => {
  const answers = set.questions.map(q => q.key); answers[0] = set.questions[0].key % 4 + 1; answers[60] = set.questions[60].key % 4 + 1; answers[66] = 0; answers[92] = set.questions[92].key % 3 + 1;
  const guesses = []; guesses[30] = true;
  const items = bossReview({paper: set, attempt: {answers, guesses}, keys, source: set.id});
  assert.deepEqual(items.map(it => it.index), [0, 30, 60, 66, 92]);
  const [word, unsure, reading, blank, reply] = items;
  assert.equal(word.answer, "けわしい"); assert.equal(word.picked, set.questions[0].choices[answers[0] - 1]); assert.equal(word.seconds, BOSS_REVIEW.short); assert.deepEqual(word.lines, []);
  assert.equal(unsure.unsure, true); assert.equal(unsure.picked, "", "right, but marked unsure: nothing to strike");
  assert.deepEqual(reading.lines, keys["n2-set-2#60"].lines); assert.equal(reading.en, keys["n2-set-2#60"].en); assert.equal(reading.ask, set.questions[60].prompt);
  assert.equal(reading.seconds, BOSS_REVIEW.long); assert.ok(BOSS_REVIEW.long > BOSS_REVIEW.short && BOSS_REVIEW.long <= 10, "more to read, still the game's pace");
  assert.equal(blank.picked, null, "left unanswered"); assert.deepEqual(blank.lines, [], "no deciding lines: the question, its answer and why");
  // A quick-response item is its own line, heard, the speaker's label left out.
  assert.equal(reply.heard, true); assert.equal(reply.lines.length, 1); assert.ok(set.questions[92].context.endsWith(reply.lines[0]) && !/^[男女]/.test(reply.lines[0]));
  // A paper as the device stores it numbers its skills; lines apply only to the set they were written for.
  const stored = {questions: set.questions.map(q => ({...q, skill: ["Vocabulary", "Grammar", "Reading", "Listening"].indexOf(q.skill)}))};
  assert.deepEqual(bossReview({paper: stored, attempt: {answers, guesses}, keys, source: set.id}), items);
  assert.deepEqual(bossReview({paper: set, attempt: {answers, guesses}, keys}).find(it => it.index === 60).lines, []);
  assert.deepEqual(bossReview({paper: set, attempt: {answers: set.questions.map(q => q.key)}}), []);
});

test("what was cleared on two devices is kept from both while it is the same boss", () => {
  const a = {updatedAt: "2026-11-27T10:00:00Z", bossDone: {key: "a1", ids: {x: 1}}}, b = {updatedAt: "2026-11-27T11:00:00Z", bossDone: {key: "a1", ids: {y: 1}}};
  assert.deepEqual(mergeGame(a, b).bossDone, {key: "a1", ids: {x: 1, y: 1}});
  assert.deepEqual(mergeGame(a, {...b, bossDone: {key: "b2", ids: {z: 1}}}).bossDone, {key: "b2", ids: {z: 1}});
  assert.deepEqual(mergeGame(a, {updatedAt: "2026-11-27T12:00:00Z"}).bossDone, a.bossDone);
  assert.equal(mergeGame({updatedAt: "1"}, {updatedAt: "2"}).bossDone, undefined);
});

test("deciding lines must be the passage's own words, short, with four different meanings", () => {
  const q = set.questions[80], good = keyOf(80);
  assert.deepEqual(checkKey(good, q), []);
  assert.ok(checkKey({...good, lines: ["引っ越しは大変でした。"]}, q).length, "not in the script");
  assert.ok(checkKey({...good, lines: [q.context.split("\n")[0]]}, q).some(e => /label/.test(e)), "the speaker's label stays out");
  assert.ok(checkKey({...good, lines: [good.lines[0], good.lines[0]]}, q).length);
  assert.ok(checkKey({...good, lines: [q.context.replace(/\n/g, "").slice(0, LIMITS.chars + 1)]}, q).length);
  assert.ok(checkKey({...good, en: "引っ越し"}, q).length); assert.ok(checkKey({...good, wrong: good.wrong.slice(0, 2)}, q).length);
  assert.ok(checkKey({...good, wrong: [good.en, ...good.wrong.slice(1)]}, q).length);
  assert.deepEqual(checkKey({skip: "needs both texts compared"}, q), []); assert.ok(checkKey({skip: ""}, q).length);
  assert.ok(checkKey(good, set.questions[0]).length, "only reading and listening questions have lines");
});

test("the shipped lines pass the validator, were solved blind, and are precached", () => {
  const {keys: shipped, version} = read("../n2-sets/keys.json");
  assert.equal(version, 1); assert.ok(Object.keys(shipped).length > 0);
  for (const [source, key] of Object.entries(shipped)) {
    const [id, i] = source.split("#"), paper = read("../n2-sets/" + id + ".json"), draft = read("../tools/boss-keys/" + id + ".json");
    assert.deepEqual(checkKey(key, paper.questions[i]), [], source);
    assert.equal(draft[i].solved, true, source + ": a card only where a blind solver picked the key from the lines alone");
  }
  assert.ok(src("../sw.js").includes('"./n2-sets/keys.json"'));
});

test("the rounds do not say where these cards come from; the review opens from the run and counts for nothing", () => {
  const html = src("../n2-mock.html"), js = src("../n2-mock.js");
  assert.ok(!/boss mistakes|from (your|the) (last )?boss/i.test(html + js));
  assert.ok(js.includes("boss: pool === n2Pool ? bossQueue({cards: bossAll, state, key: lastBoss?.id || \"\"})"));
  assert.ok(js.includes("a.boss && a.phase === \"results\" && sat.has(a.book) && a.paper === realisticPaperId(a.book)"), "only a boss sat on the paper's current edition");
  // The run on Home opens the review; the full results stay one tap away.
  assert.ok(js.includes("if (paper && startPaperReview(sitting, paper)) e.preventDefault();"));
  assert.ok(js.includes('el("a", {class: "qr-chip", href: paperReview.href, text: "Full paper"})'));
  // It is the round's review screen with its hold button, and it writes nothing.
  const body = js.slice(js.indexOf("function startPaperReview"), js.indexOf("function review(n)") > js.indexOf("function startPaperReview") ? js.indexOf("function review(n)") : js.indexOf("function done()"));
  assert.ok(body.includes("review(0);")); assert.ok(!/writeGame|rememberAnswer|rememberRound|access\(/.test(body));
  assert.ok(js.includes("if (!paperReview) clearRound();"), "a round in progress is kept");
  assert.ok(html.includes('id="game-review-ask"') && html.includes('id="game-hold"'));
  // The row names what a tap opens.
  assert.ok(js.includes('...(sitting ? [el("span", {class: "qr-tiny qr-rkgo", text: "Boss review"})] : []),'));
  // The review hides the head, so it has its own back button to Home, at any card (owner, 27 Nov).
  assert.ok(/<button[^>]*id="game-review-back"[^>]*aria-label="Back to home"[^>]*hidden>/.test(html));
  assert.ok(js.includes('$("game-review-back").hidden = !paperReview;'), "never on a round's own review");
  assert.ok(/\$\("game-review-back"\)\.onclick = \(\) => \{ clearTimeout\(timer\);[^\n]*paperReview = null;[^\n]*home\(\); \};/.test(js));
});

test("rest is for the night of the boss: it ends at five, or once the Night Radio has been started", () => {
  const st = {bossTaken: {set: "n2-set-2", at: "2026-11-26T23:00:00"}, runs: [{at: "2026-11-26T23:00:00", attemptId: "a1"}]};
  const late = [{id: "a1", book: "n2-set-2", phase: "results", completedAt: new Date("2026-11-27T01:13:00").toISOString()}];
  assert.equal(REST_ENDS, 5);
  assert.equal(resting(st, late, new Date("2026-11-27T01:30:00")), true);
  assert.equal(resting(st, late, new Date("2026-11-27T04:59:00")), true);
  assert.equal(resting(st, late, new Date("2026-11-27T09:00:00")), false, "the next morning is a new day, though the date is the same");
  // A boss finished in the afternoon rests through that evening and past midnight, until five.
  const day = [{...late[0], completedAt: new Date("2026-11-27T15:00:00").toISOString()}];
  assert.equal(resting(st, day, new Date("2026-11-27T23:50:00")), true);
  assert.equal(resting(st, day, new Date("2026-11-28T02:00:00")), true);
  assert.equal(resting(st, day, new Date("2026-11-28T05:01:00")), false);
  // The Night Radio started: no more Rest screen for this boss; the next boss rests again.
  const over = endRest(st);
  assert.equal(over.restOver, st.bossTaken.at); assert.equal(resting(over, late, new Date("2026-11-27T01:30:00")), false);
  assert.equal(resting({...over, bossTaken: {set: "n2-set-3", at: "2026-11-28T20:00:00"}, runs: [{at: "x", attemptId: "b2"}]}, [{id: "b2", book: "n2-set-3", phase: "results", completedAt: new Date("2026-11-28T21:00:00").toISOString()}], new Date("2026-11-28T22:00:00")), true);
  assert.deepEqual(endRest({}), {});
  assert.ok(src("../n2-mock.js").includes('$("game-home-radio").onclick = () => { writeGame(endRest(readGame())); radioPanel(); };'));
});

test("a vocabulary or grammar review card shows the word, its reading and its meaning large, as a round's review does", () => {
  const answers = set.questions.map(q => q.key); answers[0] = 4; answers[30] = 2;
  const [word, pattern] = bossReview({paper: set, attempt: {answers}});
  assert.deepEqual(word.target, ["word", "険しい", "けわしい"]); assert.deepEqual(pattern.target, ["grammar", "ところを見ると"]);
  // The game has the meaning of both: the cards of the pool.
  const sol = t => pool.find(c => c.kind !== "exam" && c.solution?.meaning && c.target?.[0] === t[0] && c.target[1] === t[1])?.solution;
  assert.equal(sol(word.target).word, "険しい"); assert.equal(sol(word.target).reading, "けわしい"); assert.match(sol(word.target).meaning, /steep|precipitous/i);
  assert.ok(sol(pattern.target).meaning);
  const js = src("../n2-mock.js");
  assert.ok(js.includes("solution: {word: sol.word, reading: sol.reading || \"\", meaning: sol.meaning,"), "the hero is the word, the reading and the meaning");
  assert.ok(js.includes('if (q.paperLine) { $("game-review-ja").replaceChildren(...paperText(q.paperLine, q.answer));'), "the paper's sentence sits in the example card");
  assert.ok(js.includes('"Answer: " + it.answer'), "a synonym question still shows the paper's answer");
});
