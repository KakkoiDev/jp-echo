// Every mock paper in this checkout as one input file for a reviewer (a person or an AI model):
//   node tools/paper-review/make-inputs.mjs   → tools/paper-review/input/<paper>.json (not committed)
// N2's nineteen papers (n2-sets/, with their deciding lines) and each level's current edition (sets/<level>/).
// Generated: never edit the output. docs/PAPERS-REVIEW-HANDOFF.md is the brief.
import {readFileSync, writeFileSync, existsSync, mkdirSync, rmSync} from "node:fs";
import {editionOf} from "../../n2-forms.js";
const root = new URL("../../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const out = new URL("tools/paper-review/input/", root);
rmSync(out, {recursive: true, force: true}); mkdirSync(out, {recursive: true});
const lines = read("n2-sets/keys.json").keys;
const question = (id, q, i) => ({index: i, skill: q.skill, mondai: q.mondai, ...(q.context ? {context: q.context} : {}), question: q.prompt,
  choices: q.choices, key: q.key, why: q.why, ...(lines[id + "#" + i] ? {decidingLines: lines[id + "#" + i]} : {})});
const made = [];
for (const id of Object.keys(read("n2-sets/index.json"))) {
  const set = read("n2-sets/" + id + ".json");
  writeFileSync(new URL(id + ".json", out), JSON.stringify({paper: id, level: "N2", edition: editionOf(id), theme: set.theme, questions: set.questions.map((q, i) => question(id, q, i))}, null, 1) + "\n");
  made.push(id);
}
for (const level of ["n5", "n4", "n3", "n1"]) {
  if (!existsSync(new URL("sets/" + level + "/index.json", root))) continue;
  const index = read("sets/" + level + "/index.json");
  for (const id of Object.keys(index.sets)) {
    const set = read("sets/" + level + "/" + index.edition + "/" + id + ".json");
    writeFileSync(new URL(id + ".json", out), JSON.stringify({paper: id, level: index.level, edition: index.edition, theme: set.theme, questions: set.questions.map((q, i) => question(id, q, i))}, null, 1) + "\n");
    made.push(id);
  }
}
console.log(made.length + " papers: " + made.join(", "));
