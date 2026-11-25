import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runClock, RUN_CLOCK, DIFFICULTY, difficultyOf, pace, WAVE, HOOK, STRETCH, bossProgress, takeBoss, resting, runTable, BOSS_EVERY, EXAM_POINT, atBedtime, BEDTIME, FLOW, BONUS, flowStep, flowMix, flowSeconds, levelOf, bonusPoints, SECONDS, PAUSE, REVIEW_SECONDS, inSlump, nextRound, WARM_UP, gamePool, choicesFor, pickRound, scoreAnswer, recallsMiss, rememberAnswer, rememberRound, nearMisses, gloss, today, lastDays, ranking, bossSet,
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
  assert.match(mock, /state = rememberAnswer\(readGame\(\), \{q, outcome, points: paid\.points, fast: result\.fast, difficulty: difficulty\(\)\}\); writeGame\(state\);/);
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

test("the zone: the hidden level settles where the player is right about 80% of the time", () => {
  // Simulate a player who is right with probability p at every level: the
  // staircase climbs while p > 0.8 and falls while p < 0.8.
  const run = p => { let level = FLOW.start, r = seeded(11); for (let i = 0; i < 400; i++) level = flowStep(level, r() < p); return level; };
  assert.ok(run(.95) > .9, "too easy: it climbs to the top");
  assert.ok(run(.5) < .1, "too hard: it falls to the bottom");
  assert.equal(flowStep(.5, true), .52); assert.equal(flowStep(.5, false), .42);
  assert.ok(.8 * FLOW.up - .2 * FLOW.down === 0 || Math.abs(.8 * FLOW.up - .2 * FLOW.down) < 1e-12, "balanced at 80% right");
  assert.equal(levelOf({}), FLOW.start);
});

test("the level changes the mix, the clock and how close the wrong choices are", () => {
  assert.deepEqual(flowMix(0), {weak: 1, fresh: 2, known: 7}, "easy: mostly things known");
  assert.deepEqual(flowMix(1), {weak: 5, fresh: 5, known: 0}, "hard: weak and new");
  assert.equal(flowSeconds(3, 0), 4, "easy: more time"); assert.equal(flowSeconds(3, 1), 2.5, "hard: less");
  assert.equal(flowSeconds(2, 1), 2, "never under 2 s");
  const pool = gamePool({inventory, examples, sets, sat: new Set()});
  const q = pool.find(x => x.kind === "meaning" && x.nearCount === 3);
  const near = new Set(q.wrong.slice(0, 3));
  const nearIn = level => choicesFor(q, seeded(4), level).choices.filter(c => near.has(c)).length;
  assert.equal(nearIn(0), 0, "easy: no confusable choices forced in"); assert.equal(nearIn(1), 3, "hard: all three");
});

test("surprise: bonus questions pay three times, never cost more, and combos of 5 and 10 pay a jackpot", () => {
  assert.deepEqual(bonusPoints({points: 200, bonus: true, streak: 2}), {points: 600, jackpot: 0});
  assert.deepEqual(bonusPoints({points: -200, bonus: true, streak: 0}), {points: -200, jackpot: 0}, "no extra penalty");
  assert.deepEqual(bonusPoints({points: 200, streak: 5}), {points: 700, jackpot: 500});
  assert.deepEqual(bonusPoints({points: 200, streak: 10}), {points: 1700, jackpot: 1500});
  const pool = gamePool({inventory, examples, sets, sat: new Set()});
  let bonuses = 0, n = 0; const r = seeded(21);
  for (let i = 0; i < 60; i++) { const {round} = nextRound({pool, state: {}, random: r}); n += round.length; bonuses += round.filter(x => x.bonus).length; }
  assert.ok(Math.abs(bonuses / n - BONUS.chance) < .05, "about one in eight");
});

test("bedtime: from the learner's hour until 5 am the round's end points to sleep, one more round a tap away", () => {
  const at = (h, m = 0) => new Date(2026, 10, 26, h, m);
  assert.equal(BEDTIME, "23:30");
  assert.equal(atBedtime(at(23, 29)), false); assert.equal(atBedtime(at(23, 30)), true);
  assert.equal(atBedtime(at(2)), true, "after midnight too"); assert.equal(atBedtime(at(5)), false, "morning is play time");
  assert.equal(atBedtime(at(22, 15), "22:00"), true, "the learner's own hour");
  assert.equal(atBedtime(at(22, 15), "nonsense"), false, "a bad value falls back to 23:30");
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html"), index = src("../index.html");
  assert.match(mock, /const late = atBedtime\(new Date\(\), settings\.gameBedtime\);/);
  assert.match(mock, /\$\("game-again"\)\.textContent = late \? "One more round" : "Next round";/);
  assert.match(mock, /\$\("game-sleep"\)\.href = left \? "\?view=evening" : "\.\/radio";/);
  assert.match(html, /id="game-sleep" href="\?view=evening" hidden>Evening recall, then sleep<\/a>/);
  assert.match(index, /id="settings-game-bedtime" type="time" value="23:30"/);
});

test("the boss comes every 1,000 questions, closes a run, and after it the game says rest", () => {
  let st = {answered: 999, total: 250000};
  assert.deepEqual(bossProgress(st), {done: 999, left: 1, open: false});
  st = {...st, answered: 1000};
  assert.equal(bossProgress(st).open, true);
  const now = new Date("2026-11-27T20:00:00");
  st = takeBoss(st, {set: "n2-set-6", now: now.getTime()});
  assert.deepEqual(bossProgress(st), {done: 0, left: 1000, open: false}, "the count starts again");
  assert.deepEqual(st.runs.at(-1), {set: "n2-set-6", at: now.toISOString(), start: now.toISOString(), gamePoints: 250000, questions: 1000});
  const finished = [{book: "n2-set-6", boss: true, phase: "results", startedAt: now.toISOString(), completedAt: new Date(now.getTime() + 5400000).toISOString()}];
  assert.equal(resting(st, finished, new Date("2026-11-27T22:00:00")), true);
  assert.equal(resting(st, [], new Date("2026-11-27T22:00:00")), false, "not before the boss is finished");
  assert.equal(resting(st, finished, new Date("2026-11-28T09:00:00")), false, "a new day, a new fight");
  const table = runTable({...st, runs: [...st.runs, {set: "n2-set-7", at: "2026-11-28T20:00:00.000Z", gamePoints: 300000, questions: 1000}]},
    r => r.set === "n2-set-6" ? {total: 120, sections: []} : null);
  assert.equal(table[0].set, "n2-set-6", "merged: 250,000 + 120 × 1,000 beats 300,000 with no exam yet");
  assert.equal(table[0].total, (250000 + 120 * EXAM_POINT) * 1.5, "and the run bonus: the boss fell inside the 24 h");
  assert.equal(table[0].gamePoints, 250000); assert.equal(table[0].examPoints, 120000, "both parts kept");
});

test("the boss is the real paper at half the time and never counts as a standard sitting", () => {
  const mock = src("../n2-mock.js"), study = src("../n2-study.js");
  assert.match(mock, /if \(state\.phase === "ready" && params\.get\("boss"\) === "1" && realistic\(year\)\) state\.boss = true;/);
  assert.match(mock, /const half = m => state\.boss \? Math\.ceil\(m \/ 2\) : m;/);
  assert.match(mock, /const minutes = phase => half\(/);
  assert.match(mock, /location\.href = "\?book=" \+ boss\.id \+ "&boss=1";/);
  assert.match(study, /eligibleBooks\.includes\(a\.book\) && !a\.boss && !first\.has\(a\.book\)/, "not checkpoint evidence");
  assert.match(study, /a\.phase === "results" && !a\.boss && papers\.get/, "not on the readiness chart");
});

test("pacing: a hook after time away, waves of tension and release, and a final stretch before the boss", () => {
  const now = Date.parse("2026-11-27T20:00:00Z");
  assert.equal(pace({}, now).name, "hook", "first ever round");
  assert.equal(pace({seen: {a: now - HOOK.awayMs - 1}, answered: 30}, now).name, "hook", "back after a break");
  const at = done => pace({seen: {a: now - 1000}, answered: done}, now).name;
  assert.deepEqual([0, 10, 20, 30, 40, 50].map(at), ["breather", "easy", "steady", "hard", "peak", "breather"]);
  assert.equal(at(960), "stretch");
  assert.ok(WAVE.at(-1).bonus === 2 && STRETCH.bonus === 2, "peaks pay more surprises");
  assert.ok(WAVE[0].offset < 0 && WAVE.at(-1).offset > 0, "release, then tension");
});

test("the run clock: beat the boss within 24 h for ×1.5, within 48 h for ×1.2, and the clock starts on the run's first answer", () => {
  const start = "2026-11-27T08:00:00.000Z", h = n => Date.parse(start) + n * 3600_000;
  assert.equal(runClock(null).started, false);
  assert.deepEqual([runClock(start, h(3)).times, runClock(start, h(30)).times, runClock(start, h(50)).times], [1.5, 1.2, 1]);
  assert.equal(runClock(start, h(20)).leftMs, 4 * 3600_000);
  let st = rememberAnswer({}, {q: {id: "m:a"}, outcome: "right", points: 300, now: Date.parse(start)});
  assert.equal(st.runStart, start, "first answer starts it");
  st = rememberAnswer(st, {q: {id: "m:b"}, outcome: "right", points: 300, now: h(2)});
  assert.equal(st.runStart, start, "later answers keep it");
  st = takeBoss({...st, answered: 1000, total: 200000}, {set: "n2-set-8", now: h(10)});
  assert.equal(st.runStart, null, "taking the boss closes the clock; the next answer starts a new run");
  assert.equal(st.runs.at(-1).start, start);
  const [run] = runTable(st, () => ({total: 100, sections: [], completedAt: new Date(h(12)).toISOString()}));
  assert.equal(run.times, 1.5); assert.equal(run.total, Math.round((200000 + 100000) * 1.5));
  const [late] = runTable(st, () => ({total: 100, sections: [], completedAt: new Date(h(60)).toISOString()}));
  assert.equal(late.times, 1, "too late for a bonus");
  assert.ok(RUN_CLOCK[0].times > RUN_CLOCK[1].times);
});

test("difficulty: Normal is the 80% zone, Easy aims higher and pays less, Hard aims lower and pays more", () => {
  const settle = d => { const c = DIFFICULTY[d]; return c.down / (c.up + c.down); };
  assert.ok(Math.abs(settle("normal") - .8) < 1e-9);
  assert.ok(Math.abs(settle("easy") - .9) < 1e-9);
  assert.ok(Math.abs(settle("hard") - .65) < 1e-9);
  assert.ok(DIFFICULTY.easy.offset < 0 && DIFFICULTY.hard.offset > 0);
  assert.deepEqual([DIFFICULTY.easy.points, DIFFICULTY.normal.points, DIFFICULTY.hard.points], [.75, 1, 1.25]);
  assert.equal(difficultyOf("silly"), "normal");
  assert.equal(flowStep(.5, true, "hard"), .535); assert.equal(flowStep(.5, false, "easy"), .41);
  const index = src("../index.html"), mock = src("../n2-mock.js");
  assert.match(index, /id="settings-game-difficulty"><option value="easy">/);
  assert.match(mock, /if \(paid\.points > 0\) paid\.points = Math\.round\(paid\.points \* DIFFICULTY\[difficulty\(\)\]\.points\);/);
});
