// Merge the decisive line for each authored reading and listening question
// (one file per set, {"set","cues":{index:"exact substring of context"}}) into
// n2-sets/cues.json, checking each cue is copied exactly from its context.
// Usage: node tools/n2-build-cues.mjs <dir with set-N.json>
import {readFileSync, writeFileSync, existsSync} from "node:fs";

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/n2-build-cues.mjs <dir>"); process.exit(1); }
const repo = new URL("../", import.meta.url);
const index = JSON.parse(readFileSync(new URL("n2-sets/index.json", repo), "utf8"));
const out = {}, problems = [];
for (const id of Object.keys(index)) {
  const set = JSON.parse(readFileSync(new URL("n2-sets/" + id + ".json", repo), "utf8"));
  const file = dir + "/set-" + id.replace("n2-set-", "") + ".json";
  const cues = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).cues : {};
  set.questions.forEach((q, i) => {
    if (q.skill !== "Reading" && q.skill !== "Listening") return;
    const c = cues[i];
    if (typeof c !== "string" || c.length < 4 || c.length > 80 || !q.context.includes(c)) problems.push(id + "#" + i + " " + JSON.stringify(c));
    else out[id + "#" + i] = c;
  });
}
if (problems.length) { console.error(problems.length + " problems\n" + problems.slice(0, 20).join("\n")); process.exit(1); }
writeFileSync(new URL("n2-sets/cues.json", repo), JSON.stringify({version: 1, cues: out}) + "\n");
console.log(Object.keys(out).length + " cues");
