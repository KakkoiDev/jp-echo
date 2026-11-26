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
import {connectiveSites, jobOf, glossOf, JOBS, OVERLAP, CHOICE_FOR_JOB} from "./n2-connectives.js";
import {ACCEPTED_READINGS, READING_KEY, EXCLUDED, GLOSS_FIX, GRAMMAR_SPANS, REVIEWED_LEVELS, REVIEWED_GRAMMAR_BLOCKS} from "./n2-game-review.js";
import {exampleSegments} from "./n2-delayed.js";
import {LEVELS} from "./jlpt-levels.js";

const keyOf = target => JSON.stringify(target);
export const GAME_KEY = "echo-n2-game";
export const GAME_SOURCE = "game";
// Rounds are short so a few spare seconds are enough; every answer is saved
// as it is given, so closing the page mid-round loses nothing.
// Blitz chess, not shogi (owner, 26 Nov): seconds, not minutes, per question.
export const ROUND_SIZE = 10, REVIEW_SECONDS = 5, DAILY_GOAL = 1000, RECENT_MS = 4 * 3600_000;
export const SECONDS = Object.freeze({reading: 3, meaning: 3, definition: 4, listen: 5, homophone: 5, grammar: 6, connective: 7, exam: {1: 4, 2: 5, 3: 5, 4: 7, 5: 6, 7: 8}});
// The pause after an answer before the next question, in milliseconds.
export const PAUSE = Object.freeze({right: 250, miss: 800});
export const KIND_LABEL = Object.freeze({reading: "Reading", meaning: "Meaning", definition: "Which word", listen: "Listen", connective: "Connective · 問題9", homophone: "Which kanji", grammar: "Grammar", block: "Grammar block", build: "Build grammar", infer: "Infer grammar", exam: "Exam question"});
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
export function gamePool({inventory, examples = new Map(), sets = [], sat = new Set(), level = "N2", parts = null, grammarBlocks = null}) {
  const other = level !== "N2", tag = other ? level + ":" : "";
  const split = new Map(inventory.words.map(([w, r, , p]) => [w + "/" + r, p || parts?.[w + "/" + r] || ""]));
  const kanjiOf = w => { const ks = (w.text.match(KANJI) || []).filter(k => k !== "々"), bases = (split.get(w.target[1] + "/" + w.target[2]) || "").split("|");
    return [...new Set(ks.map((k, i) => bases.length === (w.text.match(KANJI) || []).length && bases[i] ? k + bases[i] : k))]; };
  const items = recallItems(inventory), pool = [];
  // Affixes such as ～発 are left out: they are not words to pick or read alone.
  // READING_KEY and GLOSS_FIX correct the N2 list; they are not applied elsewhere.
  const words = items.meaning.map(it => { const text = it.target[1], reading = (!other && READING_KEY[text]) || it.reading || it.target[2];
    return {target: it.target, text, reading, answer: (!other && (GLOSS_FIX[text + "/" + reading] || GLOSS_FIX[text])) || it.answer}; }).filter(w => !/[〜～]/.test(w.text));
  // Stable ids: a word written the same way twice (紅葉 こうよう / もみじ) carries its reading.
  const spellings = new Map(); for (const w of words) spellings.set(w.text, (spellings.get(w.text) || 0) + 1);
  const idOf = w => tag + (spellings.get(w.text) > 1 ? w.text + "/" + w.reading : w.text);
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
      const accepted = new Set([w.reading, ...(ACCEPTED_READINGS[w.text] || [])]);
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
    const fair = o => o !== w && o.text !== w.text && !sameSense(gloss(o.answer), own);
    const near = [...new Set((kanji || []).flatMap(k => byKanji.get(k) || []))].filter(fair);
    const far = [7, 11, 17, 23, 29, 31].map((m, k) => words[(i * m + [13, 101, 307, 503, 709, 911][k]) % words.length]).filter(fair);
    const wrongMeanings = distinct(own, [...new Set([...near, ...far].map(o => gloss(o.answer)))]);
    // A word spelled like another (紅葉 こうよう / もみじ) shows its sentence: the cue to its sense.
    const cue = spellings.get(w.text) > 1 && ex && plain(ex.ja).includes(w.text) ? plain(ex.ja) : "";
    if (own && wrongMeanings.length >= 3) pool.push({id: "m:" + id, kind: "meaning", target: w.target, dimension: "meaning", prompt: w.text,
      sentence: cue, needle: w.text, answer: own, wrong: wrongMeanings, near: wrongMeanings.filter(m => near.some(o => gloss(o.answer) === m)), seconds: SECONDS.meaning,
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
  for (const [i, g] of grammar.entries()) {
    const ex = sentenceOf(g.target);
    if (!ex) continue;
    const wrong = distinct(GLOSS_FIX["g:" + g.target[1]] || g.answer, [1, 2, 3, 5, 8, 13, 21, 34].map(d => grammar[(i + d * 17) % grammar.length]).filter(o => o !== g).map(o => o.answer));
    const gAnswer = GLOSS_FIX["g:" + g.target[1]] || g.answer;
    pool.push({id: "g:" + g.target[1], kind: "grammar", target: g.target, dimension: "grammar", prompt: g.prompt,
      sentence: plain(ex.ja), needle: GRAMMAR_SPANS["g:" + g.target[1]] || piecesNeedle(plain(ex.ja), g.prompt) || surfaceNeedle(plain(ex.ja), g.prompt) || g.prompt.replace(/[〜～]/g, ""), answer: gAnswer, wrong: [...new Set(wrong)], seconds: SECONDS.grammar,
      solution: {word: g.prompt, meaning: gAnswer, ja: ex.ja, en: ex.en || ""}});
  }
  if (!other && grammarBlocks) addGrammarBlocks(pool, grammarBlocks);
  // Connectives (問題9): from reading passages of sets already sat. The
  // excerpt is up to two sentences before the blank and the blank's sentence.
  // Practice only, not scored, until the excerpts are reviewed (audit P2).
  if (other) sets = [];
  for (const set of sets) {
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
  // The bar for every item: not excluded, and four distinct choices.
  // The kanji a word card exercises; grammar, connective and exam cards have none.
  const byTarget = new Map(words.map(w => [w.target, kanjiOf(w)]));
  for (const q of pool) { const ks = byTarget.get(q.target); if (ks?.length) q.kanji = ks; }
  const fit = pool.filter(q => !EXCLUDED[q.id] && (q.fixed ? new Set(q.fixed).size === 4 : new Set(q.wrong.filter(w => w !== q.answer)).size >= 3));
  if (!other) return fit;
  // item: what a round counts as one thing, where N2 cards use their target.
  return fit.map(q => ({...q, level, item: level + ":" + q.target[1] + "/" + q.target[2], target: null, ...(REVIEWED_LEVELS.has(level) ? {} : {practice: true, record: true})}));
}
function addGrammarBlocks(pool, {blocks = {}, patterns = {}}) {
  const entries = Object.entries(blocks);
  const practice = REVIEWED_GRAMMAR_BLOCKS ? {} : {practice: true, record: true};
  const fair = (answer, options) => [...new Set(options)].filter(o => o && !sameSense(answer, o));
  const base = {target: null, dimension: null, seconds: SECONDS.grammar, ...practice};

  const grammar = pool.filter(q => q.kind === "grammar" && !EXCLUDED[q.id]);
  const keysOf = parts => [...new Set(parts.flatMap(p => Object.hasOwn(blocks, p.block) ? [p.block] : []))];
  const byKey = new Map(grammar.map(q => [q.id.slice(2), keysOf(patterns[q.id.slice(2)]?.parts || [])]));

  for (const [id, block] of entries) {
    const sentence = plain(block.ja);
    const needle = [...block.forms].sort((a, b) => b.length - a.length).find(form => sentence.includes(form));
    if (!needle) continue;
    const wrong = fair(block.gloss, entries.filter(([other, b]) => id !== other && b.type === block.type && !b.forms.some(form => block.forms.includes(form))).map(([, b]) => b.gloss));
    pool.push({...base, id: "b:" + id, kind: "block", item: "block:" + id, blockLevel: block.level, blocks: [id],
      prompt: block.form, sentence, needle, answer: block.gloss, wrong,
      solution: {word: block.form, meaning: block.gloss, ja: block.ja, en: block.en}});
  }

  for (const q of grammar) {
    const key = q.id.slice(2), pattern = patterns[key], ids = byKey.get(key);
    if (!ids.length) continue;
    q.blocks = ids;
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
    const others = grammar.filter(other => other !== q);
    const wrong = fair(q.answer, others.map(other => other.answer));
    const near = fair(q.answer, others.filter(other => byKey.get(other.id.slice(2)).some(id => ids.includes(id))).map(other => other.answer));
    const card = {...base, item: keyOf(q.target), patternKey: key, blocks: ids, prompt: q.prompt,
      sentence: q.sentence, needle, answer: q.answer, wrong, near, solution: pattern.transparency === "opaque"
        ? {...q.solution, why: "Learn this pattern as a whole."} : q.solution};
    pool.push({...card, id: "gb:" + key, kind: "build",
      parts: pattern.parts.map((p, i) => ({text: surface?.[i + 1] || p.text, gloss: blocks[p.block]?.gloss || ""}))});
    if (["clear", "partial"].includes(pattern.transparency) && pattern.solved?.right) {
      pool.push({...card, id: "gi:" + key, kind: "infer"});
    }
  }
}

// The level a card belongs to: cards without one are N2's.
export const levelOfCard = q => q?.level || "N2";

function connectiveQuestion(source, text, site) {
  const job = jobOf(site.word);
  if (!job) return [];
  const before = text.slice(0, site.at).replace(/\n/g, ""), after = text.slice(site.at + site.word.length);
  const prev = (before.match(/(?:[^。」]*[。」]){1,2}\s*$/) || [""])[0].trim();
  const rest = (after.match(/^、[^。\n]*[。」]?/) || [""])[0];
  if (!prev || rest.length < 6) return [];
  const blocked = new Set(OVERLAP[job] || [job]);
  const wrong = Object.entries(CHOICE_FOR_JOB).filter(([j]) => !blocked.has(j)).map(([, w]) => w);
  return [{id: "c:" + source + "@" + site.at, kind: "connective", practice: true, target: null, dimension: null, prompt: "（　）に入るのは？",
    sentence: prev + "（　）" + rest, needle: "（　）", answer: site.word, wrong, seconds: SECONDS.connective,
    solution: {word: site.word, meaning: glossOf(site.word) + " · " + JOBS[job], ja: prev + site.word + rest, source, job}}];
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
export function pickRound({pool, recall = [], seen = {}, wins = {}, lv = {}, size = ROUND_SIZE, random = Math.random, mix = {weak: 4, fresh: 4, known: 2}, comeback = [], now = Date.now(), calm = false}) {

  const last = new Map();
  for (const r of recall) last.set(r.dimension + keyOf(r.target), r.last);
  const state = q => { const g = q.target && last.get(q.dimension + keyOf(q.target)); return g && g !== "instant" ? "weak" : g === "instant" || wins[q.id] ? "known" : "fresh"; };
  // Seen in the last four hours: only if nothing else is left (a small kind
  // such as the homophones would otherwise come round several times a day).
  const groups = {weak: [], fresh: [], known: []}, recent = [];
  // A mastered item (極) rests three days between visits: it comes up less.
  const resting = q => now - (seen[q.id] || 0) < ((lv[q.id] || 0) >= ITEM_LEVEL.max ? ITEM_LEVEL.restMs : RECENT_MS);
  for (const q of shuffle(pool, random)) { const s = state(q); (calm && s === "known" ? groups.known : resting(q) ? recent : groups[s]).push(q); }
  // Least recently seen first, then the kinds taken in turn, so grammar,
  // readings and exam questions are not drowned by the many word questions.
  for (const [name, g] of Object.entries(groups)) groups[name] = byKindInTurn(g.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0)), random);
  const out = [], used = new Set(), targets = new Set();
  const take = (list, n) => { for (const q of list) { if (n <= 0) break; const t = cardItem(q); if (used.has(q.id) || targets.has(t)) continue; used.add(q.id); targets.add(t); out.push(q); n--; } };
  const byId = new Map(pool.map(q => [q.id, q]));
  const back = shuffle(comeback.map(id => byId.get(id)).filter(Boolean), random).slice(0, size);
  take(back, back.length);
  const backCount = out.length;
  take(groups.weak, mix.weak); take(groups.fresh, mix.fresh); take(groups.known, mix.known);
  const seenFirst = recent.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0));
  take(calm ? [...groups.known, ...seenFirst, ...groups.weak, ...groups.fresh] : [...groups.fresh, ...groups.weak, ...groups.known, ...seenFirst], size - out.length);
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
export const recallsMiss = (q, outcome) => outcome !== "right" && !!q.target;

// The device's game memory: best score, rounds, when each question was last
// seen. Kept small: the most recent 20 000 questions.
// ---- Item strength (board 9) ----
// Every question carries a level from 0 to 5. A fast right answer (under half
// the clock) adds one, at most once every four hours, so a level means spaced
// wins; a miss, a timeout or "I don't know" takes one away; a slow right
// answer leaves it. Level 5 is 極, mastered: it rests for three days between
// visits. Felt on the card, never browsed.
export const ITEM_LEVEL = Object.freeze({max: 5, gapMs: 4 * 3600_000, restMs: 3 * 86400_000});
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
  const level = q.practice ? state.level : flowStep(state.level, outcome === "right", difficulty);
  const runStart = state.runStart || new Date(now).toISOString(); // the run clock starts on its first answer
  const total = (state.total || 0) + points, day = localDay(new Date(now));
  const days = {...(state.days || {})}, d = days[day] || {answered: 0, right: 0, points: 0, rounds: 0, best: 0};
  days[day] = {...d, answered: d.answered + 1, right: d.right + (outcome === "right" ? 1 : 0), points: d.points + points};
  return {...state, seen, tried, missed, kj, ...(gb ? {gb} : {}), wins, lv, lvAt, ...(level === undefined ? {} : {level}), ...(q.practice ? {practiced: (state.practiced || 0) + 1} : {}), runStart, comeback: comeback.slice(-ROUND_SIZE), total, answered: (state.answered || 0) + 1, days};
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
export function nextRound({pool, review = [], kanji = null, grammarCards = null, recall = [], state = {}, difficulty = "normal", random = Math.random, now = Date.now()}) {
  const slump = inSlump(state), beat = pace(state, now);
  const level = Math.min(1, Math.max(0, levelOf(state) + beat.offset + (DIFFICULTY[difficulty] || DIFFICULTY.normal).offset));
  const share = review.length && pool.length ? REVIEW_SHARE : 0, memory = {recall, seen: state.seen || {}, wins: state.wins || {}, lv: state.lv || {}, random, now};
  const comeback = slump ? (state.comeback || []).slice(-WARM_UP.comeback) : state.comeback || [];
  let picked;
  // After a hard round the recovery round comes first, at every rank: kanji-first picking waits a round.
  if (kanji?.order && !slump) {
    const byId = new Map(pool.map(q => [q.id, q])), places = ROUND_SIZE - share;
    const back = shuffle(comeback.map(id => byId.get(id)).filter(Boolean), random).slice(0, places).map(q => ({...q, comeback: true}));
    picked = [...back, ...kanjiPick({pool, examples: kanji.examples || [], order: kanji.order, state, size: places - back.length, skip: back, random, now})];
    // Kanji with nothing left to ask: the places left are picked by card, so a round is always full.
    if (picked.length < places) { const words = new Set(picked.map(q => q.item)); picked.push(...pickRound({...memory, pool: pool.filter(q => !words.has(q.item)), size: places - picked.length, mix: flowMix(level)})); }
  } else picked = pickRound({...memory, pool, size: ROUND_SIZE - share, comeback, mix: slump ? WARM_UP.mix : flowMix(level), calm: slump});

  if (grammarCards && !slump) {
    const slots = picked.filter(q => q.kind === "grammar" && !q.comeback);
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
export function kanjiPick({pool = [], examples = [], order = "", state = {}, size = ROUND_SIZE, skip = [], random = Math.random, now = Date.now()}) {
  const states = kanjiStates(state), seen = state.seen || {}, cards = new Map();
  for (const q of [...pool, ...examples]) for (const key of q.kanji || []) { const k = [...key][0]; if (!cards.has(k)) cards.set(k, []); cards.get(k).push(q); }
  const wordOf = q => q.item || (q.target ? keyOf(q.target) : q.id), used = new Set(skip.map(wordOf)), out = [];
  const recent = q => now - (seen[q.id] || 0) < RECENT_MS, metAll = (q, k) => q.kanji.every(key => [...key][0] === k || states.get([...key][0])?.met);
  // The first card that fits, by the tests in turn; a reading card unless `kinds` says otherwise.
  const choose = (k, tests, kinds = ["reading"]) => {
    const list = (cards.get(k) || []).filter(q => kinds.includes(q.kind) && !used.has(wordOf(q)));
    for (const test of tests) { const hit = list.find(q => !recent(q) && test(q)) ; if (hit) return hit; }
    return list.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0))[0] || null;
  };
  const place = (k, group) => {
    const unseen = q => newWord(state, q);
    const q = group === "fresh" ? choose(k, [q => metAll(q, k), () => true], [["reading"], ["meaning"], ["reading"], ["listen", "meaning"]][out.length % 4]) || choose(k, [() => true], ["reading", "meaning", "definition", "listen"])
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

// ---- Grammar blocks ----
export const GRAMMAR_BLOCK_KNOWN = Object.freeze({transfer: 1, right: 3});
const blockKnown = ([, right = 0, , transfer = 0] = []) => transfer >= GRAMMAR_BLOCK_KNOWN.transfer || right >= GRAMMAR_BLOCK_KNOWN.right;
const patternPrefixes = ["g:", "gb:", "gi:"];
const newPattern = (state, key) => key && patternPrefixes.every(prefix => !Object.hasOwn(state.seen || {}, prefix + key));
const allMet = (state, q, except) => q.blocks.every(id => id === except || state.gb?.[id]?.[0]);
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
  const ids = new Set(cards.flatMap(q => q.blocks || []));
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
  const ids = [...byBlock.keys()];
  const record = id => state.gb?.[id] || [];
  const order = (a, b) => (record(a)[4] || 0) - (record(b)[4] || 0);
  const groups = {
    weak: ids.filter(id => record(id)[5]).sort(order),
    fresh: ids.filter(id => !record(id)[0]).sort((a, b) => {
      const level = id => byBlock.get(id).find(q => q.kind === "block")?.blockLevel || "N2";
      return LEVELS.indexOf(level(a)) - LEVELS.indexOf(level(b)) || (usage.get(b) || 0) - (usage.get(a) || 0);
    }),
    prove: ids.filter(id => record(id)[0] && !blockKnown(record(id))).sort(order),
  };
  const last = q => state.seen?.[q.id] || 0;
  const byId = new Map(pool.map(q => [q.id, q]));
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
    const blockFirst = (a, b) => Number(a.kind !== "block") - Number(b.kind !== "block") || leastRecent(a, b);
    const back = returning.find(available);
    const chosen = back ? {q: {...back, comeback: true}, id: back.blocks[0]} : find("weak", q => weak(q) && (!last(q) || now - last(q) >= RECENT_MS), weakOrder)
      || find("prove", prove, leastRecent)
      || find("fresh", fresh, blockFirst)
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
export const rankOf = (state = {}) => RANKS.includes(state?.rank) ? state.rank : DEFAULT_RANK;
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
export function applyBoss(state = {}, {key, rank = rankOf(state), total, sectionsOk = true, now = Date.now()}) {
  const log = state.bossLog || [];
  const verdict = bossVerdict({rank, total, sectionsOk});
  if (!key || !verdict || log.some(e => e.key === key)) return state;
  const entry = {key, at: new Date(now).toISOString(), rank, total, verdict};
  let next = state;
  if (rank === rankOf(state)) {
    let fails = verdict === "fail" ? 1 : 0;
    if (verdict === "fail") for (const e of [...log].reverse()) { if (e.rank !== rank || e.verdict !== "fail") break; fails++; }
    const to = verdict === "up" || verdict === "skip" ? aheadLevel(rank) : fails >= RANK_RULES.fails ? RANKS[RANKS.indexOf(rank) - 1] || null : null;
    if (to && hasBoss(to)) { next = {...setRank(state, to, now), ...(verdict === "skip" ? {bossReady: true} : {})}; entry.to = to; }
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
// Rest is decided by when the boss was finished (today), matched to the exact
// sitting when the run knows it, so a boss finished after midnight still rests.
export function resting(state = {}, attempts = [], now = new Date()) {
  const t = state.bossTaken, run = (state.runs || []).at(-1);
  if (!t?.at) return false;
  const done = attempts.find(a => a.phase === "results" && a.completedAt && (run?.attemptId ? a.id === run.attemptId : a.book === t.set && a.completedAt >= t.at));
  return !!done && localDay(new Date(done.completedAt)) === localDay(now);
}

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
  if (q.kind === "grammar" || grammarBlockCard(q)) return pattern(q.solution?.word || q.prompt) || null;
  if (q.kind === "connective") return q.answer;
  if (q.kind === "exam" && q.target) return q.target[0] === "grammar" ? pattern(q.target[1]) || null : word(q.target[1], q.target[2]).replace(/[〜～]/g, "") || null;
  return null;
}
