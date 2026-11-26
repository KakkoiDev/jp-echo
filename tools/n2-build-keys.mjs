// The deciding lines of reading and listening questions (n2-sets/keys.json).
//
// A long question cannot be asked at blitz pace, but the one or two lines
// that decide it can. Each entry of tools/boss-keys/<set>.json names those
// lines for one question of a set, word for word, with their meaning in
// English and three misreadings. Quick round turns them into cards for the
// questions missed on a boss (bossCards, n2-game.js).
//
//   node tools/n2-build-keys.mjs            validate every draft, write n2-sets/keys.json
//   node tools/n2-build-keys.mjs --check    validate only
//
// Passing means well-formed and word for word from the paper. It does not
// mean the lines decide the answer: that is the blind solve's job
// (`solved` on each entry) and a reader's.
import {readFileSync, writeFileSync, readdirSync} from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
export const LIMITS = Object.freeze({lines: 2, chars: 120, en: 80});
const JP = /[ぁ-んァ-ヶ一-龯]/;
const SKILLS = new Set(["Reading", "Listening"]);

// One entry against its question. Returns the problems found, none when it is sound.
export function checkKey(entry, q) {
  const errors = [];
  if (!q || !SKILLS.has(q.skill)) return ["not a reading or listening question"];
  if (entry.skip) return typeof entry.skip === "string" && entry.skip.length > 3 ? [] : ["skip needs its reason"];
  const {lines, en, wrong} = entry;
  if (!Array.isArray(lines) || !lines.length || lines.length > LIMITS.lines) errors.push("1 or 2 lines");
  else {
    for (const line of lines) {
      if (typeof line !== "string" || !line.trim() || /\n/.test(line)) errors.push("a line is one stretch of text");
      else if (!q.context.includes(line)) errors.push("not word for word in the passage: " + line.slice(0, 20));
      else if (/^[男女][０-９0-9１２]?[：:]/.test(line)) errors.push("leave the speaker's label out: " + line.slice(0, 12));
    }
    if (lines.join("").length > LIMITS.chars) errors.push("lines over " + LIMITS.chars + " characters");
    if (new Set(lines).size !== lines.length) errors.push("the same line twice");
  }
  const short = s => typeof s === "string" && s.trim().length >= 8 && s.length <= LIMITS.en && !JP.test(s);
  if (!short(en)) errors.push("en: English, 8 to " + LIMITS.en + " characters");
  if (!Array.isArray(wrong) || wrong.length !== 3 || !wrong.every(short)) errors.push("wrong: three English lines, 8 to " + LIMITS.en + " characters");
  else if (new Set([en, ...wrong].map(s => String(s).toLowerCase().trim())).size !== 4) errors.push("the four meanings must differ");
  return errors;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = new URL("tools/boss-keys/", root), keys = {};
  let bad = 0, skipped = 0, unsolved = 0;
  for (const file of readdirSync(dir).filter(f => /^n2-set-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)))) {
    const id = file.replace(".json", ""), set = read("n2-sets/" + file), draft = read("tools/boss-keys/" + file);
    const wanted = set.questions.map((q, i) => SKILLS.has(q.skill) ? i : -1).filter(i => i >= 0);
    for (const i of wanted) {
      const entry = draft[String(i)];
      if (!entry) { console.log(id + "#" + i + ": missing"); bad++; continue; }
      const errors = checkKey(entry, set.questions[i]);
      if (errors.length) { console.log(id + "#" + i + ": " + errors.join("; ")); bad++; continue; }
      if (entry.skip) { skipped++; continue; }
      // A card is made only where a blind solver, given the lines alone, picked the key.
      if (entry.solved !== true) { unsolved++; continue; }
      keys[id + "#" + i] = {lines: entry.lines, en: entry.en, wrong: entry.wrong};
    }
    for (const k of Object.keys(draft)) if (!wanted.includes(Number(k))) { console.log(id + "#" + k + ": not a reading or listening question"); bad++; }
  }
  console.log(Object.keys(keys).length + " keys, " + skipped + " skipped, " + unsolved + " without a blind solve, " + bad + " problems");
  if (bad) process.exit(1);
  if (!process.argv.includes("--check")) writeFileSync(new URL("n2-sets/keys.json", root), JSON.stringify({version: 1, keys}, null, 0) + "\n");
}
