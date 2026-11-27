// Checks a content file written for Quick round's new card kinds:
//   node tools/content/check.mjs paraphrase|pairs|ordering|examen <file.json>
// Passing means well-formed. Whether each item has one right answer is the blind solve's job.
import {readFileSync} from "node:fs";
import {CONNECTIVES} from "../../n2-connectives.js";
const [kind, file] = process.argv.slice(2);
const data = JSON.parse(readFileSync(file, "utf8"));
const plain = s => String(s || "").replace(/【[^】]*】/g, "");
const JP = /[ぁ-んァ-ヶ一-龯]/, KANJI = /[一-龯々]/;
// Every kanji run carries its reading: nothing but kana, digits and punctuation is left once the pairs are removed.
const readings = s => !KANJI.test(String(s).replace(/[一-龯々〆ヶ]+【[ぁ-ゖー]+】/g, ""));
const en = (s, max) => typeof s === "string" && s.length >= 6 && s.length <= max && !JP.test(s);
const errors = [];
const bad = (id, why) => errors.push(id + ": " + why);
const seen = new Set();
export const LIMITS = Object.freeze({paraphrase: {ja: [14, 46], choice: 34, en: 110}, pairs: {total: 48, en: 110}, ordering: {total: 44, tile: [1, 9], en: 110}});
if (kind === "paraphrase") for (const x of data) {
  const id = x.id || "?", L = LIMITS.paraphrase, n = plain(x.ja).length;
  if (!/^pp-\d{3}$/.test(id) || seen.has(id)) bad(id, "id pp-NNN, unique"); seen.add(id);
  if (n < L.ja[0] || n > L.ja[1]) bad(id, "sentence of " + L.ja.join("–") + " characters, has " + n);
  if (!readings(x.ja)) bad(id, "a kanji in the sentence has no reading");
  if (!Array.isArray(x.choices) || x.choices.length !== 4 || new Set(x.choices.map(plain)).size !== 4) bad(id, "four different choices");
  else for (const c of x.choices) { if (plain(c).length > L.choice || plain(c).length < 6) bad(id, "choice of 6–" + L.choice + " characters: " + plain(c)); if (!readings(c)) bad(id, "a kanji in a choice has no reading"); }
  if (![1, 2, 3, 4].includes(x.key)) bad(id, "key 1–4");
  if (!en(x.en, L.en)) bad(id, "en: English, up to " + L.en); if (!en(x.why, 140)) bad(id, "why: English, up to 140");
  if (seen.has(plain(x.ja))) bad(id, "sentence used twice"); seen.add(plain(x.ja));
}
else if (kind === "pairs") { const words = new Set(CONNECTIVES.map(c => c[0]));
  for (const x of data) { const id = x.id || "?";
    if (!/^cp-\d{3}$/.test(id) || seen.has(id)) bad(id, "id cp-NNN, unique"); seen.add(id);
    if (!words.has(x.answer)) bad(id, "answer must be one of the 35 connectives as listed: " + x.answer);
    if (!/[。！？]$/.test(plain(x.a))) bad(id, "a ends its sentence");
    if (/^[、。]/.test(plain(x.b)) || !/[。！？]$/.test(plain(x.b))) bad(id, "b starts after the comma and ends its sentence");
    if (plain(x.a).length + plain(x.b).length > LIMITS.pairs.total) bad(id, "a and b together up to " + LIMITS.pairs.total + " characters");
    if (!readings(x.a) || !readings(x.b)) bad(id, "a kanji has no reading");
    if ((plain(x.a) + plain(x.b)).includes(x.answer)) bad(id, "the answer must not appear in the clauses");
    if (!en(x.en, LIMITS.pairs.en)) bad(id, "en: English of the whole, up to " + LIMITS.pairs.en);
    if (seen.has(plain(x.a) + plain(x.b))) bad(id, "pair used twice"); seen.add(plain(x.a) + plain(x.b)); }
  for (const w of words) { const n = data.filter(x => x.answer === w).length; if (n < 3) bad(w, "needs at least 3 pairs, has " + n); } }
else if (kind === "ordering") for (const x of data) { const id = x.id || "?", L = LIMITS.ordering;
  if (!/^or-\d{3}$/.test(id) || seen.has(id)) bad(id, "id or-NNN, unique"); seen.add(id);
  if (!Array.isArray(x.tiles) || x.tiles.length !== 4 || new Set(x.tiles.map(plain)).size !== 4) { bad(id, "four different tiles, in the right order"); continue; }
  for (const t of x.tiles) { const n = plain(t).length; if (n < L.tile[0] || n > L.tile[1]) bad(id, "tile of " + L.tile.join("–") + " characters: " + plain(t)); if (!readings(t)) bad(id, "a kanji in a tile has no reading"); }
  const whole = plain(x.lead || "") + x.tiles.map(plain).join("") + plain(x.tail || "");
  if (whole.length > L.total) bad(id, "whole sentence up to " + L.total + " characters, has " + whole.length);
  if (!/[。！？」]$/.test(whole)) bad(id, "the sentence must end");
  if (!readings(x.lead || "") || !readings(x.tail || "")) bad(id, "a kanji in lead or tail has no reading");
  if (!(plain(x.lead || "").length >= 1 || plain(x.tail || "").length >= 2)) bad(id, "a lead or a tail must frame the tiles");
  if (!en(x.en, L.en)) bad(id, "en: English, up to " + L.en);
  if (seen.has(whole)) bad(id, "sentence used twice"); seen.add(whole); }
else if (kind === "examen") { const want = JSON.parse(readFileSync(new URL("./exam-sentences.json", import.meta.url), "utf8"));
  for (const k of Object.keys(want)) if (!en(data[k], 140)) bad(k, "English translation, 6 to 140 characters, no Japanese");
  for (const k of Object.keys(data)) if (!(k in want)) bad(k, "not asked for"); }
else if (kind === "gapwrong") { const want = JSON.parse(readFileSync(new URL("./gap-input.json", import.meta.url), "utf8"));
  for (const [k, q] of Object.entries(want)) { const w = data[k];
    if (!Array.isArray(w) || w.length !== 3 || new Set(w).size !== 3) { bad(k, "three different wrong choices"); continue; }
    for (const c of w) { if (typeof c !== "string" || !c.trim() || /[【】（）\s]/.test(c) || !JP.test(c)) bad(k, "a wrong choice is plain Japanese, no readings or spaces: " + c);
      else if (c === q.answer || c.includes(q.answer) || q.answer.includes(c)) bad(k, "a wrong choice must not contain or be contained in the answer: " + c);
      else if (c.length > Math.max(12, q.answer.length + 5)) bad(k, "a wrong choice about as long as the answer: " + c); } }
  for (const k of Object.keys(data)) if (!(k in want)) bad(k, "not asked for"); }
else { console.error("kind: paraphrase | pairs | ordering | examen | gapwrong"); process.exit(2); }
console.log(kind + ": " + (Array.isArray(data) ? data.length : Object.keys(data).length) + " entries, " + errors.length + " problems");
for (const e of errors.slice(0, 60)) console.log("  " + e);
if (errors.length) process.exit(1);
