// The papers that have no deciding lines yet, one input file each for a
// writer (a person or an AI model):
//   node tools/boss-keys/make-handoff.mjs   → tools/boss-keys/handoff/<set>.input.json
// Generated: never edit the output. docs/N2-PAPERS-LINES-HANDOFF.md is the brief.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from "node:fs";
const root = new URL("../../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const ids = Object.keys(read("n2-sets/index.json"));
mkdirSync(new URL("tools/boss-keys/handoff/", root), {recursive: true});
const made = [];
for (const id of ids) {
  if (existsSync(new URL("tools/boss-keys/" + id + ".json", root))) continue; // already written
  const set = read("n2-sets/" + id + ".json");
  // Every question, so a wrong or doubtful answer key can be reported; lines are asked only where `needsLines` is true.
  const questions = Object.fromEntries(set.questions.map((q, i) => [i, {skill: q.skill, mondai: q.mondai, needsLines: ["Reading", "Listening"].includes(q.skill),
    ...(q.context ? {context: q.context} : {}), question: q.prompt, choices: q.choices, key: q.key, why: q.why}]));
  writeFileSync(new URL("tools/boss-keys/handoff/" + id + ".input.json", root), JSON.stringify({set: id, questions}, null, 1) + "\n");
  made.push(id + " " + Object.values(questions).filter(q => q.needsLines).length);
}
console.log(made.length + " papers: " + made.join(", "));
