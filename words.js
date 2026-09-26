// Which of the dictionary's words your own sentences use, and how a word is
// found inside a sentence at all.
//
// Nothing here is scheduled or tested. Coverage is derived from the library
// every time it is asked for, like the kanji wall, so a sentence you add or
// delete moves the count at once and there is no second copy of the truth.
//
// There is no tokeniser in the app. A word is found by its written form, and
// a word that conjugates by its stem followed by a kana its conjugation can
// produce: 食べ then た, て, ま, な; 書 then い, か, き, く, け, こ. That reads
// 食べた as 食べる and 書いて as 書く, and leaves 食べ物 and 書店 alone. It is
// a rule, not a parser, so a one-kanji noun is only counted when it stands
// on its own — 日 in 日本 is not a sighting of 日 — and a short kana word
// can still be mistaken for a run of kana that happens to spell it.
import {stripFurigana} from "./core.js";
import {WORDS} from "./words-data.js";

export const LEVELS = ["N5", "N4", "N3", "N2", "N1", "+"];
export const LEVEL_LABELS = {N5: "Getting around", N4: "Everyday talk", N3: "Newspapers, forms", N2: "Work and study", N1: "The long tail", "+": "Common, on no list"};

const INDEX = new Map(WORDS.map(w => [w.id, w]));
export const word = id => INDEX.get(Number(id)) || null;
export const levelOf = w => w?.jlpt || "+";
export const TOTAL = WORDS.length;
export const ALL = WORDS;

// The bands, N5 first, then the common words on no list. The order within a
// band is the file's: the most common in print first. That is the order
// Practise walks.
let BANDS = null;
export function bands() {
  if (!BANDS) BANDS = LEVELS.map(level => ({key: "words-" + level, level, label: LEVEL_LABELS[level], words: WORDS.filter(w => levelOf(w) === level)}));
  return BANDS;
}

// What a word is, in the words a learner uses: JMdict's codes folded down to
// one or two labels.
const KIND = {v1: "verb", "v1-s": "verb", vk: "verb", vz: "verb", "vs-i": "verb", "vs-s": "verb", vt: "transitive", vi: "intransitive", vs: "する verb",
  "adj-i": "い-adjective", "adj-ix": "い-adjective", "adj-na": "な-adjective", "adj-no": "noun", n: "noun", "n-suf": "noun", "n-pref": "noun",
  adv: "adverb", "adv-to": "adverb", exp: "expression", int: "interjection", prt: "particle", conj: "conjunction", pn: "pronoun", num: "number",
  ctr: "counter", pref: "prefix", suf: "suffix", "aux-v": "auxiliary", aux: "auxiliary", "aux-adj": "auxiliary", cop: "copula", "adj-pn": "prenominal", "adj-f": "prenominal", "adj-t": "adjective"};
export function kindOf(w) {
  const kinds = [];
  for (const p of w?.pos || []) { const k = KIND[p] || (p.startsWith("v5") ? "verb" : null); if (k && !kinds.includes(k)) kinds.push(k); }
  if (kinds.includes("verb")) return kinds.includes("transitive") ? "transitive verb" : kinds.includes("intransitive") ? "intransitive verb" : "verb";
  return kinds.filter(k => k !== "transitive" && k !== "intransitive").slice(0, 2).join(" · ");
}

// What can follow a stem. A godan verb's last kana moves through its row
// (書か, 書き, 書く, 書け, 書こ) or drops to い or っ before た and て; an
// ichidan stem takes the endings straight; an い-adjective drops い for
// く, かった, ければ, さ, そう.
const NEXT = {
  v1: "るたてなまられよずにろさせち", "v1-s": "るたてなまられよずにろさせち", vk: "るたてなまいよれら",
  v5k: "かきくけこい", "v5k-s": "かきくけこっ", v5g: "がぎぐげごい", v5s: "さしすせそ", v5t: "たちつてとっ", v5n: "なにぬねのん",
  v5b: "ばびぶべぼん", v5m: "まみむめもん", v5r: "らりるれろっ", "v5r-i": "らりるれろっ", v5u: "わいうえおっ", "v5u-s": "わいうえおう", v5aru: "いらるれろっ",
  "adj-i": "いくかけさそ", "adj-ix": "いくかけさそ",
};
// Where a one-kana stem is trusted: after a kanji, or after て and で (an
// auxiliary: 食べている) or a particle (宿題をした, 犬がいた).
const AFTER_ONE = "てでをがはにもとへの";
const isKanji = c => /[㐀-䶿一-鿿豈-﫿]|[\u{20000}-\u{3134F}]/u.test(c || "");
const isKana = c => /[ぁ-ゖァ-ヺー]/.test(c || "");
const allKana = s => [...s].every(isKana);

// The forms a word is looked for under: the written form, and for a word
// usually written in kana, its kanji too when that is all kanji (沢山, not
// 今日は for こんにちは). Each becomes a key — a stem for a word that
// conjugates — with the rule for what may follow. An interjection (はい) is
// a whole utterance, so it needs a kana-free edge on both sides, or は + いい
// would read as はい.
function keysOf(w) {
  const out = [], pos = w.pos || [];
  const bound = pos.includes("int") && pos.length === 1;
  for (const form of [w.w, w.k && !allKana(w.k) && [...w.k].every(isKanji) ? w.k : null].filter(Boolean)) {
    const conj = pos.find(p => NEXT[p]);
    const suru = pos.some(p => p === "vs-i" || p === "vs-s") && form.endsWith("する") && form.length > 2;
    if (suru) { out.push({key: form.slice(0, -2), next: "すしせさ", kana: allKana(form)}); continue; }
    // する itself: し before ます, て, た, ない, よう, and the whole word.
    if (form === "する" && pos.some(p => p === "vs-i")) { out.push({key: "し", next: "まてたなよ", kana: true}, {key: form, next: null, kana: true}); continue; }
    if (conj && form.length >= 2) {
      out.push({key: form.slice(0, -1), next: NEXT[conj], kana: allKana(form)});
      // A two-kana word (いる, ある, いい) keeps its whole form too, since its
      // one-kana stem is only trusted after a kanji or て.
      if (form.length === 2 && allKana(form)) out.push({key: form, next: null, kana: true});
      continue;
    }
    out.push({key: form, next: null, kana: allKana(form), alone: form.length === 1 && isKanji(form), bound});
  }
  return out;
}
let FORMS = null, LONGEST = 1;
function index() {
  if (FORMS) return FORMS;
  FORMS = new Map();
  for (const w of WORDS) for (const k of keysOf(w)) {
    if (!k.key || k.key.length > 16) continue;
    LONGEST = Math.max(LONGEST, k.key.length);
    const hit = {...k, id: w.id}, list = FORMS.get(k.key);
    if (list) list.push(hit); else FORMS.set(k.key, [hit]);
  }
  return FORMS;
}

// The ids of the words a run of plain text uses. Every form that fits is a
// candidate; then the rules that stand in for a parser:
// - a stem of one kana (い for いる, し for する) only after a kanji, a
//   particle, or て and で, where an auxiliary sits: 食べている, 宿題をした,
//   not 会いたい;
// - a one-kanji word standing alone loses to a stem starting at the same
//   place: 行った is 行く, not 行 the row;
// - a kana word may not begin on a conjugation ending: 買わ is not わ;
// - two kana words that overlap resolve to the longer when they start
//   together (かわいい, not か) and to the earlier otherwise, so ですね is
//   です and ね, not すね — a single kana never blocks a later start.
export function wordsIn(text = "") {
  const s = String(text), forms = index(), hits = [];
  for (let i = 0; i < s.length; i++) {
    for (let len = 1; len <= LONGEST && i + len <= s.length; len++) {
      const list = forms.get(s.slice(i, i + len));
      if (!list) continue;
      const after = s[i + len] || "", before = s[i - 1] || "";
      for (const h of list) {
        if (h.next) {
          if (!after || !h.next.includes(after)) continue;
          if (len === 1 && h.kana && isKana(before) && !AFTER_ONE.includes(before)) continue;
          hits.push({id: h.id, start: i, end: i + len + 1, kana: h.kana, stem: true});
        } else {
          if (h.alone && (isKanji(before) || isKanji(after))) continue;
          if (h.bound && (isKana(before) || isKana(after))) continue;
          hits.push({id: h.id, start: i, end: i + len, kana: h.kana, alone: h.alone});
        }
      }
    }
  }
  const stemStarts = new Set(), endings = new Set();
  for (const h of hits) if (h.stem) { stemStarts.add(h.start); endings.add(h.end - 1); }
  const found = new Set(), kana = [];
  for (const h of hits) {
    if (h.alone && stemStarts.has(h.start)) continue;
    if (h.kana && endings.has(h.start)) continue;
    if (h.kana) kana.push(h); else found.add(h.id);
  }
  kana.sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen = [];
  for (const h of kana) {
    if (chosen.some(c => c.start === h.start || (c.end - c.start > 1 && c.start < h.start && h.start < c.end))) continue;
    chosen.push(h); found.add(h.id);
  }
  return found;
}
export const carries = (text, w) => !!w && wordsIn(text).has(w.id);

// Every register, because 見る and 拝見する are different words and you have
// met both. Each register is read on its own, so a stem at the end of one
// is never completed by the start of the next.
export function sentenceWords(sentence) {
  const texts = [sentence?.plainTarget, sentence?.plainCasualTarget, sentence?.plainPoliteTarget].filter(Boolean);
  if (!texts.length) texts.push(stripFurigana(sentence?.target || ""));
  const found = new Set();
  for (const text of texts) for (const id of wordsIn(text)) found.add(id);
  return found;
}

// word id -> the ids of your sentences that use it, oldest first.
export function coverage(sentences = []) {
  const map = new Map();
  const ordered = [...sentences].sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
  for (const sentence of ordered) {
    if (!sentence?.id) continue;
    for (const id of sentenceWords(sentence)) {
      const ids = map.get(id);
      if (ids) ids.push(sentence.id); else map.set(id, [sentence.id]);
    }
  }
  return map;
}

// Words on a sentence you have actually learned — one at Review — as
// against merely used. The same proxy the kanji wall uses.
export function learned(sentences = []) {
  const known = new Set();
  for (const sentence of sentences) {
    if ((sentence?.srs?.state ?? 0) !== 2) continue;
    for (const id of sentenceWords(sentence)) known.add(id);
  }
  return known;
}

export function summarise(cover, words = WORDS) {
  let met = 0;
  for (const w of words) if (cover.has(w.id)) met++;
  return {met, total: words.length};
}

// The forms to mark inside a sentence: the whole word first, then its stem,
// so 食べた shows 食べ marked and 書いて shows 書.
export function marks(w) {
  return [...new Set(keysOf(w).flatMap(k => [k.key]).concat([w.w, w.k].filter(Boolean)))].sort((a, b) => b.length - a.length);
}
