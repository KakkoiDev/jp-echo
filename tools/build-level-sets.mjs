// Brings authored sets for a level other than N2 into sets/ (jlpt-sets.js).
// Usage: node tools/build-level-sets.mjs <dir with n3-set-N.json …> [--edition <name>]
//   <dir>/n3-set-N.json → sets/n3/<edition>/n3-set-N.json + sets/n3/index.json
// All or nothing: every file is validated (tools/validate-level-set.mjs)
// before anything is written, and one bad file stops the whole run, exit 1.
// An edition is immutable: a set file that exists is never rewritten with
// other bytes, because the worker keeps a served address for good. Changing
// a set means --edition <new name> with EVERY set of the level in <dir>; the
// index is written last, once the edition's files are all in place.
import {readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync} from "node:fs";
import {validateLevelSet} from "./validate-level-set.mjs";
import {setLevel} from "../jlpt-sets.js";

export const EDITION = "2026-11-r2";
const read = p => JSON.parse(readFileSync(p, "utf8")), number = id => (id.includes("-mini-") ? 1000 : 0) + parseInt(id.split("-").at(-1));
// plan(dir, root, asked) → {problems, writes: [[url, text]], indexes: [[url, text]]}; writes nothing.
export function plan(dir, root, asked = "") {
  const problems = [], writes = [], indexes = new Map();
  for (const f of readdirSync(dir).filter(f => /^n[1345]-(set|mini)-\d+\.json$/.test(f)).sort()) {
    const set = read(dir + "/" + f), id = f.slice(0, -5), level = setLevel(id), home = new URL(level.toLowerCase() + "/", root);
    const found = set.id === id && set.level === level ? validateLevelSet(set) : ["file name, id and level disagree"];
    if (found.length) { problems.push(f + ": " + found.length + " problems, e.g. " + found[0]); continue; }
    if (!indexes.has(level)) {
      const old = existsSync(new URL("index.json", home)) ? read(new URL("index.json", home)) : null;
      indexes.set(level, {home, old, index: {level, edition: asked || old?.edition || EDITION, sets: asked && old && asked !== old.edition ? {} : {...(old?.sets || {})}}});
    }
    const {index} = indexes.get(level), url = new URL(index.edition + "/" + f, home), text = JSON.stringify(set) + "\n";
    if (existsSync(url) && readFileSync(url, "utf8") !== text) problems.push(f + ": " + index.edition + " already has this set with other content; an edition never changes, use --edition <new name> with every set of the level");
    writes.push([url, text]); index.sets[set.id] = set.theme;
  }
  for (const [level, {old, index}] of indexes) {
    const lost = Object.keys(old?.sets || {}).filter(id => !Object.hasOwn(index.sets, id));
    if (lost.length) problems.push(level + ": the new edition " + index.edition + " would drop " + lost.join(", ") + "; bring every set of the level");
    index.sets = Object.fromEntries(Object.entries(index.sets).sort((a, b) => number(a[0]) - number(b[0])));
  }
  return {problems, writes, indexes: [...indexes.values()].map(({home, index}) => [new URL("index.json", home), JSON.stringify(index, null, 1) + "\n"])};
}
if (process.argv[1]?.endsWith("build-level-sets.mjs")) {
  const dir = process.argv[2], asked = process.argv.includes("--edition") ? process.argv[process.argv.indexOf("--edition") + 1] : "";
  if (!dir) { console.error("usage: node tools/build-level-sets.mjs <dir> [--edition <name>]"); process.exit(1); }
  const {problems, writes, indexes} = plan(dir, new URL("../sets/", import.meta.url), asked);
  if (problems.length) { console.error("nothing written:\n" + problems.join("\n")); process.exit(1); }
  for (const [url, text] of [...writes, ...indexes]) { mkdirSync(new URL("./", url), {recursive: true}); writeFileSync(url, text); console.log(url.pathname.split("/sets/")[1]); }
}
