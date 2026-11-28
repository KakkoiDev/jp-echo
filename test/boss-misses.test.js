import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stepKey, gamePool, bossCards, bossQueue, bossReview, BOSS_REVIEW, resting, endRest, REST_ENDS, nextRound, rememberAnswer, BOSS_PLACES, BOSS_WORDS, ROUND_SIZE, KIND_LABEL as KIND_LABEL_OF} from "../n2-game.js";
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

test("prefixes and suffixes have a card: the part underlined in a sentence, its meaning to pick", async () => {
  const {affixSide, recallsMiss, choicesFor, SECONDS} = await import("../n2-game.js");
  const {REVIEWED_AFFIXES, LIST_LABEL: LIST_LABEL_OF} = await import("../n2-game-review.js");
  const cards = pool.filter(q => q.kind === "affix");
  assert.ok(cards.length >= 140, "most of the list's 167 word parts");
  const gimi = cards.find(q => q.id === "a:～気味"), zen = cards.find(q => q.id === "a:前～");
  assert.equal(gimi.sentence, "昨日から少し風邪気味だ。"); assert.equal(gimi.needle, "気味"); assert.equal(gimi.answer, "slightly ~"); assert.equal(gimi.side, "suffix");
  assert.equal(zen.needle, "前"); assert.equal(zen.side, "prefix"); assert.match(zen.answer, /former/);
  assert.equal(affixSide("～気味"), "suffix"); assert.equal(affixSide("前～"), "prefix");
  assert.equal(KIND_LABEL_OF.affix, "Word part"); assert.equal(SECONDS.affix, 5);
  for (const q of cards) {
    assert.equal(q.sentence.split(q.needle).length, 2, q.id + ": the part is written once, so the underline is the part");
    assert.ok(/^[〜～]?[^〜～\s(（]+[〜～]?$/.test(q.prompt), q.id);
    assert.ok(q.wrong.length >= 3 && !q.wrong.includes(q.answer), q.id);
    assert.equal(new Set(choicesFor(q, seeded(7), .5).choices).size, 4, q.id);
    assert.ok(q.target[0] === "word" && (q.target[1] === q.prompt || LIST_LABEL_OF[q.target[1]]?.text === q.prompt), q.id + ": the list's own target, under a clean label where it has one");
    // Unreviewed, and scored all the same (owner, 27 Nov): points both ways, and a miss is recall evidence.
    assert.equal(REVIEWED_AFFIXES, false); assert.ok(!q.practice);
    assert.equal(recallsMiss(q, "wrong"), true); assert.equal(recallsMiss({...q, practice: true}, "wrong"), false);
  }
  assert.equal(new Set(cards.map(q => q.id)).size, cards.length, "～所 しょ and ～所 じょ keep apart");
  // No whole word is a wrong choice here, and no word card is made of a part.
  assert.ok(!pool.some(q => !["affix", "partgap", "exam"].includes(q.kind) && /[〜～]/.test(q.prompt) && q.target?.[0] === "word"));
  // The other levels' lists hold no parts yet: their pools are unchanged.
  const answered = rememberAnswer({}, {q: gimi, outcome: "right", points: 300});
  assert.equal(answered.answered, 1); assert.equal(answered.total, 300);
  // A missed 問題3 question brings its part into the rounds, and the boss review finds its meaning.
  const q3 = set.questions.findIndex(q => q.target?.[1] === "～気味");
  assert.deepEqual(bossCards({set, missed: [q3], pool}).map(q => q.id), ["a:～気味"]);
  assert.ok(src("../n2-mock.js").includes('"connective", "meaning", "affix"].includes(q.kind)'), "shown as a sentence card");
});

test("a flagged card leaves the misses and rests a week: it cannot come back round after round", async () => {
  const {flagCard, flagRests, FLAG_REST_MS, heardGap} = await import("../n2-game.js");
  const day = 86400_000, now = 100 * day, id = "l:崩す";
  const st = flagCard({comeback: ["m:x", id], seen: {}}, id, now);
  assert.deepEqual(st.comeback, ["m:x"], "a flag takes the card out of the cards asked again"); assert.equal(st.seen[id], now); assert.equal(st.flags[id], now);
  assert.equal(FLAG_REST_MS, 7 * day); assert.equal(flagRests(st, id, now + 6 * day), true); assert.equal(flagRests(st, id, now + 7 * day), false); assert.equal(flagRests({}, id, now), false);
  // No round holds it while it rests, whichever list it would come from; afterwards it may be asked again.
  const card = pool.find(q => q.id === id), others = pool.filter(q => q.kind === "listen" && q.id !== id).slice(0, 30);
  for (let n = 1; n <= 20; n++) assert.ok(!nextRound({pool: [card, ...others], boss: [{...card, boss: "a1"}], review: [card], state: {...st, comeback: [id]}, random: seeded(n), now: now + day}).round.some(q => q.id === id));
  assert.ok(nextRound({pool: [card, ...others.slice(0, 9)], state: {...st, comeback: [id]}, random: seeded(1), now: now + 8 * day}).round.some(q => q.id === id));
  // Old flags are dropped when a new one is made, and both devices' flags are kept.
  assert.deepEqual(Object.keys(flagCard(st, "m:y", now + 8 * day).flags), ["m:y"]);
  assert.deepEqual(mergeGame({updatedAt: "1", flags: {a: 5, b: 1}}, {updatedAt: "2", flags: {b: 9}}).flags, {a: 5, b: 9});
  const js = src("../n2-mock.js");
  assert.ok(js.includes("const q = current; writeGame(flagCard(readGame(), q.id));")); assert.ok(js.includes("if (!paperReview) writeGame(flagCard(readGame(), m.q.id));"));
  // The cards those flags were about: an audio card whose sentence writes the word in another form now keeps its sentence.
  const listen = pool.filter(q => q.kind === "listen");
  for (const w of ["崩す", "組み立てる", "通ずる", "坊っちゃん"]) { const q = listen.find(c => c.prompt === w); assert.ok(q && heardGap(q.solution.ja, q.prompt), w); }
  assert.equal(listen.filter(q => q.solution.ja && !heardGap(q.solution.ja, q.prompt)).length, 0, "every audio card with a sentence shows it");
});

test("a card known better rests longer, so a small kind cannot loop", async () => {
  const {restFor, pickRound, ITEM_LEVEL, RECENT_MS} = await import("../n2-game.js");
  const h = 3600_000;
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(l => restFor(l) / h), [4, 8, 16, 32, 64, 72]); assert.equal(restFor(9), ITEM_LEVEL.restMs); assert.equal(restFor(undefined), RECENT_MS);
  // Eleven connective cards among thousands: one at level 2 seen ten hours ago still rests; at sixteen hours it may return.
  const con = gamePool({inventory, examples, sets: [set], sat: new Set([set.id]), excerpts: true}).filter(q => q.kind === "connective"), others = pool.filter(q => q.kind === "meaning").slice(0, 200), now = 1000 * h;
  assert.ok(con.length > 0 && con.length < 20, "a small kind: one paper sat");
  const state = hours => ({seen: Object.fromEntries(con.map(q => [q.id, now - hours * h])), lv: Object.fromEntries(con.map(q => [q.id, 2]))});
  for (let n = 1; n <= 10; n++) assert.ok(!pickRound({pool: [...con, ...others], ...state(10), random: seeded(n), now}).some(q => q.kind === "connective"));
  assert.ok([1, 2, 3, 4, 5].some(n => pickRound({pool: [...con, ...others], ...state(17), random: seeded(n), now}).some(q => q.kind === "connective")));
});

test("every boss review card is spoken once: the word, the pattern, a listening line, or the answer", () => {
  const js = src("../n2-mock.js");
  assert.ok(js.includes('const voiceOf = () => card.kind === "grammar" ? grammarVoice(card, sol).speak : spokenWord(sol.word.replace(/[〜～]/g, ""), String(sol.reading || "").replace(/[〜～]/g, ""));'));
  assert.ok(js.includes('if (sol) return {picked, q: {...base, say: voiceOf(), paperLine:'));
  assert.ok(js.includes('say: it.heard && it.lines.length ? it.lines.join("　") : keyWord,'), "a listening line, else the tested word (owner, 28 Nov)");
  assert.ok(js.includes("if (sound() && voiced) setTimeout(() => { if (reviewToken === askToken && !$(\"game-review\").hidden) say(voiced); }, 150);"));
});

test("a connective excerpt (no longer in rounds) keeps up to two sentences before the gap; its review is the word and its meaning at a glance", () => {
  const ids = Object.keys(read("../n2-sets/index.json")), all = gamePool({inventory, examples, sets: ids.map(id => read("../n2-sets/" + id + ".json")), sat: new Set(ids), excerpts: true}).filter(q => q.kind === "connective");
  assert.ok(all.length > 200);
  for (const q of all) {
    const [before, after] = q.sentence.split("（　）");
    assert.ok((before.match(/[。」]/g) || []).length >= 1, q.id);
    assert.ok(after.startsWith("、") && after.length >= 6, q.id);
    // The review: the connective, a short meaning, its job as the why, and the gap's own sentence.
    assert.equal(q.solution.word, q.answer); assert.ok(q.solution.meaning && q.solution.meaning.length <= 60 && !q.solution.meaning.includes(" · "), q.id);
    assert.ok(/^[A-Z][a-z]+: /.test(q.solution.why), q.id); assert.equal(q.solution.ja, q.answer + after);
  }
  // Shortening to one sentence was tried and taken back (owner, 27 Nov): less context makes a second connective fit.
  const mata = all.find(q => q.id === "c:n2-set-2#66@286");
  assert.equal(mata.sentence, "しかし、図書館の本は多くの人が共有する財産だ。一冊の本が汚れれば、次に読む人が迷惑する。（　）、古い資料の中には、一度傷むと二度と元に戻らないものもある。");
  assert.equal(mata.solution.meaning, "also, in addition"); assert.equal(mata.solution.ja, "また、古い資料の中には、一度傷むと二度と元に戻らないものもある。");
  assert.ok(src("../n2-game.js").includes("(?:[^。」]*[。」]){1,2}"));
  assert.ok(src("../n2-mock.js").includes('if (q.kind === "connective" || q.kind === "link") line.textContent = q.solution?.why || "";'));
});

test("a connective is asked on its own: one word, its meaning to pick, nothing to read", async () => {
  const {CONNECTIVES, OVERLAP, JOBS} = await import("../n2-connectives.js");
  const {SECONDS, choicesFor, answerSpeech} = await import("../n2-game.js");
  const {LINK_SHOWN, LINK_NOT_WRONG, LINK_WHY} = await import("../n2-game-review.js");
  const links = pool.filter(q => q.kind === "link");
  assert.equal(links.length, CONNECTIVES.length, "every connective of the table"); assert.ok(links.length >= 35);
  assert.equal(pool.filter(q => q.kind === "connective").length, 0, "no passage excerpt in a round");
  assert.equal(SECONDS.link, 3); assert.equal(KIND_LABEL_OF.link, "Connective");
  const meaningOf = new Map(CONNECTIVES.map(([w, j, m]) => [m, j]));
  for (const q of links) {
    const [word, job, meaning] = CONNECTIVES.find(c => "k:" + c[0] === q.id);
    // The card shows the form the word is met in (それにもかかわらず, だとすれば); its id keeps the table's.
    const shown = LINK_SHOWN[word] || word;
    assert.equal(q.prompt, shown); assert.ok(shown.endsWith(word)); assert.equal(q.answer, meaning); assert.equal(q.sentence, "", "nothing to read but the word");
    assert.equal(q.solution.why, LINK_WHY[word] || JOBS[job]); assert.equal(q.solution.word, shown); assert.ok(!q.practice && q.target === null);
    for (const m of LINK_NOT_WRONG[word] || []) assert.ok(!q.wrong.includes(m), word + ": " + m + " is fair for it too");
    // No wrong choice is the meaning of a connective that could do the same job.
    for (const w of q.wrong) assert.ok(!(OVERLAP[job] || [job]).includes(meaningOf.get(w)), word + " against " + w);
    assert.equal(new Set(choicesFor(q, seeded(5), .5).choices).size, 4, word);
    assert.equal(answerSpeech(q), shown);
  }
  // もっとも limits the point just made: an exception, not a turn (review, 27 Nov).
  assert.match(links.find(q => q.id === "k:もっとも").solution.why, /^Exception: /);
  const mata = links.find(q => q.prompt === "また");
  assert.equal(mata.answer, "also, in addition"); assert.match(mata.solution.why, /^Add: /);
  // A miss comes back and is scored like any card; the job line shows after the answer.
  const st = rememberAnswer({}, {q: mata, outcome: "wrong", points: -200});
  assert.deepEqual(st.comeback, ["k:また"]); assert.equal(st.total, -200);
});

test("the review of 27 Nov is applied to the word parts: their meanings, and the parts kept apart", async () => {
  const {AFFIX_GLOSS, AFFIX_CONFUSABLE} = await import("../n2-game-review.js");
  const cards = pool.filter(q => q.kind === "affix"), by = t => cards.filter(q => q.prompt === t);
  for (const [t, m] of [["～場", "venue, ground for ~"], ["非～", "non-~, un-~"], ["～道", "way, art of ~"], ["女～", "female ~"], ["～船", "ship, boat (type of ~)"]]) {
    assert.equal(AFFIX_GLOSS[t], m); for (const q of by(t)) { assert.equal(q.answer, m); assert.equal(q.solution.meaning, m); }
  }
  for (const [k, m] of Object.entries(AFFIX_GLOSS)) assert.ok(m.length <= 40 && !/[ぁ-んァ-ヶ一-龯]/.test(m), k);
  // No two parts of a group are ever each other's wrong choice.
  assert.ok(AFFIX_CONFUSABLE.length >= 20);
  const meaning = new Map(cards.map(q => [q.prompt, q.answer]));
  for (const group of AFFIX_CONFUSABLE) for (const a of group) for (const q of by(a)) for (const b of group) if (b !== a && meaning.has(b)) assert.ok(!q.wrong.includes(meaning.get(b)), a + " against " + b);
  assert.ok(!by("～器").some(q => q.wrong.includes(meaning.get("～機")))); assert.ok(by("～器").length && by("～機").length);
  // Every finding has a line saying what was done.
  const found = read("../tools/scored-review/reviews/2026-11-27-sonnet.json"), done = read("../tools/scored-review/reviews/2026-11-27-sonnet-applied.json");
  assert.equal(done.length, found.length); assert.ok(done.every(l => ["applied", "partly", "not applied", "no change needed"].includes(l.status) && l.note));
  // What can cost a learner points at N2 (parts A, C, D) is applied wherever the entry has a card.
  const open = done.filter(l => ["wrong", "unfair"].includes(l.severity) && ["A", "C", "D"].includes(l.part) && !["applied", "no change needed"].includes(l.status));
  assert.ok(open.length <= 5, open.map(l => l.id).join(", "));
});

test("the outside review of 27 Nov is applied: every finding has its line, and what could cost points at N2 is fixed", async () => {
  const {AFFIX_GLOSS, AFFIX_SHOWN, AFFIX_READING, LINK_WHY, LINK_NOT_WRONG} = await import("../n2-game-review.js");
  const found = read("../tools/scored-review/reviews/2026-11-27-outside.json"), done = read("../tools/scored-review/reviews/2026-11-27-outside-applied.json");
  assert.equal(done.length, found.length); assert.ok(done.every(l => ["applied", "partly", "not applied", "no change needed"].includes(l.status) && l.note));
  // In parts A to C every "wrong" and "unfair" finding is applied; in D only a change to a paper itself is left.
  const open = done.filter(l => ["wrong", "unfair"].includes(l.severity) && l.part !== "E" && l.status !== "applied");
  assert.deepEqual(open.map(l => l.id + " " + l.field), ["n2-set-2#71 answer", "n2-set-3#72 answer"], "these need a new edition of the paper");
  const cards = pool.filter(q => q.kind === "affix"), card = t => cards.find(q => q.prompt === t);
  assert.equal(card("前～").answer, "former; previous", "not 'late': the former president is still an adviser");
  assert.equal(card("～室").answer, "room for ~"); assert.equal(card("～年生").answer, "student in year ~; ~ grader"); assert.equal(card("～島").answer, "~ island");
  // The underline is the form the sentence writes; the reading is the one heard in compounds.
  for (const [t, shown] of Object.entries(AFFIX_SHOWN)) { assert.equal(card(t).needle, shown, t); assert.equal(card(t).sentence.split(shown).length, 2, t); }
  assert.equal(card("～済").needle, "済み"); assert.equal(card("～ぽい").needle, "っぽい"); assert.equal(card("我～").needle, "我が");
  assert.equal(card("～沿い").solution.reading, "～ぞい"); assert.equal(AFFIX_READING["～口"], "～ぐち");
  assert.ok(!card("～園").wrong.includes(card("～場").answer)); assert.ok(card("～過ぎる") && card("～続く"), "two parts gained a card");
  assert.ok(!card("防～").sentence.includes("泳"), "防水 alone does not mean fit for swimming");
  for (const m of Object.values(AFFIX_GLOSS)) assert.ok(m.length <= 40);
  // Connectives: no second fair answer on the card, and a line after the answer that does not overstate.
  const links = pool.filter(q => q.kind === "link"), link = w => links.find(q => q.id === "k:" + w);
  assert.ok(!link("もっとも").wrong.includes("of course")); assert.ok(!link("確かに").wrong.some(m => /admittedly/.test(m)));
  assert.equal(link("確かに").solution.why, LINK_WHY["確かに"]); assert.ok(!/will then turn/.test(link("確かに").solution.why)); assert.ok(!/must be true/.test(link("それなら").solution.why));
  assert.equal(Object.keys(LINK_WHY).length, 8); assert.equal(Object.keys(LINK_NOT_WRONG).length, 3);
  // Grammar: the glosses that contradicted their own example, and かねない no longer built from "could well" + "not".
  const g = read("../n2-grammar-blocks.json");
  assert.equal(g.blocks.wake.gloss, "reason; why"); assert.equal(g.blocks.ue.gloss, "top; above"); assert.equal(g.blocks.choudai.type, "noun");
  assert.deepEqual(g.blocks.tsuujiru.forms, ["通じる", "通じて"], "通して is 通す, another verb");
  assert.deepEqual(g.patterns["かねない"].parts.map(p => p.text), ["かねない"]); assert.equal(g.patterns["かねない"].transparency, "opaque");
  assert.equal(g.patterns["ないではいられない"].parts[1].gloss, "without (negative link)");
  // Deciding lines: the English says what the Japanese says.
  const keys = read("../n2-sets/keys.json").keys;
  assert.match(keys["n2-set-2#53"].en, /Thursday afternoon or Friday morning/); assert.ok(keys["n2-set-2#74"].lines.some(l => l.includes("番号")), "the line that names the number");
  assert.ok(keys["n2-set-2#101"].lines[0].includes("やさしいパソコン"), "the ordinal is tied to the course's name");
});

test("the word parts the list lacked are in it, each with a sentence and a card", async () => {
  const {AFFIX_CONFUSABLE} = await import("../n2-game-review.js");
  const added = inventory.words.slice(1748), deck = read("../decks/n2-words.json").sentences;
  assert.equal(added.length, 28); assert.equal(deck.length, inventory.words.length);
  assert.deepEqual(added.slice(0, 4).map(w => w[0]), ["不～", "無～", "～的", "～性"]);
  const cards = pool.filter(q => q.kind === "affix");
  assert.equal(cards.length, 190, "186, and four list entries under a clean label (～ごと, ～式, ～一, ～ほう)");
  for (const [i, [text, reading, meaning]] of added.entries()) {
    const s = deck[1748 + i], q = cards.find(c => c.target[1] === text && c.target[2] === reading);
    assert.equal(s.id, "n2-word-" + (1748 + i)); assert.ok(q, text + " has a card");
    assert.ok(/^[〜～]/.test(text) !== /[〜～]$/.test(text), text); assert.ok(meaning.length <= 40 && !/[ぁ-んァ-ヶ一-龯]/.test(meaning), text);
    assert.equal(q.sentence.split(q.needle).length, 2, text + ": written once in its sentence"); assert.equal(q.answer, meaning.split(";")[0].trim() === q.answer ? q.answer : q.answer);
    assert.ok(/【/.test(s.target) || !/[一-龯]/.test(s.target), text + ": the sentence carries its readings");
  }
  // ～中 has two readings and two cards; the near-twins are kept apart.
  assert.deepEqual(cards.filter(q => q.prompt === "～中").map(q => q.id).sort(), ["a:～中/～じゅう", "a:～中/～ちゅう"]);
  const answer = t => cards.find(q => q.prompt === t).answer, wrongOf = t => cards.find(q => q.prompt === t).wrong;
  for (const [a, b] of [["不～", "非～"], ["不～", "無～"], ["元～", "前～"], ["旧～", "元～"], ["全～", "総～"], ["～員", "～者"], ["～用", "～向き"], ["～め", "～気味"]]) {
    assert.ok(AFFIX_CONFUSABLE.some(g => g.includes(a) && g.includes(b)), a + " " + b); assert.ok(!wrongOf(a).includes(answer(b)), a + " against " + b);
  }
  
});

test("a sat paper's short questions are asked in the Sprint, not in a round (owner, 28 Nov)", async () => {
  // Kept in rounds on 27 Nov (the flags were about the brackets); moved to the Sprint with the other long cards on
  // 28 Nov: "I don't like having long exercises … in the rounds".
  const {sprintRound} = await import("../n2-game.js");
  const sat = gamePool({inventory, examples, sets: [set], sat: new Set([set.id])}), exams = sat.filter(q => q.kind === "exam");
  assert.ok(exams.length > 30);
  for (let n = 1; n <= 10; n++) assert.ok(!nextRound({pool: sat, state: {comeback: [exams[0].id]}, random: seeded(n)}).round.some(q => q.kind === "exam"));
  assert.ok([1, 2, 3, 4, 5, 6].some(n => sprintRound({pool: sat, random: seeded(n)}).some(q => q.kind === "exam")));
});

test("a paper's 【word】 mark is never shown raw: it is an underline, not a reading left in the text", () => {
  const js = src("../n2-mock.js");
  assert.ok(js.includes('else if (q.kind === "exam" && /【[^】]*】/.test(q.prompt)) prompt.replaceChildren(...q.prompt.split(/(【[^】]*】)/).filter(Boolean).map(part => /^【/.test(part) ? el("u", {class: "n2-mark", text: part.slice(1, -1)}) : part));'));
  // The cards concerned: every exam card whose question marks a word (問題1, 2, 5).
  const marked = pool.filter(q => q.kind === "exam" && /【[^】]*】/.test(q.prompt));
  assert.ok(marked.length >= 10); assert.ok(marked.some(q => q.id === "e:n2-set-2#20"), "the card that was flagged");
  // No other kind of card carries a bracket in what it shows.
  for (const q of pool.filter(q => q.kind !== "exam")) for (const f of [q.prompt, q.sentence, q.answer, ...(q.wrong || [])]) assert.ok(!/[【】]/.test(String(f || "")), q.id);
});

test("the mix follows the last boss: a section missed more takes more turns, within bounds", async () => {
  const {skillWeights, kindWeights, KIND_SKILL, SKILL_WEIGHT, pickRound} = await import("../n2-game.js");
  assert.deepEqual(SKILL_WEIGHT, {min: .5, max: 2});
  // A paper of four sections of ten; missed: 2 vocabulary, 4 grammar, 8 reading, 0 listening (mean miss rate .35).
  const paper = {questions: ["Vocabulary", "Grammar", "Reading", "Listening"].flatMap(skill => Array.from({length: 10}, () => ({skill, key: 1})))};
  const answers = [2, 4, 8, 0].flatMap(missed => Array.from({length: 10}, (_, i) => i < missed ? 2 : 1));
  const w = skillWeights({paper, attempt: {answers}});
  assert.deepEqual(w, {vocabulary: .57, grammar: 1.14, reading: 2, listening: .5}, "relative to the mean, clamped to .5 and 2");
  // The same from a paper as the device stores it (skills numbered), and nothing to steer by without a boss or after a perfect one.
  assert.deepEqual(skillWeights({paper: {questions: paper.questions.map(q => ({...q, skill: ["Vocabulary", "Grammar", "Reading", "Listening"].indexOf(q.skill)}))}, attempt: {answers}}), w);
  assert.equal(skillWeights({}), null); assert.equal(skillWeights({paper, attempt: {answers: answers.map(() => 1)}}), null); assert.equal(kindWeights(null), null);
  const k = kindWeights(w);
  assert.equal(k.listen, .5); assert.equal(k.grammar, 1.14); assert.equal(k.gap, 1.14); assert.equal(k.link, 2); assert.equal(k.meaning, .57); assert.equal(k.partgap, .57);
  for (const kind of new Set(pool.map(q => q.kind))) if (kind !== "exam") assert.ok(KIND_SKILL[kind], kind + " belongs to a section");
  // Over many rounds a weak listener hears more, a strong one less; with no weights the round is picked as before.
  // Listen cards are the ladder's third rung: here every word stands on it, so the weights alone decide.
  const atListen = Object.fromEntries(pool.filter(q => q.kind === "listen").map(q => [stepKey(q), 2]));
  const count = weights => { let n = 0; for (let s = 1; s <= 40; s++) n += pickRound({pool, random: seeded(s), weights, step: atListen}).filter(q => q.kind === "listen").length; return n; };
  const even = count(null);
  assert.ok(count({listen: 2}) > even && count({listen: .5}) < even, [count({listen: .5}), even, count({listen: 2})].join(" "));
  assert.deepEqual(pickRound({pool, random: seeded(4)}).map(q => q.id), pickRound({pool, random: seeded(4), weights: null}).map(q => q.id));
  assert.deepEqual(nextRound({pool, state: {}, random: seeded(4)}).round.map(q => q.id), nextRound({pool, state: {}, random: seeded(4), weights: Object.fromEntries(Object.keys(KIND_SKILL).map(x => [x, 1]))}).round.map(q => q.id), "weights of 1 change nothing");
  const js = src("../n2-mock.js");
  assert.ok(js.includes("const mixWeights = kindWeights(bossPaper ? skillWeights({paper: bossPaper, attempt: lastBoss}) : null);"));
  assert.ok(js.includes("weights: pool === n2Pool ? mixWeights : null,"));
});

test("grammar and word parts are also asked the exam's way: a gap in the sentence, the form to pick", async () => {
  const {GRAMMAR_CONFUSABLE, AFFIX_CONFUSABLE} = await import("../n2-game-review.js");
  const {SECONDS, choicesFor} = await import("../n2-game.js");
  const gaps = pool.filter(q => q.kind === "gap"), parts = pool.filter(q => q.kind === "partgap");
  assert.ok(gaps.length > 150 && parts.length > 150);
  assert.equal(SECONDS.gap, 8); assert.equal(SECONDS.partgap, 6); assert.equal(KIND_LABEL_OF.gap, "Grammar · fill the gap"); assert.equal(KIND_LABEL_OF.partgap, "Word part · fill the gap");
  for (const q of [...gaps, ...parts]) {
    assert.equal(q.sentence.split("（　）").length, 2, q.id + ": one gap");
    assert.ok(!q.sentence.includes(q.answer), q.id + ": the answer is not left in the sentence");
    assert.equal(q.sentence.replace("（　）", q.answer), q.solution.ja.replace(/【[^】]*】/g, ""), q.id + ": the gap holds exactly what the sentence writes");
    assert.ok(q.en && !/[ぁ-んァ-ヶ一-龯]/.test(q.en), q.id + ": the sentence's meaning is shown");
    assert.ok(q.wrong.length >= 3 && !q.wrong.some(w => w.includes(q.answer) || q.answer.includes(w)), q.id);
    assert.equal(new Set(choicesFor(q, seeded(3), .5).choices).size, 4, q.id);
    assert.ok(!q.practice && q.target, q.id);
  }
  // It is the same item as the meaning card: one of the two in a round, and a miss counts for the pattern or the part.
  const zaru = gaps.find(q => q.id === "f:ざるを得ない"), meaning = pool.find(q => q.id === "g:ざるを得ない");
  assert.deepEqual(zaru.target, meaning.target); assert.equal(zaru.answer, meaning.needle); assert.equal(zaru.dimension, "grammar");
  // A near-twin is never offered: not a confusable pattern, not a part of the same group.
  const needle = new Map(gaps.map(q => [q.id.slice(2), q.answer]));
  for (const [a, b] of GRAMMAR_CONFUSABLE) for (const [x, y] of [[a, b], [b, a]]) { const q = gaps.find(c => c.id === "f:" + x); if (q && needle.has(y)) assert.ok(!q.wrong.includes(needle.get(y)), x + " against " + y); }
  const partOf = new Map(parts.map(q => [q.prompt, q.answer]));
  for (const group of AFFIX_CONFUSABLE) for (const a of group) for (const q of parts.filter(c => c.prompt === a)) for (const b of group) if (b !== a && partOf.has(b) && partOf.get(b) !== q.answer) assert.ok(!q.wrong.includes(partOf.get(b)), a + " against " + b);
  const gimi = parts.find(q => q.id === "p:～気味");
  assert.equal(gimi.sentence, "昨日から少し風邪（　）だ。"); assert.equal(gimi.answer, "気味"); assert.equal(gimi.en, "I've had a slight cold since yesterday.");
  const js = src("../n2-mock.js");
  assert.ok(js.includes('const gapCard = q => q.kind === "gap" || q.kind === "partgap";'));
  assert.ok(js.includes('el("span", {class: "qr-en", lang: "en", text: q.en})'));
  assert.ok(js.includes('if (gapCard(q) && $("game-blank")) { $("game-blank").textContent = q.answer; $("game-blank").classList.add("filled"); }'));
});

test("all nineteen papers have their deciding lines: checked, solved blind, and only then used", () => {
  const ids = Object.keys(read("../n2-sets/index.json")), keys = read("../n2-sets/keys.json").keys;
  assert.equal(ids.length, 19);
  let withLines = 0, skipped = 0, unsolved = 0;
  for (const id of ids) {
    const draft = read("../tools/boss-keys/" + id + ".json"), paper = read("../n2-sets/" + id + ".json");
    const wanted = paper.questions.map((q, i) => ["Reading", "Listening"].includes(q.skill) ? i : -1).filter(i => i >= 0);
    assert.equal(wanted.length, 53, id); assert.deepEqual(Object.keys(draft).map(Number).sort((a, b) => a - b), wanted, id + ": an entry for every reading and listening question");
    for (const i of wanted) {
      const e = draft[i], key = keys[id + "#" + i];
      if (e.skip) { skipped++; assert.equal(key, undefined); continue; }
      for (const l of e.lines) assert.ok(paper.questions[i].context.includes(l), id + "#" + i + ": word for word from the paper");
      if (e.solved === true) { withLines++; assert.deepEqual(key, {lines: e.lines, en: e.en}, id + "#" + i); }
      else { unsolved++; assert.equal(key, undefined, id + "#" + i + ": not used, the blind reader could not settle it from the lines"); assert.ok(e.unsolved); }
    }
  }
  assert.equal(Object.keys(keys).length, withLines);
  assert.deepEqual([withLines, skipped, unsolved], [913, 32, 62], "set 9 #101 skipped after the outside review (28 Nov)");
  // What came back from the writer is kept as it came, findings included.
  for (let n = 4; n <= 20; n++) { const back = read("../tools/boss-keys/returned/n2-set-" + n + ".json"); assert.equal(back.set, "n2-set-" + n); assert.ok(Array.isArray(back.findings)); }
  const brief = src("../docs/N2-PAPERS-LINES-HANDOFF.md"), check = src("../tools/boss-keys/check-return.mjs");
  for (const s of ["character for character", "120 characters", "80 characters", "A blind solve", '"skip"', "findings"]) assert.ok(brief.includes(s), s);
  assert.ok(check.includes('import {checkKey} from "../n2-build-keys.mjs";') && check.includes("no `solved` mark"));
});

test("a round's review speaks every kind of card, and shows an exam card as the boss review does", async () => {
  const {answerSpeech} = await import("../n2-game.js");
  // What the voice is given, per kind: nothing is silent, and a part is said without its ～.
  for (const kind of ["reading", "meaning", "definition", "listen", "homophone", "grammar", "gap", "affix", "partgap", "link"]) {
    for (const q of pool.filter(c => c.kind === kind).slice(0, 40)) { const s = answerSpeech(q); assert.ok(s && !/[〜～]/.test(s), q.id + ": " + s); }
  }
  assert.equal(answerSpeech(pool.find(q => q.id === "f:限り")), "限り");
  assert.equal(answerSpeech(pool.find(q => q.id === "a:～気味")), "気味【ぎみ】"); assert.equal(answerSpeech(pool.find(q => q.id === "k:このように")), "このように");
  const js = src("../n2-mock.js");
  assert.ok(js.includes('const pattern = q.kind === "grammar" || q.kind === "gap" || grammarBlockCard(q) ? grammarVoice(q, sol) : null;'));
  assert.ok(js.includes('const voiced = q.kind === "kanji" ? "" : (["pair", "order"].includes(q.kind) ? q.answer : q.say) || (["affix", "partgap"].includes(q.kind) ? answerSpeech(q) : spoken || answerSpeech(q)) || "";'));
  // An exam card missed in a round: the word and its meaning large, the paper's sentence with its answer, the why.
  assert.ok(js.includes('const q = asked.kind === "exam" ? paperCardOf({target: asked.target, ask: asked.prompt, answer: asked.answer,'));
  assert.ok(js.includes('$("game-review-meaning").textContent = sol.meaning || "";'), "never the answer a second time");
  assert.ok(!js.includes('"Answer: " + q.answer'));
  const exam = gamePool({inventory, examples, sets: [set], sat: new Set([set.id])}).find(q => q.id === "e:n2-set-2#31");
  assert.deepEqual(exam.target, ["grammar", "以上2"]); assert.ok(pool.some(q => q.kind === "grammar" && q.target[1] === "以上2" && q.solution.meaning), "the pattern's meaning is at hand");
});

test("a connective built of plain pieces shows them; a word is met in its sentence, not bare", async () => {
  const {LINK_PARTS, LINK_SHOWN} = await import("../n2-game-review.js");
  const {SECONDS, partRows, heardGap} = await import("../n2-game.js");
  const links = pool.filter(q => q.kind === "link"), built = links.filter(q => q.parts);
  assert.equal(built.length, Object.keys(LINK_PARTS).length); assert.ok(built.length >= 15);
  for (const q of built) {
    assert.equal(q.parts.map(p => p.text).join(""), q.prompt, q.id + ": the pieces make the word as the card writes it");
    assert.ok(q.parts.every(p => p.gloss && p.gloss.length <= 40 && !/[ぁ-んァ-ヶ一-龯]/.test(p.gloss)), q.id);
    assert.ok(q.literal && !/[ぁ-んァ-ヶ一-龯]/.test(q.literal)); assert.equal(q.seconds, SECONDS.linkBuilt); assert.equal(partRows(q.parts).length, q.parts.length);
  }
  const nanoni = links.find(q => q.id === "k:それなのに"), nara = links.find(q => q.id === "k:それなら");
  assert.deepEqual(nanoni.parts.map(p => p.text), ["それ", "な", "のに"]); assert.equal(nanoni.literal, "even though that is so");
  assert.deepEqual(nara.parts.map(p => p.text), ["それ", "なら"]); assert.equal(nara.literal, "if that is so");
  assert.equal(links.find(q => q.id === "k:にもかかわらず").prompt, LINK_SHOWN["にもかかわらず"]);
  assert.ok(!links.find(q => q.id === "k:しかし").parts, "a connective that is one piece stays as it was");
  const js = src("../n2-mock.js");
  assert.ok(js.includes('parts.hidden = !(q.kind === "build" || (q.kind === "link" && q.parts?.length));'));
  assert.ok(js.includes('if (q.kind === "link" && q.literal) { line.replaceChildren(el("small", {text: "piece by piece"}), q.literal);'));
  assert.ok(js.includes('if (q.kind === "link" && q.parts) { $("game-review-parts").hidden = false;'));
  // Meaning cards: the deck sentence with the word underlined, in the form the sentence writes it.
  const meaning = pool.filter(q => q.kind === "meaning");
  assert.ok(meaning.every(q => q.sentence && q.sentence.includes(q.needle)), "every N2 meaning card shows its sentence");
  const kagiri = meaning.find(q => q.id === "m:限り"), kuzusu = meaning.find(q => q.id === "m:崩す");
  assert.equal(kagiri.sentence, "できる限りのことはするつもりです。"); assert.equal(kagiri.needle, "限り"); assert.equal(kagiri.seconds, SECONDS.meaningInSentence);
  assert.equal(kuzusu.needle, heardGap(kuzusu.solution.ja, "崩す")); assert.ok(kuzusu.sentence.includes("崩して"));
  assert.deepEqual([SECONDS.meaning, SECONDS.meaningInSentence, SECONDS.link, SECONDS.linkBuilt], [3, 4, 3, 5]);
  // Another level has no deck sentences: its meaning cards stay a bare word.
  assert.ok(gamePool({inventory: {words: [["犬", "いぬ", "dog"], ["猫", "ねこ", "cat"], ["鳥", "とり", "bird"], ["魚", "さかな", "fish"], ["馬", "うま", "horse"]], grammar: []}, level: "N5"}).filter(q => q.kind === "meaning").every(q => q.sentence === ""));
});

test("words and patterns made of pieces carry them, and the pieces join up to the word", async () => {
  const {WORD_PIECES, LINK_PARTS, LINK_SHOWN} = await import("../n2-game-review.js");
  const {pieceKey} = await import("../n2-game.js");
  const blocks = read("../n2-grammar-blocks.json"), full = gamePool({inventory, examples, grammarBlocks: blocks});
  assert.ok(Object.keys(WORD_PIECES).length >= 30 && Object.keys(LINK_PARTS).length >= 24, "after the audit retired ten that were one piece");
  for (const gone of ["いきなり", "みっともない", "くだらない", "ともかく", "なにしろ"]) assert.ok(!WORD_PIECES[gone], gone + ": the audit found its pieces taught no rule a learner could reuse");
  for (const [word, p] of Object.entries(WORD_PIECES)) {
    assert.equal(p.parts.map(x => x[0]).join(""), word, word + ": the pieces make the word");
    assert.ok(p.parts.length >= 2 && p.parts.every(([t, g]) => t && g && g.length <= 40 && !/[ぁ-んァ-ヶ一-龯]/.test(g)), word);
    assert.ok(p.literal && p.literal.length <= 60 && !/[ぁ-んァ-ヶ一-龯]/.test(p.literal), word);
    assert.ok(full.some(q => q.pieces && pieceKey(q.solution.word) === word), word + " is on a card");
  }
  for (const [word, p] of Object.entries(LINK_PARTS)) assert.equal(p.parts.map(x => x[0]).join(""), LINK_SHOWN[word] || word, word);
  assert.equal(pieceKey("以上 ②"), "以上"); assert.equal(pieceKey("～ざる"), "ざる");
  // Never on a card that already shows parts, and never on the card itself: after the answer and in the review.
  for (const q of full) if (q.pieces) { assert.ok(!q.parts, q.id); assert.ok(["grammar", "gap", "block", "meaning", "definition", "listen"].includes(q.kind), q.id); }
  const yamu = full.find(q => q.id === "m:やむをえない");
  assert.deepEqual(yamu.pieces.parts.map(p => p.text), ["やむ", "を", "えない"]); assert.equal(yamu.pieces.literal, "there's no stopping it: unavoidable");
  assert.ok(full.find(q => q.id === "g:以来").pieces && full.find(q => q.id === "f:以来").pieces);
  const js = src("../n2-mock.js");
  assert.ok(js.includes('if (q.pieces) { line.replaceChildren(el("small", {text: "piece by piece"}), q.pieces.literal);'));
  assert.ok(js.includes('if (q.pieces) { $("game-review-parts").hidden = false; $("game-review-partlist").replaceChildren(...partList(q.pieces.parts));'));
  // The auditor's data lists every dissection and everything still asked whole.
  const data = read("../tools/scored-review/pieces-data.json");
  assert.equal(data.dissected.length, data.counts.dissected); assert.ok(data.whole.length > 1500);
  assert.ok(data.dissected.some(d => d.word === "それなのに") && !data.whole.some(w => w.word === "やむをえない"));
  for (const s of ["texts joined must equal the", "folk etymology", "pieces-audit.json"]) assert.ok(src("../docs/PIECES-AUDIT-HANDOFF.md").includes(s), s);
});
