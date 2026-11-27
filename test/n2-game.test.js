import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {payoutCap, sameSense, answerSpeech, runClock, RUN_CLOCK, DIFFICULTY, difficultyOf, pace, WAVE, HOOK, STRETCH, bossProgress, takeBoss, resting, runTable, BOSS_EVERY, EXAM_POINT, atBedtime, BEDTIME, FLOW, BONUS, flowStep, flowMix, flowSeconds, levelOf, bonusPoints, SECONDS, PAUSE, REVIEW_SECONDS, inSlump, nextRound, WARM_UP, gamePool, choicesFor, pickRound, scoreAnswer, recallsMiss, rememberAnswer, rememberRound, nearMisses, gloss, today, lastDays, ranking, bossSet,
  ROUND_SIZE, DAILY_GOAL, RANKS, DEFAULT_RANK, REVIEW_SHARE, rankOf, setRank, rankLevels, hasBoss, levelOfCard,
  itemRecord, itemLevel, ITEM_LEVEL, levelCoverage, KNOWN_LEVEL, COVERED, isCovered, aheadLevel, EXAM_PASS, RANK_RULES, bossVerdict, applyBoss, verdictLine,
  heardGap, piecesNeedle, KANJI_KNOWN, KANJI_MIX, newWord, kanjiAfter, kanjiStates, kanjiCoverage, kanjiPick} from "../n2-game.js";
const ITEM_GAP = ITEM_LEVEL.gapMs;
import {FETCHED_LEVELS, levelFile} from "../jlpt-levels.js";
import {REVIEWED_LEVELS} from "../n2-game-review.js";
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
  assert.equal(scoreAnswer({outcome: "right", ms: 0, seconds: 10, streak: 10}).points, 600, "fast with a full combo, before the cap");
  assert.equal(scoreAnswer({outcome: "wrong", streak: 0}).points, -200);
  assert.equal(scoreAnswer({outcome: "wrong", streak: 5}).points, -300, "a broken streak of 5 costs ×1.5");
  assert.equal(scoreAnswer({outcome: "wrong", streak: 14}).points, -400, "up to ×2");
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
  assert.match(html, /id="game-skip" type="button">I don’t know<\/button>/, "I don’t know, a real move; no \"· 0\" beside it (owner, 27 Nov: confusing)");
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

test("a miss says keep going (the boards' line), and each card carries its say-it-out-loud reminder", () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html");
  assert.match(mock, /"Part of the game\. Keep going\."/);
  assert.match(html, /<p class="qr-say" id="game-aloud"><b lang="ja" aria-hidden="true">声<\/b>/);
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
  assert.match(src("../audit/quick-round/RULES.md"), /\*\*Wrong\*\*: −200, times the same step for the streak it breaks/, "the rules say what POINTS says");
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
  const q = pool.find(x => x.kind === "meaning" && x.near.length >= 3 && x.wrong.length - x.near.length >= 3);
  const near = new Set(q.near);
  const nearIn = level => choicesFor(q, seeded(4), level).choices.filter(c => near.has(c)).length;
  assert.equal(nearIn(0), 0, "easy: no confusable choices forced in"); assert.equal(nearIn(1), 3, "hard: all three");
});

test("surprise: bonus questions pay three times, never cost more, and combos of 5 and 10 pay a jackpot", () => {
  assert.deepEqual(bonusPoints({points: 150, bonus: true, streak: 2}), {points: 450, jackpot: 0, capped: false}); assert.deepEqual(bonusPoints({points: 200, bonus: true, streak: 2}), {points: 550, jackpot: 0, capped: true}, "a bonus is capped at 550 too");
  assert.deepEqual(bonusPoints({points: -200, bonus: true, streak: 0}), {points: -200, jackpot: 0, capped: false}, "no extra penalty");
  assert.deepEqual(bonusPoints({points: 200, streak: 5}), {points: 200, jackpot: 500, capped: false}, "a jackpot is celebrated, not paid");
  assert.deepEqual(bonusPoints({points: 300, bonus: true, streak: 10}), {points: 550, jackpot: 1500, capped: true}, "capped at 550");
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
  assert.match(mock, /const late = atBedtime\(new Date\(\), settings\.gameBedtime\), warm = inSlumpNext\(\), crown = best && !late;/);
  assert.match(mock, /\$\("game-again-label"\)\.textContent = late \? "One more round" : warm \? "Recovery round" : "Next round";/);
  assert.match(mock, /\$\("game-sleep"\)\.href = left \? "\?view=evening&from=game" : "\?view=game&panel=radio";/);
  assert.match(html, /id="game-sleep" href="\?view=evening&amp;from=game" hidden>[\s\S]*?Evening recall, then sleep<\/span><\/a>/);
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
  assert.deepEqual(st.runs.at(-1), {set: "n2-set-6", at: now.toISOString(), attemptId: null, start: now.toISOString(), gamePoints: 250000, rank: "N2", questions: 1000});
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
  assert.match(mock, /if \(state\.phase === "ready" && params\.get\("boss"\) === "1" && \(realistic\(year\) \|\| levelSet\)\) state\.boss = true;/);
  assert.match(mock, /const half = \(m, phase\) => state\.boss && phase === "written" \? Math\.ceil\(m \/ 2\) : m;/, "only the written clock halves; audio can't");
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
  assert.match(mock, /factor: DIFFICULTY\[difficulty\(\)\]\.points, choices: q\.choices\.length/);
});

test("connectives are 問題9 文章の文法: a passage excerpt, one blank, four connectives, wrong ones from jobs that cannot stand in", async () => {
  const {OVERLAP, jobOf, CHOICE_FOR_JOB} = await import("../n2-connectives.js");
  const pool = gamePool({inventory, examples, sets, sat: new Set(ids.filter(id => !HELD_OUT.includes(id))), excerpts: true});
  const cs = pool.filter(q => q.kind === "connective");
  assert.ok(cs.length > 150, "plenty from the sets already sat");
  assert.equal(gamePool({inventory, examples, sets, sat: new Set(), excerpts: true}).filter(q => q.kind === "connective").length, 0, "only from sets already sat");
  assert.equal(pool.length - cs.length, gamePool({inventory, examples, sets, sat: new Set(ids.filter(id => !HELD_OUT.includes(id)))}).length, "a round's pool has none of them (owner, 27 Nov)");
  for (const q of cs) {
    assert.equal(q.prompt, "（　）に入るのは？", "the 問題9 wording");
    assert.equal((q.sentence.match(/（　）/g) || []).length, 1, q.id);
    assert.ok(!q.sentence.includes(q.answer + "、") || q.sentence.indexOf(q.answer + "、") !== q.sentence.indexOf("（　）"), q.id);
    const blocked = new Set(OVERLAP[jobOf(q.answer)]);
    assert.ok(q.wrong.every(w => !blocked.has(jobOf(w))), q.id + ": a wrong choice could stand in");
    const {choices, key} = choicesFor(q, seeded(2));
    assert.equal(choices.length, 4); assert.equal(choices[key], q.answer);
    assert.ok(q.id.match(/^c:n2-set-\d+#\d+@\d+$/) && !HELD_OUT.some(h => q.id.includes(h + "#")), q.id);
  }
  assert.ok(Object.values(CHOICE_FOR_JOB).every(w => jobOf(w)), "every wrong choice has a job");
});

test("after each answer the right word or pattern is spoken, with its reading, never a whole sentence", () => {
  assert.equal(answerSpeech({kind: "reading", solution: {word: "重役", reading: "じゅうやく"}}), "重役【じゅうやく】");
  assert.equal(answerSpeech({kind: "definition", solution: {word: "噴水", reading: "ふんすい"}}), "噴水【ふんすい】");
  assert.equal(answerSpeech({kind: "grammar", prompt: "得る（える・うる）", solution: {word: "得る（える・うる）"}}), "得る");
  assert.equal(answerSpeech({kind: "grammar", prompt: "～ざる", solution: {word: "～ざる"}}), "ざる");
  assert.equal(answerSpeech({kind: "connective", answer: "ところが"}), "ところが");
  assert.equal(answerSpeech({kind: "exam", target: ["word", "先祖", "せんぞ"]}), "先祖【せんぞ】");
  assert.equal(answerSpeech({kind: "exam", target: null, prompt: "a long authored sentence"}), null, "no target, nothing spoken");
  const mock = src("../n2-mock.js");
  // In play the answer is no longer spoken: at blitz pace it ran over the next question.
  assert.doesNotMatch(mock.slice(mock.indexOf("async function answer("), mock.indexOf("function review(")), /speakOnce|answerSpeech/);
});

// ---- Audit of 26 Nov 2026 (P0): the scored pool must be trustworthy ----
const allSat = () => gamePool({inventory, examples, sets, sat: new Set(ids.filter(id => !HELD_OUT.includes(id)))});

test("audit P0: no listening item without its audio enters the exam pool", () => {
  const exams = allSat().filter(q => q.kind === "exam");
  const skillOf = id => { const [set, i] = id.slice(2).split("#"); return sets.find(s => s.id === set).questions[+i].skill; };
  assert.equal(exams.filter(q => skillOf(q.id) === "Listening").length, 0);
  assert.ok(exams.every(q => ["Vocabulary", "Grammar"].includes(skillOf(q.id))));
});

test("audit P0: unique ids, four distinct choices, excluded items out", async () => {
  const {EXCLUDED} = await import("../n2-game-review.js");
  const pool = allSat(), seenIds = new Set();
  for (const q of pool) {
    assert.ok(!seenIds.has(q.id), "duplicate id " + q.id); seenIds.add(q.id);
    assert.ok(!EXCLUDED[q.id], "excluded item in pool " + q.id);
    const {choices} = choicesFor(q, seeded(13), .5);
    assert.equal(new Set(choices).size, 4, q.id);
  }
  for (const id of ["m:紅葉/こうよう", "m:紅葉/もみじ", "m:留まる/とどまる", "m:鈍い/にぶい"]) assert.ok(seenIds.has(id) || [...seenIds].some(x => x.startsWith(id.split("/")[0] + "/")), id);
});

test("audit P0: accepted readings are never wrong choices, and the key follows what Echo teaches", async () => {
  const {ACCEPTED_READINGS, READING_KEY} = await import("../n2-game-review.js");
  const pool = allSat();
  for (const [word, readings] of Object.entries(ACCEPTED_READINGS)) {
    const q = pool.find(x => x.id === "r:" + word); if (!q) continue;
    for (const r of readings) assert.ok(!q.wrong.includes(r), word + " offers " + r);
  }
  assert.equal(pool.find(x => x.id === "r:湿気").answer, READING_KEY.湿気);
  assert.equal(pool.find(x => x.id === "l:湿気").say, "しっけ", "and the voice says it");
});

test("audit P0: no wrong choice shares the answer's meaning, and listening never offers a same-sound meaning", () => {
  const pool = allSat();
  for (const q of pool.filter(x => ["meaning", "listen", "grammar"].includes(x.kind))) for (const w of q.wrong) assert.ok(!sameSense(w, q.answer), q.id + ": " + w);
  const byText = new Map(inventory.words.map(w => [w[0], w]));
  for (const q of pool.filter(x => x.kind === "listen")) {
    const sameSound = inventory.words.filter(w => w[1] === q.say && w[0] !== q.prompt).map(w => gloss(w[2]));
    for (const g of sameSound) assert.ok(!q.wrong.includes(g), q.id + " offers the meaning of a word that sounds the same: " + g);
  }
  assert.equal(gloss("work (e.g., film, book), production"), "work (e.g., film, book), production", "no split inside parentheses");
  assert.ok(byText.size > 0);
});

test("audit P0: blind guessing never beats I don't know, in any exposed state", () => {
  for (const difficulty of Object.keys(DIFFICULTY)) for (let streak = 0; streak <= 12; streak++) for (const bonus of [false, true]) {
    const base = scoreAnswer({outcome: "right", ms: 0, seconds: 3, streak});
    const paid = bonusPoints({points: base.points, bonus, streak: base.streak, factor: DIFFICULTY[difficulty].points, choices: 4});
    const ev = paid.points / 4 + (3 / 4) * scoreAnswer({outcome: "wrong", streak}).points;
    assert.ok(ev <= 0, `${difficulty} streak ${streak} bonus ${bonus}: EV ${ev}`);
  }
  assert.equal(payoutCap(4), 550);
});

test("audit P0: a flag earns nothing, ends the combo, and the round's right count only counts right answers", () => {
  const mock = src("../n2-mock.js");
  const flag = mock.slice(mock.indexOf('$("game-flag").onclick'), mock.indexOf('$("game-review-flag").onclick'));
  assert.match(flag, /flagged\+\+; streak = 0; marks\[index\] = "fl"; head\(\);/);
  assert.doesNotMatch(flag, /recallRecord|rights\+\+|score \+=/);
  assert.match(mock, /misses: scoredN - rights, scored: scoredN\}/, "flags and practice are out of the accuracy");
  assert.match(mock, /\$\("game-done-line"\)\.textContent = late \? rights \+ " of " \+ round\.length/);
  assert.match(mock, /choicesFor\(q, Math\.random, roundLevel\)/, "the round's level picks the choices");
});

test("connective questions are scored like every card of a round; the practice path stays for unpaid cards", () => {
  const pool = allSat();
  assert.ok(pool.filter(q => q.kind === "link").length > 30 && pool.filter(q => q.kind === "link").every(q => !q.practice), "owner, 27 Nov: every card pays and costs");
  assert.match(src("../n2-mock.js"), /const paid = q\.practice \? \{points: 0, jackpot: 0\}/);
});

test("the game follows the boards (Blitz on washi): tokens, clock, head, cards, choices, flag, review, round end, home", async () => {
  const css = src("../styles.css"), html = src("../n2-mock.html"), mock = src("../n2-mock.js");
  const {surfaceNeedle} = await import("../n2-game.js");
  assert.equal((css.match(/--gold:#/g) || []).length, 3, "gold in light, dark and system");
  assert.match(css, /\.n2-game\{--right:var\(--chip-learn-fg\);--right-tint:var\(--chip-learn-bg\);--track:var\(--rule\)/);
  assert.match(css, /body\[data-view=game\]\{background-image:none;/, "no paper texture in the game");
  assert.match(css, /\.qr-bar\{flex:1;height:14px;border-radius:7px/, "board 2: the 14 px clock");
  assert.match(css, /\.qr-ch\{display:flex;align-items:center;gap:12px;min-height:56px;width:100%;padding:8px 14px;border-radius:14px;border:1\.5px solid var\(--hairline\)/);
  assert.match(css, /\.qr-ch \.t:lang\(ja\)\{font-family:var\(--ui\);font-size:20px;font-weight:700\}/, "Japanese choices in the sans");
  assert.match(css, /\.qr-play\{[^}]*height:96px;border-radius:24px/, "board 1: Play, 96 px");
  assert.match(css, /\.qr-btn\{[^}]*height:72px;border-radius:22px/, "board 6: Next round, 72 px");
  assert.match(css, /\.qr-next\{flex:1;height:52px;border-radius:14px;border:0;background:var\(--sumi\)/, "board 5: Next, ink");
  assert.match(css, /\.qr-listen\{[^}]*width:96px;height:96px;border-radius:50%/, "board 3a: the listen button");
  assert.match(html, /class="qr-ib qr-q" id="game-flag"/); assert.match(mock, /toast\("Flagged, saved as shown", "no points"\)/);
  // Measured against the boards at 375 px (v280): Home's four states, the loop, the review, the round end, board 11.
  assert.match(css, /\.n2-game\[data-mode=home\] \.qr-hd,[^{]*\{padding-bottom:8px;min-height:64px\}/, "boards 1, 11: a 64 px head outside the loop");
  assert.match(css, /\.qr-run \.qr-chip,\.qr-rk \.qr-chip\{height:28px;padding:0 12px;border-radius:14px;font-size:12px/, "board 1: Home chips are 28 px");
  assert.match(css, /\.qr-bosscard\{border:2px solid var\(--seal\)\}/); assert.match(css, /\.qr-onitile\{width:72px;height:72px/, "board 1 · B");
  assert.match(css, /\.qr-tiers i\{flex:24;height:8px;border-radius:4px;background:var\(--track\)\}\.qr-tiers i:last-child\{flex:12\}/, "board 1 · D: 24 h, 24 h, then ×1");
  assert.match(css, /\.qr-ch\.m \.t:lang\(ja\)\{font-family:var\(--display\);font-size:24px;font-weight:700\}/, "board 3a: kanji choices in the Mincho");
  assert.match(css, /\.qr-big:lang\(en\)\{font-family:var\(--ui\);font-weight:700;font-size:24px;line-height:1\.3;margin:18px 0 6px;overflow-wrap:break-word\}/, "board 3a: the English prompt");
  assert.match(css, /\.qr-ribbon\{[^}]*padding:12px 16px;border-radius:14px[^}]*font-size:15px;font-weight:900/, "board 4: the beat ribbon");
  assert.match(css, /\.qr-float\{position:absolute;right:0;bottom:0;/, "the points float sits in the combo line's slot, never on the clock");
  assert.match(html, /<span class="qr-cb" id="game-combo-chip"><\/span><span class="qr-float" id="game-float" aria-hidden="true"><\/span><\/div>/);
  assert.match(html, /<div id="game-ribbon" class="qr-ribbon" hidden>[\s\S]*?<div class="qr-clk" id="game-clock">/, "the ribbon sits above the clock");
  assert.match(css, /\.n2-game label>span:first-child\{font-size:inherit;color:inherit\}/, "Echo's label style doesn't leak into Settings");
  assert.match(mock, /const num = n => \(n < 0 \? "−" : ""\) \+ Math\.abs\(Math\.round\(n\)\)\.toLocaleString\(\);/, "a true minus sign below zero");
  assert.doesNotMatch(mock, /Jackpot \+|\+1,500/, "jackpots are a celebration: no points are promised");
  // The run clock is live on Home: it repaints every second and Home redraws on a change of tier.
  assert.match(mock, /homeTick = setInterval\(\(\) => \{ if \(root\.dataset\.mode !== "home"\) \{ clearInterval\(homeTick\); return; \} if \(paintClock\(\) !== key\) home\(\); \}, 1000\);/);
  assert.match(mock, /String\(m\)\.padStart\(2, "0"\) \+ " m left"/, "board 1: 5 h 02 m left");
  assert.match(mock, /prompt\.hidden = listen \|\| sentenceKind;/, "sentence kinds show the sentence alone");
  assert.match(html, /id="game-days"/); assert.match(html, /id="game-countdown"/); assert.match(html, /id="game-bosscard"/);
  assert.equal(surfaceNeedle("この方法なら、問題は解決し得る。", "得る（える・うる）"), "得る");
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{html:not\(\.motion-on\) \.n2-game \*\{animation:none !important/);
  assert.match(mock, /navigator\.vibrate/);
  assert.match(mock, /const playable = hears\(\) \? pool : pool\.filter\(q => q\.kind !== "listen"\);/);
});

test("Quick round progress travels in the N2 gist file: rounds and runs union, maxima kept, the newer save decides the rest", async () => {
  const {mergeGame, mergeN2, signatures} = await import("../sync.js");
  const phone = {updatedAt: "2026-11-27T10:00:00Z", answered: 300, total: 50000, best: 900, rounds: 30, bossFrom: 0, runStart: "2026-11-27T08:00:00Z",
    seen: {"m:a": 5, "m:b": 9}, wins: {"m:a": 2}, days: {"2026-11-27": {answered: 300, right: 240, points: 50000, rounds: 30, best: 900}},
    history: [{at: "2026-11-27T09:00:00Z", score: 900, right: 9, n: 10}], runs: []};
  const laptop = {updatedAt: "2026-11-26T22:00:00Z", answered: 120, total: 20000, best: 1200, rounds: 12, bossFrom: 0,
    seen: {"m:b": 3, "m:c": 7}, wins: {"m:a": 5}, days: {"2026-11-26": {answered: 120, right: 90, points: 20000, rounds: 12, best: 1200}},
    history: [{at: "2026-11-26T21:00:00Z", score: 1200, right: 10, n: 10}], runs: [{at: "2026-11-20T10:00:00Z", set: "n2-set-4", gamePoints: 1, questions: 1000}]};
  const m = mergeGame(phone, laptop);
  assert.equal(m.best, 1200); assert.equal(m.history.length, 2); assert.equal(m.runs.length, 1);
  assert.deepEqual(m.seen, {"m:a": 5, "m:b": 9, "m:c": 7}); assert.equal(m.wins["m:a"], 5);
  assert.equal(m.days["2026-11-26"].answered, 120); assert.equal(m.days["2026-11-27"].answered, 300);
  assert.equal(m.runStart, phone.runStart, "the newer save's run clock");
  // The run clock survives a newer save that has no start yet (a Sound toggle on another device), and keeps the earlier start of one run.
  const quiet = {updatedAt: "2026-11-27T11:00:00Z", sound: false, bossFrom: 0};
  assert.equal(mergeGame(phone, quiet).runStart, phone.runStart, "a save with no start doesn't reset the clock");
  assert.equal(mergeGame(phone, {...quiet, runStart: "2026-11-27T10:59:00Z"}).runStart, phone.runStart, "the earlier start of the same run");
  assert.equal(mergeGame(phone, {...quiet, bossFrom: 1000, runStart: null}).runStart, null, "a newer save past the boss closes it");
  assert.deepEqual(mergeGame(laptop, phone), m, "the same in either order");
  assert.equal(mergeGame(null, phone), phone);
  assert.equal(mergeN2({game: phone}, {game: laptop}).game.best, 1200);
  assert.notEqual(signatures.n2({game: phone}), signatures.n2({game: m}), "a merged change is pushed");
  const progress = src("../n2-progress.js"), mock = src("../n2-mock.js");
  assert.match(progress, /nights:readNights\(\),game:readGameStore\(\),goal:readGoal\(\)/, "in the gist file");
  assert.match(progress, /nights:readNights\(\),game:readGameStore\(\)\};/, "and the N2 export");
  assert.match(mock, /JSON\.stringify\(\{\.\.\.state, updatedAt: new Date\(\)\.toISOString\(\)\}\)\); markDirty\("n2"\);/);
});

test("the game has its own settings, and switching Open Echo on Quick round on goes there at once", () => {
  const html = src("../n2-mock.html"), mock = src("../n2-mock.js"), app = src("../app.js");
  for (const id of ["game-set-difficulty", "game-set-bedtime", "game-set-sound", "game-set-start"]) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /id="game-settings-open" type="button">[\s\S]*?Settings<\/button>/, "Settings opens in the game, not in Echo");
  assert.match(mock, /switchClick\("game-set-start", on => savePreference\("startGame", on\)\);/);
  assert.match(app, /\$\("#settings-start-game"\)\.addEventListener\("change",e=>\{if\(e\.target\.checked&&settings\.startGame\)setTimeout\(\(\)=>location\.assign\("\.\/n2-mock\.html\?view=game"\),250\)\}\);/);
});

test("a round can be left at any time: the chevron goes back to Home (board 2)", () => {
  const mock = src("../n2-mock.js");
  assert.match(mock, /\$\("game-back"\)\.setAttribute\("aria-label", "Back to home"\);/);
  assert.match(mock, /\$\("game-back"\)\.onclick = e => \{ e\.preventDefault\(\); rememberOpenPattern\(\); window\.speechSynthesis\?\.cancel\(\); home\(\); \};/);
});

test("Radio stays inside the game: Day Radio and Evening recall come back, the Night Radio runs here", () => {
  const html = src("../n2-mock.html"), mock = src("../n2-mock.js");
  const game = html.slice(html.indexOf('<section id="game"'), html.indexOf('<section id="check"'));
  assert.doesNotMatch(game, /href="\.\/radio"/, "no link out to Echo's Radio from the game");
  assert.match(game, /id="game-radio-open" type="button">[\s\S]*?Radio<\/button>/);
  assert.match(game, /href="\?view=radio&amp;mode=listen&amp;from=game"/); assert.match(game, /data-recall="\?view=radio&amp;mode=recall&amp;from=game"/); assert.match(game, /href="\?view=evening&amp;from=game"/);
  assert.match(game, /id="game-night" class="qr-night"/);
  assert.match(mock, /nightPlayer\.start\(tonight\.cued, \{steps: radioSteps/, "the cued half, the same plan as Echo's");
  assert.match(mock, /keepNight\(readNights\(\), nightRecord\(tonight\)\)/, "the night is recorded for the comparison");
  assert.match(mock, /if \(FROM_GAME\) \{ \$\("day-back"\)\.href = "\?view=game&panel=radio";/);
  assert.match(mock, /\$\("check-done-go"\)\.href = evening \? \(fromGame \? "\?view=game&panel=radio" : "\.\/radio"\)/);
  assert.match(mock, /if \(params\.get\("panel"\) === "radio"\) radioPanel\(\); else home\(\);/);
  assert.match(mock, /\["game-radio", "radio"\]/, "the screen switcher shows it");
});

// ---- Re-audit of v276 (26 Nov 2026) ----
test("re-audit P0: a homophone card keeps its kana visible (no 【】 for the furigana parser to eat)", async () => {
  const {rubySegments} = await import("../core.js");
  const pool = gamePool({inventory, examples, sets, sat: new Set()});
  for (const q of pool.filter(x => x.kind === "homophone")) {
    assert.ok(!q.sentence.includes("【"), q.id);
    assert.ok(rubySegments(q.sentence).map(x => x.text).join("").includes(q.prompt), q.id + ": the reading is still on screen");
    assert.equal(q.needle, q.prompt);
  }
});

test("re-audit P0: sense cues and corrected glosses", () => {
  const pool = gamePool({inventory, examples, sets, sat: new Set()});
  const get = id => pool.find(q => q.id === id);
  for (const id of ["m:紅葉/こうよう", "m:紅葉/もみじ"]) { const q = get(id); if (q) assert.ok(q.sentence.includes("紅葉"), id + " shows its sentence as the cue"); }
  assert.match(get("m:鈍い/のろい")?.answer || "slow", /slow/);
  assert.match(get("m:留まる/とまる")?.answer || "perch", /perch/);
  assert.match(get("m:宛名")?.answer || "addressee", /addressee/);
  assert.match(get("d:発売")?.prompt || "release", /release/);
  assert.ok(!/trendy/.test(get("m:白髪/しらが")?.answer || get("m:白髪")?.answer || ""));
});

test("re-audit P0: the listen clock starts after playback, a failed playback is unscored, stale speech is dropped", () => {
  const mock = src("../n2-mock.js");
  assert.match(mock, /speakAndWait\(spokenWord\(q\.prompt, q\.say\), \{voice: voice\(\), rate: Number\(settings\.rate\) \|\| 1\}\)\.then\(ok => \{\n      if \(token !== askToken \|\| current !== q \|\| locked\) return;\n[^\n]*\n      if \(ok\) \{ if \(document\.visibilityState === "hidden"\) hiddenResume = startClock; else startClock\(\); return; \}/);
  assert.match(mock, /"The audio didn’t play: this one doesn’t count\."/);
  assert.match(mock, /if \(reviewToken === askToken && !\$\("game-review"\)\.hidden\) say\(/, "a review word isn't spoken after leaving it");
  assert.match(mock, /window\.speechSynthesis\?\.cancel\(\); askToken\+\+;/, "Home cancels pending speech and callbacks");
});

test("re-audit P1: practice is exposure only: no accuracy, level, day, boss, run clock, wins, repeats or bonus", () => {
  const before = {answered: 5, level: .5, total: 100, comeback: [], days: {}, wins: {}};
  const after = rememberAnswer(before, {q: {id: "c:x", practice: true}, outcome: "wrong", points: 0, now: Date.now()});
  assert.equal(after.answered, 5); assert.equal(after.level, .5); assert.deepEqual(after.comeback, []); assert.equal(after.runStart, undefined);
  assert.deepEqual(after.days, {}); assert.equal(after.practiced, 1); assert.ok(after.seen["c:x"]);
  const pool = gamePool({inventory, examples, sets, sat: new Set(ids.filter(id => !HELD_OUT.includes(id)))});
  for (let i = 0; i < 30; i++) for (const q of nextRound({pool, state: {}, random: seeded(i + 1)}).round) assert.ok(!(q.practice && q.bonus), "no bonus on practice");
  const r = rememberRound({}, {score: 0, questions: Array(10).fill({}), misses: 1, scored: 7});
  assert.deepEqual([r.history[0].right, r.history[0].n], [6, 7], "flags and practice are out of the round's accuracy");
});

test("re-audit P1: a hidden tab pauses the card or review; P2: the boss closes its run when the sitting starts, and rest follows its finish", () => {
  const mock = src("../n2-mock.js");
  assert.match(mock, /if \(document\.visibilityState === "hidden"\) hiddenResume = reportPause\?\.\(\) \|\| null;/);
  assert.match(mock, /if \(state\.boss && !state\.bossTaken\) \{ try \{ writeGame\(takeBoss\(readGame\(\), \{set: year, attemptId: state\.id\}\)\); \} catch \{\} state\.bossTaken = true; \}/);
  assert.doesNotMatch(mock.slice(mock.indexOf("const fightBoss"), mock.indexOf("const fightBoss") + 200), /takeBoss/, "tapping Face the boss closes nothing");
  const st = takeBoss({answered: 1000, total: 9}, {set: "n2-set-9", attemptId: "att-1", now: Date.parse("2026-11-27T23:00:00")});
  assert.equal(st.runs.at(-1).attemptId, "att-1");
  const finishedAfterMidnight = [{id: "att-1", book: "n2-set-9", phase: "results", completedAt: new Date("2026-11-28T00:40:00").toISOString()}];
  assert.equal(resting(st, finishedAfterMidnight, new Date("2026-11-28T01:00:00")), true, "rest follows the finish, after midnight too");
  assert.equal(resting(st, [{...finishedAfterMidnight[0], id: "other"}], new Date("2026-11-28T01:00:00")), false, "only that sitting");
});

test("re-audit P2: the audit export shows the underline, practice and the filtered near misses", () => {
  const reading = src("../audit/quick-round/questions/reading.jsonl").split("\n").find(l => l.includes('"r:的確"'));
  if (reading) assert.ok(!JSON.parse(reading).wrongCandidates.includes("てっかく"));
  assert.doesNotMatch(src("../audit/quick-round/data/readings.tsv").split("\n").find(l => l.startsWith("的確\t")) || "", /てっかく/);
  // Every card is scored since SCORE_ALL (owner, 27 Nov), and the connective is asked on its own: no card is marked practice.
  assert.doesNotMatch(src("../audit/quick-round/questions/link.jsonl"), /"practice":true/);
  assert.match(src("../audit/quick-round/questions/grammar.jsonl"), /"underline":/);
});

test("a guess on a streak: the streak-scaled penalty outweighs keeping the combo alive for the next card", () => {
  // Two cards: this one unknown (guess or I don't know), the next one known and
  // answered instantly. Guessing keeps the streak 1 time in 4; the next answer
  // then pays more. The scaled penalty must outweigh that, at every streak,
  // difficulty and bonus.
  for (const difficulty of Object.keys(DIFFICULTY)) for (let streak = 0; streak <= 12; streak++) for (const bonus of [false, true]) {
    const factor = DIFFICULTY[difficulty].points;
    const pay = (s, b) => { const r = scoreAnswer({outcome: "right", ms: 0, seconds: 3, streak: s}); return bonusPoints({points: r.points, bonus: b, streak: r.streak, factor, choices: 4}).points; };
    const lucky = pay(streak, bonus) + pay(streak + 1, false);
    const unlucky = scoreAnswer({outcome: "wrong", streak}).points + pay(0, false);
    const skip = 0 + pay(0, false);
    const guess = lucky / 4 + unlucky * 3 / 4;
    assert.ok(guess <= skip, `${difficulty} streak ${streak} bonus ${bonus}: guess ${guess} vs skip ${skip}`);
  }
});

test("reports 08e2c732, bc70f913: reduced motion never stops the clock bar, and a grammar miss is read with its reading", async () => {
  const {patternVoice, answerSpeech} = await import("../n2-game.js");
  const {exampleSegments} = await import("../n2-delayed.js");
  const css = src("../styles.css"), mock = src("../n2-mock.js");
  assert.match(css, /\.n2-game a\.qr-ib:hover,[^{]*\{color:var\(--sumi\)\}/, "a tapped link doesn't turn seal");
  assert.match(css, /html:not\(\.motion-on\) \.n2-game \*:not\(#game-bar\)\{transition-duration:\.08s !important\}/, "the bar keeps its own transition");
  assert.match(css, /html\.motion-off \.n2-game \*:not\(#game-bar\)\{transition-duration:\.08s !important\}/, "Echo's Motion: Off too");
  assert.deepEqual(patternVoice("得る", [{text: "解決", reading: "かいけつ"}, {text: "得", reading: "う", mark: true}, {text: "る", mark: true}]), {speak: "得【う】る", reading: "うる"});
  assert.deepEqual(patternVoice("ばかりに", []), {speak: "ばかりに", reading: ""}, "kana needs no reading line");
  assert.deepEqual(patternVoice("末", [{text: "悩", reading: "なや", mark: true}, {text: "んだ", mark: true}]), {speak: "悩【なや】んだ", reading: "なやんだ"}, "else the underlined part of the sentence");
  const pool = gamePool({inventory, examples, sets: []}).filter(q => q.kind === "grammar" && /[一-鿿]/.test(answerSpeech(q) || ""));
  assert.ok(pool.length > 50);
  for (const q of pool) { const text = answerSpeech(q); assert.ok(patternVoice(text, exampleSegments(q.solution.ja, [q.needle || "", text].filter(Boolean))).reading, text + " has a reading"); }
  assert.match(mock, /const spoken = pattern \? pattern\.speak : sol\.word && sol\.reading \? spokenWord\(sol\.word, sol\.reading\) : "";/);
});

test("reports 9221d018, 7bd670be, 84ce79be: audible effects, a listen card in its sentence, a snapshot with every flag", async () => {
  const {createReport, SNAPSHOT_MAX} = await import("../reports.js");
  const {exampleSegments} = await import("../n2-delayed.js");
  const mock = src("../n2-mock.js"), css = src("../styles.css");
  // Effects a phone speaker can play: mixed up, resumed on every note, no note under 196 Hz.
  assert.match(mock, /const LOUD = 3;/); assert.match(mock, /if \(ctx\.state !== "running"\) ctx\.resume/);
  assert.match(mock, /wrong: \(\) => tone\(330, 0, \.2, "sawtooth", \.05, 196\)/);
  // Most listen cards have a sentence that holds the word; it shows with the word as a gap, filled on the answer.
  const listen = gamePool({inventory, examples, sets: []}).filter(q => q.kind === "listen");
  const placed = listen.filter(q => q.solution.ja && exampleSegments(q.solution.ja, [q.prompt]).some(s => s.mark));
  assert.ok(placed.length / listen.length > .6, placed.length + " of " + listen.length + " listen cards sit in a sentence");
  assert.match(mock, /heard\.flatMap\(\(s, n\) => !s\.mark \? \[s\.text\] : heard\[n - 1\]\?\.mark \? \[\] : \[el\("span", \{class: "qr-blank", id: "game-blank"\}\)\]\)/, "no furigana, one gap");
  assert.match(css, /\.qr-sent\.heard,/);
  // A snapshot rides on the report, capped; a report without one is unchanged.
  const shot = {html: "<section>" + "x".repeat(SNAPSHOT_MAX * 2) + "</section>", width: 393, height: 873, dpr: 2.75, theme: "system/light", motion: "reduce", view: "game", css: "./styles.css?v=208"};
  const r = createReport({kind: "card", snapshot: shot});
  assert.equal(r.snapshot.html.length, SNAPSHOT_MAX); assert.equal(r.snapshot.motion, "reduce"); assert.equal(r.snapshot.width, 393);
  assert.equal("snapshot" in createReport({kind: "bug"}), false);
  assert.match(mock, /const snapshot = screenSnapshot\(root\); \/\/ taken at the tap, before the game moves on/);
  assert.match(mock, /warm \? "Recovery round" : "Next round"/, "after a hard round the next is named a recovery round; the effect is unchanged");
});

test("the game says which version is running and offers a waiting update itself, on a tap", async () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html"), sw = src("../sw.js"), reports = src("../reports.js");
  assert.match(sw, /if\(event\.data==="echo:version"\)event\.ports\?\.\[0\]\?\.postMessage\(CACHE\)/, "the worker in control names its own version");
  assert.match(reports, /sort\(\(a, b\) => Number\(a\.match\(\/\\d\+\/\)\[0\]\) - Number\(b\.match\(\/\\d\+\/\)\[0\]\)\)\[0\]/, "else the lowest cache: a waiting update already has a higher one");
  assert.match(html, /id="game-update" hidden>[\s\S]*?id="game-update-now" type="button">Update<\/button>/, "Home: one line when an update is ready");
  assert.match(html, /id="game-set-version"[\s\S]*?id="game-version"/, "Settings: the version, tap to check");
  assert.match(mock, /const applyUpdate = \(\) => \{ const waiting = registration\?\.waiting; if \(!waiting\) return false; navigator\.serviceWorker\.addEventListener\("controllerchange", \(\) => location\.reload\(\), \{once: true\}\); waiting\.postMessage\("echo:activate-update"\); return true; \};/, "applied only when asked");
  assert.match(mock, /root\.dataset\.mode === "home"\) checkUpdate\(\)/, "never checked or offered during a round");
  // The worker answers a version request on the port it is given.
  const {default: vm} = await import("node:vm"); const handlers = {}; let told = "";
  vm.runInNewContext(sw, {self: {addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting() {}, registration: {scope: "https://echo.test/"}, clients: {claim: async () => {}}, location: {origin: "https://echo.test"}}, caches: {}, Request: class {}, Response: class {}, URL, fetch: async () => ({})});
  handlers.message({data: "echo:version", ports: [{postMessage: v => { told = v; }}]});
  assert.match(told, /^jp-echo-v\d+$/);
});

test("the game is pinned to the screen: nothing above it and no viewport unit can push Radio and Settings below the fold", () => {
  const css = src("../styles.css");
  assert.match(css, /body\[data-view=game\] \.n2-game\{position:fixed;inset:0;box-sizing:border-box;width:100%;min-height:0;padding:0 16px;overflow-y:auto;/);
  assert.match(css, /body\[data-view=game\] #n2-main\{padding:0\}/, "the 16 px gutter moved onto the game itself");
});

test("Radio from the game: Day and Night start alike, and Day Radio and Evening recall wear the game's look, not a fork", () => {
  const html = src("../n2-mock.html"), css = src("../styles.css"), mock = src("../n2-mock.js");
  const radio = html.slice(html.indexOf('id="game-radio"'), html.indexOf('id="game-play"'));
  assert.match(radio, /id="game-day-mode" role="radiogroup"[\s\S]*?id="game-day-start" href="\?view=radio&amp;mode=listen&amp;from=game"/, "Day has its own start");
  assert.match(radio, /class="qr-btn qr-btn60 qr-mt12" id="game-night-start"/); assert.doesNotMatch(radio, /class="qr-dock"/, "no bottom button for the night alone");
  assert.match(mock, /if \(FROM_GAME\) \{ document\.body\.dataset\.from = "game";/);
  assert.match(css, /body\[data-from=game\]\{background-image:none;background:var\(--washi\);font-family:var\(--ui\)\}/);
  assert.match(css, /body\[data-from=game\] \.drill-title\{font-family:var\(--ui\);font-size:20px;font-weight:900/);
  assert.match(css, /body\[data-from=game\] #day-howto\{margin-top:12px;padding:0 16px;border:1px solid var\(--hairline\)/, "the how-to card keeps its gap and top edge (Echo's first-row rule zeroed both)");
  assert.doesNotMatch(css.slice(css.indexOf("body[data-from=game]{"), css.indexOf("/* Day Radio */")), /#[0-9A-Fa-f]{6}\b/, "tokens only in the skin");
  assert.match(mock, /\$\("day-done-back"\)\.href = "\?view=game&panel=radio"/, "the end of Day Radio leads back to the game's Radio");
});

test("every grammar card underlines what it asks about, even a pattern that sits in the sentence in pieces (owner's flags on g:ていては)", async () => {
  const {exampleSegments} = await import("../n2-delayed.js");
  const {GRAMMAR_SPANS} = await import("../n2-game-review.js");
  const grammar = gamePool({inventory, examples, sets: []}).filter(q => q.kind === "grammar");
  for (const q of grammar) assert.ok(exampleSegments(q.sentence, [q.needle]).some(s => s.mark), q.id + " has an underline");
  // A pattern in pieces by nature keeps its pieces; ていては now has a sentence that shows it whole (deck audit, v287).
  const split = grammar.find(q => q.id === "g:も-ば-も");
  assert.equal(exampleSegments(split.sentence, [split.needle]).map(s => s.mark ? "[" + s.text + "]" : s.text).join(""), "彼女は英語[も]話せ[ば]、中国語[も]話せる。");
  const whole = grammar.find(q => q.id === "g:ていては");
  assert.equal(exampleSegments(whole.sentence, [whole.needle]).map(s => s.mark ? "[" + s.text + "]" : s.text).join(""), "文句ばかり言っ[ていては]、何も変わらないよ。");
  // Deck audit: where a natural sentence can show the named form, it does (no voiced or split stand-in).
  for (const [id, form] of [["g:た末-の末", "た末"], ["g:たって", "たって"], ["g:てならない", "てならない"], ["g:ようではないか", "ようではないか"], ["g:かのようだ", "かのようだ"]])
    assert.ok(grammar.find(q => q.id === id).sentence.includes(form), id + " shows " + form);
  assert.ok(exampleSegments(split.solution.ja, [split.needle]).some(s => s.mark), "and in the review, with furigana");
  for (const id of Object.keys(GRAMMAR_SPANS)) assert.ok(grammar.some(q => q.id === id), id + " is a grammar card");
  // One piece that is missing means no underline from that needle, never a partial one.
  assert.equal(exampleSegments("休んでいる。", [["で", "いては"]]).some(s => s.mark), false);
  assert.equal(exampleSegments("雨が降る。", ["降る"]).filter(s => s.mark).map(s => s.text).join(""), "降る", "a plain needle works as before");
});

test("item strength: a fast right answer four hours apart adds a level, a miss takes one, 極 rests three days", async () => {
  const {itemLevel, levelAfter, ITEM_LEVEL, pickRound} = await import("../n2-game.js");
  const {mergeGame} = await import("../sync.js");
  const q = {id: "m:x", kind: "meaning", target: ["word", "x", "x"], dimension: "meaning"}, t0 = Date.parse("2026-11-26T09:00:00Z");
  let st = rememberAnswer({}, {q, outcome: "right", fast: true, now: t0});
  assert.equal(itemLevel(st, q.id), 1, "a fast right answer");
  st = rememberAnswer(st, {q, outcome: "right", fast: true, now: t0 + 3600_000});
  assert.equal(itemLevel(st, q.id), 1, "not twice within four hours: a level means spaced wins");
  st = rememberAnswer(st, {q, outcome: "right", fast: false, now: t0 + 5 * 3600_000});
  assert.equal(itemLevel(st, q.id), 1, "a slow right answer leaves it");
  st = rememberAnswer(st, {q, outcome: "right", fast: true, now: t0 + 6 * 3600_000});
  assert.equal(itemLevel(st, q.id), 2);
  for (const outcome of ["wrong", "timeout", "dontknow"]) assert.equal(levelAfter({lv: {[q.id]: 3}}, {id: q.id, outcome}), 2, outcome + " takes one away");
  assert.equal(levelAfter({lv: {[q.id]: 0}}, {id: q.id, outcome: "wrong"}), 0); assert.equal(levelAfter({lv: {[q.id]: 5}}, {id: q.id, outcome: "right", fast: true, now: t0}), 5, "five is the top");
  assert.equal(itemLevel(rememberAnswer({lv: {"c:p": 3}}, {q: {id: "c:p", practice: true}, outcome: "wrong"}), "c:p"), 3, "practice never moves a level");
  // A mastered item seen yesterday is passed over while anything else is left; after three days it is back.
  const pool = Array.from({length: 30}, (_, i) => ({id: "m:" + i, kind: "meaning", target: ["word", "w" + i, "r" + i], dimension: "meaning"}));
  const day = 86400_000, now = t0 + 10 * day, seen = {"m:0": now - day}, lv = {"m:0": ITEM_LEVEL.max};
  assert.equal(pickRound({pool, seen, lv, now}).some(x => x.id === "m:0"), false);
  assert.equal(pickRound({pool: pool.slice(0, 10), seen: {"m:0": now - 4 * day}, lv, now}).some(x => x.id === "m:0"), true);
  // Levels travel with the game's progress.
  const m = mergeGame({updatedAt: "2026-11-26T10:00:00Z", lv: {a: 2, b: 1}, lvAt: {a: 5}}, {updatedAt: "2026-11-26T09:00:00Z", lv: {a: 4, c: 3}, lvAt: {a: 9, c: 2}});
  assert.deepEqual(m.lv, {a: 2, b: 1, c: 3}); assert.deepEqual(m.lvAt, {a: 9, c: 2});
  const html = src("../n2-mock.html"), mock = src("../n2-mock.js"), css = src("../styles.css");
  assert.match(html, /id="game-lv" hidden><i><\/i><i><\/i><i><\/i><i><\/i><i><\/i><b id="game-lv-n"><\/b><\/span>/, "board 9: five squares");
  assert.match(css, /\.qr-lv i\{width:10px;height:10px;border-radius:2px;border:1\.5px solid var\(--right\)/);
  assert.doesNotMatch(mock, /\["Again", "seal"\]/, "the level takes the corner the off-board Again chip had");
});

test("a round survives a closed app or a trip Home for 30 minutes; a recovery round follows accuracy, not the score", () => {
  const mock = src("../n2-mock.js"), html = src("../n2-mock.html"), css = src("../styles.css");
  assert.match(mock, /const ROUND_KEY = "echo-n2-round", ROUND_KEEP_MS = 30 \* 60_000;/);
  assert.match(mock, /if \(!s \|\| Date\.now\(\) - s\.at > ROUND_KEEP_MS \|\| !\(s\.index >= 1 && s\.index < s\.items\.length\)\)/, "1 to 9 answers, under 30 minutes");
  assert.match(mock, /kept \? "Resume round" : "Play"/); assert.match(html, /id="game-play-pips" hidden>/, "board 12 · B: the pips sit inside Play");
  assert.match(mock, /state = rememberRound\([^\n]*\n    clearRound\(\);/, "the round's end drops it");
  assert.equal(inSlump({history: [{score: -800, right: 6, n: 10}]}), false, "a score below zero alone is not a slump");
  assert.equal(inSlump({history: [{score: 300, right: 4, n: 10}]}), true);
  assert.equal(inSlump({history: [{score: 0, right: 0, n: 0}]}), false, "a round with nothing scored is not a slump");
  // Listening is honest: no answer before the word has been heard, no cards without a voice, one clock.
  assert.match(mock, /if \(locked \|\| !current \|\| voiceWait\) return;/);
  assert.match(mock, /const hears = \(\) => sound\(\) && japaneseVoices\("ja"\)\.length > 0 && listenFails < 2;/);
  assert.match(mock, /if \(!\$\("game-play"\)\.hidden && current && !locked && voiceWait\) return null;/, "nothing to pause while the voice plays");
  assert.match(css, /@media\(max-height:760px\)\{\n  body\[data-view=game\] \.qr-ch\{min-height:48px;padding:6px 12px\}/, "short screens keep the four choices on screen");
});

// ---- Levels and the rank ----
const levelsManifest = read("../levels/manifest.json");
const levelInventory = level => read("../levels/" + levelsManifest.version + "/" + levelFile(level));
const levelPool = level => gamePool({inventory: levelInventory(level), level});

test("the N2 pool is the same pool with or without a level named: ids, order and all", () => {
  const sat = new Set(["n2-set-5"]);
  assert.deepEqual(gamePool({inventory, examples, sets, sat, level: "N2"}), gamePool({inventory, examples, sets, sat}));
  const pool = gamePool({inventory, examples});
  assert.ok(pool.every(q => !("level" in q) && !("item" in q) && levelOfCard(q) === "N2"));
  assert.ok(pool.some(q => q.id === "r:就任") && pool.some(q => q.id === "m:就任") && pool.some(q => q.kind === "grammar"), "today's ids are untouched");
});

test("another level gives word cards only, under ids no other level can have", () => {
  const n2 = new Set(gamePool({inventory, examples, sets, sat: new Set(ids)}).map(q => q.id)), all = new Set(n2);
  for (const level of FETCHED_LEVELS) {
    const pool = gamePool({inventory: levelInventory(level), examples, sets, sat: new Set(ids), level});
    assert.ok(pool.length > 2000, level + " has enough cards: " + pool.length);
    assert.deepEqual([...new Set(pool.map(q => q.kind))].sort(), ["definition", "listen", "meaning", "reading"], level + ": no grammar, connective or exam cards yet");
    for (const q of pool) {
      assert.ok(q.id.startsWith(q.id[0] + ":" + level + ":"), q.id);
      assert.ok(!all.has(q.id), "collides: " + q.id); all.add(q.id);
      assert.equal(q.level, level); assert.equal(levelOfCard(q), level);
      assert.ok(q.item.startsWith(level + ":"));
      assert.equal(q.target, null, "a miss must not enter N2's recall evidence");
      assert.equal(recallsMiss(q, "wrong"), false);
    }
  }
  // 明らか is N3 in Echo's lists; an N2 word of the same spelling would keep its bare id.
  assert.ok(all.has("m:N3:明らか") && !n2.has("m:N3:明らか"));
});

test("no level has been reviewed, and its cards are scored all the same; an unpaid card still counts and moves its record", () => {
  assert.deepEqual([...REVIEWED_LEVELS], ["N2"], "add a level only after its pool has been audited");
  for (const level of FETCHED_LEVELS) assert.ok(levelPool(level).every(q => !q.practice), level + ": scored (SCORE_ALL)");
  // The unpaid path (SCORE_ALL off) is kept: a card marked practice and record.
  const q = {...levelPool("N3")[0], practice: true, record: true}, before = {answered: 5, total: 900, level: .5, days: {}, bossFrom: 0};
  const miss = rememberAnswer(before, {q, outcome: "wrong", points: -200, now: 1000});
  for (const k of ["total", "level", "bossFrom"]) assert.deepEqual(miss[k], before[k], k + " is untouched: no points, and the hidden level stays");
  // It is an answer all the same: it counts toward the day and the 1,000 that open the boss.
  assert.equal(miss.answered, 6); assert.equal(Object.values(miss.days)[0].answered, 1); assert.ok(miss.runStart);
  assert.equal(bossProgress({...miss, answered: 1000}).open, true);
  assert.equal(miss.seen[q.id], 1000); assert.equal(miss.practiced, 1);
  assert.deepEqual([miss.tried[q.id], miss.missed[q.id]], [1, 1]);
  assert.deepEqual(miss.comeback, [q.id], "a miss comes back next round");
  const win = rememberAnswer(miss, {q, outcome: "right", fast: true, now: 2000 + ITEM_GAP});
  assert.deepEqual([win.tried[q.id], win.missed[q.id], win.wins[q.id], itemLevel(win, q.id)], [2, 1, 1, 1]);
  assert.deepEqual(win.comeback, []);
  assert.deepEqual(itemRecord(win, q.id), {level: 1, tried: 2, missed: 1, failRate: .5, seenAt: 2000 + ITEM_GAP, levelAt: 2000 + ITEM_GAP});
  // Connectives stay exposure only.
  const c = rememberAnswer({}, {q: {id: "c:x", practice: true}, outcome: "wrong", now: 5});
  assert.deepEqual(c, {seen: {"c:x": 5}, practiced: 1});
});

test("every scored answer keeps the item record too: tries, misses, the fail rate", () => {
  let st = {};
  const q = {id: "m:就任", target: ["word", "就任", "しゅうにん"]};
  for (const [i, outcome] of ["right", "wrong", "timeout", "right"].entries()) st = rememberAnswer(st, {q, outcome, now: 1000 + i});
  assert.deepEqual([st.tried[q.id], st.missed[q.id]], [4, 2]);
  assert.equal(itemRecord(st, q.id).failRate, .5);
  assert.deepEqual(itemRecord({}, "m:nothing"), {level: 0, tried: 0, missed: 0, failRate: null, seenAt: 0, levelAt: 0});
});

test("coverage counts a level's words once each: met, and known from item level " + KNOWN_LEVEL, () => {
  const pool = levelPool("N4"), words = new Set(pool.map(q => q.item)).size;
  assert.deepEqual(levelCoverage(pool, {}), {items: words, seen: 0, known: 0});
  const [a, b] = [pool.find(q => q.kind === "meaning"), pool.find(q => q.kind === "reading")], other = pool.find(q => q.item !== a.item && q.item !== b.item);
  const sameWord = pool.filter(q => q.item === a.item);
  const st = {seen: {[a.id]: 1, [sameWord.at(-1).id]: 2, [other.id]: 3}, lv: {[a.id]: KNOWN_LEVEL, [other.id]: KNOWN_LEVEL - 1}};
  assert.deepEqual(levelCoverage(pool, st), {items: words, seen: 2, known: 1});
  const n2 = gamePool({inventory, examples}), c = levelCoverage(n2, {seen: {"r:就任": 1, "m:就任": 1, "g:傾向がある": 1}});
  assert.equal(c.seen, 1, "N2 words count by their target; grammar is not a word");
  assert.equal(isCovered({items: 100, seen: 95}), true); assert.equal(isCovered({items: 100, seen: 94}), false); assert.equal(isCovered({items: 0, seen: 0}), false);
  assert.equal(COVERED, .95); assert.equal(aheadLevel("N3"), "N2"); assert.equal(aheadLevel("N1"), null);
});

test("the gate: only a boss moves the rank: up with a margin, skip far above, down on the second fail in a row", () => {
  assert.deepEqual({...EXAM_PASS}, {N5: 80, N4: 90, N3: 95, N2: 90, N1: 100});
  assert.deepEqual({...RANK_RULES}, {margin: 10, skip: 150, fails: 2});
  const v = (total, sectionsOk = true, rank = "N2") => bossVerdict({rank, total, sectionsOk});
  assert.deepEqual([v(89), v(90), v(99), v(100), v(149), v(150), v(180)], ["fail", "hold", "hold", "up", "up", "skip", "skip"]);
  assert.equal(v(160, false), "fail", "a section under its minimum fails whatever the total");
  assert.deepEqual([v(104, true, "N3"), v(105, true, "N3"), v(94, true, "N3")], ["hold", "up", "fail"]);
  assert.equal(bossVerdict({rank: "N2"}), null); assert.equal(bossVerdict({rank: "N0", total: 180}), null);
});

test("the boss moves the rank: up on a pass with margin, down on the second fail in a row, once per boss", () => {
  const up = applyBoss({answered: 1000}, {key: "run-1", rank: "N2", total: 120, now: Date.parse("2026-11-27T10:00:00Z")});
  assert.equal(rankOf(up), "N1"); assert.equal(up.rankAt, "2026-11-27T10:00:00.000Z"); assert.ok(!up.bossReady);
  assert.deepEqual(up.bossLog, [{key: "run-1", at: "2026-11-27T10:00:00.000Z", rank: "N2", total: 120, verdict: "up", to: "N1"}]);
  assert.equal(applyBoss(up, {key: "run-1", rank: "N2", total: 20}), up, "a boss is applied once");
  const skip = applyBoss(setRank({}, "N4", 1), {key: "s", rank: "N4", total: 160, now: 2});
  assert.equal(rankOf(skip), "N3"); assert.equal(skip.bossReady, true, "far above the line: the next boss opens at once");
  let st = applyBoss({answered: 1000}, {key: "a", rank: "N2", total: 70, now: 1});
  assert.equal(st.bossLog[0].verdict, "fail"); assert.equal(rankOf(st), "N2", "one fail moves nothing");
  st = applyBoss(st, {key: "b", rank: "N2", total: 60, now: 2});
  assert.equal(rankOf(st), "N3", "the second fail in a row goes down one level"); assert.equal(st.bossLog[1].to, "N3");
  const broken = applyBoss(applyBoss(applyBoss({answered: 1000}, {key: "a", rank: "N2", total: 70, now: 1}), {key: "b", rank: "N2", total: 95, now: 2}), {key: "c", rank: "N2", total: 70, now: 3});
  assert.equal(rankOf(broken), "N2", "a pass in between ends the streak");
  assert.equal(rankOf(applyBoss(setRank({}, "N1", 1), {key: "top", rank: "N1", total: 170, now: 2})), "N1", "nothing above N1 yet");
  assert.equal(rankOf(applyBoss(applyBoss(setRank({}, "N5", 1), {key: "x", rank: "N5", total: 10, now: 2}), {key: "y", rank: "N5", total: 10, now: 3})), "N5", "nothing below N5");
  const empty = {};
  assert.equal(applyBoss(empty, {key: "x", rank: "N2"}), empty, "no score: nothing"); assert.equal(applyBoss(empty, {rank: "N2", total: 100}), empty, "no key: nothing");
  // A boss of a rank the player no longer holds is logged and moves nothing.
  const held = applyBoss(setRank({}, "N3", 1), {key: "old", rank: "N2", total: 170, now: 2});
  assert.equal(rankOf(held), "N3"); assert.deepEqual([held.bossLog[0].verdict, held.bossLog[0].to, held.bossLog[0].waits], ["skip", undefined, undefined]);
});

test("where both levels have a boss the rank moves, and a skip opens the next boss at once", () => {
  // N1 ⇄ N2 would move if N1 had mocks; the rule is checked on the pieces that decide it.
  const src_ = src("../n2-game.js");
  assert.match(src_, /if \(to && hasBoss\(to\) && levels\.includes\(to\)\) \{ next = \{\.\.\.setRank\(state, to, now\), \.\.\.\(verdict === "skip" \? \{bossReady: true\} : \{\}\)\}; entry\.to = to; \}/);
  assert.deepEqual(bossProgress({bossReady: true, answered: 3}), {done: BOSS_EVERY, left: 0, open: true});
  const taken = takeBoss({bossReady: true, rank: "N2", answered: 3, total: 10}, {set: "n2-set-6", now: Date.parse("2026-11-27T11:00:00Z")});
  assert.equal(taken.bossReady, false); assert.equal(taken.runs[0].rank, "N2", "a run names the rank its boss was sat at");
  assert.equal(bossProgress(taken).open, false);
});

test("the last verdict reads in words on Home", () => {
  assert.equal(verdictLine(null), "");
  assert.equal(verdictLine({rank: "N2", total: 120, verdict: "up", waits: "N1"}), "Last boss 120 of 180: N2 passed: N1 opens when its exams exist");
  assert.equal(verdictLine({rank: "N3", total: 120, verdict: "up", to: "N2"}), "Last boss 120 of 180: N3 passed: now N2");
  assert.equal(verdictLine({rank: "N2", total: 93, verdict: "hold"}), "Last boss 93 of 180: passed, 100 moves the rank up");
  assert.equal(verdictLine({rank: "N2", total: 70, verdict: "fail"}), "Last boss 70 of 180, under the N2 line: one more like it moves the rank down");
  assert.equal(verdictLine({rank: "N2", total: 70, verdict: "fail", to: "N3"}), "Last boss 70 of 180, under the N2 line: now N3");
});

test("the item record and the boss verdicts sync: counts take the larger, a verdict is kept once, in time order", async () => {
  const {mergeGame} = await import("../sync.js");
  const a = {updatedAt: "2026-11-27T10:00:00Z", tried: {x: 3, y: 1}, missed: {x: 1}, bossLog: [{key: "r1", at: "2026-11-27T09:00:00Z", verdict: "fail"}, {key: "r2", at: "2026-11-27T09:30:00Z", verdict: "hold"}]};
  const b = {updatedAt: "2026-11-27T11:00:00Z", tried: {x: 2, z: 4}, missed: {x: 2, z: 1}, bossLog: [{key: "r1", at: "2026-11-27T09:05:00Z", verdict: "fail"}]};
  const m = mergeGame(a, b);
  assert.deepEqual(m.tried, {x: 3, y: 1, z: 4}); assert.deepEqual(m.missed, {x: 2, z: 1});
  assert.deepEqual(m.bossLog.map(e => e.key), ["r1", "r2"], "the same boss from two devices is one verdict");
  assert.ok(!("tried" in mergeGame({answered: 1}, {answered: 2})) && !("bossLog" in mergeGame({answered: 1}, {answered: 2})));
});

test("the game screen settles bosses on Home, shows coverage where there is no boss, and previews the level above", () => {
  const js = src("../n2-mock.js");
  assert.match(js, /const exam = run\.rank && !\(st\.bossLog \|\| \[\]\)\.some\(e => e\.key === run\.at\) \? examOf\(run\) : null;/, "runs from before the rules are left alone");
  assert.match(js, /applyBoss\(st, \{key: run\.at, rank: run\.rank, total: exam\.total, sectionsOk: exam\.sections\.every\(x => x\.ok\), levels: bossLevels\}\)/);
  assert.match(js, /const byKanji = !boss && !missing\.includes\(rankOf\(st\)\) && rankKanji \? kanjiCoverage\(rankKanji, st\) : null;/, "with no boss to open, Home counts kanji, not words");
  assert.match(js, /kanjiFirst = pools\[0\] && level !== "N2" && rankKanji \? \{order: rankKanji, examples: \[\.\.\.lower, \.\.\.n2Pool\.filter\(q => q\.kanji\)\]\} : null;/, "N2 is picked as it always was");
  assert.match(js, /nextRound\(\{pool: playable, review, kanji: kanjiFirst && /);
  assert.match(js, /if \(pools\[0\] && ahead && isCovered\(levelCoverage\(pool, readGame\(\)\)\)\)/);
  assert.match(js, /const lvFrom = q\.practice && !q\.record \? 0 : itemLevel/);
});

test("the cards of another level hold the same bar: four distinct choices, the answer never among the wrong ones", () => {
  for (const level of FETCHED_LEVELS) for (const [i, q] of levelPool(level).entries()) {
    assert.ok(!q.wrong.includes(q.answer) || new Set(q.wrong.filter(w => w !== q.answer)).size >= 3, q.id);
    if (i % 7) continue;
    const {choices, key} = choicesFor(q, seeded(i + 1), (i % 3) / 2);
    assert.equal(new Set(choices).size, 4, q.id); assert.equal(choices[key], q.answer, q.id);
    if (q.kind === "meaning" || q.kind === "listen") for (const c of choices) if (c !== q.answer) assert.ok(!sameSense(c, q.answer), q.id + ": " + c);
  }
});

test("the rank is a JLPT level; a state without one is N2, so nobody's progress moves", () => {
  assert.deepEqual([...RANKS], ["N5", "N4", "N3", "N2", "N1"]);
  assert.equal(DEFAULT_RANK, "N2");
  assert.equal(rankOf({answered: 3}), "N2", "a state from before ranks stays N2"); assert.equal(rankOf({}), "N5", "a new player starts at N5"); assert.equal(rankOf(undefined), "N5"); assert.equal(rankOf({rank: "N9", answered: 1}), "N2");
  const old = {seen: {"r:就任": 1}, wins: {"r:就任": 2}, lv: {"r:就任": 3}, comeback: ["m:就任"], total: 10};
  const set = setRank(old, "N3", Date.parse("2026-11-26T10:00:00Z"));
  assert.equal(rankOf(set), "N3"); assert.equal(set.rankAt, "2026-11-26T10:00:00.000Z");
  assert.deepEqual({...set, rank: undefined, rankAt: undefined}, {...old, rank: undefined, rankAt: undefined}, "setting a rank changes nothing else");
  assert.equal(setRank(old, "N0"), old, "not a rank yet");
});

test("the rank picks its level, and the levels under it come back as review", () => {
  assert.deepEqual(rankLevels("N5"), {level: "N5", review: []});
  assert.deepEqual(rankLevels("N3"), {level: "N3", review: ["N5", "N4"]});
  assert.deepEqual(rankLevels("N1"), {level: "N1", review: ["N5", "N4", "N3", "N2"]});
  // N2's rounds are all scored today; unscored lower levels stay out until reviewed.
  assert.deepEqual(rankLevels("N2"), {level: "N2", review: []});
  assert.deepEqual(rankLevels(), {level: "N2", review: []});
  assert.deepEqual(rankLevels("N2", new Set(["N2", "N4"])), {level: "N2", review: ["N4"]});
  for (const r of RANKS) assert.equal(hasBoss(r), true, r + " is a level with a boss (N1's papers are still being written)");
});

test("a round at rank N3 is N3 cards with a share of N4 and N5 review, one card a word", () => {
  const pool = levelPool("N3"), review = [...levelPool("N5"), ...levelPool("N4")];
  for (const seed of [1, 2, 3, 4, 5]) {
    const {round} = nextRound({pool, review, state: setRank({}, "N3"), random: seeded(seed), now: 1e12});
    assert.equal(round.length, ROUND_SIZE);
    const old = round.filter(q => q.review);
    assert.equal(old.length, REVIEW_SHARE);
    assert.ok(old.every(q => ["N5", "N4"].includes(q.level)) && round.filter(q => !q.review).every(q => q.level === "N3"));
    assert.equal(new Set(round.map(q => q.item)).size, ROUND_SIZE, "no word twice in a round");
    assert.ok(round.every(q => !q.practice), "every card of the round is scored");
    for (let i = 1; i < round.length; i++) assert.notEqual(round[i].kind, round[i - 1].kind, "no two of a kind in a row");
  }
  // Review cards rotate: the ones just seen give way to others.
  const first = nextRound({pool, review, state: {}, random: seeded(9), now: 1e12}).round.filter(q => q.review);
  const seen = Object.fromEntries(review.filter(q => first.some(f => f.item === q.item)).map(q => [q.id, 1e12]));
  const second = nextRound({pool, review, state: {seen}, random: seeded(9), now: 1e12 + 1000}).round.filter(q => q.review);
  assert.ok(second.every(q => !first.some(f => f.item === q.item)));
});

test("with nothing to review a round is picked exactly as before", () => {
  const pool = gamePool({inventory, examples}), state = {seen: {"r:就任": 5}, comeback: ["m:就任"], level: .6};
  const pick = extra => nextRound({pool, state, random: seeded(7), now: 1e12, ...extra}).round.map(q => q.id + "/" + q.seconds + "/" + q.bonus);
  assert.deepEqual(pick({review: []}), pick({}));
  assert.equal(nextRound({pool, state, random: seeded(7), now: 1e12}).round.some(q => q.review), false);
});

test("the rank syncs: the one set last wins, and a save that never chose one cannot take it away", async () => {
  const {mergeGame} = await import("../sync.js");
  const phone = {...setRank({answered: 10}, "N3", Date.parse("2026-11-26T10:00:00Z")), updatedAt: "2026-11-26T10:00:00Z"};
  const laptop = {answered: 12, sound: false, updatedAt: "2026-11-26T11:00:00Z"};
  for (const m of [mergeGame(phone, laptop), mergeGame(laptop, phone)]) { assert.equal(rankOf(m), "N3"); assert.equal(m.sound, false, "the rest still comes from the newer save"); }
  const later = {...setRank(laptop, "N4", Date.parse("2026-11-26T12:00:00Z")), updatedAt: "2026-11-26T09:00:00Z"};
  assert.equal(rankOf(mergeGame(phone, later)), "N4", "by when the rank was set, not when the save was made");
  assert.equal(rankOf(mergeGame({answered: 1}, {answered: 2})), "N2");
  assert.ok(!("rank" in mergeGame({answered: 1}, {answered: 2})));
});

test("the game screen loads the rank's levels, shows the rank on Home and sets it in Settings", () => {
  const js = src("../n2-mock.js"), html = src("../n2-mock.html");
  assert.match(js, /rankLevels\(rankOf\(readGame\(\)\)\)/);
  assert.match(js, /const review = hears\(\) \? lower : lower\.filter\(q => q\.kind !== "listen"\);\s*const next = nextRound\(\{pool: playable, review, /);
  assert.match(js, /\$\("game-rank"\)\.textContent = rank;/, "the rank is a chip beside the title");
  assert.match(html, /<span id="game-title">Quick round<\/span><span class="qr-chip" data-tone="seal" id="game-rank" hidden><\/span>/);
  assert.match(html, /id="game-radio-open" type="button"><span class="qr-glyph" lang="ja" aria-hidden="true">音<\/span>Radio<\/button>/, "Radio is 音, not a moon");
  assert.match(js, /writeGame\(setRank\(readGame\(\), v\)\); await loadRank\(\)/);
  assert.match(js, /const bossNow = \(\) => hasBoss\(bossRank\(\)\) && bossIds\.length \? bossSet\(\{sets: bossIds, attempts: data\.attempts, /, "no boss is promised while a level has no papers on the device");
  for (const r of RANKS) assert.ok(html.includes('role="radio" data-value="' + r + '">' + r + "</button>"), r);
  assert.match(html, /id="game-set-rank" role="radiogroup" aria-label="Rank"/);
});

// ---- Kanji first ----
const n2Parts = read("../n2-kanji-parts.json");

test("every word card names its kanji, with the base reading where the word splits", () => {
  const n2 = gamePool({inventory, examples, parts: n2Parts});
  assert.deepEqual(n2.find(q => q.id === "r:就任").kanji, ["就しゅう", "任にん"]);
  assert.deepEqual(n2.find(q => q.id === "m:就任").kanji, ["就しゅう", "任にん"]);
  assert.ok(n2.filter(q => q.kind === "grammar").every(q => !q.kanji));
  assert.deepEqual(gamePool({inventory, examples}).find(q => q.id === "r:就任").kanji, ["就", "任"], "without the split, the bare kanji");
  const n3 = levelPool("N3");
  assert.deepEqual(n3.find(q => q.id === "r:N3:一般").kanji, ["一いち", "般はん"], "the base reading, not the sound change (いっぱん)");
  assert.ok(n3.filter(q => q.kind === "reading").every(q => q.kanji?.length));
  // Stripping the tag leaves the N2 pool exactly as it was.
  const strip = pool => pool.map(({kanji, ...q}) => q);
  assert.deepEqual(strip(n2), strip(gamePool({inventory, examples})));
});

test("the kanji record: met on any card, read on reading cards, transfer on a word never shown", () => {
  const card = (id, kind, kanji) => ({id, kind, kanji, practice: true, record: true});
  let st = rememberAnswer({}, {q: card("m:N3:一般", "meaning", ["一いつ", "般はん"]), outcome: "wrong", now: 10});
  assert.deepEqual(st.kj, {"一いつ": [1, 0, 0, 0, 10, 0], "般はん": [1, 0, 0, 0, 10, 0]}, "a meaning card meets the kanji and says nothing of its reading");
  // The same word again: right, but no transfer: the word has been shown.
  assert.equal(newWord(st, {id: "r:N3:一般"}), false);
  st = rememberAnswer(st, {q: card("r:N3:一般", "reading", ["一いつ", "般はん"]), outcome: "right", now: 20});
  assert.deepEqual(st.kj["般はん"], [2, 1, 0, 0, 20, 0]);
  // 般 in a word never shown: the reading was rebuilt.
  assert.equal(newWord(st, {id: "r:N3:全般"}), true);
  st = rememberAnswer(st, {q: card("r:N3:全般", "reading", ["全ぜん", "般はん"]), outcome: "right", now: 30});
  assert.deepEqual(st.kj["般はん"], [3, 2, 0, 1, 30, 0]);
  assert.deepEqual(st.kj["全ぜん"], [1, 1, 0, 0, 30, 0], "a kanji never met cannot transfer: it may have been a guess");
  st = rememberAnswer(st, {q: card("r:N3:諸般", "reading", ["諸しょ", "般はん"]), outcome: "timeout", now: 40});
  assert.deepEqual(st.kj["般はん"], [4, 2, 1, 1, 40, 1], "a missed reading marks it weak");
  assert.deepEqual(kanjiStates(st).get("般"), {met: 4, right: 2, transfer: 1, at: 40, weak: true});
  // Scored N2 cards keep it too; cards without kanji leave it alone.
  const n2 = rememberAnswer({}, {q: {id: "r:就任", kind: "reading", kanji: ["就しゅう", "任にん"], target: ["word", "就任", "しゅうにん"]}, outcome: "right", now: 5});
  assert.deepEqual(n2.kj["就しゅう"], [1, 1, 0, 0, 5, 0]);
  assert.deepEqual(kanjiAfter({kj: {x: [1]}}, {q: {id: "g:x", kind: "grammar"}, outcome: "right"}), {x: [1]});
});

test("coverage counts a level's kanji: met, and known by one transfer or three right readings", () => {
  assert.deepEqual({...KANJI_KNOWN}, {transfer: 1, right: 3});
  const st = {kj: {"般はん": [3, 2, 0, 1, 1, 0], "一いつ": [5, 1, 0, 0, 1, 0], "一いち": [4, 2, 0, 0, 1, 0], "全ぜん": [1, 1, 0, 0, 1, 0], "影": [1, 0, 0, 0, 1, 0]}};
  assert.deepEqual(kanjiCoverage("般一全影響", st), {items: 5, met: 4, known: 2}, "一 is known over its two readings together");
  assert.deepEqual(kanjiCoverage(levelsManifest.kanji.N3, {}), {items: 638, met: 0, known: 0});
});

test("a kanji-first round: new kanji in level order, then proving them in words never shown, a missed one again", () => {
  const order = levelsManifest.kanji.N3, pool = levelPool("N3"), examples = [...levelPool("N5"), ...levelPool("N4"), ...gamePool({inventory, examples: new Map(), parts: n2Parts}).filter(q => q.kanji)];
  const first = kanjiPick({pool, examples, order, state: {}, size: 8, random: seeded(1), now: 1e12});
  assert.equal(first.length, 8);
  assert.ok(first.every(q => q.why === "fresh" && order.includes(q.focus) && q.kanji.some(key => key.startsWith(q.focus))), "a new player meets new kanji");
  assert.deepEqual(first.map(q => q.focus).sort(), [...order].filter(k => pool.some(q => q.kanji?.some(key => key.startsWith(k)))).slice(0, 8).sort(), "the level's first eight, in its order");
  assert.equal(new Set(first.map(q => q.item)).size, 8, "no word twice");
  assert.ok(new Set(first.map(q => q.kind)).size > 1, "not all one kind of card");
  // Answer them (one reading missed), then the next round proves and repairs.
  let st = {};
  const missed = first.find(q => q.kind === "reading");
  for (const q of first) st = rememberAnswer(st, {q, outcome: q === missed ? "wrong" : "right", now: 1e12});
  const second = kanjiPick({pool, examples, order, state: st, size: 8, random: seeded(2), now: 1e12 + 5 * 3600_000});
  const by = why => second.filter(q => q.why === why);
  assert.ok(by("weak").some(q => q.focus === missed.focus && q.kind === "reading"), "the missed reading comes back");
  assert.equal(by("fresh").length, KANJI_MIX.fresh); assert.equal(by("prove").length, KANJI_MIX.prove + (KANJI_MIX.weak - by("weak").length));
  for (const q of [...by("prove"), ...by("weak")]) assert.equal(q.kind, "reading", "proving is reading");
  const unseenFor = k => [...pool, ...examples].some(q => q.kind === "reading" && newWord(st, q) && q.kanji.some(key => key.startsWith(k)));
  for (const q of by("prove")) assert.equal(newWord(st, q), unseenFor(q.focus), q.focus + ": in a word never shown when there is one");
  // 一般 was shown; 般 is then proved in another word, never 一般 again, when the lists have one.
  const mini = [{id: "r:N3:一般", kind: "reading", item: "N3:一般", kanji: ["一いち", "般はん"]}, {id: "r:N3:全般", kind: "reading", item: "N3:全般", kanji: ["全ぜん", "般はん"]}];
  const met = rememberAnswer({}, {q: {...mini[0], practice: true, record: true}, outcome: "right", now: 1});
  assert.deepEqual(kanjiPick({pool: mini, order: "般", state: met, size: 1, now: 1e12}).map(q => [q.id, q.why]), [["r:N3:全般", "prove"]]);
  assert.ok(second.every(q => !first.some(f => f.item && f.item === q.item) || !newWord(st, q)));
  // A word may come from another level when the rank's own list has no second one.
  let far = st; const seenAll = {...st.seen}; for (const q of pool) seenAll[q.id] = 1; far = {...st, seen: seenAll};
  assert.ok(kanjiPick({pool, examples, order, state: far, size: 8, random: seeded(3), now: 1e12}).some(q => q.level !== "N3"), "examples from other levels");
});

test("at a rank of word cards the round is kanji first, with the comebacks first and the review places kept", () => {
  const order = levelsManifest.kanji.N3, pool = levelPool("N3"), review = [...levelPool("N5"), ...levelPool("N4")];
  const back = pool.find(q => q.kind === "reading");
  const {round} = nextRound({pool, review, kanji: {order, examples: review}, state: {comeback: [back.id]}, random: seeded(4), now: 1e12});
  assert.equal(round.length, ROUND_SIZE);
  assert.equal(round[0].id, back.id); assert.equal(round[0].comeback, true);
  assert.equal(round.filter(q => q.review).length, REVIEW_SHARE);
  assert.equal(round.filter(q => q.focus).length, ROUND_SIZE - REVIEW_SHARE - 1);
  assert.equal(new Set(round.map(q => q.item)).size, ROUND_SIZE, "no word twice, the review places included");
  // Without `kanji` nothing changes: the round is picked by card, as N2's is.
  assert.ok(nextRound({pool, review, state: {}, random: seeded(4), now: 1e12}).round.every(q => !q.focus));
});

test("the kanji record syncs: counts take the larger, last seen and weak follow the later sighting", async () => {
  const {mergeGame} = await import("../sync.js");
  const a = {updatedAt: "2026-11-27T10:00:00Z", kj: {"般はん": [3, 2, 0, 1, 500, 0], "一いつ": [1, 0, 0, 0, 100, 0]}};
  const b = {updatedAt: "2026-11-27T09:00:00Z", kj: {"般はん": [4, 1, 1, 0, 900, 1], "全ぜん": [1, 1, 0, 0, 50, 0]}};
  for (const m of [mergeGame(a, b), mergeGame(b, a)]) assert.deepEqual(m.kj, {"般はん": [4, 2, 1, 1, 900, 1], "一いつ": [1, 0, 0, 0, 100, 0], "全ぜん": [1, 1, 0, 0, 50, 0]});
  assert.ok(!("kj" in mergeGame({answered: 1}, {answered: 2})));
});

test("every kanji of a level can be asked: each has a reading card, with wrong readings that are wrong", () => {
  for (const level of FETCHED_LEVELS) {
    const pool = levelPool(level), reads = pool.filter(q => q.kind === "reading");
    for (const k of levelsManifest.kanji[level]) assert.ok(reads.some(q => q.kanji.some(key => key.startsWith(k))), level + " " + k);
    for (const q of reads) { assert.ok(!q.wrong.includes(q.answer), q.id); assert.ok(new Set(q.wrong).size >= 3, q.id); }
  }
  // 委員 いいん has no voicing or long-vowel trap: words that share a kanji give the wrong readings.
  const q = levelPool("N3").find(q => q.id === "r:N3:委員");
  assert.equal(q.answer, "いいん"); assert.ok(q.wrong.includes("かいいん"));
  // N2's reading cards are not widened: its pool is audited as it is.
  assert.equal(gamePool({inventory, examples}).filter(q => q.kind === "reading").length, gamePool({inventory, examples, parts: n2Parts}).filter(q => q.kind === "reading").length);
});

// ---- A boss at every level ----
test("each level's exam: its sections, minimums, pass mark and clocks", async () => {
  const {LEVEL_EXAM, estimate, examOf, PASS_TOTAL} = await import("../n2-study.js");
  assert.deepEqual(Object.fromEntries(Object.entries(LEVEL_EXAM).map(([l, e]) => [l, [e.pass, e.sections.length, e.minutes.written, e.minutes.listening]])),
    {N5: [80, 2, 60, 30], N4: [90, 2, 80, 35], N3: [95, 3, 100, 40], N2: [90, 3, 105, 50], N1: [100, 3, 110, 55]});
  for (const l of RANKS) assert.equal(LEVEL_EXAM[l].pass, EXAM_PASS[l], l + ": the gate and the exam agree");
  assert.equal(examOf({}).pass, PASS_TOTAL); assert.equal(examOf({level: "N4"}).pass, 90);
  // N4: two sections, 120 and 60. 30 written questions (10 a skill) and 10 listening.
  const questions = Array.from({length: 40}, (_, i) => ({index: i, skill: Math.floor(i / 10), key: 1}));
  const answers = questions.map((q, i) => (i < 20 || i >= 30 && i < 36 ? 1 : 2)); // 20 of 30 written, 6 of 10 listening
  const e = estimate({level: "N4", questions}, {phase: "results", answers});
  assert.deepEqual(e.sections.map(s => [s.key, s.scaled, s.ok, s.max]), [["knowledge-reading", 80, true, 120], ["listening", 36, true, 60]]);
  assert.deepEqual([e.total, e.complete, e.pass, e.passTotal, e.level], [116, true, true, 90, "N4"]);
  const low = estimate({level: "N4", questions}, {phase: "results", answers: questions.map((q, i) => (i < 30 ? 1 : i < 33 ? 1 : 2))});
  assert.deepEqual([low.total, low.sections[1].scaled, low.sections[1].ok, low.pass], [138, 18, false, false], "a section under its minimum fails whatever the total");
  // The same answers on an N2 paper score as they always did: three sections of 60.
  const n2 = estimate({questions}, {phase: "results", answers});
  assert.deepEqual(n2.sections.map(s => s.scaled), [60, 0, 36]); assert.ok(!("passTotal" in n2) && !("max" in n2.sections[0]));
  // N3 passes at 95, not 90.
  const n3 = estimate({level: "N3", questions}, {phase: "results", answers: questions.map((q, i) => (i % 2 ? 1 : 2))});
  assert.deepEqual([n3.total, n3.pass], [90, false]);
});

test("the boss of a level is one of its own papers: an unsat one first, its held-out papers last", () => {
  const ids = Array.from({length: 10}, (_, i) => "n3-set-" + (i + 1)), held = ["n3-set-9", "n3-set-10"];
  assert.deepEqual(bossSet({sets: ids, attempts: [], held, prefix: "n3-set-"}), {id: "n3-set-1", fresh: true, beatenToday: false});
  const sat = ids.slice(0, 8).map((book, i) => ({book, phase: "results", completedAt: "2026-11-0" + (i + 1) + "T10:00:00Z"}));
  assert.equal(bossSet({sets: ids, attempts: sat, held, prefix: "n3-set-"}).id, "n3-set-9", "the held-out papers come once the others are sat");
  const all = [...sat, {book: "n3-set-9", phase: "results", completedAt: "2026-11-10T10:00:00Z"}, {book: "n3-set-10", phase: "results", completedAt: "2026-11-11T10:00:00Z"}];
  assert.deepEqual(bossSet({sets: ids, attempts: all, held, prefix: "n3-set-", now: new Date("2026-11-20T10:00:00")}), {id: "n3-set-1", fresh: false, beatenToday: false}, "then the one sat longest ago");
  assert.equal(bossSet({sets: ids, attempts: [{book: "n2-set-5", phase: "results", completedAt: new Date().toISOString()}], held, prefix: "n3-set-"}).beatenToday, false, "an N2 sitting is not this level's boss");
});

test("the exam screen sits a paper of any level, and the game opens each rank's boss", () => {
  const js = src("../n2-mock.js"), sw = src("../sw.js");
  assert.match(js, /const levelSet = isLevelSet\(year\);\s*const native = bookIds\.includes\(year\) \|\| adaptive \|\| levelSet;/);
  assert.match(js, /const paper = \{id: key, book: id, level, title: [^;]+, edition, minutes: LEVEL_EXAM\[level\]\.minutes, questions: levelRows\(set\)\};/, "the paper names its level and its clocks");
  assert.match(js, /params\.get\("boss"\) === "1" && \(realistic\(year\) \|\| levelSet\)\) state\.boss = true;/);
  assert.match(js, /else \{ bossIds = Object\.keys\(\(await gameSets\.index\(level\)\)\?\.sets \|\| gameSets\.ready\(level\)\?\.sets \|\| \{\}\); gameSets\.keep\(level\)\.catch\(\(\) => \{\}\); \}/, "the papers are kept on the device ahead of the boss");
  assert.match(js, /el\("b", \{text: e\.passTotal \?\? PASS_TOTAL\}\)/, "results show the level's pass line");
  assert.ok(sw.includes('"./jlpt-sets.js"'));
  assert.match(src("../n2-progress.js"), /if\(paper\.level&&paper\.level!=="N2"\) continue;/, "another level's paper is never N2 evidence");
});

// Owner's report, 27 Nov: "I was told the following round would be calm with
// words I know, but the exact opposite happened. I got only new words."
test("the recovery round after a hard one is made of cards already won, even ones seen minutes ago", () => {
  const pool = gamePool({inventory, examples}), random = seeded(1), t0 = 1.8e12;
  let st = {};
  // Three good rounds and a bad one, two minutes apart: everything won is "recent".
  for (let r = 0; r < 4; r++) {
    const now = t0 + r * 120_000, {round} = nextRound({pool, state: st, random, now});
    let miss = 0;
    for (const q of round) { const outcome = r === 3 && miss < 7 ? (miss++, "wrong") : "right"; st = rememberAnswer(st, {q, outcome, fast: outcome === "right", now}); }
    st = rememberRound(st, {score: 0, questions: round, misses: r === 3 ? 7 : 0, scored: 10, now});
  }
  assert.equal(inSlump(st), true);
  const {round, warmUp} = nextRound({pool, state: st, random, now: t0 + 4 * 120_000});
  assert.equal(warmUp, true); assert.equal(round.length, ROUND_SIZE);
  const rest = round.filter(q => !q.comeback);
  assert.equal(round.length - rest.length, WARM_UP.comeback, "two of the misses come back, no more");
  assert.ok(rest.filter(q => st.wins[q.id]).length >= rest.length - WARM_UP.mix.fresh, "the rest are cards the player has won: " + rest.map(q => st.wins[q.id] ? "won" : "new").join(" "));
  assert.ok(rest.filter(q => !st.seen[q.id]).length <= WARM_UP.mix.fresh, "at most one new card");
  // Outside a recovery round the four-hour rest still holds: nothing just seen comes back.
  const good = {...st, history: [...st.history, {at: "x", right: 9, n: 10}]};
  assert.ok(nextRound({pool, state: {...good, comeback: []}, random, now: t0 + 5 * 120_000}).round.every(q => !st.seen[q.id]));
});

test("a round is only called a recovery round when it is one, and it comes first at a kanji-first rank too", () => {
  const pool = gamePool({inventory, examples}), slumped = {history: [{at: "a", right: 2, n: 10}]};
  const fresh = nextRound({pool, state: slumped, random: seeded(2), now: 1.8e12});
  assert.equal(fresh.warmUp, false, "a new player has won nothing: the ribbon must not promise things they know");
  assert.equal(fresh.round.length, ROUND_SIZE);
  // Rank N3: after a hard round the won N3 cards come back, not new kanji.
  const n3 = levelPool("N3"), review = [...levelPool("N5"), ...levelPool("N4")], order = levelsManifest.kanji.N3, random = seeded(3), t0 = 1.8e12;
  let st = {};
  for (let r = 0; r < 4; r++) {
    const now = t0 + r * 120_000, {round} = nextRound({pool: n3, review, kanji: {order, examples: review}, state: st, random, now});
    let miss = 0;
    for (const q of round) { const outcome = r === 3 && miss < 7 ? (miss++, "wrong") : "right"; st = rememberAnswer(st, {q, outcome, fast: outcome === "right", now}); }
    st = rememberRound(st, {score: 0, questions: round, misses: r === 3 ? 7 : 0, scored: 10, now});
  }
  const {round, warmUp} = nextRound({pool: n3, review, kanji: {order, examples: review}, state: st, random, now: t0 + 4 * 120_000});
  assert.equal(warmUp, true);
  assert.ok(round.every(q => !q.focus), "no kanji-first picking in the recovery round");
  assert.ok(round.filter(q => !q.comeback && !st.seen[q.id]).length <= WARM_UP.mix.fresh, "at most one new card, the review places included");
});

// Owner's report, 27 Nov: in …にしろ…にしろ only the first にしろ was underlined.
test("a pattern written in pieces is underlined in every piece", async () => {
  const {exampleSegments} = await import("../n2-delayed.js");
  assert.deepEqual(piecesNeedle("賛成にしろ反対にしろ、理由をはっきり言ってください。", "にしろ～にしろ"), ["にしろ", "にしろ"]);
  assert.deepEqual(piecesNeedle("このスープは辛いことは辛いが、とてもおいしい。", "ことは〜が"), ["ことは", "が"]);
  assert.equal(piecesNeedle("彼は行かざるを得ない。", "ざるを得ない"), null, "one piece: the usual underline");
  assert.equal(piecesNeedle("出かけようとしているところに、電話がかかってきた。", "～ところに・～ところへ"), null, "alternatives, not pieces");
  assert.equal(piecesNeedle("賛成にしろ、言ってください。", "にしろ～にしろ"), null, "a piece missing: fall back");
  const pool = gamePool({inventory, examples}), marks = id => { const q = pool.find(q => q.id === id); return exampleSegments(q.sentence, [q.needle]).filter(x => x.mark).map(x => x.text); };
  assert.deepEqual(marks("g:にしろ-にしろ"), ["にしろ", "にしろ"]);
  assert.deepEqual(marks("g:やら-やら"), ["やら", "やら"]);
  assert.deepEqual(marks("g:ては-ては"), ["ては", "ては"]);
  assert.deepEqual(marks("g:ことは-が"), ["ことは", "が"]);
  assert.deepEqual(marks("g:ないことには-ない"), ["ないことには", "ない"]);
  assert.deepEqual(marks("g:にしても-にしても"), ["にしても", "にしても"], "the reviewed spans still decide where they exist");
  // Every N2 pattern written with ～ between pieces marks at least two places.
  for (const [key, name] of inventory.grammar) {
    const pieces = name.replace(/[①-⑨]|（[^）]*）|\([^)]*\)/g, "").split(/[〜～…]+/).filter(x => x.trim());
    const q = pool.find(q => q.id === "g:" + key);
    if (pieces.length < 2 || name.includes("・") || !q) continue;
    assert.ok(exampleSegments(q.sentence, [q.needle]).filter(x => x.mark).length >= 2 || key === "お-願う", key + ": " + q.sentence);
  }
});

// Owner's report, 27 Nov: "there is one sentence, I get the audio, but not the example sentence."
test("a listen card keeps its sentence when the word is written there in another form", () => {
  assert.equal(heardGap("夕方【ゆうがた】、縁側【えんがわ】で涼【すず】んでいた。", "涼む"), "涼");
  assert.equal(heardGap("隣【となり】の部屋【へや】が騒々【そうぞう】しくて眠【ねむ】れない。", "騒々しい"), "騒々し");
  assert.equal(heardGap("東西【とうざい】に延【の】びる大通【おおどお】り。", "東西"), "東西", "as written when it is there");
  assert.equal(heardGap("今日【きょう】は暑【あつ】い。", "涼む"), "", "not in the sentence: the sound alone");
  assert.equal(heardGap("", "涼む"), ""); assert.equal(heardGap("涼む", ""), "");
  const listen = gamePool({inventory, examples}).filter(q => q.kind === "listen");
  const alone = listen.filter(q => !heardGap(q.solution.ja, q.prompt));
  assert.ok(alone.length < listen.length * .02, alone.length + " of " + listen.length + " listen cards are the sound alone: " + alone.slice(0, 8).map(q => q.prompt).join(" "));
  const mock = src("../n2-mock.js");
  assert.match(mock, /const gap = listen && q\.solution\?\.ja \? heardGap\(q\.solution\.ja, q\.prompt\) : "";/);
  assert.match(mock, /\$\("game-blank"\)\.textContent = q\.kind === "listen" \? q\.gap \|\| q\.prompt : q\.answer;/, "the gap fills with what the sentence holds, not the dictionary form");
});

// Owner, 27 Nov: "a link to the run on Home so that I can look at my mistakes anytime".
test("a finished run on Home links to its boss results", () => {
  const js = src("../n2-mock.js");
  assert.match(js, /el\(sitting \? "a" : "div", \{class: "qr-rk", href: sitting \? "\?book=" \+ encodeURIComponent\(sitting\.book\) \+ "&attempt=" \+ encodeURIComponent\(sitting\.id\) : undefined,/);
  assert.match(js, /const no = all\.findIndex\(x => x\.at === r\.at\) \+ 1, sitting = r\.exam && bossSitting\(r\);/, "only a run whose boss is finished");
  assert.match(src("../styles.css"), /\.n2-game a\.qr-rk:hover\{color:var\(--sumi\)\}/);
});

// Owner, 27 Nov: N2 comes first until 6 Dec. Passing the N2 boss must not move the player to a level with no papers.
test("the rank waits when the next level has no papers on the device", () => {
  const passed = applyBoss({answered: 1000}, {key: "r1", rank: "N2", total: 130, now: 5, levels: ["N5", "N4", "N3", "N2"]});
  assert.equal(rankOf(passed), "N2");
  assert.deepEqual([passed.bossLog[0].verdict, passed.bossLog[0].waits, passed.bossLog[0].to], ["up", "N1", undefined]);
  assert.equal(verdictLine(passed.bossLog[0]), "Last boss 130 of 180: N2 passed: N1 opens when its exams exist");
  const down = applyBoss(applyBoss({answered: 1000}, {key: "a", rank: "N2", total: 60, now: 1, levels: ["N3", "N2"]}), {key: "b", rank: "N2", total: 60, now: 2, levels: ["N3", "N2"]});
  assert.equal(rankOf(down), "N3", "a level with papers is reachable");
  assert.equal(rankOf(applyBoss({answered: 1000}, {key: "r1", rank: "N2", total: 130, now: 5})), "N1", "with every level's papers there, it moves");
  const js = src("../n2-mock.js");
  assert.match(js, /sectionsOk: exam\.sections\.every\(x => x\.ok\), levels: bossLevels\}\)/);
});
