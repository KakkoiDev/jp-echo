// Build levels/: the word and grammar inventories of N5, N4, N3 and N1, in
// the shape of n2-inventory.json, from the catalogues Echo ships
// (words-data.js JLPT tags, grammar-data.js bands). See jlpt-levels.js.
//
//   node tools/build-level-inventories.mjs
//
// The version is a hash of the content, so files only move when they change.
// (tools/build-jlpt-inventories.mjs is something else: the research datasets
// in datasets/jlpt/, which the app never loads.)
import {writeFileSync, mkdirSync, rmSync, existsSync, readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {WORDS} from "../words-data.js";
import {GRAMMAR} from "../grammar-data.js";
import {FETCHED_LEVELS, buildInventory, levelFile} from "../jlpt-levels.js";

const root = new URL("../levels/", import.meta.url);
const built = FETCHED_LEVELS.map(level => [level, JSON.stringify(buildInventory(level, {words: WORDS, grammar: GRAMMAR})) + "\n"]);
const version = createHash("sha256").update(built.map(([, text]) => text).join("")).digest("hex").slice(0, 10);

mkdirSync(root, {recursive: true});
for (const name of readdirSync(root)) if (name !== version) rmSync(new URL(name, root), {recursive: true, force: true});
const dir = new URL(version + "/", root);
if (!existsSync(dir)) mkdirSync(dir);
const levels = {};
for (const [level, text] of built) {
  writeFileSync(new URL(levelFile(level), dir), text);
  const data = JSON.parse(text);
  levels[level] = {words: data.words.length, grammar: data.grammar.length};
  console.log(level, data.words.length, "words,", data.grammar.length, "grammar,", Math.round(text.length / 1024) + " KB");
}
writeFileSync(new URL("manifest.json", root), JSON.stringify({version, levels}, null, 1) + "\n");
console.log("levels/" + version);
