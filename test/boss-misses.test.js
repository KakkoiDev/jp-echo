import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gamePool, bossCards, bossQueue, nextRound, rememberAnswer, BOSS_PLACES, BOSS_WORDS, KEY_SECONDS, KIND_LABEL, ROUND_SIZE} from "../n2-game.js";
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

test("a vocabulary or grammar miss comes back as the question itself and the card of what it tests", () => {
  const cards = bossCards({set, missed: [0, 30], pool});
  // 険しい has no reading card (no fair traps), so its meaning card stands in; a grammar question brings the grammar card.
  assert.deepEqual(cards.map(q => q.id), ["e:n2-set-2#0", "m:険しい", "e:n2-set-2#30", "g:ところを見ると"]);
  // Where the word has a reading card, a reading question brings that one.
  const read = set.questions.findIndex((q, i) => q.dimension === "reading" && q.target && pool.some(p => p.kind === "reading" && p.target?.[1] === q.target[1]));
  assert.equal(bossCards({set, missed: [read], pool}).at(-1).kind, "reading");
  assert.ok(cards.every(q => !q.practice && pool.some(p => p.id === q.id)));
});

test("a written question the game has no exam card for still brings its word or pattern", () => {
  const usage = set.questions.findIndex(q => q.mondai === 6 && q.target);
  const cards = bossCards({set, missed: [usage], pool});
  assert.ok(cards.length >= 1 && cards.every(q => q.kind !== "exam" && q.target?.[1] === set.questions[usage].target[1]));
});

test("a reading miss becomes two cards on its deciding lines: what they mean, then the paper's question", () => {
  const cards = bossCards({set, missed: [60], keys, pool}), [means, asks] = cards;
  assert.deepEqual([means.id, asks.id], ["kl:n2-set-2#60", "kq:n2-set-2#60"]);
  assert.equal(means.kind, "keyline"); assert.equal(means.answer, keys["n2-set-2#60"].en); assert.equal(means.wrong.length, 3);
  assert.equal(asks.kind, "key"); assert.equal(asks.prompt, set.questions[60].prompt);
  assert.deepEqual(asks.fixed, set.questions[60].choices); assert.equal(asks.answer, set.questions[60].choices[set.questions[60].key - 1]);
  for (const q of [means, asks]) {
    assert.equal(q.sentence, keys["n2-set-2#60"].lines[0]);
    assert.ok(set.questions[60].context.includes(q.sentence), "the lines are the passage's own");
    assert.ok(q.practice && q.record, "unreviewed: no points, but the answer counts");
    assert.equal(q.item, "key:n2-set-2#60"); assert.equal(q.target, null);
    assert.equal(q.seconds, KEY_SECONDS[q.kind]); assert.ok(KIND_LABEL[q.kind]);
    assert.ok(!q.heard);
  }
  assert.ok(KEY_SECONDS.keyline <= 8 && KEY_SECONDS.key <= 12, "blitz pace");
});

test("a listening line is heard, not read", () => {
  const [means, asks] = bossCards({set, missed: [80], keys, pool});
  for (const q of [means, asks]) { assert.equal(q.heard, true); assert.equal(q.say, keys["n2-set-2#80"].lines[0]); assert.ok(!/^[男女]/.test(q.say)); }
});

test("a question with no deciding lines makes no key card, only its words", () => {
  const cards = bossCards({set, missed: [61], keys, pool});
  assert.ok(cards.every(q => q.kind === "meaning" && q.passage === "n2-set-2#61"));
  for (const q of cards) assert.ok((set.questions[61].context + set.questions[61].choices.join("")).includes(q.prompt) && q.prompt.length >= 2);
});

test("the queue keeps a passage's unknown words, three at most, and drops what is done", () => {
  const cards = bossCards({set, missed: [0, 60], keys, pool}), words = cards.filter(q => q.passage);
  assert.ok(words.length > BOSS_WORDS, "the passage holds more N2 words than a round should take");
  const first = bossQueue({cards, state: {}, key: "a1"});
  assert.equal(first.filter(q => q.passage).length, BOSS_WORDS);
  assert.ok(first.every(q => q.boss === "a1"));
  // A word already known is not asked for the boss's sake; the next unknown one takes its place.
  const known = first.find(q => q.passage).id;
  const next = bossQueue({cards, state: {lv: {[known]: 3}}, key: "a1"});
  assert.ok(!next.some(q => q.id === known)); assert.equal(next.filter(q => q.passage).length, BOSS_WORDS);
  const done = bossQueue({cards, state: {bossDone: {key: "a1", ids: {"e:n2-set-2#0": 1, "kl:n2-set-2#60": 1}}}, key: "a1"});
  assert.ok(!done.some(q => q.id === "e:n2-set-2#0" || q.id === "kl:n2-set-2#60")); assert.ok(done.some(q => q.id === "kq:n2-set-2#60"));
  // Another boss: what was done for the last one says nothing about this one.
  assert.equal(bossQueue({cards, state: {bossDone: {key: "a1", ids: {"e:n2-set-2#0": 1}}}, key: "b2"}).filter(q => q.id === "e:n2-set-2#0").length, 1);
});

test("a round gives the boss's misses a few places, never two cards of one question, and none in a recovery round", () => {
  const cards = bossCards({set, missed: [0, 2, 5, 30, 60, 80], keys, pool}), boss = bossQueue({cards, state: {}, key: "a1"});
  const {round} = nextRound({pool, boss, state: {}, random: seeded(3)});
  const mine = round.filter(q => q.boss);
  assert.equal(round.length, ROUND_SIZE); assert.equal(mine.length, BOSS_PLACES);
  assert.equal(new Set(mine.map(q => q.target ? JSON.stringify(q.target) : q.item)).size, mine.length);
  assert.ok(!round.some(q => q.kind === "key") || !round.some(q => q.kind === "keyline" && q.source === round.find(k => k.kind === "key").source));
  const slump = {history: [{at: "2026-11-27T00:00:00Z", score: -500, right: 2, n: 10}]};
  assert.equal(nextRound({pool, boss, state: slump, random: seeded(3)}).round.filter(q => q.boss).length, 0);
  // Without a boss the round is picked exactly as before.
  assert.deepEqual(nextRound({pool, state: {}, random: seeded(3)}).round.map(q => q.id), nextRound({pool, boss: [], state: {}, random: seeded(3)}).round.map(q => q.id));
});

test("a miss is cleared by a right answer; a wrong one leaves it in the queue; every answer counts toward the boss", () => {
  const cards = bossCards({set, missed: [60], keys, pool}), [q] = bossQueue({cards, state: {}, key: "a1"});
  const wrong = rememberAnswer({}, {q, outcome: "wrong", points: -200});
  assert.equal(wrong.bossDone, undefined); assert.equal(wrong.answered, 1); assert.equal(wrong.total, 0, "a key card pays and costs nothing");
  assert.ok(bossQueue({cards, state: wrong, key: "a1"}).some(c => c.id === q.id));
  const right = rememberAnswer(wrong, {q, outcome: "right", points: 300});
  assert.deepEqual(right.bossDone, {key: "a1", ids: {[q.id]: 1}}); assert.equal(right.answered, 2); assert.equal(right.total, 0);
  assert.ok(!bossQueue({cards, state: right, key: "a1"}).some(c => c.id === q.id));
  // The same card met outside the queue clears nothing.
  assert.equal(rememberAnswer({}, {q: {...q, boss: undefined}, outcome: "right"}).bossDone, undefined);
  // A new boss starts its own list.
  assert.deepEqual(rememberAnswer(right, {q: {...q, boss: "b2"}, outcome: "right"}).bossDone, {key: "b2", ids: {[q.id]: 1}});
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

test("the game does not say where these cards come from", () => {
  // Owner, 27 Nov: no row, no count, no label about the boss; the next boss is a fresh paper.
  const html = src("../n2-mock.html"), js = src("../n2-mock.js");
  assert.ok(!/boss mistakes|from (your|the) (last )?boss/i.test(html + js));
  assert.ok(js.includes("boss: pool === n2Pool ? bossQueue({cards: bossAll, state, key: lastBoss?.id || \"\"})"));
  assert.ok(js.includes("a.boss && a.phase === \"results\" && sat.has(a.book) && a.paper === realisticPaperId(a.book)"), "only a boss sat on the paper's current edition");
});
