// Which of the joyo kanji your own sentences have put in front of you.
//
// Nothing here is scheduled or tested. Coverage is derived from the library
// every time it is asked for, so a sentence you add or delete moves the wall
// immediately and there is no second copy of the truth to fall out of step.
import {stripFurigana} from "./core.js";
import {JOYO, GRADES} from "./kanji-data.js";
import {READINGS} from "./kanji-readings.js";

const JOYO_SET = new Set(JOYO);

export const isJoyo = character => JOYO_SET.has(character);

// Joyo only. A sentence may well carry kanji outside the list — 綺麗, a name —
// and those are not what the wall is counting.
export function kanjiIn(text = "") {
  const found = new Set();
  for (const character of String(text)) if (JOYO_SET.has(character)) found.add(character);
  return found;
}

// Every register, because 見る and 拝見 are different characters and you have
// met both. Falls back to stripping the notation when no plain form was stored.
export function sentenceKanji(sentence) {
  const plain = [sentence?.plainTarget, sentence?.plainCasualTarget, sentence?.plainPoliteTarget]
    .filter(Boolean).join("");
  return kanjiIn(plain || stripFurigana(sentence?.target || ""));
}

// kanji -> the ids of your sentences that contain it, oldest first.
export function coverage(sentences = []) {
  const map = new Map();
  const ordered = [...sentences].sort((a, b) =>
    String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
  for (const sentence of ordered) {
    if (!sentence?.id) continue;
    for (const character of sentenceKanji(sentence)) {
      const ids = map.get(character);
      if (ids) ids.push(sentence.id); else map.set(character, [sentence.id]);
    }
  }
  return map;
}

// The bands the wall is drawn in. `level` is the school grade, or null for
// everything taught later. The grade itself is the current one, from
// KANJIDIC2; the older list only supplies the teaching order within a grade.
// A kanji the 2017 revision moved — or added, as with the twenty prefecture
// kanji at grade 4 — joins its current grade at the end, in joyo order.
export function bands() {
  const placed = new Set();
  const out = GRADES.map((chars, index) => {
    const grade = index + 1, list = [];
    for (const c of chars) if ((READINGS[c]?.grade ?? grade) === grade) { list.push(c); placed.add(c); }
    return {key: "grade" + grade, level: grade, chars: list};
  });
  for (const c of JOYO) {
    if (placed.has(c)) continue;
    const grade = READINGS[c]?.grade;
    if (grade >= 1 && grade <= 6) { out[grade - 1].chars.push(c); placed.add(c); }
  }
  out.push({key: "secondary", level: null, chars: [...JOYO].filter(c => !placed.has(c))});
  return out;
}
// The JLPT bands, N5 first. The label is what the level is for, in the words
// the study tool uses; the counts are whatever the data carries.
export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const LEVEL_LABELS = {N5: "Getting around", N4: "Everyday reading", N3: "Newspapers, forms", N2: "Work and study", N1: "The long tail"};

// The same wall banded by JLPT level. Within a band the order is the one you
// would be taught in: school grade first, then how common the kanji is in
// print, then joyo order for the rest. That is the order Practise walks.
export function jlptBands() {
  const index = new Map([...JOYO].map((c, i) => [c, i]));
  const rank = c => { const r = READINGS[c] || {}; return [r.grade ?? 9, r.freq ?? Infinity, index.get(c)]; };
  const cmp = (a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  return LEVELS.map(level => ({key: level, level, label: LEVEL_LABELS[level],
    chars: [...JOYO].filter(c => (READINGS[c]?.jlpt || "N1") === level).sort(cmp)}));
}
export const levelOf = character => READINGS[character]?.jlpt || null;

// What is known about a character without any account at all.
export const facts = character => READINGS[character] || null;

// 𠮟 (U+20B9F) is joyo and sits outside the BMP, so String.length counts it
// twice and would have the app claim 2,137 kanji forever. Everything here
// counts by code point; nothing counts by .length.
const count = chars => {
  let n = 0;
  for (const _ of chars) n++;
  return n;
};

// Kanji carried by a sentence you have actually learned, as opposed to one
// sitting new in the library. Nothing new is scheduled for this: it reads the
// state the sentence scheduler already keeps, where 2 is Review.
export function learned(sentences = []) {
  const known = new Set();
  for (const sentence of sentences) {
    if ((sentence?.srs?.state ?? 0) !== 2) continue;
    for (const character of sentenceKanji(sentence)) known.add(character);
  }
  return known;
}

export function summarise(cover, chars = JOYO) {
  let met = 0;
  for (const character of chars) if (cover.has(character)) met++;
  return {met, total: count(chars)};
}

export const TOTAL = count(JOYO);

// Learn walks the wall in band order — grade 1 first, the secondary band
// last — and shows only what you have not met. `from` is where you stopped;
// with `inclusive` the character you stopped on is shown again if it is still
// unmet, so closing and reopening picks up where you were rather than one on.
export const ORDER = bands().flatMap(band => band.chars);
export function nextUnmet(cover, from = null, direction = 1, {inclusive = false, order = ORDER} = {}) {
  const at = from ? order.indexOf(from) : -1;
  if (direction > 0) {
    for (let i = at < 0 ? 0 : (inclusive ? at : at + 1); i < order.length; i++) if (!cover.has(order[i])) return order[i];
  } else {
    for (let i = at < 0 ? order.length - 1 : (inclusive ? at : at - 1); i >= 0; i--) if (!cover.has(order[i])) return order[i];
  }
  return null;
}
export const unmetCount = cover => TOTAL - cover.size;
