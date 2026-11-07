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
import {createJapaneseWordMatcher} from "./japanese-words.js";
import {WORDS} from "./words-data.js";

export const LEVELS = ["N5", "N4", "N3", "N2", "N1", "+"];
export const LEVEL_LABELS = {N5: "Getting around", N4: "Everyday talk", N3: "Newspapers, forms", N2: "Work and study", N1: "The long tail", "+": "Common, on no list"};

const INDEX = new Map(WORDS.map(w => [w.id, w]));
export const word = id => INDEX.get(Number(id)) || LOOKUP_INDEX.get(Number(id)) || null;
export const levelOf = w => w?.jlpt || "+";
export let TOTAL = WORDS.length;
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
let main=createJapaneseWordMatcher(WORDS);

// The uncommon words of JMdict, looked up a piece at a time when a sentence
// needs them (dictionary.js). They have their own matcher: they mark and
// open like any word, but never join the Words wall, its bands or its totals.
const LOOKUP=[],LOOKUP_INDEX=new Map();
let lookup=createJapaneseWordMatcher(LOOKUP);
// Adds looked-up words; returns how many were new. A common word always wins
// its id: a looked-up word never shadows one already in WORDS.
export function addLookupWords(list=[]){let added=0;
 for(const w of list)if(Number.isInteger(w?.id)&&w.w&&Array.isArray(w.en)&&!INDEX.has(w.id)&&!LOOKUP_INDEX.has(w.id)){LOOKUP.push(w);LOOKUP_INDEX.set(w.id,w);added++}
 if(added)lookup=createJapaneseWordMatcher(LOOKUP);return added}
export const isLookupWord=w=>!!w&&LOOKUP_INDEX.has(Number(w.id));
export function wordsIn(text){const found=main.wordsIn(text);if(LOOKUP.length)for(const id of lookup.wordsIn(text))found.add(id);return found}
// A looked-up word marks where no common word does, or where it spans a
// longer stretch than the common words it covers (朝会 over 朝 and 会).
export function wordSpans(text="",ids=null){const spans=main.wordSpans(text,ids);if(!LOOKUP.length)return spans;
 for(const extra of lookup.wordSpans(text,ids)){const overlap=spans.filter(s=>s.start<extra.end&&extra.start<s.end);
  if(!overlap.length)spans.push(extra);
  else if(overlap.every(s=>extra.start<=s.start&&s.end<=extra.end&&extra.end-extra.start>s.end-s.start)){for(const s of overlap)spans.splice(spans.indexOf(s),1);spans.push(extra)}}
 return spans.sort((a,b)=>a.start-b.start||b.end-a.end)}
const keysOf=w=>(LOOKUP_INDEX.has(Number(w?.id))?lookup:main).keysOf(w);
export const carries = (text,w) => !!w && wordsIn(text).has(w.id);

// Every register, because 見る and 拝見する are different words and you have
// met both. Each register is read on its own, so a stem at the end of one
// is never completed by the start of the next.
export function sentenceWords(sentence) {
  const texts = [sentence?.plainTarget, sentence?.plainCasualTarget, sentence?.plainPoliteTarget].filter(Boolean);
  if (!texts.length) texts.push(stripFurigana(sentence?.target || ""));
  const found = new Set((sentence?.vocabulary||[]).filter(id=>word(id)));
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

const BASE_WORDS=[...WORDS];
export function setImportedWords(imported=[]){
 WORDS.splice(0,WORDS.length,...BASE_WORDS,...imported.filter(w=>Number.isInteger(w.id)&&w.id<0&&w.w&&Array.isArray(w.en)));
 INDEX.clear();for(const w of WORDS)INDEX.set(w.id,w);TOTAL=WORDS.length;BANDS=null;
 main=createJapaneseWordMatcher(WORDS);
}
