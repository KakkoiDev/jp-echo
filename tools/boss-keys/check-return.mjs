// Checks one file a writer handed back for a paper (docs/N2-PAPERS-LINES-HANDOFF.md):
//   node tools/boss-keys/check-return.mjs <returned.json>            report only
//   node tools/boss-keys/check-return.mjs <returned.json> --write    also save tools/boss-keys/<set>.json
// What is saved has no `solved` mark: a card is made only after the blind
// solve (a second reader, given the lines alone, must pick the key).
import {readFileSync, writeFileSync} from "node:fs";
import {checkKey} from "../n2-build-keys.mjs";
const root = new URL("../../", import.meta.url);
const file = process.argv[2];
if (!file) { console.error("usage: node tools/boss-keys/check-return.mjs <returned.json> [--write]"); process.exit(2); }
const back = JSON.parse(readFileSync(file, "utf8"));
const set = JSON.parse(readFileSync(new URL("n2-sets/" + back.set + ".json", root), "utf8"));
const wanted = set.questions.map((q, i) => ["Reading", "Listening"].includes(q.skill) ? i : -1).filter(i => i >= 0);
let bad = 0, withLines = 0, skipped = 0;
const out = {};
for (const i of wanted) {
  const entry = back.lines?.[String(i)];
  if (!entry) { console.log(back.set + "#" + i + ": missing"); bad++; continue; }
  const errors = checkKey(entry, set.questions[i]);
  if (errors.length) { console.log(back.set + "#" + i + ": " + errors.join("; ")); bad++; continue; }
  entry.skip ? skipped++ : withLines++;
  out[String(i)] = entry.skip ? {skip: entry.skip} : {lines: entry.lines, en: entry.en};
}
for (const k of Object.keys(back.lines || {})) if (!wanted.includes(Number(k))) { console.log(back.set + "#" + k + ": not a reading or listening question"); bad++; }
const findings = Array.isArray(back.findings) ? back.findings : [];
for (const f of findings) if (!(Number.isInteger(f.index) && set.questions[f.index] && f.problem && ["wrong", "unfair", "weak", "note"].includes(f.severity))) { console.log("finding not well-formed: " + JSON.stringify(f).slice(0, 120)); bad++; }
console.log(back.set + ": " + withLines + " with lines, " + skipped + " skipped, " + findings.length + " findings on the paper (" + findings.filter(f => ["wrong", "unfair"].includes(f.severity)).length + " wrong or unfair), " + bad + " problems");
if (bad) process.exit(1);
if (process.argv.includes("--write")) writeFileSync(new URL("tools/boss-keys/" + back.set + ".json", root), JSON.stringify(out, null, 1) + "\n");
