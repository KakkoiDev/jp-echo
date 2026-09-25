// Which of the joyo kanji your own sentences have put in front of you.
//
// Nothing here is scheduled or tested. Coverage is derived from the library
// every time it is asked for, so a sentence you add or delete moves the wall
// immediately and there is no second copy of the truth to fall out of step.
import {stripFurigana} from "./core.js";
import {JOYO, GRADES} from "./kanji-data.js";

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
// everything taught later — which, until we can source the 2017 revision's
// per-grade assignment, also holds the twenty prefecture kanji it promoted.
export function bands() {
  const graded = new Set(GRADES.join(""));
  return [
    ...GRADES.map((chars, index) => ({key: "grade" + (index + 1), level: index + 1, chars: [...chars]})),
    {key: "secondary", level: null, chars: [...JOYO].filter(character => !graded.has(character))},
  ];
}

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
