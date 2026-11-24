// Merge reviewed comprehension tags (one file per set, {"set","tags":{index:[ids]}})
// into n2-sets/tags.json, checking every Reading and Listening question of
// sets 02–20 has 1–2 known tags. Usage: node tools/n2-build-tags.mjs <dir>
import {readFileSync, writeFileSync, readdirSync} from "node:fs";
import {TAGS} from "../n2-comprehension.js";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/n2-build-tags.mjs <dir with set-N.json>"); process.exit(1); }
const known = new Set(TAGS.map(t => t.id));
const repo = new URL("../", import.meta.url);
const index = JSON.parse(readFileSync(new URL("n2-sets/index.json", repo), "utf8"));
const out = {}, problems = [];
for (const id of Object.keys(index)) {
  const set = JSON.parse(readFileSync(new URL("n2-sets/" + id + ".json", repo), "utf8"));
  const file = readdirSync(dir).find(f => f === "set-" + id.replace("n2-set-", "") + ".json");
  const tags = file ? JSON.parse(readFileSync(dir + "/" + file, "utf8")).tags : {};
  set.questions.forEach((q, i) => {
    if (q.skill !== "Reading" && q.skill !== "Listening") return;
    const t = tags[i];
    if (!Array.isArray(t) || !t.length || t.length > 2 || !t.every(x => known.has(x)) || new Set(t).size !== t.length) problems.push(id + "#" + i + " " + JSON.stringify(t));
    else out[id + "#" + i] = t;
  });
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
writeFileSync(new URL("n2-sets/tags.json", repo), JSON.stringify({version: 1, taxonomy: TAGS.map(t => t.id), tags: out}) + "\n");
console.log(Object.keys(out).length + " questions tagged");
