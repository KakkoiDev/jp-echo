// Validates an N2 deck batch: [{id, source, target}] where id is n2-word-<index>
// or n2-grammar-<index> (indexes into n2-inventory.json) and the sentence uses it.
// Usage: node tools/n2-validate-deck.mjs batch.json   (exit 1 on problems)
import {readFileSync} from "node:fs";
const inv = JSON.parse(readFileSync(new URL("../n2-inventory.json", import.meta.url), "utf8"));
export const plain = s => s.replace(/【[^】]*】/g, "");
const kana = /[ぁ-ゖー]/;
// Inventory spellings can carry ～ (affixes), "; " alternatives and (notes).
export const spellings = word => String(word).split(/[;；]/).map(v => v.replace(/[（(][^)）]*[)）]/g, "").replace(/[～〜]/g, "").trim()).filter(Boolean);
// The sentence read aloud: every kanji run replaced by its 【reading】.
export const spoken = s => s.replace(/[一-龯々]+【([^】]*)】/g, "$1");
export function usesWord(text, word) {
  const affix = /[～〜]/.test(word);
  return spellings(word).some(w => usesSpelling(text, w) || (/^[ぁ-ゖー]+$/.test(w) && (spoken(text).includes(w) || ((affix || w.length >= 3) && w.length > 1 && spoken(text).includes(w.slice(0, -1))))));
}
function usesSpelling(text, word) {
  const t = plain(text);
  if (t.includes(word)) return true;
  // Inflected verbs and adjectives: the stem before the final kana.
  let stem = word; while (stem.length > 1 && kana.test(stem.at(-1))) stem = stem.slice(0, -1);
  return stem !== word && /[一-龯々]/.test(stem) && t.includes(stem);
}
export function validateDeckBatch(rows) {
  const problems = [], seen = new Set();
  if (!Array.isArray(rows)) return ["the file must be a JSON array"];
  for (const [i, r] of rows.entries()) {
    const at = `#${i + 1} ${r?.id}`;
    const m = /^n2-(word|grammar)-(\d+)$/.exec(r?.id || "");
    if (!m) { problems.push(`${at}: id must be n2-word-<n> or n2-grammar-<n>`); continue; }
    if (seen.has(r.id)) problems.push(`${at}: duplicate id`); seen.add(r.id);
    const entry = (m[1] === "word" ? inv.words : inv.grammar)[Number(m[2])];
    if (!entry) { problems.push(`${at}: no inventory entry ${m[2]}`); continue; }
    if (!r.source?.trim() || !r.target?.trim()) { problems.push(`${at}: needs source and target`); continue; }
    if (/[A-Za-z]{3,}/.test(plain(r.target))) problems.push(`${at}: target contains Latin text`);
    if (/【[^】]*[^ぁ-ゖー】][^】]*】/.test(r.target)) problems.push(`${at}: readings in 【】 must be hiragana only`);
    if (!/[。？！]$/.test(r.target.trim())) problems.push(`${at}: target must be one full sentence ending in 。？！`);
    if (m[1] === "word" && !usesWord(r.target, entry[0])) problems.push(`${at}: sentence does not contain ${entry[0]}`);
  }
  return problems;
}
if (process.argv[1]?.endsWith("n2-validate-deck.mjs")) {
  const problems = validateDeckBatch(JSON.parse(readFileSync(process.argv[2], "utf8")));
  console.log(problems.length ? problems.join("\n") : "OK");
  process.exit(problems.length ? 1 : 0);
}
