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
import {readFileSync} from "node:fs";
import {FETCHED_LEVELS, buildInventory, levelFile, levelKanji} from "../jlpt-levels.js";
import {READINGS} from "../kanji-readings.js";
import {splitReading} from "../kanji-split.js";

const split = (text, reading) => splitReading(text, reading, READINGS);

const root = new URL("../levels/", import.meta.url);
const built = FETCHED_LEVELS.map(level => [level, JSON.stringify(buildInventory(level, {words: WORDS, grammar: GRAMMAR, split})) + "\n"]);
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
// The kanji each level brings (all five lists, N2's from n2-inventory.json),
// and N2's own split readings: n2-kanji-parts.json, part of the app like its inventory.
const n2 = JSON.parse(readFileSync(new URL("../n2-inventory.json", import.meta.url), "utf8"));
const lists = {N2: n2.words, ...Object.fromEntries(built.map(([level, text]) => [level, JSON.parse(text).words]))};
const parts = {};
for (const [text, reading] of n2.words) { const p = split(text, reading); if (p) parts[text + "/" + reading] = p.map(x => x.base).join("|"); }
writeFileSync(new URL("../n2-kanji-parts.json", import.meta.url), JSON.stringify(parts) + "\n");
writeFileSync(new URL("manifest.json", root), JSON.stringify({version, levels, kanji: levelKanji(lists)}, null, 1) + "\n");
console.log("levels/" + version);
