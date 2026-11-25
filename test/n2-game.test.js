import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SECONDS, PAUSE, REVIEW_SECONDS, inSlump, nextRound, WARM_UP, gamePool, choicesFor, pickRound, scoreAnswer, recallsMiss, rememberAnswer, rememberRound, nearMisses, gloss, today, lastDays, ranking, bossSet,
  ROUND_SIZE, DAILY_GOAL} from "../n2-game.js";
import {examplesFromDecks} from "../day-radio.js";
import {HELD_OUT} from "../n2-comprehension.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
const inventory = read("../n2-inventory.json");
const examples = examplesFromDecks(inventory, [read("../decks/n2-words.json"), read("../decks/n2-grammar.json")]);
const ids = Object.keys(read("../n2-sets/index.json"));
const sets = ids.map(id => read("../n2-sets/" + id + ".json"));
const seeded = (n = 1) => () => { n = (n * 16807) % 2147483647; return n / 2147483647; };

test("reading traps are the 問題1 ones: voicing, vowel length, small っ", () => {
  assert.ok(nearMisses("せんぞ").includes("せんそ"));
  assert.ok(nearMisses("せんぞ").includes("ぜんぞ"));
  assert.ok(nearMisses("しゅうにん").includes("しゅにん"));
  assert.ok(nearMisses("がっこう").includes("がくこう"));
  assert.ok(nearMisses("いっさい").includes("いちさい"));
  for (const r of ["せんぞ", "けいこうとう", "すきとおる", "がっこう"]) assert.ok(!nearMisses(r).includes(r) && nearMisses(r).every(m => !/うう|っっ|^っ|っ$/.test(m)), r);
});

test("definitions never give the answer away in Japanese", () => {
  assert.equal(gloss("relative(s) (same as 親戚 (しんせき))"), "relative(s)");
  assert.equal(gloss("to cool oneself, to cool off, to enjoy"), "to cool oneself, to cool off");
});

test("the pool mixes every kind, exam questions only from sets already sat and never the held-out ones", () => {
  const sat = new Set(["n2-set-5", ...HELD_OUT]);
  const pool = gamePool({inventory, examples, sets, sat});
  const kinds = new Set(pool.map(q => q.kind));
  for (const k of ["reading", "meaning", "definition", "listen", "homophone", "grammar", "exam"]) assert.ok(kinds.has(k), k);
  const exams = pool.filter(q => q.kind === "exam");
  assert.ok(exams.length > 30 && exams.every(q => q.id.startsWith("e:n2-set-5#")), "only the sat set, none held out");
  assert.equal(gamePool({inventory, examples, sets}).filter(q => q.kind === "exam").length, 0, "nothing sat, no exam questions");
  assert.ok(pool.length > 5000, "enough to almost never repeat");
  for (const q of pool.filter(q => q.kind !== "exam").slice(0, 400)) {
    const {choices, key} = choicesFor(q, seeded(7));
    assert.equal(choices.length, 4, q.id); assert.equal(new Set(choices).size, 4, q.id);
    assert.equal(choices[key], q.answer, q.id);
    assert.ok(!/[〜～]/.test(q.kind === "definition" ? choices.join("") : ""), "no affixes as words");
  }
  const reading = pool.find(q => q.id === "r:先祖") || pool.find(q => q.kind === "reading");
  assert.ok(!reading.sentence.includes("【"), "the question sentence carries no furigana to give the reading away");
});

test("a round is ten, mixes the kinds, opens with last round's misses and skips what was seen in the last hours", () => {
  const pool = gamePool({inventory, examples, sets, sat: new Set(["n2-set-5"])});
  const round = pickRound({pool, random: seeded(3)});
  assert.equal(round.length, ROUND_SIZE);
  assert.ok(new Set(round.map(q => q.kind)).size >= 5, "mixed");
  for (let i = 1; i < round.length; i++) assert.notEqual(round[i].kind, round[i - 1].kind, "no two of a kind in a row");
  const missed = round.slice(0, 3).map(q => q.id);
  const next = pickRound({pool, random: seeded(9), comeback: missed, seen: Object.fromEntries(round.map(q => [q.id, Date.now()]))});
  assert.deepEqual(next.slice(0, 3).map(q => q.id).sort(), [...missed].sort(), "the misses come back first");
  assert.ok(next.slice(0, 3).every(q => q.comeback));
  assert.ok(next.slice(3).every(q => !round.some(r => r.id === q.id)), "the rest is new");
});

test("points reward speed hard, punish mistakes hard, and a blind guess always loses", () => {
  assert.deepEqual(scoreAnswer({outcome: "right", ms: 0, seconds: 10, streak: 0}), {points: 300, streak: 1, fast: true});
  assert.equal(scoreAnswer({outcome: "right", ms: 10000, seconds: 10, streak: 0}).points, 50, "right but at the buzzer");
  assert.equal(scoreAnswer({outcome: "right", ms: 0, seconds: 10, streak: 10}).points, 600, "fast with a full combo");
  assert.equal(scoreAnswer({outcome: "wrong", streak: 5}).points, -200);
  assert.deepEqual(scoreAnswer({outcome: "dontknow", streak: 5}), {points: 0, streak: 0, fast: false});
  // A blind guess among four, even instant: ¼ × 300 − ¾ × 200 < 0.
  assert.ok(.25 * 300 + .75 * -200 < 0);
  assert.equal(recallsMiss({target: ["word", "a", "b"]}, "right"), false, "picking right is not recalling");
  assert.equal(recallsMiss({target: ["word", "a", "b"]}, "timeout"), true);
});

test("the day counts toward 1,000, the ranking and chart follow, and the boss opens on a set not sat yet", () => {
  const now = new Date("2026-11-26T12:00:00");
  let state = {};
  const q = {id: "m:x"};
  state = rememberAnswer(state, {q, outcome: "wrong", points: -50, now: now.getTime()});
  assert.deepEqual(state.comeback, ["m:x"]);
  state = rememberAnswer(state, {q: {id: "m:x", comeback: true}, outcome: "timeout", points: 0, now: now.getTime()});
  assert.deepEqual(state.comeback, ["m:x"], "missed again, back again");
  state = rememberAnswer(state, {q: {id: "m:y"}, outcome: "right", points: 150, now: now.getTime()});
  state = rememberAnswer(state, {q: {id: "m:x", comeback: true}, outcome: "right", points: 100, now: now.getTime()});
  assert.deepEqual(state.comeback, [], "proved");
  state = rememberRound(state, {score: 400, questions: Array(10).fill(q), misses: 1, now: now.getTime()});
  state = rememberRound(state, {score: 900, questions: Array(10).fill(q), misses: 0, now: now.getTime()});
  assert.equal(today(state, now).answered, 4); assert.equal(today(state, now).left, DAILY_GOAL - 4);
  assert.equal(lastDays(state, 14, now).at(-1).answered, 4); assert.equal(lastDays(state, 14, now).length, 14);
  const rank = ranking(state);
  assert.deepEqual(rank.top.map(r => r.score), [900, 400]); assert.equal(rank.place, 1);
  const boss = bossSet({sets: ["n2-set-2", "n2-set-3", ...HELD_OUT], attempts: [{book: "n2-set-2", startedAt: "2026-11-20T00:00:00Z"}], now});
  assert.equal(boss.id, "n2-set-3"); assert.equal(boss.fresh, true);
  assert.equal(bossSet({sets: ["n2-set-2", ...HELD_OUT], attempts: [{book: "n2-set-2", startedAt: "x"}], now}).id, HELD_OUT[0], "held-out sets come last");
});

test("the game is a view of the N2 page, saved per answer, linked from the hub and the home screen", () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html"), sw = src("../sw.js"), manifest = read("../manifest.webmanifest");
  assert.match(mock, /view === "game" \? game :/);
  assert.match(mock, /state = rememberAnswer\(readGame\(\), \{q, outcome, points: result\.points, fast: result\.fast\}\); writeGame\(state\);/);
  assert.match(mock, /"missed", new Date\(\), \{source: GAME_SOURCE/);
  assert.match(html, /href="\?view=game"><span class="library-tool-glyph" lang="ja" aria-hidden="true">速<\/span>/);
  assert.match(html, /id="game-skip" type="button">I don’t know<\/button>/);
  assert.ok(manifest.shortcuts.some(s => s.url === "./n2-mock.html?view=game"));
  assert.match(sw, /"\.\/n2-game\.js"/);
  assert.doesNotMatch(src("../n2-game.js"), /localStorage|document\.|indexedDB/, "pure");
});

test("Settings can open Echo straight on Quick round, once per launch, so Back still reaches Echo", () => {
  const index = src("../index.html"), app = src("../app.js"), mock = src("../n2-mock.html");
  assert.match(index, /id="settings-start-game" type="checkbox"/);
  assert.match(app, /settings\.startGame=\$\("#settings-start-game"\)\.checked;/);
  assert.match(app, /"autotag","settings-start-game"/, "commits on change like every preference");
  assert.match(index, /if\(s\.startGame&&\/\^\\\/\(index\\\.html\)\?\$\/\.test\(location\.pathname\)&&!location\.search&&!location\.hash&&!sessionStorage\.getItem\("echo-launched"\)\)/);
  assert.match(mock, /sessionStorage\.setItem\("echo-launched","1"\)/, "a launch into the game counts too");
});

test("a flag stops the clock, names the question as shown, and in the review names the miss on screen", () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html");
  assert.match(html, /id="game-flag" type="button" aria-label="Flag this question"/);
  assert.match(html, /id="game-review-flag" type="button" aria-label="Flag this answer"/);
  assert.match(mock, /const resume = reportPause\?\.\(\) \|\| null;\n  try \{ await reportSheet\(\); \} finally \{ resume\?\.\(\); \}/, "every report, head or card, pauses a timed screen");
  assert.match(mock, /extra: \{view: "game", kind: q\.kind, mondai: q\.mondai \|\| null, target: q\.target \|\| null, sentence: q\.sentence \|\| "", choices: q\.choices \|\| \[\], answer: q\.answer, picked: picked \?\? null,/);
  assert.match(mock, /if \(!\$\("game-review"\)\.hidden && misses\[reviewAt\]\) return cardOf\(misses\[reviewAt\]\.q, misses\[reviewAt\]\.picked\);/);
});

test("the two rules are on the round's end, and a miss says keep going", () => {
  assert.match(src("../n2-mock.html"), /<span>Two rules<\/span>Say it out loud as you read\. Mistakes are part of the game: just keep going\./);
  assert.match(src("../n2-mock.js"), /"Part of the game\. Keep going\."/);
});

test("the game's flag is one tap: it saves the question as shown and moves on, with no sheet", () => {
  const mock = src("../n2-mock.js");
  const flag = mock.slice(mock.indexOf('$("game-flag").onclick'), mock.indexOf('$("game-review-flag").onclick'));
  assert.doesNotMatch(flag, /openReport/, "no questions asked");
  assert.match(flag, /quickFlag\(cardOf\(q\)\);/);
  assert.match(flag, /timer = setTimeout\(\(\) => \{ index\+\+; ask\(\); \}, PAUSE\.right\);/, "and the next question comes at once");
  assert.match(mock, /kind: "card", reasons: \[\], note: "Flagged in Quick round with one tap; the reason is for the audit to find\."/);
});

test("the audit pack is in step with the game: rebuild it with node tools/build-game-audit.mjs", () => {
  const playable = new Set(ids.filter(id => !HELD_OUT.includes(id)));
  const pool = gamePool({inventory, examples, sets, sat: playable});
  const summary = src("../audit/quick-round/SUMMARY.md");
  assert.match(summary, new RegExp("\\*\\*" + pool.length.toLocaleString("en") + "\\*\\*"), "SUMMARY.md counts what the game builds");
  for (const kind of new Set(pool.map(q => q.kind))) {
    const lines = src("../audit/quick-round/questions/" + kind + ".jsonl").trim().split("\n").length;
    assert.equal(lines, pool.filter(q => q.kind === kind).length, kind);
  }
  for (const f of ["README.md", "CONCEPT.md", "RULES.md"]) assert.ok(src("../audit/quick-round/" + f).length > 500, f);
  assert.match(src("../audit/quick-round/RULES.md"), /\*\*Wrong\*\*: −200\./, "the rules say what POINTS says");
});

test("blitz, not shogi: a few seconds a question and almost no pause between them", () => {
  for (const [kind, sec] of Object.entries(SECONDS)) for (const v of typeof sec === "object" ? Object.values(sec) : [sec]) assert.ok(v <= 8, kind);
  assert.ok(SECONDS.reading <= 3 && SECONDS.meaning <= 3);
  assert.ok(PAUSE.right <= 300 && PAUSE.miss <= 1000 && REVIEW_SECONDS <= 5);
});

test("after a bad round, the next is a warm-up of things the player wins at, with only two misses back", () => {
  const pool = gamePool({inventory, examples, sets, sat: new Set(["n2-set-5"])});
  const won = pool.filter(q => q.kind !== "exam").slice(0, 40);
  const wins = Object.fromEntries(won.map(q => [q.id, 2]));
  const distinct = [...new Map(pool.slice(500).map(q => [JSON.stringify(q.target), q])).values()];
  const missed = distinct.slice(0, 8).map(q => q.id);
  const bad = {history: [{at: "2026-11-26T10:00:00Z", score: -400, right: 2, n: 10}], wins, comeback: missed};
  assert.equal(inSlump(bad), true);
  assert.equal(inSlump({history: [{score: 900, right: 7, n: 10}]}), false, "one good round ends it");
  assert.equal(inSlump({}), false);
  const {round, warmUp} = nextRound({pool, state: bad, random: seeded(5)});
  assert.equal(warmUp, true);
  assert.equal(round.filter(q => q.comeback).length, WARM_UP.comeback, "two misses, not eight");
  assert.ok(round.filter(q => wins[q.id]).length >= 6, "mostly questions already won");
  const normal = nextRound({pool, state: {...bad, history: [{score: 900, right: 8, n: 10}]}, random: seeded(5)});
  assert.equal(normal.warmUp, false);
  assert.equal(normal.round.filter(q => q.comeback).length, missed.length, "all misses back in a normal round");
  let st = rememberAnswer({}, {q: {id: "m:a"}, outcome: "right", points: 300, fast: true});
  assert.equal(st.wins["m:a"], 1, "a fast right answer is a win");
  st = rememberAnswer(st, {q: {id: "m:a"}, outcome: "right", points: 60, fast: false});
  assert.equal(st.wins["m:a"], 1, "a slow one is not");
});
