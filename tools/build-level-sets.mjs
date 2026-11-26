// Brings authored sets for a level other than N2 into sets/ (jlpt-sets.js).
// Usage: node tools/build-level-sets.mjs <dir with n3-set-N.json …>
//   <dir>/n3-set-N.json → sets/n3/<edition>/n3-set-N.json + sets/n3/index.json
// A set that fails tools/validate-level-set.mjs is skipped and the run exits 1.
// The edition is the one sets/<level>/index.json names (EDITION for a new
// level). Revising a set already sat by learners is a new edition: pass
// --edition <name> and bring every set of the level over to it.
import {readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync} from "node:fs";
import {validateLevelSet} from "./validate-level-set.mjs";
import {setLevel} from "../jlpt-sets.js";

export const EDITION = "2026-11";
const dir = process.argv[2], asked = process.argv.includes("--edition") ? process.argv[process.argv.indexOf("--edition") + 1] : "";
if (!dir) { console.error("usage: node tools/build-level-sets.mjs <dir> [--edition <name>]"); process.exit(1); }
const root = new URL("../sets/", import.meta.url), read = p => JSON.parse(readFileSync(p, "utf8"));
const number = id => parseInt(id.split("-set-")[1]);
let failed = 0; const indexes = new Map();
for (const f of readdirSync(dir).filter(f => /^n[1345]-set-\d+\.json$/.test(f)).sort()) {
  const set = read(dir + "/" + f), level = setLevel(f.slice(0, -5)), home = new URL(level.toLowerCase() + "/", root);
  const problems = set.id === f.slice(0, -5) && set.level === level ? validateLevelSet(set) : ["file name, id and level disagree"];
  if (problems.length) { failed++; console.error("skip " + f + ": " + problems.length + " problems, e.g. " + problems[0]); continue; }
  if (!indexes.has(level)) indexes.set(level, existsSync(new URL("index.json", home)) ? read(new URL("index.json", home)) : {level, edition: asked || EDITION, sets: {}});
  const index = indexes.get(level);
  if (asked && index.edition !== asked) { index.edition = asked; index.sets = {}; }
  mkdirSync(new URL(index.edition + "/", home), {recursive: true});
  writeFileSync(new URL(index.edition + "/" + f, home), JSON.stringify(set) + "\n");
  index.sets[set.id] = set.theme;
  console.log("sets/" + level.toLowerCase() + "/" + index.edition + "/" + f, set.questions.length);
}
for (const [level, index] of indexes) {
  index.sets = Object.fromEntries(Object.entries(index.sets).sort((a, b) => number(a[0]) - number(b[0])));
  writeFileSync(new URL(level.toLowerCase() + "/index.json", root), JSON.stringify(index, null, 1) + "\n");
}
process.exit(failed ? 1 : 0);
