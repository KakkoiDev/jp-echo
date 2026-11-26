import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {rubySegments} from "../core.js";
import {patternNeedles} from "../n2-delayed.js";
import {JP, sameSense} from "../n2-game.js";
import {GLOSS_FIX} from "../n2-game-review.js";
import {LEVELS} from "../jlpt-levels.js";

const read = path => JSON.parse(readFileSync(path, "utf8"));
const root = path => new URL("../" + path, import.meta.url);
export const inventory = read(root("n2-inventory.json"));
const edition = read(root("levels/manifest.json")).version;
const inventories = Object.fromEntries(LEVELS.map(level => [level, level === "N2" ? inventory : read(root(`levels/${edition}/${level.toLowerCase()}.json`))]));
const lowerForms = Object.fromEntries(LEVELS.map(level => [level, new Set(inventories[level].grammar.flatMap(([, name]) => patternNeedles(name)))]));
const kinds = new Set(["negative", "noun", "particle", "verb", "ending", "word"]);
const basicParticles = new Set(["は", "が", "を", "に", "で", "と", "の", "へ", "も", "か", "から", "まで", "より", "や", "ね", "よ"]);
const kanji = /[\p{Unified_Ideograph}々]/u;
const object = value => value && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && !!value.trim();

export function blockLevel({form, forms = [], type}) {
  if (type === "particle" && basicParticles.has(form)) return "N5";
  // A form absent from all inventories is evidenced here as part of N2.
  return LEVELS.find(level => forms.some(f => lowerForms[level].has(f))) || "N2";
}

export function validateGrammarBlocks(index, {draft = false} = {}) {
  const errors = [], add = (where, message) => errors.push(`${where}: ${message}`);
  if (!object(index) || index.version !== 1 || !object(index.blocks) || !object(index.patterns)) {
    return {errors: ["Expected version 1, a blocks object, and a patterns object."]};
  }
  const {blocks, patterns} = index;
  const grammar = new Map(inventory.grammar.map(([key, name, meaning]) => [key, {name, meaning: GLOSS_FIX["g:" + key] || meaning}]));
  const users = new Map(Object.keys(blocks).map(id => [id, new Set()]));
  const types = {}, transparency = {}, meaningGroups = new Map();
  if (!draft) for (const key of grammar.keys()) if (!Object.hasOwn(patterns, key)) add(key, "missing pattern");

  for (const [id, b] of Object.entries(blocks)) {
    if (!/^[a-z0-9-]+$/.test(id) || !object(b)) { add(id, "invalid block id or object"); continue; }
    if (!kinds.has(b.type)) add(id, "invalid block type");
    else types[b.type] = (types[b.type] || 0) + 1;
    const forms = Array.isArray(b.forms) ? b.forms : [];
    if (!text(b.form) || !forms.every(text) || !forms.includes(b.form) || new Set(forms).size !== forms.length) add(id, "forms must be distinct and include form");
    if (!LEVELS.includes(b.level) || b.level !== blockLevel({...b, forms})) add(id, "level does not match inventory");
    if (!text(b.gloss) || !/[a-z]/i.test(b.gloss) || JP.test(b.gloss) || [...String(b.gloss || "")].length > 40) add(id, "gloss must be short English");
    if (!text(b.ja) || !text(b.en) || JP.test(b.en) || !/[a-z]/i.test(b.en)) { add(id, "missing Japanese/English example"); continue; }
    const segments = rubySegments(b.ja), sentence = segments.map(s => s.text).join("");
    if (!/[。！？]$/.test(sentence) || (sentence.match(/[。！？]/g) || []).length !== 1
      || /[【】]/.test(sentence) || segments.some(s => kanji.test(s.text) && !/^[ぁ-ゖァ-ヺー]+$/.test(s.reading || ""))) {
      add(id, "example must be one annotated sentence");
    }
    if (!forms.some(form => text(form) && sentence.includes(form))) add(id, "example does not contain a listed form");
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const point = grammar.get(key);
    if (!point || !object(pattern)) { add(key, "unknown grammar key or invalid pattern"); continue; }
    const {parts, literal, transparency: t, solved} = pattern;
    const forms = patternNeedles(point.name);
    if (!Array.isArray(parts) || !parts.length || parts.some(p => !object(p) || !text(p.text))) {
      add(key, "expected ordered parts");
      continue;
    }
    if (!forms.includes(parts.map(p => p.text).join(""))) add(key, "parts do not reconstruct a surface form");
    for (const part of parts) {
      if (!Object.hasOwn(part, "block")) {
        if (!/^[ぁ-ゖァ-ヺー]{1,2}$/.test(part.text)) add(key, `non-kana or long glue: ${part.text}`);
        continue;
      }
      // A part may carry its own gloss, held to the same rules as a block's.
      // A part's own gloss says what this form does here, negation included (review, 27 Nov).
      if (part.gloss !== undefined && (!text(part.gloss) || JP.test(part.gloss) || [...part.gloss].length > 40)) add(key, `gloss of part ${part.text} must be short English`);
      const b = Object.hasOwn(blocks, part.block) && blocks[part.block];
      if (!object(b)) { add(key, `unknown block: ${part.block}`); continue; }
      users.get(part.block).add(key);
      if (!Array.isArray(b.forms) || !b.forms.includes(part.text)) add(key, `form ${part.text} is not listed for ${part.block}`);
      // A pattern that is one block has nothing to build: its gloss is its meaning, plainly (owner, 27 Nov).
      // No "must not overlap the answer" rule any more (review, 27 Nov 2026): a
      // hint that dodges the answer's words came out abstract or false (得ない as
      // "get or attain"). The build card is where the parts are taught, so its
      // hints say plainly what each form does; the infer card, which shows no
      // hints, is the test.
    }
    if (!parts.some(p => Object.hasOwn(p, "block"))) add(key, "pattern has no blocks");
    if (t !== "opaque" && !text(literal)) add(key, "missing literal");
    if (literal !== undefined && (!text(literal) || JP.test(literal))) add(key, "literal must be English");
    // One block is the whole pattern: learned whole, by its block card. No solve, no build or infer card.
    if (parts.length === 1 && Object.hasOwn(blocks, parts[0].block) && t !== "opaque") add(key, "a one-block pattern is learned whole (opaque)");
    // partial also by a reviewer's judgment: solved blind, but a nuance must be taught ({by: "review"}).
    const solves = {clear: ["blocks-only", true], partial: ["blocks+sentence", true]};
    if (t === "partial" && solved?.by === "review" && solved?.right === true) { /* a reviewer lowered it from clear */ }
    else if (Object.hasOwn(solves, t)) {
      const [by, right] = solves[t];
      if (solved?.by !== by || solved?.right !== right) add(key, `missing successful ${by} solve`);
    } else if (t === "opaque") {
      if (solved !== undefined && (solved?.by !== "blocks+sentence" || solved?.right !== false)) add(key, "invalid opaque solve");
    } else if (!(draft && t === "pending" && solved === undefined)) add(key, "invalid transparency");
    if (typeof t === "string") transparency[t] = (transparency[t] || 0) + 1;
    for (const form of forms) {
      if (!meaningGroups.has(form)) meaningGroups.set(form, []);
      meaningGroups.get(form).push({key, literal});
    }
  }
  for (const rows of meaningGroups.values()) {
    if (rows.length < 2) continue;
    for (const row of rows) if (!text(row.literal) || rows.some(other => other !== row && other.literal === row.literal)) add(row.key, "shared surface form needs a distinct literal");
  }

  const single = [];
  for (const [id, matches] of users) {
    const b = blocks[id];
    if (!matches.size) add(id, "unused block");
    else if (matches.size === 1) {
      single.push(id);
      if (b.single !== true) add(id, "single-use block needs single: true");
    } else if (b.single !== undefined) add(id, "shared block cannot be marked single");
  }
  // No cap on single-use blocks (owner, 27 Nov: "arbitrary percentage is no
  // problem" if the product teaches). The share is reported, not enforced: the
  // N2 list uses many ordinary words in one pattern only (沿う, 契機, 傾向).
  const share = single.length / (users.size || 1);
  const shared = new Set([...users.values()].filter(keys => keys.size > 1).flatMap(keys => [...keys]));
  return {errors, counts: {patterns: Object.keys(patterns).length, blocks: users.size, types, transparency,
    sharedPatterns: shared.size, singleShare: Math.round(share * 1000) / 10, single, opaque: Object.entries(patterns).filter(([, p]) => p?.transparency === "opaque").map(([key]) => key)}};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), draft = args.includes("--draft");
  const path = args.find(arg => !arg.startsWith("--")) || root("n2-grammar-blocks.json");
  try {
    const {errors, counts} = validateGrammarBlocks(read(path), {draft});
    if (counts) console.log(JSON.stringify(counts, null, 2));
    for (const message of errors) console.error(message);
    process.exitCode = Number(!!errors.length);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
