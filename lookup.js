// Looking a kanji, a word or a grammar point up, on the device, from what the data
// files already carry: a character, a reading in kana or romaji, or a word
// of the English meaning. No index, no network. Everything here is a filter
// over the 2,136 readings, the 22,953 words and the 979 points, in the order the wall draws.
import {READINGS} from "./kanji-readings.js";
import {GRAMMAR} from "./grammar-data.js";
import {WORDS} from "./words-data.js";
import {isJoyo, jlptBands} from "./kanji.js";

const WALL = jlptBands().flatMap(band => band.chars);
const isCJK = c => /[㐀-䶿一-鿿豈-﫿]|[\u{20000}-\u{3134F}]/u.test(c);
const isKana = c => /[ぁ-ゖァ-ヺーー]/.test(c);

// Katakana to hiragana, so ガク and がく are the same reading.
export const toHiragana = text => String(text).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// KANJIDIC marks okurigana with a dot (まな.ぶ) and a prefix or suffix with a
// dash (-がた). Neither is something a person types.
const plainReading = r => toHiragana(r).replace(/[.\-]/g, "");
const stemReading = r => toHiragana(r).split(".")[0].replace(/-/g, "");

// Enough Hepburn to type a reading: the syllable table, small tsu for a
// doubled consonant, and ん before a consonant or at the end. Anything the
// table cannot place means the text was not romaji.
const ROMAJI = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ",
  ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と", na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ", ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ", ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご", za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ", sha: "しゃ", sya: "しゃ", shu: "しゅ", syu: "しゅ", sho: "しょ", syo: "しょ",
  cha: "ちゃ", tya: "ちゃ", chu: "ちゅ", tyu: "ちゅ", cho: "ちょ", tyo: "ちょ", nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ", mya: "みゃ", myu: "みゅ", myo: "みょ", rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ", ja: "じゃ", jya: "じゃ", ju: "じゅ", jyu: "じゅ", jo: "じょ", jyo: "じょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ", pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
};
export function romajiToKana(text) {
  const s = String(text).toLowerCase().replace(/[\s'’]/g, "");
  if (!s || !/^[a-z-]+$/.test(s)) return null;
  let out = "", i = 0;
  while (i < s.length) {
    if (s[i] === "-") { out += "ー"; i++; continue; }
    if (s[i] === "n" && (i + 1 === s.length || !/[aiueoyn]/.test(s[i + 1]))) { out += "ん"; i++; continue; }
    if (s[i] === "n" && s[i + 1] === "n") { out += "ん"; i += 2; continue; }
    if (s[i] === s[i + 1] && /[kstcpgzdbhfmryw]/.test(s[i])) { out += "っ"; i++; continue; }
    let hit = null;
    for (const len of [3, 2, 1]) { const piece = s.slice(i, i + len); if (ROMAJI[piece]) { hit = piece; break; } }
    if (!hit) return null;
    out += ROMAJI[hit]; i += hit.length;
  }
  return out;
}

// Which characters of the wall answer a query, and how. `how` is "are" for
// characters typed or pasted, "read" for a reading, "mean" for English; the
// order is the wall's own. A character that is not joyo comes back apart,
// so the screen can say so instead of showing nothing.
export function searchKanji(raw) {
  const q = String(raw || "").trim();
  if (!q) return null;
  const typed = [...new Set([...q].filter(isCJK))];
  if (typed.length) return {how: "are", key: typed.join(""), chars: WALL.filter(c => typed.includes(c)), notJoyo: typed.filter(c => !isJoyo(c))};
  const kana = [...q].every(isKana) ? toHiragana(q) : romajiToKana(q);
  if (kana) {
    const chars = WALL.filter(c => { const r = READINGS[c]; return r.on.some(x => plainReading(x) === kana) || r.kun.some(x => plainReading(x) === kana || stemReading(x) === kana); });
    if (chars.length || [...q].every(isKana)) return {how: "read", key: kana, chars, notJoyo: []};
  }
  const word = q.toLowerCase();
  const chars = WALL.filter(c => READINGS[c].en.some(m => m.toLowerCase().includes(word)));
  return {how: "mean", key: q, chars, notJoyo: []};
}

// Grammar by name or gloss. Kana matches the title; a word matches the gloss;
// romaji is tried as kana first. Order is the list's own: level, then lesson.
export function searchGrammar(raw) {
  const q = String(raw || "").trim();
  if (!q) return null;
  const kana = [...q].every(isKana) ? toHiragana(q) : null, romaji = kana ? null : romajiToKana(q), word = q.toLowerCase();
  const byTitle = key => GRAMMAR.filter(p => toHiragana(p.title).includes(key));
  if (kana) return {how: "named", key: kana, points: byTitle(kana)};
  let points = romaji ? byTitle(romaji) : [];
  if (points.length) return {how: "named", key: romaji, points};
  points = GRAMMAR.filter(p => p.title.toLowerCase().includes(word) || (p.hint || "").toLowerCase().includes(word));
  return {how: "mean", key: q, points};
}

// A word, by what you would type for it: the reading in kana or romaji, the
// word itself or a kanji in it, or the English. A reading matches whole
// first, then at the start, then anywhere; English matches a gloss whole
// first ("eat", "to eat"), then at its start, then as a word inside it. The
// order within a tier is the dictionary's own: level, then how common.
const WORD_LIMIT = 60;
const READ = WORDS.map(w => toHiragana(w.r));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function searchWords(raw) {
  const q = String(raw || "").trim();
  if (!q) return null;
  const tiers = [[], [], []], take = () => { const words = tiers.flat(); return {words: words.slice(0, WORD_LIMIT), total: words.length}; };
  if ([...q].some(isCJK)) {
    for (const w of WORDS) { if (w.w === q || w.k === q) tiers[0].push(w); else if (w.w.startsWith(q) || (w.k && w.k.startsWith(q))) tiers[1].push(w); else if (w.w.includes(q) || (w.k && w.k.includes(q))) tiers[2].push(w); }
    return {how: "are", key: q, ...take()};
  }
  const kana = [...q].every(isKana) ? toHiragana(q) : romajiToKana(q);
  if (kana) {
    for (let i = 0; i < WORDS.length; i++) { const r = READ[i], w = WORDS[i]; if (r === kana || w.w === kana) tiers[0].push(w); else if (r.startsWith(kana)) tiers[1].push(w); else if (r.includes(kana)) tiers[2].push(w); }
    if (tiers[0].length || tiers[1].length || tiers[2].length || [...q].every(isKana)) return {how: "read", key: kana, ...take()};
  }
  const word = q.toLowerCase(), inside = new RegExp("\\b" + escapeRe(word) + "\\b");
  for (const w of WORDS) {
    let best = 0;
    for (const sense of w.en) for (const gloss of sense.split("; ")) {
      const g = gloss.toLowerCase();
      if (g === word || g === "to " + word) { best = 3; break; }
      if (g.startsWith(word + " ") || g.startsWith("to " + word + " ")) best = Math.max(best, 2);
      else if (best < 1 && inside.test(g)) best = 1;
    }
    if (best) tiers[3 - best].push(w);
  }
  return {how: "mean", key: q, ...take()};
}
