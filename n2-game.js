// Quick round: a fast, mixed, multiple-choice game over all of Echo's N2
// material. A few seconds a question, points for right and fast, a streak,
// an honest "I don't know", and a review of every miss after the round.
//
// Question kinds, all from material already in Echo:
//   reading     a word in its deck sentence; pick its reading among near
//               misses (voicing, long vowel, small っ: the 問題1 traps)
//   meaning     a word; pick its meaning among words that share a kanji
//   definition  a definition; pick the word it defines
//   listen      a word heard (device voice, with its reading); pick its meaning
//   homophone   a reading in a sentence; pick the word (問題2 表記)
//   grammar     a pattern underlined in its deck sentence; pick its meaning
//   exam        short authored questions (問題1–5, 7) from sets the learner
//               has already sat, so an unseen set stays unseen for a mock
//
// Recognition is not recall: a right answer saves nothing, but a miss, a
// timeout or "I don't know" saves a missed recall check (source "game"), so
// game misses join Today's checks, Evening recall and the Night Radio.
// Pure (no DOM, no storage): test/n2-game.test.js holds it.
import {recallItems, localDay} from "./n2-study.js";
import {HELD_OUT} from "./n2-comprehension.js";

const keyOf = target => JSON.stringify(target);
export const GAME_KEY = "echo-n2-game";
export const GAME_SOURCE = "game";
// Rounds are short so a few spare seconds are enough; every answer is saved
// as it is given, so closing the page mid-round loses nothing.
// Blitz chess, not shogi (owner, 26 Nov): seconds, not minutes, per question.
export const ROUND_SIZE = 10, REVIEW_SECONDS = 5, DAILY_GOAL = 1000, RECENT_MS = 4 * 3600_000;
export const SECONDS = Object.freeze({reading: 3, meaning: 3, definition: 4, listen: 5, homophone: 5, grammar: 6, exam: {1: 4, 2: 5, 3: 5, 4: 7, 5: 6, 7: 8}});
// The pause after an answer before the next question, in milliseconds.
export const PAUSE = Object.freeze({right: 250, miss: 800});
export const KIND_LABEL = Object.freeze({reading: "Reading", meaning: "Meaning", definition: "Which word", listen: "Listen", homophone: "Which kanji", grammar: "Grammar", exam: "Exam question"});
const EXAM_MONDAI = new Set([1, 2, 3, 4, 5, 7]);
const KANJI = /[一-鿿々]/g;
const plain = s => String(s || "").replace(/【[^】]*】/g, "");
// A short English gloss with no Japanese in it: JMdict's "(same as 親戚 (しんせき))"
// would give the answer away.
const JP = /[ぁ-んァ-ヶ一-龯々]/;
export const gloss = s => String(s || "").replace(/\((?:[^()]|\([^()]*\))*\)/g, m => JP.test(m) ? "" : m).split(/[,;]/)
  .map(x => x.replace(/\s+/g, " ").trim()).filter(x => x && !JP.test(x)).slice(0, 2).join(", ");

// A seeded shuffle, so tests can fix the order.
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---- Reading near misses ----
// The traps 問題1 sets: a voiced or unvoiced sound, a long or short vowel, a
// small っ added or dropped, a small ゃゅょ made big.
const VOICE = {か:"が",き:"ぎ",く:"ぐ",け:"げ",こ:"ご",さ:"ざ",し:"じ",す:"ず",せ:"ぜ",そ:"ぞ",た:"だ",ち:"ぢ",つ:"づ",て:"で",と:"ど",は:"ば",ひ:"び",ふ:"ぶ",へ:"べ",ほ:"ぼ"};
const UNVOICE = Object.fromEntries(Object.entries(VOICE).map(([a, b]) => [b, a]));
const HALF = {ば:"ぱ",び:"ぴ",ぶ:"ぷ",べ:"ぺ",ぼ:"ぽ",ぱ:"ば",ぴ:"び",ぷ:"ぶ",ぺ:"べ",ぽ:"ぼ"};
const SMALL = {ゃ:"や",ゅ:"ゆ",ょ:"よ"};
const O_ROW = new Set([..."おこごそぞとどのほぼぽもよろ"]);
const STOP_AFTER = new Set([..."かきくけこさしすせそたちつてとぱぴぷぺぽ"]);
const STOP_FROM = {く: true, つ: true, ち: true, き: true};
export function nearMisses(reading = "") {
  const r = [...reading], out = new Set();
  const put = arr => { const s = arr.join(""); if (s && s !== reading && !/^[っー]|っ$|っっ|うう/.test(s)) out.add(s); };
  r.forEach((ch, i) => {
    const next = r[i + 1], swap = c => put([...r.slice(0, i), c, ...r.slice(i + 1)]);
    for (const map of [VOICE, UNVOICE, HALF]) if (map[ch]) swap(map[ch]);
    if (SMALL[ch]) swap(SMALL[ch]);
    // Long and short vowels: こう/こ, しゅう/しゅ, しょう/しょ.
    if (ch === "う" && i > 0 && (O_ROW.has(r[i - 1]) || r[i - 1] === "ゅ" || r[i - 1] === "ょ")) put([...r.slice(0, i), ...r.slice(i + 1)]);
    if ((O_ROW.has(ch) || ch === "ゅ" || ch === "ょ") && next && next !== "う" && next !== "ゃ" && next !== "ゅ" && next !== "ょ") put([...r.slice(0, i + 1), "う", ...r.slice(i + 1)]);
    // Small っ where two kanji meet: がっこう/がくこう, いっさい/いちさい.
    if (ch === "っ") { swap("く"); swap("つ"); swap("ち"); }
    if (STOP_FROM[ch] && next && STOP_AFTER.has(next) && i > 0) swap("っ");
  });
  return [...out];
}

// ---- The pool ----
// examples: the deck sentences by target (examplesFromDecks). sets: authored
// N2 sets; only those in `sat` give exam questions, never HELD_OUT.
export function gamePool({inventory, examples = new Map(), sets = [], sat = new Set()}) {
  const items = recallItems(inventory), pool = [];
  // Affixes such as ～発 are left out: they are not words to pick or read alone.
  const words = items.meaning.map(it => ({target: it.target, text: it.target[1], reading: it.reading || it.target[2], answer: it.answer})).filter(w => !/[〜～]/.test(w.text));
  const byKanji = new Map();
  for (const w of words) for (const k of new Set(w.text.match(KANJI) || [])) byKanji.set(k, [...(byKanji.get(k) || []), w]);
  const byReading = new Map();
  for (const w of words) byReading.set(w.reading, [...(byReading.get(w.reading) || []), w]);
  const sentenceOf = target => (examples.get(keyOf(target)) || [])[0] || null;

  for (const [i, w] of words.entries()) {
    const ex = sentenceOf(w.target), kanji = w.text.match(KANJI);
    if (kanji && w.reading && w.reading !== w.text) {
      const misses = nearMisses(w.reading);
      if (misses.length >= 3) pool.push({id: "r:" + w.text, kind: "reading", target: w.target, dimension: "reading", prompt: w.text,
        sentence: ex ? plain(ex.ja) : "", needle: w.text, answer: w.reading, wrong: misses, seconds: SECONDS.reading,
        solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    }
    // Meaning: confusable words share a kanji; the rest come from anywhere.
    const near = [...new Set((kanji || []).flatMap(k => byKanji.get(k) || []))].filter(o => o !== w && gloss(o.answer) !== gloss(w.answer));
    const far = [words[(i * 7 + 13) % words.length], words[(i * 11 + 101) % words.length], words[(i * 17 + 307) % words.length], words[(i * 23 + 503) % words.length]].filter(o => o !== w);
    const wrongMeanings = [...new Set([...near, ...far].map(o => gloss(o.answer)).filter(g => g && g !== gloss(w.answer)))];
    const own = gloss(w.answer);
    if (own && wrongMeanings.length >= 3) pool.push({id: "m:" + w.text, kind: "meaning", target: w.target, dimension: "meaning", prompt: w.text,
      sentence: "", answer: gloss(w.answer), wrong: wrongMeanings, nearCount: Math.min(3, near.length), seconds: SECONDS.meaning,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Definition: the meaning shown, the word to find among words sharing a kanji.
    const nearWords = near.map(o => o.text), farWords = far.map(o => o.text).filter(t => !nearWords.includes(t));
    if (own && kanji && nearWords.length + farWords.length >= 3) pool.push({id: "d:" + w.text, kind: "definition", target: w.target, dimension: "meaning", prompt: gloss(w.answer),
      sentence: "", answer: w.text, wrong: [...nearWords, ...farWords], nearCount: Math.min(3, nearWords.length), seconds: SECONDS.definition,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Listen: the word heard, its meaning to pick (the same confusable set).
    if (own && wrongMeanings.length >= 3) pool.push({id: "l:" + w.text, kind: "listen", target: w.target, dimension: "meaning", prompt: w.text, say: w.reading,
      sentence: "", answer: gloss(w.answer), wrong: wrongMeanings, nearCount: Math.min(3, near.length), seconds: SECONDS.listen,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Homophones: the same reading, different words (問題2 表記).
    const same = (byReading.get(w.reading) || []).filter(o => o.text !== w.text);
    if (same.length && ex && plain(ex.ja).includes(w.text)) {
      const shared = [...new Set((kanji || []).flatMap(k => byKanji.get(k) || []))].filter(o => o.text !== w.text && !same.includes(o));
      pool.push({id: "h:" + w.text, kind: "homophone", target: w.target, dimension: "meaning", prompt: w.reading,
        sentence: plain(ex.ja).replace(w.text, "【" + w.reading + "】"), needle: "【" + w.reading + "】", answer: w.text,
        wrong: [...same.map(o => o.text), ...shared.map(o => o.text)], seconds: SECONDS.homophone,
        solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex.ja, en: ex.en || "", others: same.map(o => o.text + " · " + gloss(o.answer))}});
    }
  }
  const grammar = items.grammar;
  for (const [i, g] of grammar.entries()) {
    const ex = sentenceOf(g.target);
    if (!ex) continue;
    const wrong = [1, 2, 3, 5, 8, 13].map(d => grammar[(i + d * 17) % grammar.length]).filter(o => o !== g).map(o => o.answer).filter(a => a && a !== g.answer);
    pool.push({id: "g:" + g.target[1], kind: "grammar", target: g.target, dimension: "grammar", prompt: g.prompt,
      sentence: plain(ex.ja), needle: g.prompt.replace(/[〜～]/g, ""), answer: g.answer, wrong: [...new Set(wrong)], seconds: SECONDS.grammar,
      solution: {word: g.prompt, meaning: g.answer, ja: ex.ja, en: ex.en || ""}});
  }
  for (const set of sets) {
    if (!set?.id || HELD_OUT.includes(set.id) || !sat.has(set.id)) continue;
    for (const [i, q] of (set.questions || []).entries()) {
      if (!EXAM_MONDAI.has(q.mondai) || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.key) continue;
      const answer = q.choices[q.key - 1];
      pool.push({id: "e:" + set.id + "#" + i, kind: "exam", mondai: q.mondai, target: q.target || null,
        dimension: q.target?.[0] === "grammar" ? "grammar" : q.dimension || "meaning", prompt: q.prompt, sentence: "",
        answer, wrong: q.choices.filter((_, j) => j !== q.key - 1), fixed: q.choices, seconds: SECONDS.exam[q.mondai] || 12,
        solution: {why: q.why || "", source: set.id + "#" + i}});
    }
  }
  return pool;
}

// The four choices, in a fixed order per question for exam items (as
// authored), shuffled otherwise. Near misses come first when there are any.
// level (0 easy … 1 hard, see flowLevel) decides how many of the confusable
// wrong choices (sharing a kanji) are used: none when easy, all three when hard.
export function choicesFor(q, random = Math.random, level = .5) {
  if (q.fixed) return {choices: q.fixed, key: q.fixed.indexOf(q.answer)};
  const near = q.nearCount ? q.wrong.slice(0, Math.min(q.nearCount, Math.round(level * 3))) : [];
  const rest = shuffle(q.wrong.filter(w => !near.includes(w)), random);
  const picked = [...new Set([...near, ...rest])].filter(w => w !== q.answer).slice(0, 3);
  const choices = shuffle([q.answer, ...picked], random);
  return {choices, key: choices.indexOf(q.answer)};
}

// ---- The round ----
// Weak first (missed or slow last time), then new, then a few known for
// pace and confidence. The least recently seen win within each group, so
// a large pool almost never repeats. No two of a kind in a row.
// comeback: ids missed last round, asked again first (the chance to prove
// them), in a new order and with the choices shuffled again.
// wins: question id → times answered right and fast in the game; a question
// won before counts as known even if no recall record says so.
export function pickRound({pool, recall = [], seen = {}, wins = {}, size = ROUND_SIZE, random = Math.random, mix = {weak: 4, fresh: 4, known: 2}, comeback = [], now = Date.now()}) {
  const last = new Map();
  for (const r of recall) last.set(r.dimension + keyOf(r.target), r.last);
  const state = q => { const g = q.target && last.get(q.dimension + keyOf(q.target)); return g && g !== "instant" ? "weak" : g === "instant" || wins[q.id] ? "known" : "fresh"; };
  // Seen in the last four hours: only if nothing else is left (a small kind
  // such as the homophones would otherwise come round several times a day).
  const groups = {weak: [], fresh: [], known: []}, recent = [];
  for (const q of shuffle(pool, random)) (now - (seen[q.id] || 0) < RECENT_MS ? recent : groups[state(q)]).push(q);
  // Least recently seen first, then the kinds taken in turn, so grammar,
  // readings and exam questions are not drowned by the many word questions.
  for (const [name, g] of Object.entries(groups)) groups[name] = byKindInTurn(g.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0)), random);
  const out = [], used = new Set(), targets = new Set();
  const take = (list, n) => { for (const q of list) { if (n <= 0) break; const t = q.target ? keyOf(q.target) : q.id; if (used.has(q.id) || targets.has(t)) continue; used.add(q.id); targets.add(t); out.push(q); n--; } };
  const byId = new Map(pool.map(q => [q.id, q]));
  const back = shuffle(comeback.map(id => byId.get(id)).filter(Boolean), random).slice(0, size);
  take(back, back.length);
  const backCount = out.length;
  take(groups.weak, mix.weak); take(groups.fresh, mix.fresh); take(groups.known, mix.known);
  take([...groups.fresh, ...groups.weak, ...groups.known, ...recent.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0))], size - out.length);
  const rest = interleave(shuffle(out.slice(backCount, size), random));
  return [...out.slice(0, backCount).map(q => ({...q, comeback: true})), ...rest].slice(0, Math.max(size, backCount));
}
function byKindInTurn(list, random) {
  const queues = new Map();
  for (const q of list) queues.set(q.kind, [...(queues.get(q.kind) || []), q]);
  const kinds = shuffle([...queues.keys()], random), out = [];
  while (out.length < list.length) for (const k of kinds) { const next = queues.get(k).shift(); if (next) out.push(next); }
  return out;
}
// The kind with the most left goes next, never the one just asked.
function interleave(rows) {
  const out = [], rest = [...rows];
  while (rest.length) {
    const count = new Map(); for (const r of rest) count.set(r.kind, (count.get(r.kind) || 0) + 1);
    let best = -1;
    rest.forEach((r, i) => { if (r.kind !== out.at(-1)?.kind && (best < 0 || count.get(r.kind) > count.get(rest[best].kind))) best = i; });
    out.push(...rest.splice(best < 0 ? 0 : best, 1));
  }
  return out;
}

// ---- Points ----
// Speed is rewarded and mistakes are punished hard (owner, 26 Nov). Right:
// 50, plus up to 250 for speed, times the combo (×1.1 a step, up to ×2).
// Wrong: −200. "I don't know" and a timeout: 0. Wrong, I don't know and a
// timeout all break the combo, so a blind guess always loses points.
export const POINTS = Object.freeze({base: 50, speed: 250, wrong: -200, fastShare: .5});
export function scoreAnswer({outcome, ms = 0, seconds = 10, streak = 0}) {
  if (outcome === "right") {
    const share = Math.max(0, 1 - ms / (seconds * 1000));
    const points = Math.round((POINTS.base + POINTS.speed * share) * (1 + Math.min(streak, 10) / 10));
    return {points, streak: streak + 1, fast: share >= POINTS.fastShare};
  }
  return {points: outcome === "wrong" ? POINTS.wrong : 0, streak: 0, fast: false};
}

// What a miss saves: a missed recall check of the question's own dimension.
export const recallsMiss = (q, outcome) => outcome !== "right" && !!q.target;

// The device's game memory: best score, rounds, when each question was last
// seen. Kept small: the most recent 20 000 questions.
// After each answer: the question is seen; a miss waits for the next round.
export function rememberAnswer(state = {}, {q, outcome, points = 0, fast = false, difficulty = "normal", now = Date.now()}) {
  const seen = {...(state.seen || {}), [q.id]: now};
  const wins = {...(state.wins || {})};
  if (fast) wins[q.id] = (wins[q.id] || 0) + 1;
  const comeback = (state.comeback || []).filter(id => id !== q.id);
  if (outcome !== "right") comeback.push(q.id); // missed again: it comes back again
  const level = flowStep(state.level, outcome === "right", difficulty);
  const runStart = state.runStart || new Date(now).toISOString(); // the run clock starts on its first answer
  const total = (state.total || 0) + points, day = localDay(new Date(now));
  const days = {...(state.days || {})}, d = days[day] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  days[day] = {...d, answered: d.answered + 1, right: d.right + (outcome === "right" ? 1 : 0), points: d.points + points};
  return {...state, seen, wins, level, runStart, comeback: comeback.slice(-ROUND_SIZE), total, answered: (state.answered || 0) + 1, days};
}
export function rememberRound(state = {}, {score, questions = [], misses, now = Date.now()}) {
  const seen = {...(state.seen || {})};
  for (const q of questions) seen[q.id] = now;
  const ids = Object.keys(seen);
  if (ids.length > 20000) ids.sort((a, b) => seen[a] - seen[b]).slice(0, ids.length - 20000).forEach(id => delete seen[id]);
  const day = localDay(new Date(now)), days = {...(state.days || {})}, d = days[day] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  days[day] = {...d, rounds: d.rounds + 1, best: Math.max(d.best, score)};
  const right = questions.length - (misses ?? 0);
  const history = [...(state.history || []), {at: new Date(now).toISOString(), score, right, n: questions.length}].slice(-500);
  return {...state, best: Math.max(state.best || 0, score), rounds: (state.rounds || 0) + 1, seen, last: score, days, history};
}

// Today's count against the daily goal, and the last `n` days for the chart.
export function today(state = {}, now = new Date()) {
  const d = state.days?.[localDay(now)] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  return {...d, goal: DAILY_GOAL, left: Math.max(0, DAILY_GOAL - d.answered)};
}
export function lastDays(state = {}, n = 14, now = new Date()) {
  return Array.from({length: n}, (_, i) => {
    const day = localDay(new Date(now.getTime() - (n - 1 - i) * 86_400_000));
    return {day, answered: state.days?.[day]?.answered || 0};
  });
}
// The ranking: your best rounds, with where the latest one stands.
export function ranking(state = {}, top = 5) {
  const list = (state.history || []).map((r, i) => ({...r, i})).sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));
  const latest = (state.history || []).length - 1;
  return {top: list.slice(0, top), place: list.findIndex(r => r.i === latest) + 1, of: list.length};
}

// The day's boss: the first authored set not sat yet (sets 19–20, kept for
// unseen-passage mocks, come last), else the one sat longest ago.
export function bossSet({sets = [], attempts = [], now = new Date()}) {
  const lastAt = new Map();
  for (const a of attempts) { const at = a.completedAt || a.startedAt || ""; if (a.book && at > (lastAt.get(a.book) || "")) lastAt.set(a.book, at); }
  const order = [...sets.filter(id => !HELD_OUT.includes(id)), ...sets.filter(id => HELD_OUT.includes(id))];
  if (!order.length) return null;
  const fresh = order.find(id => !lastAt.has(id));
  const id = fresh || [...order].sort((a, b) => lastAt.get(a).localeCompare(lastAt.get(b)))[0];
  const day = localDay(now), beatenToday = attempts.some(a => a.phase === "results" && a.completedAt && localDay(new Date(a.completedAt)) === day && (a.book || "").startsWith("n2-set-"));
  return {id, fresh: !!fresh, beatenToday};
}

// A slump: the last round went badly (under half right, or points below
// zero). The next round is a warm-up of things the player already wins at,
// with at most two of the misses, to bring the motivation back (owner,
// 26 Nov). One good round (seven or more right) ends it.
export const WARM_UP = Object.freeze({mix: {weak: 1, fresh: 1, known: 8}, comeback: 2});
export function inSlump(state = {}) {
  const last = (state.history || []).at(-1);
  return !!last && (last.right / Math.max(1, last.n) < .5 || last.score < 0);
}
export function nextRound({pool, recall = [], state = {}, difficulty = "normal", random = Math.random, now = Date.now()}) {
  const slump = inSlump(state), beat = pace(state, now);
  const level = Math.min(1, Math.max(0, levelOf(state) + beat.offset + (DIFFICULTY[difficulty] || DIFFICULTY.normal).offset));
  const round = pickRound({pool, recall, seen: state.seen || {}, wins: state.wins || {}, random, now,
    comeback: slump ? (state.comeback || []).slice(-WARM_UP.comeback) : state.comeback || [], mix: slump ? WARM_UP.mix : flowMix(level)})
    .map(q => ({...q, seconds: flowSeconds(q.seconds, level), bonus: !q.comeback && random() < BONUS.chance * beat.bonus}));
  return {round, warmUp: slump, level, beat};
}

// ---- Pacing ----
// Games pace in waves of tension and release, not a flat line: Valve's
// AI Director in Left 4 Dead cycles build-up, peak and relax; level curves in
// puzzle games run as a sawtooth, a hard level followed by easier ones; and
// Jesse Schell's interest curve opens on a hook, climbs through peaks to a
// climax, then resolves. Quick round does the same on top of the zone:
//   hook      the first round after 30 minutes away is easy, to pull you in;
//   waves     rounds run in fives: breather, easy, steady, hard, peak (the
//             peak doubles the bonus chance), then a breather again;
//   stretch   the last 50 questions before the boss run at peak;
//   climax    the boss; then rest.
// The offset is added to the hidden level for that round only; the staircase
// keeps learning from every answer.
export const WAVE = Object.freeze([
  {name: "breather", offset: -.25, bonus: 1, line: "Breather round"},
  {name: "easy", offset: -.1, bonus: 1, line: ""},
  {name: "steady", offset: 0, bonus: 1, line: ""},
  {name: "hard", offset: .1, bonus: 1, line: ""},
  {name: "peak", offset: .2, bonus: 2, line: "Peak round: bonuses doubled"},
]);
export const HOOK = Object.freeze({awayMs: 30 * 60_000, offset: -.3, line: "Warm-up: an easy start"});
export const STRETCH = Object.freeze({from: 950, offset: .25, bonus: 2, line: "Final stretch to the boss"});
export function pace(state = {}, now = Date.now()) {
  const last = Math.max(0, ...Object.values(state.seen || {}));
  if (!last || now - last > HOOK.awayMs) return {name: "hook", offset: HOOK.offset, bonus: 1, line: HOOK.line};
  const done = bossProgress(state).done;
  if (done >= STRETCH.from && done < BOSS_EVERY) return {name: "stretch", offset: STRETCH.offset, bonus: STRETCH.bonus, line: STRETCH.line};
  return WAVE[Math.floor(done / ROUND_SIZE) % WAVE.length];
}

// ---- The zone ----
// A staircase keeps the player right about 80% of the time: up a little for
// each right answer, down four times as much for each miss, so it settles
// where right × 0.02 = miss × 0.08, i.e. 80% right. Learning is fastest near
// that rate (Wilson et al. 2019, "the eighty-five percent rule"), and it is
// where a game feels hard but winnable. The level is never shown.
export const FLOW = Object.freeze({start: .5, up: .02, down: .08});
export const levelOf = state => typeof state?.level === "number" ? state.level : FLOW.start;
export function flowStep(level = FLOW.start, right, difficulty = "normal") {
  const l = typeof level === "number" ? level : FLOW.start, d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  return Math.round(Math.min(1, Math.max(0, l + (right ? d.up : -d.down))) * 1000) / 1000;
}
// The learner's difficulty (Settings). Normal is the adaptive zone at 80%
// right. Easy aims at 90% right and starts every round lower; Hard aims at
// 65% and starts higher. Points follow: Easy pays ×0.75, Hard ×1.25, so
// runs on different settings rank fairly.
export const DIFFICULTY = Object.freeze({
  easy: {label: "Easy", up: .01, down: .09, offset: -.2, points: .75},
  normal: {label: "Normal", up: .02, down: .08, offset: 0, points: 1},
  hard: {label: "Hard", up: .035, down: .065, offset: .2, points: 1.25},
});
export const difficultyOf = name => DIFFICULTY[name] ? name : "normal";
// What the level changes: the mix (easy: mostly known; hard: weak and new)…
export function flowMix(level = FLOW.start) {
  const weak = Math.round(1 + 4 * level), fresh = Math.round(2 + 3 * level);
  return {weak, fresh, known: Math.max(0, ROUND_SIZE - weak - fresh)};
}
// …and the clock (easy: 30% more time; hard: 20% less), never under 2 s.
export function flowSeconds(seconds, level = FLOW.start) {
  return Math.max(2, Math.round(seconds * (1.3 - .5 * level) * 2) / 2);
}

// ---- Surprise ----
// About one question in eight is a bonus worth three times the points, never
// more of a penalty. A combo of 5 and of 10 pays a jackpot on top.
export const BONUS = Object.freeze({chance: .12, times: 3, jackpots: {5: 500, 10: 1500}});
export function bonusPoints({points, bonus = false, streak = 0}) {
  if (points <= 0) return {points, jackpot: 0};
  const jackpot = BONUS.jackpots[streak] || 0;
  return {points: (bonus ? points * BONUS.times : points) + jackpot, jackpot};
}

// ---- Bedtime ----
// From the learner's bedtime until 5 am, a round's end points to Evening
// recall and the Night Radio instead of another round: the night is when the
// day's questions are kept, so sleep wins. "One more round" stays one tap away.
export const BEDTIME = "23:30";
export function atBedtime(now = new Date(), bedtime = BEDTIME) {
  const [h, m] = (/^\d{1,2}:\d{2}$/.test(bedtime || "") ? bedtime : BEDTIME).split(":").map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= h * 60 + m || minutes < 5 * 60;
}

// ---- The boss, every 1,000 questions ----
// Every 1,000 questions answered since the last boss, the boss opens: a full
// mock (bossSet). Taking it restarts the count; once it is finished, the game
// says rest for the rest of that day (Play stays one tap away).
export const BOSS_EVERY = 1000;
export function bossProgress(state = {}) {
  const done = Math.max(0, (state.answered || 0) - (state.bossFrom || 0));
  return {done: Math.min(done, BOSS_EVERY), left: Math.max(0, BOSS_EVERY - done), open: done >= BOSS_EVERY};
}
export function takeBoss(state = {}, {set, now = Date.now()}) {
  const at = new Date(now).toISOString();
  // A run: the 1,000 questions' points, closed when the boss is taken; its
  // exam score joins it once the boss is finished (runTable).
  const run = {set, at, start: state.runStart || at, gamePoints: (state.total || 0) - (state.runFrom || 0), questions: (state.answered || 0) - (state.bossFrom || 0)};
  return {...state, bossFrom: state.answered || 0, runFrom: state.total || 0, runStart: null, bossTaken: {set, at}, runs: [...(state.runs || []), run].slice(-200)};
}
// Runs, ranked by the merged score, each keeping its two parts for the
// in-depth view. examOf(run) gives the finished boss sitting's estimate
// ({total 0–180, sections}) or null while it is not done. The exam counts
// 1,000 points per scaled point, so a full exam (180) weighs about as much as
// 1,000 questions played well.
export const EXAM_POINT = 1000;
export function runTable(state = {}, examOf = () => null) {
  return (state.runs || []).map(r => {
    const exam = examOf(r), examPoints = exam ? exam.total * EXAM_POINT : 0;
    const clock = exam ? runClock(r.start || r.at, exam.completedAt || r.at) : null, times = clock?.times || 1;
    return {...r, exam, examPoints, times, total: Math.round((r.gamePoints + examPoints) * times)};
  }).sort((a, b) => b.total - a.total || a.at.localeCompare(b.at));
}

// ---- The run clock ----
// A run's clock starts on its first answer. Beat the boss (finish the 1,000
// questions and the boss) within 24 hours and the whole run counts ×1.5;
// within 48 hours, ×1.2; after that, ×1. The home shows the live multiplier
// and the time left on it, so there is always a reason to finish.
export const RUN_CLOCK = Object.freeze([{hours: 24, times: 1.5}, {hours: 48, times: 1.2}]);
export function runClock(start, now = Date.now()) {
  if (!start) return {times: RUN_CLOCK[0].times, leftMs: RUN_CLOCK[0].hours * 3600_000, started: false};
  const elapsed = (typeof now === "number" ? now : Date.parse(now)) - Date.parse(start);
  for (const tier of RUN_CLOCK) if (elapsed < tier.hours * 3600_000) return {times: tier.times, leftMs: tier.hours * 3600_000 - elapsed, started: true};
  return {times: 1, leftMs: 0, started: true};
}
export function resting(state = {}, attempts = [], now = new Date()) {
  const t = state.bossTaken;
  if (!t?.at || localDay(new Date(t.at)) !== localDay(now)) return false;
  return attempts.some(a => a.book === t.set && a.phase === "results" && (a.completedAt || "") >= t.at);
}
