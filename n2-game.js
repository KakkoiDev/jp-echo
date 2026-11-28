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
//   connective  問題9 文章の文法: a passage excerpt with a connective blanked,
//               four connectives to choose from, wrong ones from jobs that
//               cannot stand in for the answer's (n2-connectives.js)
//   exam        short authored questions (問題1–5, 7) from sets the learner
//               has already sat, so an unseen set stays unseen for a mock
//
// Recognition is not recall: a right answer saves nothing, but a miss, a
// timeout or "I don't know" saves a missed recall check (source "game"), so
// game misses join Today's checks, Evening recall and the Night Radio.
// Pure (no DOM, no storage): test/n2-game.test.js holds it.
import {recallItems, localDay} from "./n2-study.js";
import {HELD_OUT} from "./n2-comprehension.js";
import {connectiveSites, jobOf, glossOf, JOBS, OVERLAP, CHOICE_FOR_JOB, CONNECTIVES} from "./n2-connectives.js";
import {ACCEPTED_READINGS, READING_KEY, EXCLUDED, GLOSS_FIX, GRAMMAR_SPANS, REVIEWED_LEVELS, REVIEWED_GRAMMAR_BLOCKS, REVIEWED_AFFIXES, AFFIX_GLOSS, AFFIX_CONFUSABLE, AFFIX_SHOWN, AFFIX_READING, LINK_NOT_WRONG, LINK_SHOWN, LINK_WHY, LINK_PARTS, WORD_PIECES, LIST_LABEL, LEVEL_GLOSS, LEVEL_DROP, LEVEL_READING, NOT_WRONG, SCORE_ALL, GRAMMAR_CONFUSABLE} from "./n2-game-review.js";
import {exampleSegments} from "./n2-delayed.js";
import {LEVELS} from "./jlpt-levels.js";

const keyOf = target => JSON.stringify(target);
export const GAME_KEY = "echo-n2-game";
export const GAME_SOURCE = "game";
// Rounds are short so a few spare seconds are enough; every answer is saved
// as it is given, so closing the page mid-round loses nothing.
// Blitz chess, not shogi (owner, 26 Nov): seconds, not minutes, per question.
export const ROUND_SIZE = 10, REVIEW_SECONDS = 5, DAILY_GOAL = 1000, RECENT_MS = 4 * 3600_000;
export const SECONDS = Object.freeze({kana: 3, kanji: 3, reading: 3, meaning: 3, meaningInSentence: 4, definition: 4, listen: 5, homophone: 5, grammar: 6, affix: 5, gap: 8, partgap: 6, link: 3, linkBuilt: 5, para: 8, pair: 6, order: 8, connective: 7, exam: {1: 4, 2: 5, 3: 5, 4: 7, 5: 6, 7: 8}});
// The pause after an answer before the next question, in milliseconds.
export const PAUSE = Object.freeze({right: 250, miss: 800});
export const KIND_LABEL = Object.freeze({kana: "Kana", kanji: "Kanji", reading: "Reading", meaning: "Meaning", definition: "Which word", listen: "Listen", connective: "Connective · 問題9", homophone: "Which kanji", grammar: "Grammar", block: "Grammar piece", build: "Grammar parts", infer: "New grammar", exam: "Exam question", affix: "Word part", link: "Connective", gap: "Grammar · fill the gap", partgap: "Word part · fill the gap",
  para: "Same meaning", pair: "Connective · fill the gap", order: "Sentence order · ★", sprint: "Reading sprint"});
const EXAM_MONDAI = new Set([1, 2, 3, 4, 5, 7]), WRITTEN = new Set(["Vocabulary", "Grammar"]);
const KANJI = /[一-鿿々]/g;
const plain = s => String(s || "").replace(/【[^】]*】/g, "");
// A short English gloss with no Japanese in it: JMdict's "(same as 親戚 (しんせき))"
// would give the answer away.
export const JP = /[ぁ-んァ-ヶ一-龯々]/;
export const gloss = s => {
  const text = String(s || "").replace(/\((?:[^()]|\([^()]*\))*\)/g, m => JP.test(m) ? "" : m);
  const parts = []; let depth = 0, cur = "";
  for (const ch of text) { if (ch === "(") depth++; if (ch === ")") depth = Math.max(0, depth - 1); if ((ch === "," || ch === ";") && !depth) { parts.push(cur); cur = ""; } else cur += ch; }
  parts.push(cur);
  return parts.map(x => x.replace(/\s+/g, " ").trim()).filter(x => x && !JP.test(x)).slice(0, 2).join(", ");
};
// Two English meanings compete when they share a content word ("steam" and
// "water vapor, steam"): then one can't be the wrong choice for the other.
const STOP = new Set("to the a an of in on at by for with and or one's oneself someone something etc e.g. be is as from up out into over not no it its that this who which what".split(" "));
const senseWords = text => new Set(String(text || "").toLowerCase().replace(/\([^)]*\)/g, " ").split(/[^a-z]+/).filter(t => t.length > 2 && !STOP.has(t)).map(t => t.replace(/(ing|ed|es|s)$/, "")));
export function sameSense(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const x = senseWords(a), y = senseWords(b);
  for (const t of x) if (y.has(t)) return true;
  return false;
}

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
//
// level: the JLPT level the inventory is (jlpt-levels.js). N2, the default,
// is the pool as it has always been, ids and all. Any other level gives its
// word cards only (reading, meaning, which word, listen; a sentence is
// optional for them), each id carrying the level ("r:N3:就任") so no two
// levels can collide and no N2 progress is touched. Until a level's cards
// have been reviewed (REVIEWED_LEVELS) they are practice, not scored, and
// have no recall target: a miss there never enters N2's recall evidence.
// They still keep the item record (`record`: tries, misses, item level, wins,
// the miss coming back), so what is known at a level is tracked from the
// first card; only points, the day and the boss count wait for the review.
// Grammar, connective and exam cards for other levels wait for their decks
// and sets.
//
// Every word card names the kanji it exercises (`kanji`): each kanji with its
// base reading where the word splits cleanly (就しゅう, 任にん), the bare kanji
// otherwise. The readings are an inventory row's fourth field, or `parts`
// for N2 (n2-kanji-parts.json: "就任/しゅうにん" → "しゅう|にん").
// Every card of a round pays when it is right and costs when it is wrong
// (owner, 27 Nov: SCORE_ALL). The REVIEWED_ flags still say what a reviewer
// has read; with SCORE_ALL off, unread content goes back to practice: no
// points, the answer recorded and counted.
const unscored = reviewed => reviewed || SCORE_ALL ? {} : {practice: true, record: true};
export function gamePool({inventory, examples = new Map(), sets = [], sat = new Set(), level = "N2", parts = null, grammarBlocks = null, excerpts = false, extras = null, review = null}) {
  const other = level !== "N2", tag = other ? level + ":" : "";
  const split = new Map(inventory.words.map(([w, r, , p]) => [w + "/" + r, p || parts?.[w + "/" + r] || ""]));
  const kanjiOf = w => { const ks = (w.text.match(KANJI) || []).filter(k => k !== "々"), bases = (split.get(w.target[1] + "/" + w.target[2]) || "").split("|");
    return [...new Set(ks.map((k, i) => bases.length === (w.text.match(KANJI) || []).length && bases[i] ? k + bases[i] : k))]; };
  const items = recallItems(inventory), pool = [];
  // Affixes such as ～発 are left out: they are not words to pick or read alone.
  // READING_KEY and GLOSS_FIX correct the N2 list; they are not applied elsewhere.
  const allWords = items.meaning.map(it => (!other && LIST_LABEL[it.target[1]]) ? {target: it.target, ...LIST_LABEL[it.target[1]]} : (() => { const text = it.target[1], reading = (!other && READING_KEY[text]) || (other && LEVEL_READING[level + ":" + text]) || it.reading || it.target[2], rk = level + ":" + text + "/" + (it.reading || it.target[2]);
    return {target: it.target, text, reading, answer: (!other && (GLOSS_FIX[text + "/" + reading] || GLOSS_FIX[text])) || (other && (review?.gloss?.[rk] || LEVEL_GLOSS[level + ":" + text + "/" + reading] || LEVEL_GLOSS[level + ":" + text])) || it.answer, also: other ? review?.also?.[rk] || [] : [], dropped: !!(other && review?.drop?.[rk])}; })())
    // `review` (level-review.json): every word of the other levels read by a reviewer: the meaning a learner knows,
    // the other readings a learner would give (never a wrong choice), and the entries no card can ask fairly.
    .filter(w => !w.dropped && !(other && (LEVEL_DROP.includes(level + ":" + w.text) || LEVEL_DROP.includes(level + ":" + w.text + "/" + w.reading))));
  // The prefixes and suffixes of the list (前～, ～気味): not words, but word parts with a card of their own (affixCards).
  const affixes = allWords.filter(w => /[〜～]/.test(w.text)), words = allWords.filter(w => !/[〜～]/.test(w.text));
  // Stable ids: a word written the same way twice (紅葉 こうよう / もみじ) carries its reading.
  const spellings = new Map(); for (const w of words) spellings.set(w.text, (spellings.get(w.text) || 0) + 1);
  const idOf = w => tag + (spellings.get(w.text) > 1 ? w.text + "/" + w.reading : w.text);
  const apartWords = new Map();
  for (const [a, b] of NOT_WRONG) { apartWords.set(a, new Set([...(apartWords.get(a) || []), b])); apartWords.set(b, new Set([...(apartWords.get(b) || []), a])); }
  const byKanji = new Map();
  for (const w of words) for (const k of new Set(w.text.match(KANJI) || [])) byKanji.set(k, [...(byKanji.get(k) || []), w]);
  const byReading = new Map();
  for (const w of words) byReading.set(w.reading, [...(byReading.get(w.reading) || []), w]);
  const sentenceOf = target => (examples.get(keyOf(target)) || [])[0] || null;
  // A wrong choice must be wrong: no shared meaning with the answer, and for
  // listening, no word that sounds the same (the ear cannot tell them apart).
  const distinct = (answer, others) => others.filter(o => o && !sameSense(o, answer));

  for (const [i, w] of words.entries()) {
    const ex = sentenceOf(w.target), kanji = w.text.match(KANJI), own = gloss(w.answer), id = idOf(w);
    if (kanji && w.reading && w.reading !== w.text) {
      const accepted = new Set([w.reading, ...(ACCEPTED_READINGS[w.text] || []), ...(w.also || [])]);
      const misses = nearMisses(w.reading).filter(m => !accepted.has(m));
      // A reading with no trap of its own (委員 いいん) would have no card, and its
      // kanji could never be asked. In the levels played kanji first, the
      // readings of words that share a kanji stand in (会員 かいいん, 委任 いにん).
      if (other && misses.length < 3) for (const o of new Set((kanji || []).flatMap(k => byKanji.get(k) || []))) if (o.text !== w.text && o.text.match(KANJI)?.length && !accepted.has(o.reading) && !misses.includes(o.reading)) misses.push(o.reading);
      // A kanji found in no other word of the level: readings of the same length from anywhere in it.
      if (other && misses.length < 3) for (let step = 1; step < words.length && misses.length < 5; step++) { const o = words[(i + step * 37) % words.length];
        if (o.text.match(KANJI) && Math.abs(o.reading.length - w.reading.length) <= 1 && !accepted.has(o.reading) && !misses.includes(o.reading)) misses.push(o.reading); }
      if (misses.length >= 3) pool.push({id: "r:" + id, kind: "reading", target: w.target, dimension: "reading", prompt: w.text,
        sentence: ex && plain(ex.ja).includes(w.text) ? plain(ex.ja) : "", needle: w.text, answer: w.reading, wrong: misses, seconds: SECONDS.reading,
        solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    }
    // Meaning: confusable words share a kanji; the rest come from anywhere.
    // Never a word written the same way (紅葉: autumn leaves / maple) or sharing the meaning.
    // A word never stands against one that means the same (NOT_WRONG), and a word sharing a kanji never against one whose
    // full meaning overlaps (review, 27 Nov: 助ける against 救助, 遅刻 against 遅れ).
    const fair = o => o !== w && o.text !== w.text && !sameSense(gloss(o.answer), own) && !apartWords.get(w.text)?.has(o.text);
    const near = [...new Set((kanji || []).flatMap(k => byKanji.get(k) || []))].filter(o => fair(o) && !sameSense(o.answer, w.answer));
    const far = [7, 11, 17, 23, 29, 31].map((m, k) => words[(i * m + [13, 101, 307, 503, 709, 911][k]) % words.length]).filter(fair);
    const wrongMeanings = distinct(own, [...new Set([...near, ...far].map(o => gloss(o.answer)))]);
    // A word spelled like another (紅葉 こうよう / もみじ) shows its sentence: the cue to its sense.
    const cue = spellings.get(w.text) > 1 && ex && plain(ex.ja).includes(w.text) ? plain(ex.ja) : "";
    // The word is met in its sentence, underlined, not bare (owner, 27 Nov: 限り alone says little): where the
    // deck sentence writes the word, in this form or another (崩す, 崩して), the card shows it.
    const written = ex ? heardGap(ex.ja, w.text) : "";
    if (own && wrongMeanings.length >= 3) pool.push({id: "m:" + id, kind: "meaning", target: w.target, dimension: "meaning", prompt: w.text,
      sentence: written ? plain(ex.ja) : cue, needle: written || w.text, answer: own, wrong: wrongMeanings, near: wrongMeanings.filter(m => near.some(o => gloss(o.answer) === m)), seconds: written ? SECONDS.meaningInSentence : SECONDS.meaning,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Definition: the meaning shown, the word to find; no wrong word may share the meaning.
    const nearWords = [...new Set(near.map(o => o.text))].filter(t => t !== w.text), farWords = [...new Set(far.map(o => o.text))].filter(t => t !== w.text && !nearWords.includes(t));
    if (own && kanji && nearWords.length + farWords.length >= 3) pool.push({id: "d:" + id, kind: "definition", target: w.target, dimension: "meaning", prompt: own,
      sentence: "", answer: w.text, wrong: [...nearWords, ...farWords], near: nearWords, seconds: SECONDS.definition,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Listen: the word heard, its meaning to pick; never the meaning of a word that sounds the same.
    const soundAlike = new Set((byReading.get(w.reading) || []).filter(o => o !== w).map(o => gloss(o.answer)));
    const heardWrong = wrongMeanings.filter(m => !soundAlike.has(m) && ![...soundAlike].some(a => sameSense(a, m)));
    if (own && heardWrong.length >= 3) pool.push({id: "l:" + id, kind: "listen", target: w.target, dimension: "meaning", prompt: w.text, say: w.reading,
      sentence: "", answer: own, wrong: heardWrong, near: heardWrong.filter(m => near.some(o => gloss(o.answer) === m)), seconds: SECONDS.listen,
      solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex?.ja || "", en: ex?.en || ""}});
    // Homophones: the same reading, different words (問題2 表記). Spellings
    // that share the meaning are not wrong choices.
    const same = (byReading.get(w.reading) || []).filter(o => o.text !== w.text && !sameSense(gloss(o.answer), own));
    if (same.length && ex && plain(ex.ja).includes(w.text)) {
      const shared = [...new Set((kanji || []).flatMap(k => byKanji.get(k) || []))].filter(o => o.text !== w.text && !same.includes(o) && o.reading !== w.reading && !sameSense(gloss(o.answer), own));
      pool.push({id: "h:" + id, kind: "homophone", target: w.target, dimension: "meaning", prompt: w.reading,
        sentence: plain(ex.ja).replace(w.text, w.reading), needle: w.reading, answer: w.text,
        wrong: [...new Set([...same.map(o => o.text), ...shared.map(o => o.text)])], seconds: SECONDS.homophone,
        solution: {word: w.text, reading: w.reading, meaning: w.answer, ja: ex.ja, en: ex.en || "", others: same.map(o => o.text + " · " + gloss(o.answer))}});
    }
  }
  const grammar = other ? [] : items.grammar;
  const confusablePair = new Set(GRAMMAR_CONFUSABLE.flatMap(([a, b]) => [a + "\n" + b, b + "\n" + a]));
  for (const [i, g] of grammar.entries()) {
    const ex = sentenceOf(g.target);
    if (!ex) continue;
    // Patterns a reviewer could not tell apart by meaning are never each other's wrong choice (GRAMMAR_CONFUSABLE).
    const answerOf = o => GLOSS_FIX["g:" + o.target[1]] || o.answer;
    const wrong = distinct(answerOf(g), [1, 2, 3, 5, 8, 13, 21, 34].map(d => grammar[(i + d * 17) % grammar.length]).filter(o => o !== g && !confusablePair.has(g.target[1] + "\n" + o.target[1])).map(answerOf));
    const gAnswer = GLOSS_FIX["g:" + g.target[1]] || g.answer;
    pool.push({id: "g:" + g.target[1], kind: "grammar", target: g.target, dimension: "grammar", prompt: g.prompt,
      sentence: plain(ex.ja), needle: GRAMMAR_SPANS["g:" + g.target[1]] || piecesNeedle(plain(ex.ja), g.prompt) || surfaceNeedle(plain(ex.ja), g.prompt) || g.prompt.replace(/[〜～]/g, ""), answer: gAnswer, wrong: [...new Set(wrong)], seconds: SECONDS.grammar,
      solution: {word: g.prompt, meaning: gAnswer, ja: ex.ja, en: ex.en || ""}});
  }
  if (!other) pool.push(...gapCards(pool.filter(q => q.kind === "grammar"), confusablePair, extras?.gapWrong || {}));
  if (!other) { const parts = affixCards(affixes, sentenceOf); pool.push(...parts, ...partGapCards(parts)); }
  if (!other && grammarBlocks) addGrammarBlocks(pool, grammarBlocks);
  // Connectives (問題9): from reading passages of sets already sat. The
  // excerpt is up to two sentences before the blank and the blank's sentence.
  // Practice only, not scored, until the excerpts are reviewed (audit P2).
  if (other) sets = [];
  // The connective on its own (linkCards) is what a round asks. The passage excerpts are no longer in rounds
  // (owner, 27 Nov: long enough to be fair was too long to be fun, and shorter was unfair); `excerpts` still
  // builds them, for the audit and the reviewer.
  if (!other) pool.push(...linkCards());
  if (!other && extras) pool.push(...extraCards(extras));
  for (const set of excerpts ? sets : []) {
    if (!set?.id || HELD_OUT.includes(set.id) || !sat.has(set.id)) continue;
    const seen = new Set();
    for (const [i, q] of (set.questions || []).entries()) {
      const text = q.context || "";
      if (q.skill !== "Reading" || !text || seen.has(text) || /（[０-９\d]+）/.test(text)) continue;
      seen.add(text);
      for (const site of connectiveSites(text)) pool.push(...connectiveQuestion(set.id + "#" + i, text, site));
    }
  }
  // Authored exam questions: written sections only (言語知識), never a
  // listening item whose audio the game cannot give.
  for (const set of sets) {
    if (!set?.id || HELD_OUT.includes(set.id) || !sat.has(set.id)) continue;
    for (const [i, q] of (set.questions || []).entries()) {
      if (!WRITTEN.has(q.skill) || !EXAM_MONDAI.has(q.mondai) || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.key) continue;
      const answer = q.choices[q.key - 1];
      pool.push({id: "e:" + set.id + "#" + i, kind: "exam", mondai: q.mondai, target: q.target || null,
        dimension: q.target?.[0] === "grammar" ? "grammar" : q.dimension || "meaning", prompt: q.prompt, sentence: "",
        answer, wrong: q.choices.filter((_, j) => j !== q.key - 1), fixed: q.choices, seconds: SECONDS.exam[q.mondai] || 12,
        solution: {why: q.why || "", source: set.id + "#" + i}});
    }
  }
  // A word or pattern asked whole that is made of plain pieces carries them (WORD_PIECES): said together after the
  // answer and listed in the review of a miss. Cards that already show parts (build, infer, a built connective) keep theirs.
  if (!other) for (const q of pool) {
    if (q.parts || !["grammar", "gap", "block", "meaning", "definition", "listen", "reading", "homophone"].includes(q.kind)) continue;
    // extras.pieces: the audited dissections of the word list (n2-word-pieces.json), kept apart from the code.
    const key = pieceKey(q.solution?.word), built = WORD_PIECES[key] || extras?.pieces?.[key];
    if (built) q.pieces = {parts: built.parts.map(([text, g]) => ({text, gloss: g})), literal: built.literal};
  }
  // The bar for every item: not excluded, and four distinct choices.
  // The kanji a word card exercises; grammar, connective and exam cards have none.
  const byTarget = new Map(words.map(w => [w.target, kanjiOf(w)]));
  for (const q of pool) { const ks = byTarget.get(q.target); if (ks?.length) q.kanji = ks; }
  const fit = pool.filter(q => !EXCLUDED[q.id] && (q.fixed ? new Set(q.fixed).size === 4 : new Set(q.wrong.filter(w => w !== q.answer)).size >= 3));
  if (!other) return fit;
  // item: what a round counts as one thing, where N2 cards use their target.
  return fit.map(q => ({...q, level, item: level + ":" + q.target[1] + "/" + q.target[2], target: null, ...unscored(REVIEWED_LEVELS.has(level))}));
}
// ---- The exam's direction ----
// The paper does not show a pattern and ask its meaning: it shows a sentence
// with a gap and asks what goes in it (問題7; 問題3 for word parts). These
// two kinds ask that way, from the sentences the pattern and part cards
// already have. The sentence's English sits under it: a rule-built card
// cannot know that no other pattern could stand in the gap, but only one
// gives the sentence that meaning. The choices are forms as sentences write
// them, never a near-twin of the answer (GRAMMAR_CONFUSABLE, AFFIX_CONFUSABLE).
const GAP = "（　）";
// authored: pattern key → three wrong choices written for that sentence (n2-gap-wrong.json, blind-tested): forms that
// attach in the gap and are wrong by meaning, as the exam writes them. Where there are none, other sentences' forms.
function gapCards(grammar, confusablePair, authored = {}) {
  const usable = grammar.filter(q => typeof q.needle === "string" && q.needle.length >= 2 && q.sentence.split(q.needle).length === 2 && q.solution?.en && !EXCLUDED[q.id]);
  return usable.flatMap(q => {
    const key = q.id.slice(2);
    const wrong = [...new Set(usable.filter(o => o !== q && !confusablePair.has(key + "\n" + o.id.slice(2)) && !sameSense(o.answer, q.answer) && !o.needle.includes(q.needle) && !q.needle.includes(o.needle)).map(o => o.needle))];
    const own = Array.isArray(authored[key]) && authored[key].length === 3 ? authored[key] : null;
    if (!own && wrong.length < 3) return [];
    return [{id: "f:" + key, kind: "gap", ...(own ? {fixedWrong: true} : {}), target: q.target, dimension: "grammar", prompt: q.prompt, sentence: q.sentence.replace(q.needle, GAP), en: q.solution.en,
      answer: q.needle, wrong: own || wrong, near: own ? [] : wrong.filter(w => Math.abs(w.length - q.needle.length) <= 1), seconds: SECONDS.gap, solution: q.solution, needle: q.needle}];
  });
}
function partGapCards(parts) {
  const apart = new Map();
  for (const group of AFFIX_CONFUSABLE) for (const t of group) apart.set(t, new Set([...(apart.get(t) || []), ...group]));
  const usable = parts.filter(q => q.solution?.en);
  return usable.flatMap(q => {
    // A near-twin is kept out by what is written, not by its entry: 室～ would put ～室 back among ～所's choices.
    const twins = new Set(usable.filter(o => apart.get(q.prompt)?.has(o.prompt)).map(o => o.needle));
    const others = usable.filter(o => o.needle !== q.needle && !twins.has(o.needle) && !sameSense(o.answer, q.answer) && !o.needle.includes(q.needle) && !q.needle.includes(o.needle));
    const near = [...new Set(others.filter(o => o.side === q.side).map(o => o.needle))], wrong = [...new Set([...near, ...others.map(o => o.needle)])];
    if (wrong.length < 3) return [];
    return [{id: "p:" + q.id.slice(2), kind: "partgap", target: q.target, dimension: "meaning", prompt: q.prompt, sentence: q.sentence.replace(q.needle, GAP), en: q.solution.en,
      answer: q.needle, wrong, near, side: q.side, seconds: SECONDS.partgap, solution: q.solution, needle: q.needle, ...(q.practice ? {practice: true, record: true} : {})}];
  });
}

// ---- Word parts ----
// A prefix or a suffix (前～ former, ～気味 slightly) is a building block: it
// is never met alone, it changes the word it joins, and the paper asks it in
// 問題3 (owner, 27 Nov). Its card is a grammar card in shape: the deck
// sentence with the part underlined, its meaning to pick among the meanings
// of other parts, those on the same side first. Only a part written once in
// its sentence has a card: where it shows twice the underline could not say
// which one is meant. Practice until the list's glosses and the sentences
// are reviewed (REVIEWED_AFFIXES): no points, but every answer counts.
// A word or pattern as WORD_PIECES names it: without ～, the ①② of a second sense, spaces or a bracketed note.
export const pieceKey = word => String(word || "").replace(/[〜～①-⑨\s]/g, "").replace(/（[^）]*）|\([^)]*\)/g, "");
export const affixSide = text => /^[〜～]/.test(text) ? "suffix" : "prefix";
function affixCards(affixes, sentenceOf) {
  const reviewed = w => AFFIX_GLOSS[w.text + "/" + w.reading] || AFFIX_GLOSS[w.text];
  const meaningOf = w => reviewed(w) || gloss(w.answer);
  const apart = new Map(); // part → the parts it must never stand against
  for (const group of AFFIX_CONFUSABLE) for (const t of group) apart.set(t, new Set([...(apart.get(t) || []), ...group]));
  const clean = affixes.filter(w => /^[〜～]?[^〜～\s(（)）]+[〜～]?$/.test(w.text) && /^[〜～]/.test(w.text) !== /[〜～]$/.test(w.text) && meaningOf(w));
  const spellings = new Map(); for (const w of clean) spellings.set(w.text, (spellings.get(w.text) || 0) + 1);
  const practice = unscored(REVIEWED_AFFIXES);
  return clean.flatMap(w => {
    const ex = sentenceOf(w.target), sentence = ex ? plain(ex.ja) : "", bare = w.text.replace(/[〜～]/g, ""), part = AFFIX_SHOWN[w.text] || bare, own = meaningOf(w);
    if (!sentence || sentence.split(part).length !== 2) return [];
    const others = clean.filter(o => o.text.replace(/[〜～]/g, "") !== bare && !apart.get(w.text)?.has(o.text) && !sameSense(meaningOf(o), own));
    const near = [...new Set(others.filter(o => affixSide(o.text) === affixSide(w.text)).map(o => meaningOf(o)))];
    const wrong = [...new Set([...near, ...others.map(o => meaningOf(o))])];
    if (wrong.length < 3) return [];
    return [{...practice, id: "a:" + (spellings.get(w.text) > 1 ? w.text + "/" + w.reading : w.text), kind: "affix", target: w.target, dimension: "meaning", prompt: w.text,
      sentence, needle: part, answer: own, wrong, near, side: affixSide(w.text), seconds: SECONDS.affix,
      solution: {word: w.text, reading: AFFIX_READING[w.text] || w.reading, meaning: reviewed(w) || w.answer, ja: ex.ja, en: ex.en || ""}}];
  });
}

function addGrammarBlocks(pool, {blocks = {}, patterns = {}}) {
  const entries = Object.entries(blocks);
  const practice = unscored(REVIEWED_GRAMMAR_BLOCKS);
  const fair = (answer, options) => [...new Set(options)].filter(o => o && !sameSense(answer, o));
  const base = {target: null, dimension: null, seconds: SECONDS.grammar, ...practice};

  const grammar = pool.filter(q => q.kind === "grammar" && !EXCLUDED[q.id]);
  const confusable = new Set(GRAMMAR_CONFUSABLE.flatMap(([a, b]) => [a + "\n" + b, b + "\n" + a]));
  const keysOf = parts => [...new Set(parts.flatMap(p => Object.hasOwn(blocks, p.block) ? [p.block] : []))];
  const byKey = new Map(grammar.map(q => [q.id.slice(2), keysOf(patterns[q.id.slice(2)]?.parts || [])]));

  // The particles and endings of N5 and N4 (に, は, を, て, だ…) are taken as
  // known: an N2 learner's first grammar cards were two dozen of these, with
  // glosses too abstract to tell apart (audit, 27 Nov). They have no card of
  // their own, count as met in every pattern, and are left out of the count.
  const basic = new Set(entries.filter(([, b]) => BASIC_BLOCK.levels.includes(b.level) && BASIC_BLOCK.types.includes(b.type)).map(([id]) => id));
  for (const [id, block] of entries) {
    if (basic.has(id)) continue;
    const sentence = plain(block.ja);
    const needle = [...block.forms].sort((a, b) => b.length - a.length).find(form => sentence.includes(form));
    if (!needle) continue;
    // Wrong choices: blocks of the same type first; a small type (the negatives) is topped up from the others.
    const others = entries.filter(([other, b]) => id !== other && !basic.has(other) && !b.forms.some(form => block.forms.includes(form)));
    const wrong = fair(block.gloss, [...others.filter(([, b]) => b.type === block.type), ...others.filter(([, b]) => b.type !== block.type)].map(([, b]) => b.gloss));
    pool.push({...base, id: "b:" + id, kind: "block", item: "block:" + id, blockLevel: block.level, blocks: [id],
      prompt: block.form, sentence, needle, answer: block.gloss, wrong,
      solution: {word: block.form, meaning: block.gloss, ja: block.ja, en: block.en}});
  }

  for (const q of grammar) {
    const key = q.id.slice(2), pattern = patterns[key], ids = byKey.get(key);
    if (!ids.length) continue;
    q.blocks = ids;
    // A pattern that is one block is learned by its block card: nothing to build or infer.
    if (pattern.parts.length === 1) continue;
    // Use the deck's reviewed span when available, including split spans.
    // Otherwise require the actual ordered pieces, never a guessed stem.
    const variants = pattern.parts.map(({text, block}) => {
      const b = blocks[block];
      const alternatives = b?.type === "verb" || (b?.type === "ending" && pattern.parts.length === 1) ? b.forms : [];
      const escape = form => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return "(" + [...new Set([text, ...alternatives])].map(escape).join("|") + ")";
    });
    const surface = q.sentence.match(new RegExp(variants.join("")));
    const needle = GRAMMAR_SPANS[q.id] || piecesNeedle(q.sentence, q.prompt) || surface?.[0];
    if (!needle || !exampleSegments(q.sentence, [needle]).some(part => part.mark)) continue;
    // Patterns the blind solvers could not tell apart by meaning are never each other's wrong choice.
    const others = grammar.filter(other => other !== q && !confusable.has(key + "\n" + other.id.slice(2)));
    const wrong = fair(q.answer, others.map(other => other.answer));
    const near = fair(q.answer, others.filter(other => byKey.get(other.id.slice(2)).some(id => ids.includes(id))).map(other => other.answer));
    const basics = ids.filter(id => basic.has(id));
    if (basics.length) q.basics = basics;
    const card = {...base, item: keyOf(q.target), patternKey: key, blocks: ids, ...(basics.length ? {basics} : {}), prompt: q.prompt,
      sentence: q.sentence, needle, answer: q.answer, wrong, near, solution: pattern.transparency === "opaque"
        ? {...q.solution, why: "Learn this pattern as a whole."} : q.solution};
    // The parts as the sentence writes them. A part may carry its own gloss
    // where the block's would mislead beside this form (得ない under 得る).
    // Both cards carry them: the build card shows the list, the infer card
    // only in the review of a miss. `literal`: the parts read together.
    const parts = pattern.parts.map((p, i) => ({text: surface?.[i + 1] || p.text, gloss: p.gloss || blocks[p.block]?.gloss || ""}));
    const whole = {...card, parts, ...(pattern.literal ? {literal: pattern.literal} : {})};
    pool.push({...whole, id: "gb:" + key, kind: "build"});
    if (["clear", "partial"].includes(pattern.transparency) && pattern.solved?.right) {
      pool.push({...whole, id: "gi:" + key, kind: "infer"});
    }
  }
}

// The level a card belongs to: cards without one are N2's.
export const levelOfCard = q => q?.level || "N2";

// ---- Authored cards: paraphrase, clause pairs, sentence order ----
// Three kinds whose content is written for them, not built by rule (owner's
// list, 27 Nov), each in a file of its own:
//   para   n2-paraphrase.json  one sentence, four to pick the one that says
//                              the same: the heart of N2 reading (言い換え);
//   pair   n2-pairs.json       two short clauses and a gap: the connective
//                              that links them; wrong choices from jobs that
//                              cannot stand in (OVERLAP), as for the excerpts;
//   order  n2-ordering.json    問題8: four tiles, the one that lands on ★
//                              (always the third slot).
// Each item reaches the pool only if a blind solver settled it (the files
// hold what passed). No English on the card: it would give the answer away.
export const ORDER_STAR = 2;
function extraCards({paraphrase = [], pairs = [], ordering = []}) {
  const out = [];
  for (const x of paraphrase) {
    const choices = x.choices.map(plain);
    out.push({id: "pp:" + x.id, kind: "para", target: null, dimension: null, prompt: plain(x.ja), sentence: plain(x.ja), needle: "",
      answer: choices[x.key - 1], wrong: choices.filter((_, i) => i !== x.key - 1), seconds: SECONDS.para, say: x.ja,
      solution: {word: choices[x.key - 1], meaning: x.en, ja: x.ja, en: "", why: x.why || ""}});
  }
  for (const x of pairs) {
    const job = jobOf(x.answer); if (!job) continue;
    const blocked = new Set(OVERLAP[job] || [job]);
    const wrong = [...new Set(CONNECTIVES.filter(([w, j]) => w !== x.answer && !blocked.has(j)).map(([w]) => w))];
    if (wrong.length < 3) continue;
    const built = LINK_PARTS[x.answer];
    out.push({id: "cp:" + x.id, kind: "pair", target: null, dimension: null, prompt: "（　）に入るのは？", sentence: plain(x.a) + "（　）、" + plain(x.b), needle: "（　）",
      answer: x.answer, wrong, job, seconds: SECONDS.pair, say: x.a + x.answer + "、" + x.b, ...(built ? {pieces: {parts: built.parts.map(([text, g]) => ({text, gloss: g})), literal: built.literal}} : {}),
      solution: {word: x.answer, meaning: glossOf(x.answer), why: LINK_WHY[x.answer] || JOBS[job], ja: x.a + x.answer + "、" + x.b, en: x.en}});
  }
  for (const x of ordering) {
    const tiles = x.tiles.map(plain), whole = (x.lead || "") + x.tiles.join("") + (x.tail || "");
    out.push({id: "or:" + x.id, kind: "order", target: null, dimension: null, prompt: plain(x.lead || "") + "＿＿ ＿＿ ★ ＿＿" + plain(x.tail || ""), sentence: plain(whole),
      lead: plain(x.lead || ""), tail: plain(x.tail || ""), tiles, needle: tiles[ORDER_STAR],
      answer: tiles[ORDER_STAR], wrong: tiles.filter((_, i) => i !== ORDER_STAR), seconds: SECONDS.order, say: whole,
      solution: {word: tiles[ORDER_STAR], meaning: x.en, ja: whole, en: ""}});
  }
  return out;
}

// ---- The reading sprint ----
// One short passage, its question, 90 seconds (owner's backlog): the game's one long card, started from Home as a round
// of SPRINT.size, from 問題10 (short passages) of papers not yet sat and never HELD_OUT. The review shows the deciding
// lines (n2-sets/keys.json) where they exist.
export const SPRINT = Object.freeze({size: 3, seconds: 90, mondai: [10], long: 7, perKind: 2});
export function sprintCards({sets = [], sat = new Set(), keys = {}, seen = {}, random = Math.random} = {}) {
  const out = [];
  for (const set of sets) {
    if (!set?.id || sat.has(set.id) || HELD_OUT.includes(set.id)) continue;
    for (const [i, q] of (set.questions || []).entries()) {
      if (q.skill !== "Reading" || !SPRINT.mondai.includes(q.mondai) || !q.context || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.key) continue;
      const source = set.id + "#" + i, key = keys[source];
      out.push({id: "sp:" + source, kind: "sprint", target: null, dimension: null, prompt: q.prompt, sentence: plain(q.context), needle: "",
        answer: q.choices[q.key - 1], wrong: q.choices.filter((_, j) => j !== q.key - 1), fixed: q.choices, seconds: SPRINT.seconds,
        solution: {word: q.choices[q.key - 1], meaning: "", ja: key ? key.lines.join("") : "", en: key?.en || "", why: q.why || "", source}});
    }
  }
  // Least recently seen first, then at random.
  return shuffle(out, random).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0));
}

// The Sprint (owner, 28 Nov): its passages spread among the long cards a round no longer asks, ten in all. The long
// cards are picked like a round's (least recently seen, the kinds in turn, resting); a long card missed comes back
// first in the next Sprint.
export function sprintRound({passages = [], pool = [], state = {}, recall = [], random = Math.random, now = Date.now()}) {
  const longs = pool.filter(q => LONG_KINDS.has(q.kind));
  const ids = new Set(longs.map(q => q.id)), comeback = (state.comeback || []).filter(id => ids.has(id));
  // At most SPRINT.perKind of a kind, so the many exam questions never crowd out the order, pair and meaning cards.
  const many = pickRound({pool: longs, recall, seen: state.seen || {}, wins: state.wins || {}, lv: state.lv || {}, size: SPRINT.long * 3, comeback, random, now});
  const count = {}, cards = [];
  for (const q of many) { if (cards.length >= SPRINT.long) break; if (!q.comeback && (count[q.kind] || 0) >= SPRINT.perKind) continue; count[q.kind] = (count[q.kind] || 0) + 1; cards.push(q); }
  for (const q of many) { if (cards.length >= SPRINT.long) break; if (!cards.includes(q)) cards.push(q); }
  const out = [...cards], step = Math.max(1, Math.floor((cards.length + passages.length) / Math.max(1, passages.length)));
  passages.slice(0, SPRINT.size).forEach((p, n) => out.splice(Math.min(out.length, n * step + 1 + n), 0, p));
  return out;
}

// ---- The connective on its own ----
// One word, large, nothing to read: とはいえ → "that said, even so". At N2 a
// connective says where the writer's point is, and it has to be known on
// sight. The words, their meanings and their jobs are n2-connectives.js; a
// wrong choice is never the meaning of a connective whose job overlaps the
// answer's (OVERLAP), so しかし is not offered against だが. After the answer
// the card says the word's job in a line.
function linkCards() {
  return CONNECTIVES.flatMap(([word, job, meaning]) => {
    const blocked = new Set(OVERLAP[job] || [job]);
    const wrong = [...new Set(CONNECTIVES.filter(([w, j, m]) => w !== word && !blocked.has(j) && !sameSense(m, meaning)).map(([, , m]) => m))].filter(m => !(LINK_NOT_WRONG[word] || []).includes(m));
    const shown = LINK_SHOWN[word] || word; // the form the word is met in (それにもかかわらず); the id keeps the table's
    // Where a connective is built of plain pieces (それ + な + のに), the card shows them, as a grammar card shows its
    // parts, and says them together after the answer: one more word worked out, not memorised (owner, 27 Nov).
    const built = LINK_PARTS[word];
    if (wrong.length < 3 || !JOBS[job]) return [];
    return [{...(SCORE_ALL ? {} : {practice: true, record: true}), id: "k:" + word, kind: "link", target: null, dimension: null, prompt: shown,
      sentence: "", answer: meaning, wrong, job, seconds: built ? SECONDS.linkBuilt : SECONDS.link, ...(built ? {parts: built.parts.map(([text, g]) => ({text, gloss: g})), literal: built.literal} : {}),
      solution: {word: shown, meaning, why: LINK_WHY[word] || JOBS[job], ja: "", en: ""}}];
  });
}

function connectiveQuestion(source, text, site) {
  const job = jobOf(site.word);
  if (!job) return [];
  const before = text.slice(0, site.at).replace(/\n/g, ""), after = text.slice(site.at + site.word.length);
  // Up to two sentences before the gap. One sentence was tried (27 Nov) and taken back the same day: with less
  // before it, a second connective often fits too, and the card stops being fair (owner: "the wrong direction").
  // What keeps a long excerpt from being known by its shape is its rest (restFor), not its length.
  const prev = (before.match(/(?:[^。」]*[。」]){1,2}\s*$/) || [""])[0].trim();
  const rest = (after.match(/^、[^。\n]*[。」]?/) || [""])[0];
  if (!prev || rest.length < 6) return [];
  const blocked = new Set(OVERLAP[job] || [job]);
  const wrong = Object.entries(CHOICE_FOR_JOB).filter(([j]) => !blocked.has(j)).map(([, w]) => w);
  return [{id: "c:" + source + "@" + site.at, kind: "connective", ...(SCORE_ALL ? {} : {practice: true}), target: null, dimension: null, prompt: "（　）に入るのは？",
    sentence: prev + "（　）" + rest, needle: "（　）", answer: site.word, wrong, seconds: SECONDS.connective,
    // The review of a miss is the word and its meaning at a glance, like any word: the connective, its short
    // meaning large, its job as the why, and the gap's own sentence.
    solution: {word: site.word, meaning: glossOf(site.word), why: JOBS[job], ja: site.word + rest, source, job}}];
}

// A pattern written in pieces (にしろ～にしろ, ことは〜が, ないことには～ない) is
// underlined in every piece: each is found in order after the one before
// (owner's report, 27 Nov: only the first にしろ was underlined). null when
// the name is one piece, or a piece is not in the sentence as written.
export function piecesNeedle(sentence = "", name = "") {
  const pieces = String(name).replace(/[①-⑨]|（[^）]*）|\([^)]*\)/g, "").split(/[〜～…]+/).map(x => x.trim()).filter(Boolean);
  if (pieces.length < 2) return null;
  let from = 0;
  for (const piece of pieces) { const at = sentence.indexOf(piece, from); if (at < 0) return null; from = at + piece.length; }
  return pieces;
}
// The form to underline, as it appears in the sentence (design fix 6): a
// grammar name like 得る（える・うる） or ～ないことには, and a word in a conjugated
// form (生ずる written 生じた), are found by their stem. "" when not found.
export function surfaceNeedle(sentence = "", name = "") {
  const forms = String(name).replace(/[〜～]/g, "").replace(/（[^）]*）|\([^)]*\)/g, "").split(/[・／\s]+/).map(x => x.trim()).filter(Boolean);
  for (const f of forms) if (sentence.includes(f)) return f;
  for (const f of forms) for (let cut = 1; cut <= 3 && f.length - cut >= 1; cut++) {
    const stem = f.slice(0, f.length - cut);
    if (/^[ぁ-ん]$/.test(stem) || !stem) break;
    if (sentence.includes(stem)) return stem;
  }
  return "";
}

// What a listen card leaves out of its sentence: the heard word as written,
// or, when the sentence has it in another form (涼む heard, 涼んでいた written),
// the part of it that is there (涼). "" when the sentence does not hold it:
// the card is then the sound alone. (Owner's report, 27 Nov: a card gave the
// audio and no sentence; 219 of N2's 1,581 listen cards did.)
export function heardGap(ja = "", word = "") {
  const sentence = plain(ja);
  return !word ? "" : sentence.includes(word) ? word : surfaceNeedle(sentence, word);
}

// The four choices, in a fixed order per question for exam items (as
// authored), shuffled otherwise. Near misses come first when there are any.
// level (0 easy … 1 hard, see flowLevel) decides how many of the confusable
// wrong choices (sharing a kanji) are used: none when easy, all three when hard.
export function choicesFor(q, random = Math.random, level = .5) {
  if (q.fixed) return {choices: q.fixed, key: q.fixed.indexOf(q.answer)};
  // q.near: the confusable wrong choices (sharing a kanji). Easy forces none
  // in and takes the others first; hard forces up to three.
  const near = (q.near || []).filter(w => w !== q.answer), far = q.wrong.filter(w => w !== q.answer && !near.includes(w));
  const forced = shuffle(near, random).slice(0, Math.round(level * 3));
  const rest = level < .5 ? [...shuffle(far, random), ...shuffle(near.filter(w => !forced.includes(w)), random)] : shuffle([...far, ...near.filter(w => !forced.includes(w))], random);
  const picked = [...new Set([...forced, ...rest])].slice(0, 3);
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
// calm: the recovery round after a hard one. What the player has won is
// taken even if it was seen minutes ago (in a session everything won is
// recent, and the four-hour rest used to leave the round to new cards: owner's
// report, 27 Nov), and the places left go to the familiar before the new.
const cardItem = q => q.target ? keyOf(q.target) : q.item || q.id;
// When each word was last shown, by any of its cards.
function wordSeen(pool, seen) {
  const last = new Map();
  for (const q of pool) { const t = seen[q.id]; if (!t) continue; const w = cardItem(q); if (t > (last.get(w) || 0)) last.set(w, t); }
  return last;
}
// The reading-first rule: a meaning, definition or listen card whose word has a reading card never answered.
const ASKED_AFTER_READING = new Set(["meaning", "definition", "listen"]);
export function readFirst(pool, seen = {}) {
  const reading = new Map();
  for (const q of pool) if (q.kind === "reading") reading.set(cardItem(q), q.id);
  return q => ASKED_AFTER_READING.has(q.kind) && reading.has(cardItem(q)) && !seen[reading.get(cardItem(q))];
}
export function pickRound({pool, also = [], recall = [], seen = {}, wins = {}, lv = {}, size = ROUND_SIZE, random = Math.random, mix = {weak: 4, fresh: 4, known: 2}, comeback = [], now = Date.now(), calm = false, first = [], places = 0, weights = null}) {

  const last = new Map();
  for (const r of recall) last.set(r.dimension + keyOf(r.target), r.last);
  const state = q => { const g = q.target && last.get(q.dimension + keyOf(q.target)); return g && g !== "instant" ? "weak" : g === "instant" || wins[q.id] ? "known" : "fresh"; };
  // Seen in the last four hours: only if nothing else is left (a small kind
  // such as the homophones would otherwise come round several times a day).
  const groups = {weak: [], fresh: [], known: []}, recent = [];
  // A mastered item (極) rests three days between visits: it comes up less.
  // The rest doubles with each level (4 h, 8 h, 16 h, 32 h, 64 h, then three days): a card known better comes
  // back later. Without it a small kind looped: eleven connective excerpts came round every four hours until the
  // answer was known by the look of the card, not by reading it (owner's flags, 27 Nov).
  // The rest is the word's, not the card's (owner, 28 Nov: 小学生 came back round after round as its meaning,
  // definition, listen and reading cards in turn, each resting on its own clock).
  const lastOf = wordSeen(pool, seen);
  const resting = q => now - Math.max(seen[q.id] || 0, lastOf.get(cardItem(q)) || 0) < restFor(lv[q.id]);
  // A word with a reading card is read before it is asked any other way: its kanji are what is learned.
  const unread = readFirst(pool, seen);
  for (const q of shuffle(pool, random)) { const s = state(q); if (unread(q)) continue; (calm && s === "known" ? groups.known : resting(q) ? recent : groups[s]).push(q); }
  // Least recently seen first, then the kinds taken in turn, so grammar,
  // readings and exam questions are not drowned by the many word questions.
  for (const [name, g] of Object.entries(groups)) groups[name] = byKindInTurn(g.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0)), random, weights);
  const out = [], used = new Set(), targets = new Set();
  const take = (list, n) => { for (const q of list) { if (n <= 0) break; const t = cardItem(q); if (used.has(q.id) || targets.has(t)) continue; used.add(q.id); targets.add(t); out.push(q); n--; } };
  // also: cards asked only as comebacks (a missed kanji card), never picked here.
  const byId = new Map([...pool, ...also].map(q => [q.id, q]));
  const back = shuffle(comeback.map(id => byId.get(id)).filter(Boolean), random).slice(0, size);
  take(back, back.length);
  const backCount = out.length;
  // first: cards that go ahead of the mix whatever their rest (the boss's misses), `places` of them.
  take(first, places);
  take(groups.weak, mix.weak); take(groups.fresh, mix.fresh); take(groups.known, mix.known);
  const seenFirst = recent.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0));
  take(calm ? [...groups.known, ...seenFirst, ...groups.weak, ...groups.fresh] : [...groups.fresh, ...groups.weak, ...groups.known, ...seenFirst], size - out.length);
  const rest = interleave(shuffle(out.slice(backCount, size), random));
  return [...out.slice(0, backCount).map(q => ({...q, comeback: true})), ...rest].slice(0, Math.max(size, backCount));
}
// weights: kind → how many turns it takes each time round (1 where unsaid). With none the kinds take one turn
// each, as they always did. A kind at 0.5 is taken every other time round, a kind at 2 twice.
function byKindInTurn(list, random, weights = null) {
  const queues = new Map();
  for (const q of list) queues.set(q.kind, [...(queues.get(q.kind) || []), q]);
  const kinds = shuffle([...queues.keys()], random), out = [], credit = new Map();
  while (out.length < list.length) for (const k of kinds) {
    const queue = queues.get(k); if (!queue.length) continue;
    credit.set(k, (credit.get(k) || 0) + (weights?.[k] ?? 1));
    while (credit.get(k) >= 1 && queue.length) { out.push(queue.shift()); credit.set(k, credit.get(k) - 1); }
  }
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
// Wrong: −200, times the same step for the streak it breaks (up to −400). "I don't know" and a timeout: 0. Wrong, I don't know and a
// timeout all break the combo, so a blind guess always loses points.
export const POINTS = Object.freeze({base: 50, speed: 250, wrong: -200, fastShare: .5});
export function scoreAnswer({outcome, ms = 0, seconds = 10, streak = 0}) {
  if (outcome === "right") {
    const share = Math.max(0, 1 - ms / (seconds * 1000));
    const points = Math.round((POINTS.base + POINTS.speed * share) * (1 + Math.min(streak, 10) / 10));
    return {points, streak: streak + 1, fast: share >= POINTS.fastShare};
  }
  // A wrong answer costs more on a streak (owner, 26 Nov): ×1.1 per answer of
  // the streak it breaks, like the combo itself, so −200 at no streak and −400
  // at ten. Gambling a long streak on a guess is the risky move, not the safe one.
  return {points: outcome === "wrong" ? Math.round(POINTS.wrong * (1 + Math.min(streak, 10) / 10)) : 0, streak: 0, fast: false};
}

// What a miss saves: a missed recall check of the question's own dimension.
// An unreviewed card (practice) writes no recall evidence.
export const recallsMiss = (q, outcome) => outcome !== "right" && !!q.target && !q.practice;

// The device's game memory: best score, rounds, when each question was last
// seen. Kept small: the most recent 20 000 questions.
// ---- Item strength (board 9) ----
// Every question carries a level from 0 to 5. A fast right answer (under half
// the clock) adds one, at most once every four hours, so a level means spaced
// wins; a miss, a timeout or "I don't know" takes one away; a slow right
// answer leaves it. Level 5 is 極, mastered: it rests for three days between
// visits. Felt on the card, never browsed.
export const ITEM_LEVEL = Object.freeze({max: 5, gapMs: 4 * 3600_000, restMs: 3 * 86400_000});
export const restFor = (level = 0) => Math.min(ITEM_LEVEL.restMs, RECENT_MS * 2 ** Math.min(ITEM_LEVEL.max, Math.max(0, Math.floor(Number(level) || 0))));
export const itemLevel = (state = {}, id) => Math.min(ITEM_LEVEL.max, Math.max(0, Math.floor(Number(state.lv?.[id]) || 0)));
export function levelAfter(state = {}, {id, outcome, fast = false, now = Date.now()}) {
  const before = itemLevel(state, id);
  if (outcome !== "right") return Math.max(0, before - 1);
  return fast && before < ITEM_LEVEL.max && now - (state.lvAt?.[id] || 0) >= ITEM_LEVEL.gapMs ? before + 1 : before;
}
// What the game knows about one card: its level, how often it was tried and
// missed (the fail rate), when it was last seen and last levelled up.
export function itemRecord(state = {}, id) {
  const tried = state.tried?.[id] || 0, missed = Math.min(tried, state.missed?.[id] || 0);
  return {level: itemLevel(state, id), tried, missed, failRate: tried ? missed / tried : null, seenAt: state.seen?.[id] || 0, levelAt: state.lvAt?.[id] || 0};
}
// A level's coverage: its words (a word is one thing, whatever card asks it),
// how many have been met, and how many are known: some card of the word at
// KNOWN_LEVEL or more, i.e. won fast on three separate occasions.
export const KNOWN_LEVEL = 3;
export function levelCoverage(pool = [], state = {}) {
  const words = new Map();
  for (const q of pool) {
    const key = q.item || (q.target?.[0] === "word" ? keyOf(q.target) : null);
    if (!key || q.kind === "exam") continue;
    const w = words.get(key) || {seen: false, level: 0};
    words.set(key, {seen: w.seen || !!state.seen?.[q.id], level: Math.max(w.level, itemLevel(state, q.id))});
  }
  const all = [...words.values()];
  return {items: all.length, seen: all.filter(w => w.seen).length, known: all.filter(w => w.level >= KNOWN_LEVEL).length};
}
// After each answer: the question is seen; a miss waits for the next round.
export function rememberAnswer(state = {}, {q, outcome, points = 0, fast = false, difficulty = "normal", now = Date.now()}) {
  const seen = {...(state.seen || {}), [q.id]: now};
  // Practice (connectives until reviewed) is exposure only: it never moves
  // accuracy, the level, the day or boss counts, the run clock, wins or repeats.
  if (q.practice && !q.record) return {...state, seen, practiced: (state.practiced || 0) + 1};
  const kj = kanjiAfter(state, {q, outcome, now});
  const gb = grammarAfter(state, {q, outcome, now});
  // The item record (owner, 26 Nov): how often each card was tried and missed.
  const tried = {...(state.tried || {}), [q.id]: (state.tried?.[q.id] || 0) + 1};
  const missed = outcome === "right" ? state.missed || {} : {...(state.missed || {}), [q.id]: (state.missed?.[q.id] || 0) + 1};
  // An unreviewed level's card (record) is an answer like any other: the item
  // record moves, the miss comes back, and it counts toward the day and the
  // 1,000 that open the boss (owner, 27 Nov: the levels must be playable
  // now). Only its points wait for the review (the screen pays it nothing),
  // and it leaves the hidden level alone.
  if (q.practice) points = 0;
  const wins = {...(state.wins || {})};
  if (fast) wins[q.id] = (wins[q.id] || 0) + 1;
  const was = itemLevel(state, q.id), now_ = levelAfter(state, {id: q.id, outcome, fast, now});
  const lv = {...(state.lv || {})}, lvAt = {...(state.lvAt || {})};
  if (now_ !== was) { lv[q.id] = now_; if (now_ > was) lvAt[q.id] = now; }
  const comeback = (state.comeback || []).filter(id => id !== q.id);
  if (outcome !== "right") comeback.push(q.id); // missed again: it comes back again
  // A boss's miss is done once its card is answered right (bossCards).
  const bossDone = q.boss && outcome === "right" ? {key: q.boss, ids: {...(state.bossDone?.key === q.boss ? state.bossDone.ids : {}), [q.id]: 1}} : state.bossDone;
  const level = q.practice ? state.level : flowStep(state.level, outcome === "right", difficulty);
  const runStart = state.runStart || new Date(now).toISOString(); // the run clock starts on its first answer
  const total = (state.total || 0) + points, day = localDay(new Date(now));
  const days = {...(state.days || {})}, d = days[day] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  days[day] = {...d, answered: d.answered + 1, right: d.right + (outcome === "right" ? 1 : 0), points: d.points + points};
  return {...state, seen, tried, missed, kj, ...(gb ? {gb} : {}), wins, lv, lvAt, ...(level === undefined ? {} : {level}), ...(q.practice ? {practiced: (state.practiced || 0) + 1} : {}), runStart, comeback: comeback.slice(-ROUND_SIZE), ...(bossDone ? {bossDone} : {}), total, answered: (state.answered || 0) + 1, days};
}
export function rememberRound(state = {}, {score, questions = [], misses, scored, now = Date.now()}) {
  const seen = {...(state.seen || {})};
  for (const q of questions) seen[q.id] = now;
  const ids = Object.keys(seen);
  if (ids.length > 20000) ids.sort((a, b) => seen[a] - seen[b]).slice(0, ids.length - 20000).forEach(id => delete seen[id]);
  const day = localDay(new Date(now)), days = {...(state.days || {})}, d = days[day] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  days[day] = {...d, rounds: d.rounds + 1, best: Math.max(d.best, score)};
  const n = scored ?? questions.length, right = Math.max(0, n - (misses ?? 0));
  const history = [...(state.history || []), {at: new Date(now).toISOString(), score, right, n}].slice(-500);
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
// held: the level's held-out sets (N2's by default); prefix: what its set ids start with.
export function bossSet({sets = [], attempts = [], now = new Date(), held = HELD_OUT, prefix = "n2-set-"}) {
  const lastAt = new Map();
  for (const a of attempts) { const at = a.completedAt || a.startedAt || ""; if (a.book && at > (lastAt.get(a.book) || "")) lastAt.set(a.book, at); }
  const order = [...sets.filter(id => !held.includes(id)), ...sets.filter(id => held.includes(id))];
  if (!order.length) return null;
  const fresh = order.find(id => !lastAt.has(id));
  const id = fresh || [...order].sort((a, b) => lastAt.get(a).localeCompare(lastAt.get(b)))[0];
  const day = localDay(now), beatenToday = attempts.some(a => a.phase === "results" && a.completedAt && localDay(new Date(a.completedAt)) === day && (a.book || "").startsWith(prefix));
  return {id, fresh: !!fresh, beatenToday};
}

// ---- The boss's misses ----
// A boss shows what is not known yet. Asking the same question again would
// only teach its answer (owner, 27 Nov), so the rounds take what transfers:
// the word or pattern a missed question tested, on its own card, in another
// sentence; and from a reading or listening miss, the N2 words and patterns
// of the passage, those of its deciding lines (n2-sets/keys.json) first.
// A few places of each round, with no word about where they come from, until
// each card has been answered right once. The question itself is only ever
// shown again in the boss review (bossReview), which asks nothing.
export const BOSS_PLACES = 4, BOSS_WORDS = 3;
export function bossCards({set, missed = [], keys = {}, pool = []}) {
  if (!set?.id) return [];
  const byTarget = new Map();
  for (const q of pool) if (q.target && q.kind !== "exam") byTarget.set(keyOf(q.target), [...(byTarget.get(keyOf(q.target)) || []), q]);
  const words = pool.filter(q => q.kind === "meaning" && q.target?.[0] === "word" && q.prompt.length >= 2 && q.prompt.match(KANJI));
  // A pattern counts as in the text only when it is written there whole.
  const patterns = pool.filter(q => q.kind === "grammar").map(q => [q, q.prompt.replace(/[〜～]/g, "")]).filter(([, name]) => name.length >= 3 && !/[・（(]/.test(name));
  const out = [], seen = new Set();
  const add = q => { if (q && !seen.has(q.id)) { seen.add(q.id); out.push(q); } };
  for (const i of [...new Set(missed)].sort((a, b) => a - b)) {
    const q = set.questions?.[i], source = set.id + "#" + i;
    if (!q) continue;
    if (WRITTEN.has(q.skill)) {
      const cards = q.target ? byTarget.get(keyOf(q.target)) || [] : [];
      const kind = q.target?.[0] === "grammar" ? "grammar" : q.dimension === "reading" ? "reading" : "meaning";
      add(cards.find(c => c.kind === kind) || cards[0]);
      continue;
    }
    const lines = (keys[source]?.lines || []).join(""), passage = (q.context || "") + (q.choices || []).join("");
    for (const text of [lines, passage]) {
      if (!text) continue;
      for (const [g, name] of patterns) if (text.includes(name)) add({...g, passage: source});
      for (const w of words) if (text.includes(w.prompt)) add({...w, passage: source});
    }
  }
  return out;
}
// What is left of them: the cards not yet answered right since this boss.
// Of a passage's words and patterns only those not known yet are kept, BOSS_WORDS a passage.
export function bossQueue({cards = [], state = {}, key = ""}) {
  const done = state.bossDone?.key === key ? state.bossDone.ids || {} : {}, perPassage = new Map();
  return cards.filter(q => {
    if (done[q.id]) return false;
    if (!q.passage) return true;
    if (itemLevel(state, q.id) >= KNOWN_LEVEL || state.wins?.[q.id]) return false;
    const n = perPassage.get(q.passage) || 0; perPassage.set(q.passage, n + 1);
    return n < BOSS_WORDS;
  }).map(q => ({...q, boss: key}));
}

// ---- The mix follows the last boss ----
// A learner's weak section gets more of the round, the strong one less
// (owner, 27 Nov: for every learner, from the relative result of the last
// boss). Each section's miss rate is set against the mean of the four: a
// section missed twice as often as the mean takes twice the turns, one
// missed half as often takes half, never outside SKILL_WEIGHT's bounds, so
// no skill disappears and none floods the round. Before a first boss, or
// after a perfect one, every kind takes one turn as before.
export const SKILL_WEIGHT = Object.freeze({min: .5, max: 2});
export const SKILLS_OF_PAPER = Object.freeze(["vocabulary", "grammar", "reading", "listening"]);
const SKILL_NAMES = {Vocabulary: 0, Grammar: 1, Reading: 2, Listening: 3};
// What each kind of card trains. A connective is a reading tool: it says where the writer's point is.
export const KIND_SKILL = Object.freeze({kana: "vocabulary", kanji: "vocabulary", reading: "vocabulary", meaning: "vocabulary", definition: "vocabulary", homophone: "vocabulary", affix: "vocabulary", partgap: "vocabulary",
  grammar: "grammar", gap: "grammar", block: "grammar", build: "grammar", infer: "grammar", order: "grammar",
  link: "reading", connective: "reading", para: "reading", sprint: "reading", pair: "reading", listen: "listening"});
export function skillWeights({paper, attempt} = {}) {
  const tally = SKILLS_OF_PAPER.map(() => [0, 0]);
  (paper?.questions || []).forEach((q, i) => { const s = typeof q.skill === "number" ? q.skill : SKILL_NAMES[q.skill]; if (!(s in tally) || !q.key) return; tally[s][1]++; if (attempt?.answers?.[i] !== q.key) tally[s][0]++; });
  const rates = tally.map(([missed, n]) => n ? missed / n : null), known = rates.filter(r => r !== null);
  const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  if (!mean) return null;
  return Object.fromEntries(SKILLS_OF_PAPER.map((name, i) => [name, rates[i] === null ? 1 : Math.min(SKILL_WEIGHT.max, Math.max(SKILL_WEIGHT.min, Math.round(rates[i] / mean * 100) / 100))]));
}
export const kindWeights = skills => skills ? Object.fromEntries(Object.entries(KIND_SKILL).map(([kind, skill]) => [kind, skills[skill] ?? 1])) : null;

// ---- A flag ----
// A flag says the card itself looks wrong. It is not an answer, and the card
// must not come straight back: flagged while it was waiting as a miss, it
// used to return every round (崩す, flagged sixteen times in 25 minutes:
// reports of 26 Nov). A flag takes the card out of the misses and rests it
// FLAG_REST_MS, time for the report to be read; then it may be asked again.
export const FLAG_REST_MS = 7 * 86400_000;
export const flagRests = (state = {}, id, now = Date.now()) => now - (state.flags?.[id] || 0) < FLAG_REST_MS;
export function flagCard(state = {}, id, now = Date.now()) {
  const flags = Object.fromEntries(Object.entries({...(state.flags || {}), [id]: now}).filter(([, at]) => now - at < FLAG_REST_MS));
  return {...state, seen: {...(state.seen || {}), [id]: now}, comeback: (state.comeback || []).filter(x => x !== id), flags};
}

// The boss review: every wrong or unsure answer of one sitting as a card that
// is read, not answered: the question, the right choice, the one picked, the
// why, and for a reading or listening question its deciding lines. It runs
// at the game's pace (BOSS_REVIEW seconds a card, with the hold button) and
// counts toward nothing: it is a look at the answers, not an exercise.
// `paper` is the sitting's own paper (its questions as they were shown);
// `keys` apply only when `source` names the set they were written for.
export const BOSS_REVIEW = Object.freeze({short: 5, long: 8});
export function bossReview({paper, attempt, keys = {}, source = ""}) {
  return (paper?.questions || []).flatMap((q, i) => {
    const given = attempt?.answers?.[i], unsure = !!attempt?.guesses?.[i];
    if (!q?.key || !Array.isArray(q.choices) || (given === q.key && !unsure)) return [];
    // A stored paper numbers its skills (0 vocabulary … 3 listening); a set file names them.
    const long = [2, 3, "Reading", "Listening"].includes(q.skill);
    const key = source ? keys[source + "#" + i] : null, heard = q.skill === "Listening" || q.skill === 3;
    return [{index: i, mondai: q.mondai, long, heard, target: q.target || null, ask: q.prompt || "", answer: q.choices[q.key - 1],
      picked: given === q.key ? "" : given ? q.choices[given - 1] || "" : null, unsure: given === q.key,
      lines: key?.lines || (heard && (q.choices.length === 3) ? [String(q.context || "").replace(/^[男女][０-９0-9１２]?[：:]/, "")] : []), en: key?.en || "", why: q.why || "",
      seconds: long ? BOSS_REVIEW.long : BOSS_REVIEW.short}];
  });
}

// A slump: the last round went badly (under half right, or points below
// zero). The next round is a warm-up of things the player already wins at,
// with at most two of the misses, to bring the motivation back (owner,
// 26 Nov). One good round (seven or more right) ends it.
export const WARM_UP = Object.freeze({mix: {weak: 1, fresh: 1, known: 8}, comeback: 2});
export function inSlump(state = {}) {
  const last = (state.history || []).at(-1);
  // Accuracy alone (owner, 26 Nov): a score below zero used to count too, and
  // since a wrong answer on a streak costs up to 400 it fired nearly every round.
  return !!last && last.n > 0 && last.right / last.n < .5;
}
// review: the cards of the levels under the player's rank (rankLevels). When
// there are any, REVIEW_SHARE of the round's places go to them, least recently
// seen first, so a level passed keeps coming back. With none, the round is
// picked exactly as it always was.
// kanji: {order, examples} picks the rank's places by kanji (kanjiPick)
// instead of by card: the way of every level whose cards are word cards only.
// N2 kanji (owner's backlog, 27 Nov): N2 rounds stay picked by card, but KANJI_PLACES of each go to kanji-first picking
// over the same pool (kanjiPick): a missed reading first, then new kanji in the order of how many N2 words carry them,
// then proving them in words not seen yet. `kanjiOrder` is that order; without it the round is picked as before.
export const KANJI_PLACES = 2;
// A level's kanji that some card can ask (a reading card in any of the pools given). A kanji whose only words were
// dropped by the word-list review (咖哩, 其れから, 吝嗇: rare spellings) leaves the level's order and its count, so a
// level can be fully known.
export function askableKanji(order = "", pools = []) {
  const has = new Set();
  for (const pool of pools) for (const q of pool || []) if (q.kind === "reading") for (const key of q.kanji || []) has.add([...key][0]);
  return [...order].filter(k => has.has(k)).join("");
}
export function kanjiOrderOf(pool = []) {
  const count = new Map();
  for (const q of pool) if (q.kind === "reading") for (const key of q.kanji || []) { const k = [...key][0]; count.set(k, (count.get(k) || 0) + 1); }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k).join("");
}
// Kinds whose card is a block of text or a puzzle: Same meaning (a sentence and four sentence-long choices), sentence
// order (★), clause pairs and the paper's own questions. They break a round's flow (owner, 28 Nov: "it just breaks
// the flow of the round"), so they live in the Sprint (sprintRound) and never in a round.
export const LONG_KINDS = new Set(["para", "order", "pair", "exam"]);
export function nextRound({pool, review = [], kanji = null, grammarCards = null, boss = [], recall = [], state = {}, difficulty = "normal", random = Math.random, now = Date.now(), exams = true, long = false, weights = null, kanjiOrder = "", glyphs = [], kana = []}) {
  // exams: false leaves a paper's own questions (the `e:` cards) out of the round.
  if (!exams) pool = pool.filter(q => q.kind !== "exam");
  // Long cards stay out of a round (owner, 28 Nov: "long text blocks in the fast rounds slow down and only invite
  // me to memorize"): the pool still builds them for the audit and the reviewer; long: true lets them in.
  if (!long) pool = pool.filter(q => !LONG_KINDS.has(q.kind));
  // A flagged card rests (flagCard): it is in no round until the rest is over.
  if (Object.keys(state.flags || {}).length) { const live = list => list && list.filter(q => !flagRests(state, q.id, now));
    pool = live(pool); review = live(review); boss = live(boss); grammarCards = live(grammarCards); if (kanji?.examples) kanji = {...kanji, examples: live(kanji.examples)}; }
  const slump = inSlump(state), beat = pace(state, now);
  const level = Math.min(1, Math.max(0, levelOf(state) + beat.offset + (DIFFICULTY[difficulty] || DIFFICULTY.normal).offset));
  const share = review.length && pool.length ? REVIEW_SHARE : 0, memory = {recall, seen: state.seen || {}, wins: state.wins || {}, lv: state.lv || {}, random, now};
  const comeback = slump ? (state.comeback || []).slice(-WARM_UP.comeback) : state.comeback || [];
  let picked;
  // After a hard round the recovery round comes first, at every rank: kanji-first picking waits a round.
  if (kanji?.order && !slump) {
    const byId = new Map([...pool, ...glyphs, ...kana].map(q => [q.id, q])), places = ROUND_SIZE - share;
    const back = shuffle(comeback.map(id => byId.get(id)).filter(Boolean), random).slice(0, places).map(q => ({...q, comeback: true}));
    picked = [...back, ...kanjiPick({pool, examples: kanji.examples || [], order: kanji.order, state, size: places - back.length, skip: back, random, now, glyphs})];
    // Kanji with nothing left to ask: the places left are picked by card, so a round is always full.
    if (picked.length < places) { const words = new Set(picked.map(q => q.item)); picked.push(...pickRound({...memory, pool: pool.filter(q => !words.has(q.item)), size: places - picked.length, mix: flowMix(level)})); }
  } else picked = pickRound({...memory, pool, also: [...glyphs, ...kana], size: ROUND_SIZE - share, comeback, mix: slump ? WARM_UP.mix : flowMix(level), calm: slump, weights,
    // The last boss's misses take the first places after the comebacks; a recovery round leaves them out.
    ...(slump ? {} : {first: boss, places: BOSS_PLACES})});

  // Kanji places in an N2 round: the last places picked by card give way to kanji-first picks over the same pool.
  if (kanjiOrder && !kanji?.order && !slump) {
    const byKanji = kanjiPick({pool, order: kanjiOrder, state, size: KANJI_PLACES, skip: picked, random, now, glyphs});
    if (byKanji.length) { const keep = picked.filter(q => q.comeback || q.boss), rest = picked.filter(q => !q.comeback && !q.boss);
      picked = [...keep, ...rest.slice(0, Math.max(0, rest.length - byKanji.length)), ...byKanji]; }
  }
  // Kana places (kanaPick): given only at rank N5, while some kana are not yet learned. They take the last places.
  if (kana.length) {
    const byKana = kanaPick({cards: kana, state, skip: picked, now});
    if (byKana.length) { const keep = picked.filter(q => q.comeback || q.boss), rest = picked.filter(q => !q.comeback && !q.boss && q.kind !== "kana");
      // Kana open the round after the comebacks: the easier step first.
      picked = [...keep, ...byKana, ...rest.slice(0, Math.max(0, ROUND_SIZE - share - keep.length - byKana.length))]; }
  }
  if (grammarCards && !slump) {
    const slots = picked.filter(q => q.kind === "grammar" && !q.comeback && !q.boss);
    const replacements = grammarPick({pool: grammarCards, state, slots, skip: picked.filter(q => !slots.includes(q)), comeback, now});
    let n = 0;
    picked = picked.map(q => slots.includes(q) ? replacements[n++] : q);
  }

  if (share) {
    // The comeback cards stay first; the review cards are spread among the rest.
    const words = new Set(picked.map(q => q.item).filter(Boolean));
    const back = picked.filter(q => q.comeback), old = pickRound({...memory, pool: review.filter(q => !words.has(q.item)), size: Math.max(0, ROUND_SIZE - picked.length), mix: slump ? {weak: 0, fresh: 0, known: share} : {weak: share, fresh: share, known: share}, calm: slump}).map(q => ({...q, review: true}));
    picked = [...back, ...interleave(shuffle([...picked.filter(q => !q.comeback), ...old], random))];
  }
  const round = picked.map(q => ({...q, seconds: flowSeconds(q.seconds, level), bonus: !q.comeback && !q.practice && random() < BONUS.chance * beat.bonus}));
  // The round is only called a recovery round when it is one: at least half of
  // it is things already won or seen. A new player has nothing to recover with.
  const familiar = round.filter(q => !q.comeback && (state.wins?.[q.id] || state.seen?.[q.id])).length;
  return {round, warmUp: slump && familiar >= ROUND_SIZE / 2, level, beat};
}

// ---- Kanji first ----
// What is learned is the kanji with its reading, not the word (owner, 26 Nov):
// N3 is 638 kanji, not 2,055 words. A word is the example that carries them.
// `kj` in the game state keeps, per kanji-and-reading (the keys of a card's
// `kanji`): [met, right, missed, transfer, last seen, weak].
//   met       cards answered that hold it, of any kind;
//   right /   reading cards only: the one card that asks how it is read;
//   missed
//   transfer  read right in a word the game had never shown, the kanji met
//             before: the reading was rebuilt, not remembered. One is enough
//             to call the kanji known; so are three right readings, for a
//             kanji with no second word to prove it in (KANJI_KNOWN);
//   weak      1 after a missed reading, until one is right.
export const KANJI_KNOWN = Object.freeze({transfer: 1, right: 3});
const knows = e => !!e && (e.transfer >= KANJI_KNOWN.transfer || e.right >= KANJI_KNOWN.right);
const WORD_KINDS = ["r:", "m:", "d:", "l:", "h:"];
// No card of this word has ever been shown.
export const newWord = (state = {}, q) => !WORD_KINDS.some(p => state.seen?.[p + String(q.id).slice(2)]);
export function kanjiAfter(state = {}, {q, outcome, now = Date.now()}) {
  if (!q.kanji?.length) return state.kj || {};
  const kj = {...(state.kj || {})}, reads = q.kind === "reading", fresh = reads && outcome === "right" && newWord(state, q);
  for (const key of q.kanji) {
    const [met = 0, right = 0, missed = 0, transfer = 0, , weak = 0] = kj[key] || [];
    kj[key] = [met + 1, right + (reads && outcome === "right" ? 1 : 0), missed + (reads && outcome !== "right" ? 1 : 0),
      transfer + (fresh && met > 0 ? 1 : 0), now, reads ? (outcome === "right" ? 0 : 1) : weak];
  }
  return kj;
}
// One kanji, over all its readings: met, known (some reading transferred), weak.
export function kanjiStates(state = {}) {
  const out = new Map();
  for (const [key, [met = 0, right = 0, , transfer = 0, at = 0, weak = 0]] of Object.entries(state.kj || {})) {
    const k = [...key][0], e = out.get(k) || {met: 0, right: 0, transfer: 0, at: 0, weak: false};
    out.set(k, {met: e.met + met, right: e.right + right, transfer: e.transfer + transfer, at: Math.max(e.at, at), weak: e.weak || !!weak});
  }
  return out;
}
// order: a level's kanji (levels/manifest.json `kanji`), as a string.
export function kanjiCoverage(order = "", state = {}) {
  const states = kanjiStates(state), all = [...order];
  return {items: all.length, met: all.filter(k => states.get(k)?.met).length, known: all.filter(k => knows(states.get(k))).length};
}
// A round picked by kanji. Each place is a kanji of the level, then a word
// for it:
//   weak   a reading missed last time: asked again, in another word if there is one;
//   new    never met, in the level's order: in a word whose other kanji are
//          already met when there is one, so one new thing at a time;
//   prove  met but not yet transferred: its reading in a word never shown;
//   known  a known kanji in a word never shown, for pace.
// pool: the rank's cards. examples: cards of other levels, used when the
// rank's own list has no fitting word (half of a level's kanji sit in a
// single word of that level). No word twice; nothing shown in the last four
// hours unless nothing else is left.
export const KANJI_MIX = Object.freeze({weak: 3, fresh: 3, prove: 2});
export function kanjiPick({pool = [], examples = [], order = "", state = {}, size = ROUND_SIZE, skip = [], random = Math.random, now = Date.now(), glyphs = []}) {
  const states = kanjiStates(state), seen = state.seen || {}, cards = new Map();
  for (const q of [...pool, ...examples]) for (const key of q.kanji || []) { const k = [...key][0]; if (!cards.has(k)) cards.set(k, []); cards.get(k).push(q); }
  const wordOf = q => q.item || (q.target ? keyOf(q.target) : q.id), used = new Set(skip.map(wordOf)), out = [];
  const lastOf = wordSeen(pool.concat(examples), seen);
  const recent = q => now - Math.max(seen[q.id] || 0, lastOf.get(cardItem(q)) || 0) < RECENT_MS, metAll = (q, k) => q.kanji.every(key => [...key][0] === k || states.get([...key][0])?.met);
  // The first card that fits, by the tests in turn; a reading card unless `kinds` says otherwise.
  const choose = (k, tests, kinds = ["reading"]) => {
    const list = (cards.get(k) || []).filter(q => kinds.includes(q.kind) && !used.has(wordOf(q)));
    for (const test of tests) { const hit = list.find(q => !recent(q) && test(q)) ; if (hit) return hit; }
    // Nothing rested: the kanji waits (owner, 28 Nov: a kanji with one or two words brought the same card back
    // round after round, 訴訟 five times in a session). The places left go to other kanji or to cards.
    return null;
  };
  // A new kanji is met first as itself, with its meaning (kanjiCards; owner, 28 Nov: "to help pattern recognition
  // when encountering a new word"); once met, its reading is proved in words.
  const glyphOf = new Map(glyphs.map(q => [q.prompt, q]));
  const place = (k, group) => {
    const glyph = group === "fresh" && glyphOf.get(k);
    if (glyph && !seen[glyph.id] && !used.has(glyph.id)) { used.add(glyph.id); out.push({...glyph, focus: k, why: group}); return true; }
    const unseen = q => newWord(state, q);
    // A new kanji comes in with its reading (owner, 28 Nov: 軍隊 came as meaning and listen cards, never read).
    const q = group === "fresh" ? choose(k, [q => metAll(q, k), () => true]) || choose(k, [() => true], ["meaning", "definition", "listen"])
      : group === "weak" ? choose(k, [q => unseen(q) && metAll(q, k), unseen, () => true])
      : choose(k, [q => unseen(q) && metAll(q, k), unseen, () => true]);
    if (!q || (group === "known" && !unseen(q))) return false;
    used.add(wordOf(q)); out.push({...q, focus: k, why: group}); return true;
  };
  const groups = {weak: [], fresh: [], prove: [], known: []};
  for (const k of order) { const e = states.get(k); if (!cards.has(k)) continue; groups[e?.weak ? "weak" : !e?.met ? "fresh" : knows(e) ? "known" : "prove"].push(k); }
  groups.weak.sort((a, b) => states.get(a).at - states.get(b).at); groups.prove.sort((a, b) => states.get(a).at - states.get(b).at); groups.known = shuffle(groups.known, random);
  const fill = (group, n) => { const list = groups[group]; while (n > 0 && list.length && out.length < size) if (place(list.shift(), group)) n--; };
  fill("weak", KANJI_MIX.weak); fill("fresh", KANJI_MIX.fresh); fill("prove", KANJI_MIX.prove);
  // Places left over go to proving before anything new: consolidate, then move on.
  for (const group of ["prove", "fresh", "weak", "known"]) fill(group, size - out.length);
  return shuffle(out, random);
}

// ---- Kanji by meaning ----
// One card a kanji (owner, 28 Nov): the kanji large, its meaning to pick among other kanji's meanings. KANJIDIC's
// English (kanji-readings.js: up to four), the first three shown. No wrong choice shares a word with the answer's
// meanings, so 恐 "fear, dread" never stands against 畏 "fear". Its review lists words that carry it.
// readings: {kanji: {on, kun, en, freq}}; order: the kanji wanted; words: [{word, reading, level}] to quote.
export const KANJI_MEANINGS = 3, KANJI_WRONG = 8, KANJI_WORDS = 3;
const meaningWords = en => new Set(en.flatMap(m => m.toLowerCase().replace(/\([^)]*\)/g, "").split(/[^a-z]+/).filter(w => w.length > 2 && !["the", "and", "for", "one"].includes(w))));
// KANJIDIC names a kanji's radical among its meanings ("one radical (no.1)", "door radical (no. 63)"): not a meaning.
const plainMeanings = en => { const kept = (en || []).filter(m => !/radical \(no\.\s*\d+\)/i.test(m)); return kept.length ? kept : en || []; };
export function kanjiCards(readings = {}, order = "", words = []) {
  readings = Object.fromEntries(Object.entries(readings).map(([k, r]) => [k, {...r, en: plainMeanings(r.en)}]));
  const all = [...new Set(order)].filter(k => readings[k]?.en?.length);
  const byFreq = [...all].sort((a, b) => (readings[a].freq || 3000) - (readings[b].freq || 3000));
  return all.map(k => {
    const r = readings[k], answer = r.en.slice(0, KANJI_MEANINGS).join(", "), mine = meaningWords(r.en);
    // Wrong choices from kanji of about the same frequency, none sharing a meaning word.
    const at = byFreq.indexOf(k), wrong = [], taken = new Set(mine);
    for (let d = 1; wrong.length < KANJI_WRONG && d < byFreq.length; d++) for (const j of [at - d, at + d]) {
      const o = byFreq[j]; if (!o || wrong.length >= KANJI_WRONG) continue;
      const theirs = readings[o].en, text = theirs.slice(0, KANJI_MEANINGS).join(", ");
      // Nor with one another: two "fear" choices would point at each other.
      const words_ = meaningWords(theirs);
      if ([...words_].some(w => taken.has(w)) || wrong.includes(text) || text === answer) continue;
      wrong.push(text); for (const w of words_) taken.add(w);
    }
    const carry = words.filter(w => w.word.includes(k)).slice(0, KANJI_WORDS);
    const reading = [...(r.on || []), ...(r.kun || []).map(x => x.replace(/\..*$/, "").replace(/-/g, ""))].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4).join("・");
    return {id: "kj:" + k, kind: "kanji", item: "kj:" + k, prompt: k, answer, wrong, kanji: [k], target: null, seconds: SECONDS.kanji,
      solution: {word: k, reading, meaning: r.en.join(", "), why: carry.length ? "In " + carry.map(w => w.word + (w.reading ? "（" + w.reading + "）" : "")).join(" · ") : ""}};
  });
}

// ---- Kana ----
// Hiragana, then katakana (owner, 28 Nov: "so that the user gets to learn too"): the base sounds row by row, then
// ゛ and ゜, then the small-kana sounds (きゃ, ひょ). The kana large, its romaji (Hepburn) to pick; wrong choices are
// look-alikes first (さ/ち, シ/ツ, ソ/ン), then other sounds, never one written the same in romaji (じ/ぢ).
const KANA_ROWS = ["あいうえお", "かきくけこ", "さしすせそ", "たちつてと", "なにぬねの", "はひふへほ", "まみむめも", "やゆよ", "らりるれろ", "わをん",
  "がぎぐげご", "ざじずぜぞ", "だぢづでど", "ばびぶべぼ", "ぱぴぷぺぽ"];
const KANA_ROMAJI = Object.freeze({あ: "a", い: "i", う: "u", え: "e", お: "o", か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no", は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo", や: "ya", ゆ: "yu", よ: "yo", ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro", わ: "wa", を: "wo", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po"});
// The small-kana sounds: an い-column kana and a small ゃ, ゅ or ょ.
const YOON = ["き", "し", "ち", "に", "ひ", "み", "り", "ぎ", "じ", "び", "ぴ"];
const yoonRomaji = (k, y) => { const base = KANA_ROMAJI[k], v = {ゃ: "a", ゅ: "u", ょ: "o"}[y]; return /^(shi|chi|ji)$/.test(base) ? base.slice(0, -1) + v : base.slice(0, -1) + "y" + v; };
// Pairs that are told apart by a stroke: each is a wrong choice for the other.
export const KANA_LOOKALIKE = Object.freeze(["あお", "いり", "さち", "きさ", "ぬめ", "ねれわ", "はほ", "るろ", "まも", "こに", "うら", "くへ", "しつ", "ソン", "シツ", "クケタ", "ウワフ", "ヌス", "チテ", "コユ", "アマ", "ノメ", "ナメ", "ラヲ", "セヤ", "ルレ"]);
const toKatakana = text => text.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
export const KANA_WRONG = 8;
// words: [{word, reading}] whose reading begins with the kana, quoted in its review.
export function kanaCards(words = []) {
  const hira = [...KANA_ROWS.flatMap(row => [...row].map(k => [k, KANA_ROMAJI[k]])), ...YOON.flatMap(k => ["ゃ", "ゅ", "ょ"].map(y => [k + y, yoonRomaji(k, y)]))];
  const all = [...hira, ...hira.map(([k, r]) => [toKatakana(k), r])];
  const romajiOf = new Map(all), look = new Map();
  for (const group of KANA_LOOKALIKE) for (const k of group) look.set(k, [...(look.get(k) || []), ...[...group].filter(o => o !== k)]);
  return all.map(([k, r], i) => {
    const katakana = i >= hira.length, near = [...new Set((look.get(k) || []).map(o => romajiOf.get(o)).filter(x => x && x !== r))];
    // Other sounds of the same script and size, nearest in the teaching order first.
    const same = all.map((e, j) => [e, j]).filter(([[o], j]) => (j >= hira.length) === katakana && o.length === k.length && o !== k).sort((a, b) => Math.abs(a[1] - i) - Math.abs(b[1] - i)).map(([[, x]]) => x);
    const wrong = [...new Set([...near, ...same.filter(x => x !== r)])].slice(0, KANA_WRONG);
    const reading = katakana ? k : k, carry = words.filter(w => w.reading && (katakana ? toKatakana(w.reading) : w.reading).startsWith(k) && w.word !== w.reading).slice(0, 2);
    return {id: "kn:" + k, kind: "kana", item: "kn:" + k, prompt: k, answer: r, wrong, near, target: null, seconds: SECONDS.kana, say: k, order: i, script: katakana ? "katakana" : "hiragana",
      solution: {word: k, reading: "", meaning: r, why: carry.length ? "In " + carry.map(w => w.word + "（" + w.reading + "）").join(" · ") : ""}};
  });
}
// A kana is learned after KANA_LEARNED right answers. While some are not, a round at rank N5 gives KANA_PLACES to
// them: a kana seen but not learned again (after KANA_REST), then new ones in the teaching order.
export const KANA_LEARNED = 2, KANA_PLACES = Object.freeze({learning: 6, last: 3}), KANA_REST = 10 * 60_000;
const kanaRight = (state, id) => (state.tried?.[id] || 0) - (state.missed?.[id] || 0);
export function kanaPick({cards = [], state = {}, skip = [], now = Date.now()}) {
  const learning = cards.filter(q => kanaRight(state, q.id) < KANA_LEARNED);
  if (!learning.length) return [];
  const places = learning.length > cards.length / 2 ? KANA_PLACES.learning : KANA_PLACES.last, used = new Set(skip.map(q => q.id)), seen = state.seen || {};
  const again = learning.filter(q => seen[q.id] && now - seen[q.id] >= KANA_REST && !used.has(q.id)).sort((a, b) => seen[a.id] - seen[b.id]);
  const fresh = learning.filter(q => !seen[q.id] && !used.has(q.id));
  const out = [...again.slice(0, Math.ceil(places / 2))];
  out.push(...fresh.slice(0, places - out.length), ...again.slice(out.length));
  return out.slice(0, places);
}

// ---- Grammar from its parts on the screen (board 13) ----
// The list under a build card: one row a piece, in sentence order; a piece
// that repeats is one row with its count (にしても～にしても is three rows, not
// six); a piece with no gloss gets no row.
export function partRows(parts = []) {
  const rows = [];
  for (const {text, gloss} of parts) {
    if (!gloss) continue;
    const same = rows.find(r => r.text === text && r.gloss === gloss);
    if (same) same.times++; else rows.push({text, gloss, times: 1});
  }
  return rows;
}
// The underline cut into one segment per part, so the eye matches the list to
// the sentence. needle: what the card underlines (a string, or the pieces of a
// split pattern). null when the parts do not fill the underline exactly: the
// card then keeps its one underline.
export function cutUnderline(sentence = "", needle = "", parts = []) {
  const ranges = []; let from = 0;
  for (const piece of [].concat(needle)) { const at = piece ? sentence.indexOf(piece, from) : -1; if (at < 0) return null; ranges.push([at, at + piece.length]); from = at + piece.length; }
  const out = [], queue = parts.map(p => p.text); let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push({text: sentence.slice(at, a)});
    let i = a;
    while (i < b) { const text = queue.shift(); if (!text || !sentence.startsWith(text, i) || i + text.length > b) return null; out.push({text, part: true, cut: i > a}); i += text.length; }
    at = b;
  }
  if (queue.length) return null;
  if (at < sentence.length) out.push({text: sentence.slice(at)});
  return out;
}
// The blocks an answer has just proved: those whose transfer count rose.
// The proved beat holds the card a little longer (board 13 · H).
export const PROVED_MS = 600;
export const provedBy = (before = {}, after = {}, q = {}) => (q.blocks || []).filter(id => (after.gb?.[id]?.[3] || 0) > (before.gb?.[id]?.[3] || 0));

// ---- Grammar blocks ----
export const GRAMMAR_BLOCK_KNOWN = Object.freeze({transfer: 1, right: 3});
const blockKnown = ([, right = 0, , transfer = 0] = []) => transfer >= GRAMMAR_BLOCK_KNOWN.transfer || right >= GRAMMAR_BLOCK_KNOWN.right;
const patternPrefixes = ["g:", "gb:", "gi:"];
const newPattern = (state, key) => key && patternPrefixes.every(prefix => !Object.hasOwn(state.seen || {}, prefix + key));
export const BASIC_BLOCK = Object.freeze({levels: ["N5", "N4"], types: ["particle", "ending", "negative"]});
const allMet = (state, q, except) => q.blocks.every(id => id === except || q.basics?.includes(id) || state.gb?.[id]?.[0]);
export const grammarBlockCard = q => q.kind === "block" || q.kind === "build" || q.kind === "infer";

export function grammarAfter(state, {q, outcome, now}) {
  if (!q.blocks?.length) return state.gb;
  const gb = {...state.gb};
  const test = q.kind === "block" || q.kind === "infer", right = outcome === "right";
  const transfer = q.kind === "infer" && right && newPattern(state, q.patternKey) && allMet(state, q);
  for (const id of q.blocks) {
    const [met = 0, got = 0, missed = 0, proved = 0, , weak = 0] = gb[id] || [];
    gb[id] = [met + 1, got + Number(test && right), missed + Number(test && !right),
      proved + Number(!!transfer), now, test ? Number(!right) : weak];
  }
  return gb;
}

export function grammarCoverage(cards, state = {}) {
  const basic = new Set(cards.flatMap(q => q.basics || []));
  const ids = new Set(cards.flatMap(q => q.blocks || []).filter(id => !basic.has(id)));
  return {items: ids.size, known: [...ids].filter(id => blockKnown(state.gb?.[id])).length};
}

// Replace only ordinary grammar slots. Reserve the other original targets so
// an exam/comeback or a later fallback cannot repeat the same pattern.
export function grammarPick({pool, state, slots, skip, comeback = [], now}) {
  const used = new Set(skip.map(cardItem)), focused = new Set(), usage = new Map();
  const byBlock = new Map();
  for (const q of pool) for (const id of q.blocks) {
    if (q.kind === "build") usage.set(id, (usage.get(id) || 0) + 1);
    if (!byBlock.has(id)) byBlock.set(id, []);
    byBlock.get(id).push(q);
  }
  const basic = new Set(pool.flatMap(q => q.basics || []));
  const ids = [...byBlock.keys()].filter(id => !basic.has(id));
  const record = id => state.gb?.[id] || [];
  const order = (a, b) => (record(a)[4] || 0) - (record(b)[4] || 0);
  // A block is assembled once it has been shown inside a pattern with its
  // parts (a build card). Audit, 27 Nov: without this stage a build card was
  // never picked (0 in 600 simulated rounds): the block card always won the
  // "new" place and nothing asked for a build afterwards.
  const assembled = id => byBlock.get(id).some(q => q.kind === "build" && Object.hasOwn(state.seen || {}, q.id));
  const groups = {
    weak: ids.filter(id => record(id)[5]).sort(order),
    assemble: ids.filter(id => record(id)[0] && !blockKnown(record(id)) && !assembled(id)).sort(order),
    fresh: ids.filter(id => !record(id)[0]).sort((a, b) => {
      const level = id => byBlock.get(id).find(q => q.kind === "block")?.blockLevel || "N2";
      return LEVELS.indexOf(level(a)) - LEVELS.indexOf(level(b)) || (usage.get(b) || 0) - (usage.get(a) || 0);
    }),
    prove: ids.filter(id => record(id)[0] && !blockKnown(record(id))).sort(order),
  };
  const last = q => state.seen?.[q.id] || 0;
  const byId = new Map(pool.map(q => [q.id, q])), inferable = new Set(pool.filter(q => q.kind === "infer").map(q => q.patternKey));
  const returning = comeback.map(id => byId.get(id)).filter(Boolean);
  return slots.map((fallback, index) => {
    const reserved = new Set(slots.slice(index + 1).map(cardItem));
    const available = q => !used.has(cardItem(q)) && !reserved.has(cardItem(q));
    const find = (group, test, sort) => {
      for (const id of groups[group]) {
        if (focused.has(id)) continue;
        const q = byBlock.get(id).filter(q => available(q) && test(q, id)).sort(sort)[0];
        if (q) return {q, id};
      }
      return null;
    };
    const weak = q => q.kind === "block" || (q.kind === "infer" && allMet(state, q));
    const prove = q => q.kind === "infer" && newPattern(state, q.patternKey) && allMet(state, q);
    const leastRecent = (a, b) => last(a) - last(b);
    const weakOrder = (a, b) => Number(!newPattern(state, a.patternKey)) - Number(!newPattern(state, b.patternKey)) || leastRecent(a, b);
    const fresh = (q, id) => q.kind === "block" || (q.kind === "build" && allMet(state, q, id));
    // Build with a pattern already shown when there is one: the unseen ones are kept for the proof.
    // A pattern shown with its parts can no longer prove anything (transfer
    // needs a pattern never shown), and most blocks sit in one pattern only.
    // So a pattern is built when it could not be a proof anyway (no infer
    // card, or already shown), or when each of its blocks keeps another
    // unseen pattern to be proved on.
    const spare = id => byBlock.get(id).filter(c => c.kind === "infer" && newPattern(state, c.patternKey)).length;
    const assemble = q => q.kind === "build" && allMet(state, q)
      && (!inferable.has(q.patternKey) || !newPattern(state, q.patternKey) || q.blocks.every(id => spare(id) >= 2));
    // A block with nothing left to prove it on is asked again by its own card, until it is known.
    const rehearse = q => q.kind === "block" && (!last(q) || now - last(q) >= RECENT_MS);
    const keepUnseen = (a, b) => Number(newPattern(state, a.patternKey)) - Number(newPattern(state, b.patternKey)) || leastRecent(a, b);
    const blockFirst = (a, b) => Number(a.kind !== "block") - Number(b.kind !== "block") || leastRecent(a, b);
    const back = returning.find(available);
    const chosen = back ? {q: {...back, comeback: true}, id: back.blocks[0]} : find("weak", q => weak(q) && (!last(q) || now - last(q) >= RECENT_MS), weakOrder)
      || find("assemble", assemble, keepUnseen)
      || find("prove", prove, leastRecent)
      || find("fresh", fresh, blockFirst)
      || find("prove", rehearse, leastRecent)
      || find("weak", weak, weakOrder);
    if (chosen) focused.add(chosen.id);
    const q = chosen?.q || fallback;
    used.add(cardItem(q));
    return q;
  });
}

// ---- The rank ----
// The player's rank is a JLPT level, N5 to N1 (docs/JLPT-LEVELS-PLAN.md,
// phase 4). It sets the level of the questions; the levels under it come back
// as review. It is kept in the game state (`rank`, with `rankAt`, the moment
// it was set, so a sync keeps the latest choice: mergeGame, sync.js).
// A state with no rank is N2: every player before ranks existed played N2,
// and their progress stays exactly where it was.
// How the rank moves up and down is the owner's to decide (promotion is meant
// to be the level's boss); until then it only changes by setRank.
export const RANKS = LEVELS, DEFAULT_RANK = "N2";
// Where a player starts (JLPT plan, phase 4; owner, 27 Nov: "do it all now"): a new player, with no rank and no
// answer yet, starts at START_RANK and moves up by passing each level's boss. A state that has answered without a rank
// (from before ranks existed) is N2, as it always was, so earlier progress is untouched.
export const START_RANK = "N5";
export const rankOf = (state = {}) => RANKS.includes(state?.rank) ? state.rank : state?.answered ? DEFAULT_RANK : START_RANK;
export function setRank(state = {}, rank, now = Date.now()) {
  return RANKS.includes(rank) ? {...state, rank, rankAt: new Date(now).toISOString()} : state;
}
// Places in a round kept for the levels under the rank.
export const REVIEW_SHARE = 2;
// Which levels a round draws on: the rank's own, and those under it as review.
// At N2 nothing is mixed in yet: the lower levels' cards are still practice
// (REVIEWED_LEVELS), and an N2 round is all scored; unscored cards would only
// slow its run to the boss. A lower level joins N2's rounds once it is reviewed.
export function rankLevels(rank = DEFAULT_RANK, reviewed = REVIEWED_LEVELS) {
  const at = RANKS.indexOf(RANKS.includes(rank) ? rank : DEFAULT_RANK), under = RANKS.slice(0, at);
  return {level: RANKS[at], review: RANKS[at] === "N2" ? under.filter(l => reviewed.has(l)) : under};
}
// The boss of a rank is a mock of its level: N2's ship with the app, the
// others are sets/<level>/ (jlpt-sets.js), fetched and kept. Every level
// counts as having one (owner, 27 Nov: "do as if the N1 files were already
// there"), so the rank moves freely; whether a boss can be opened today is
// the screen's to check (the sets may not be on the device, or not written).
export const BOSS_LEVELS = RANKS;
export const hasBoss = rank => BOSS_LEVELS.includes(rank);
// The level above the rank: once the rank's own words have nearly all been
// met (COVERED of them), its cards join the review places as a preview, so a
// player who has run out of new questions at their level meets the next one.
export const COVERED = .95;
export const aheadLevel = rank => RANKS[RANKS.indexOf(rank) + 1] || null;
export const isCovered = c => c.items > 0 && c.seen / c.items >= COVERED;

// ---- The gate ----
// Questions build the item record; only the boss moves the rank (owner,
// 26 Nov). A finished boss of the player's rank gives one verdict:
//   skip   total ≥ RANK_RULES.skip, every section at its minimum: up one
//          level, and that level's boss opens at once;
//   up     total ≥ the level's pass total + RANK_RULES.margin, every section
//          at its minimum: up one level;
//   fail   under the pass total, or a section under its minimum; the second
//          fail in a row at a rank moves it down one level;
//   hold   passed, without the margin: the rank stays.
// The boss is judged as it is sat, written part at half time (owner, 26 Nov).
// A ladder, not Elo: bosses are too rare (one per 1,000 questions) for a
// rating to mean anything. A rank only moves to a level that has a boss
// (hasBoss): otherwise there would be no gate back, so the verdict is kept
// (`waits`) and the rank stays until that level's exams exist.
// Pass totals of 180 (jlpt.jp; docs/JLPT-LEVELS-PLAN.md).
export const EXAM_PASS = Object.freeze({N5: 80, N4: 90, N3: 95, N2: 90, N1: 100});
export const RANK_RULES = Object.freeze({margin: 10, skip: 150, fails: 2});
export function bossVerdict({rank, total, sectionsOk = true}) {
  const pass = EXAM_PASS[rank];
  if (!pass || typeof total !== "number") return null;
  if (total < pass || !sectionsOk) return "fail";
  return total >= RANK_RULES.skip ? "skip" : total >= pass + RANK_RULES.margin ? "up" : "hold";
}
// key: the boss sitting (its run's `at`), so a result is applied once.
// A boss of a rank the player no longer holds is logged and moves nothing.
// levels: the levels whose boss can be sat on this device today. The rank
// only moves to one of them; otherwise the verdict is kept (`waits`) and the
// rank stays, so nobody lands on a level with no paper to climb back from or
// forward on (N1 until its papers ship: owner, 27 Nov, N2 comes first).
export function applyBoss(state = {}, {key, rank = rankOf(state), total, sectionsOk = true, now = Date.now(), levels = BOSS_LEVELS}) {
  const log = state.bossLog || [];
  const verdict = bossVerdict({rank, total, sectionsOk});
  if (!key || !verdict || log.some(e => e.key === key)) return state;
  const entry = {key, at: new Date(now).toISOString(), rank, total, verdict};
  let next = state;
  if (rank === rankOf(state)) {
    let fails = verdict === "fail" ? 1 : 0;
    if (verdict === "fail") for (const e of [...log].reverse()) { if (e.rank !== rank || e.verdict !== "fail") break; fails++; }
    const to = verdict === "up" || verdict === "skip" ? aheadLevel(rank) : fails >= RANK_RULES.fails ? RANKS[RANKS.indexOf(rank) - 1] || null : null;
    if (to && hasBoss(to) && levels.includes(to)) { next = {...setRank(state, to, now), ...(verdict === "skip" ? {bossReady: true} : {})}; entry.to = to; }
    else if (to) entry.waits = to;
  }
  return {...next, bossLog: [...log, entry].slice(-200)};
}
// The last verdict, in words, for Home.
export function verdictLine(entry) {
  if (!entry) return "";
  const score = entry.total + " of 180", moved = entry.to ? ": now " + entry.to : entry.waits ? ": " + entry.waits + " opens when its exams exist" : "";
  return entry.verdict === "fail" ? "Last boss " + score + ", under the " + entry.rank + " line" + (entry.to ? ": now " + entry.to : entry.waits ? "" : ": one more like it moves the rank down")
    : entry.verdict === "hold" ? "Last boss " + score + ": passed, " + (EXAM_PASS[entry.rank] + RANK_RULES.margin) + " moves the rank up"
    : "Last boss " + score + ": " + entry.rank + " passed" + moved;
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
export const BONUS = Object.freeze({chance: .12, times: 3, jackpots: {5: 500, 10: 1500}}); // jackpots: celebrated, not paid
// Blind guessing must never beat "I don't know" in expected points (audit P0).
// With n choices a guess is right 1 time in n and costs 200 the other n − 1
// times, so the whole positive payout of any answer (speed, combo, bonus,
// difficulty) is capped at 200 × (n − 1): 600 for four choices. Jackpots are
// a celebration (sound and line), not points, so they can't tip the sum.
// The cap keeps a 50-point margin below the break-even 200 × (n − 1), so a
// lucky guess that keeps a young streak alive still doesn't pay over two cards.
export const payoutCap = (choices = 4) => -POINTS.wrong * (choices - 1) - 50;
export function bonusPoints({points, bonus = false, streak = 0, factor = 1, choices = 4}) {
  const jackpot = BONUS.jackpots[streak] || 0;
  if (points <= 0) return {points, jackpot: 0, capped: false};
  const raw = Math.round(points * (bonus ? BONUS.times : 1) * factor), cap = payoutCap(choices);
  return {points: Math.min(raw, cap), jackpot, capped: raw > cap};
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
// The boss sitting: the written section at half time (105 → 53 min), the
// listening at its own length, since its audio cannot be shortened.
export const BOSS_MINUTES = Object.freeze({written: 53, listening: 50});
export function bossProgress(state = {}) {
  const done = Math.max(0, (state.answered || 0) - (state.bossFrom || 0));
  // bossReady: a boss passed far above the line opens the next one at once (applyBoss).
  return state.bossReady ? {done: BOSS_EVERY, left: 0, open: true} : {done: Math.min(done, BOSS_EVERY), left: Math.max(0, BOSS_EVERY - done), open: done >= BOSS_EVERY};
}
export function takeBoss(state = {}, {set, attemptId = null, now = Date.now()}) {
  const at = new Date(now).toISOString();
  // A run: the 1,000 questions' points, closed when the boss is taken; its
  // exam score joins it once the boss is finished (runTable).
  const run = {set, at, attemptId, rank: rankOf(state), start: state.runStart || at, gamePoints: (state.total || 0) - (state.runFrom || 0), questions: (state.answered || 0) - (state.bossFrom || 0)};
  return {...state, bossFrom: state.answered || 0, runFrom: state.total || 0, runStart: null, bossReady: false, bossTaken: {set, at}, runs: [...(state.runs || []), run].slice(-200)};
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
// Rest is decided by when the boss was finished (that night), matched to the exact
// sitting when the run knows it, so a boss finished after midnight still rests.
export function resting(state = {}, attempts = [], now = new Date()) {
  const t = state.bossTaken, run = (state.runs || []).at(-1);
  if (!t?.at) return false;
  const done = attempts.find(a => a.phase === "results" && a.completedAt && (run?.attemptId ? a.id === run.attemptId : a.book === t.set && a.completedAt >= t.at));
  // Rest is for the evening of the boss, not the day after (owner, 27 Nov): it
  // ends once the Night Radio has been started (restOver), and at REST_ENDS in
  // the morning, so a boss finished at 1 am does not rest through the next day.
  if (!done || state.restOver === t.at) return false;
  const night = d => localDay(new Date(new Date(d).getTime() - REST_ENDS * 3600_000));
  return night(done.completedAt) === night(now);
}
export const REST_ENDS = 5;
export const endRest = (state = {}) => state.bossTaken?.at ? {...state, restOver: state.bossTaken.at} : state;

// ---- The answer, spoken ----
// After each answer the right word or pattern is spoken once (the device's
// default Japanese voice), never a whole sentence: the sound, the reading and
// the situation together. Words carry their reading (【】), so the voice
// never guesses (重役 → おもやく).
// A grammar pattern, for the voice and the review's reading line: each kanji
// of the pattern takes the reading its example sentence gives it (segments
// from exampleSegments); failing that, the underlined part of the sentence is
// what is read; with neither, the bare pattern and no reading line.
export function patternVoice(text = "", segments = []) {
  const KANJI_RUN = /[一-鿿々]+/g, runs = text.match(KANJI_RUN) || [];
  if (!runs.length) return {speak: text, reading: ""};
  const known = new Map(segments.filter(s => s.reading).map(s => [s.text, s.reading]));
  if (runs.every(run => known.has(run))) return {speak: text.replace(KANJI_RUN, run => run + "【" + known.get(run) + "】"), reading: text.replace(KANJI_RUN, run => known.get(run))};
  const marked = segments.filter(s => s.mark);
  return marked.some(s => s.reading) ? {speak: marked.map(s => s.reading ? s.text + "【" + s.reading + "】" : s.text).join(""), reading: marked.map(s => s.reading || s.text).join("")} : {speak: text, reading: ""};
}
export function answerSpeech(q) {
  const word = (text, reading) => text && reading && text !== reading ? text + "【" + reading + "】" : text || reading || "";
  const pattern = text => String(text || "").replace(/[〜～]/g, "").replace(/（[^）]*）|\([^)]*\)/g, "").trim();
  if (["reading", "meaning", "definition", "listen", "homophone"].includes(q.kind)) return word(q.solution?.word, q.solution?.reading) || null;
  if (q.kind === "grammar" || q.kind === "gap" || grammarBlockCard(q)) return pattern(q.solution?.word || q.prompt) || null;
  if (q.kind === "affix" || q.kind === "partgap") return word(pattern(q.solution?.word), pattern(q.solution?.reading)) || null;
  if (q.kind === "connective") return q.answer;
  if (q.kind === "link") return q.prompt;
  if (q.kind === "pair") return q.answer;
  if (q.kind === "exam" && q.target) return q.target[0] === "grammar" ? pattern(q.target[1]) || null : word(q.target[1], q.target[2]).replace(/[〜～]/g, "") || null;
  return null;
}
