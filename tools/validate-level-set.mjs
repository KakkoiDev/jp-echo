// Validates one authored mock set against its level's blueprint (jlpt-sets.js).
// The level-aware sibling of tools/n2-validate-set.mjs, which stays N2's.
// Usage: node tools/validate-level-set.mjs path/to/n3-set-N.json [--profile]
//   exit 1 on problems; --profile also prints the level profile (kanji and lengths).
import {readFileSync} from "node:fs";
import {SET_LEVELS, expectedRows, groupsOf, setLevel, setForm} from "../jlpt-sets.js";
import {TAG} from "../n2-comprehension.js";

const root = new URL("../", import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const KANJI = /[㐀-鿿]/g;
// A level's inventory and those below it (levels/, built by
// tools/build-level-inventories.mjs; N2's is n2-inventory.json).
const inventories = new Map();
function inventory(level) {
  if (!inventories.has(level)) inventories.set(level, level === "N2" ? read("n2-inventory.json") : read("levels/" + read("levels/manifest.json").version + "/" + level.toLowerCase() + ".json"));
  return inventories.get(level);
}
const known = new Map();
function knownFor(level) {
  if (known.has(level)) return known.get(level);
  const words = new Map(), grammar = new Map(), kanji = new Set();
  for (const from of SET_LEVELS[level].draws) {
    const inv = inventory(from);
    for (const w of inv.words) { const key = JSON.stringify(["word", w[0], w[1]]); if (!words.has(key)) words.set(key, from); for (const k of w[0].match(KANJI) || []) kanji.add(k); }
    for (const g of inv.grammar) { const key = JSON.stringify(["grammar", g[0]]); if (!grammar.has(key)) grammar.set(key, from); }
  }
  known.set(level, {words, grammar, kanji});
  return known.get(level);
}

// How far a set sits from its level, measured rather than judged: the share
// of its kanji (by occurrence) that no word of the level's inventories or the
// lower ones uses, and the kanji themselves. Names of people and places count.
export function levelProfile(set) {
  const level = set.level || setLevel(set.id), {kanji} = knownFor(level);
  // The kanji of the paper's own theme are its subject (面接 in a paper about job interviews) and do not count.
  const own = new Set(String(set.theme || "").match(KANJI) || []);
  const seen = new Set(), outside = new Map(); let total = 0, out = 0;
  for (const q of set.questions) {
    // The fixed question of a spoken-reply item (最もよい返事はどれですか) is the paper's wording, not the writer's.
    const fixed = q.skill === "Listening" && (q.choices || []).length === 3;
    const text = [seen.has(q.context) ? "" : q.context, fixed ? "" : q.prompt, ...(q.choices || [])].join("\n"); seen.add(q.context);
    for (const k of text.match(KANJI) || []) { total++; if (!kanji.has(k) && !own.has(k)) { out++; outside.set(k, (outside.get(k) || 0) + 1); } }
  }
  return {level, kanji: total, outside: out, share: total ? out / total : 0, list: [...outside].sort((a, b) => b[1] - a[1]).map(([k, n]) => k + (n > 1 ? "×" + n : ""))};
}
// At most this share of a set's kanji may lie outside its level's inventories.
// (Measured the same way, N2's sets sit at 1.3–2.2% against the N3 inventories.)
export const OUTSIDE_KANJI = 0.01;
// At least this share of a set's word and grammar targets come from the level itself.
export const OWN_LEVEL_TARGETS = 0.7;

// A script line is spoken by 男 or 女, numbered when a talk has two of one.
const SPEAKER = /^[男女][１２３]?：\S/;
// A passage with spaces and punctuation taken out, so one comma does not make it new.
const plain = text => String(text).replace(/[\s、。，．,.!?！？「」『』（）()・…〜~ー―-]/g, "");
// The deciding line or lines of a question: `cue` is one span or up to three.
export const cuesOf = q => (Array.isArray(q.cue) ? q.cue : q.cue == null ? [] : [q.cue]);

export function validateLevelSet(set) {
  const problems = [], level = set.level;
  if (!SET_LEVELS[level]) return ["unknown level " + JSON.stringify(level)];
  const {words, grammar} = knownFor(level), prefix = level.toLowerCase();
  if (setLevel(set.id) !== level) problems.push(`id must be ${prefix}-set-<N> or ${prefix}-mini-<N>`);
  const form = setForm(set.id) || "boss";
  if (!set.theme) problems.push("missing theme");
  const qs = set.questions || [], expected = expectedRows(level, form);
  if (qs.length !== expected.length) problems.push(`expected ${expected.length} questions, got ${qs.length}`);
  const seenTargets = new Set(), seenPrompts = new Set(), keys = {3: [0, 0, 0], 4: [0, 0, 0, 0]}, groups = new Map();
  let own = 0, targets = 0;
  qs.forEach((q, i) => {
    const b = expected[i], at = `#${i + 1}`;
    if (!b) return;
    if (q.skill !== b.skill || q.mondai !== b.mondai) { problems.push(`${at}: expected ${b.skill} 問題${b.mondai} (${b.kind}), got ${q.skill} 問題${q.mondai}`); return; }
    const n = b.options, prompt = String(q.prompt || ""), context = typeof q.context === "string" ? q.context : "";
    const fine = Array.isArray(q.choices) && q.choices.length === n && q.choices.every(c => typeof c === "string" && c.trim());
    if (!fine) problems.push(`${at}: needs ${n} non-empty choices`);
    else if (new Set(q.choices.map(c => c.trim())).size !== n) problems.push(`${at}: duplicate choices`);
    if (!Number.isInteger(q.key) || q.key < 1 || q.key > n) problems.push(`${at}: key must be 1..${n}`); else keys[n][q.key - 1]++;
    if (!prompt.trim()) problems.push(`${at}: empty prompt`);
    if (!q.why?.trim()) problems.push(`${at}: empty why`);
    if (typeof q.context !== "string") problems.push(`${at}: context must be a string`);
    if (!b.needsContext && context) problems.push(`${at}: ${b.kind} has no context`);
    if (b.needsContext && !context.trim()) problems.push(`${at}: ${b.kind} needs a context`);
    const right = fine && Number.isInteger(q.key) ? q.choices[q.key - 1] : "";
    if (b.needsContext) {
      const group = b.skill + b.mondai; if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(context);
      const length = [...context].length;
      if (b.chars && (length < b.chars[0] || length > b.chars[1])) problems.push(`${at}: ${b.kind} context is ${length} characters, wants ${b.chars[0]}–${b.chars[1]}`);
    } else if (seenPrompts.has(prompt)) problems.push(`${at}: prompt used twice`);
    seenPrompts.add(prompt);
    if (b.skill === "Listening" && context && context.split("\n").some(line => line.trim() && !SPEAKER.test(line))) problems.push(`${at}: every listening script line needs a speaker label: 男： 女： (男１： … for more than one)`);
    if (b.skill === "Reading" || b.skill === "Listening") {
      const tags = q.tags;
      if (!Array.isArray(tags) || tags.length < 1 || tags.length > 2 || new Set(tags).size !== tags.length || tags.some(t => !TAG[t])) problems.push(`${at}: needs 1–2 tags from TAGS (n2-comprehension.js)`);
      else if ((b.kind === "即時応答" || b.kind === "発話表現") && tags[0] !== "response") problems.push(`${at}: ${b.kind} is tagged "response" first`);
      const spans = cuesOf(q), min = b.chars && b.chars[0] < 100 ? 3 : 4;
      if (!spans.length || spans.length > 3 || new Set(spans).size !== spans.length || spans.some(cue => typeof cue !== "string" || [...cue].length < min || [...cue].length > 80 || !context.includes(cue))) problems.push(`${at}: cue must be one to three spans of ${min}–80 characters, each copied exactly from the context`);
    } else if (q.tags || q.cue) problems.push(`${at}: only reading and listening questions carry tags and a cue`);
    if (b.targeted) {
      const t = JSON.stringify(q.target), from = words.get(t) || grammar.get(t);
      const wantsWord = b.skill === "Vocabulary";
      if (!from) problems.push(`${at}: target ${t} is not in the ${SET_LEVELS[level].draws.join("/")} inventories`);
      else if ((q.target[0] === "word") !== wantsWord) problems.push(`${at}: ${b.kind} targets a ${wantsWord ? "word" : "grammar point"}`);
      else { if (seenTargets.has(t)) problems.push(`${at}: target ${t} used twice`); targets++; if (from === level) own++; }
      seenTargets.add(t);
      const dimension = b.targeted === "reading" ? "reading" : "meaning";
      if (q.dimension !== dimension) problems.push(`${at}: dimension must be "${dimension}"`);
      const [, text, reading] = Array.isArray(q.target) ? q.target : [];
      if (b.targeted === "reading" && text) {
        if (!/[㐀-鿿]/.test(text)) problems.push(`${at}: 漢字読み needs a word written in kanji`);
        if (right !== reading) problems.push(`${at}: 漢字読み key must be the reading ${reading}`);
        if (!prompt.includes("【" + text + "】")) problems.push(`${at}: prompt must contain 【${text}】`);
        if (fine && q.choices.some(c => /[㐀-鿿]/.test(c))) problems.push(`${at}: 漢字読み choices are kana`);
      }
      if (b.targeted === "spelling" && text) {
        if (right !== text) problems.push(`${at}: 表記 key must be the spelling ${text}`);
        if (!prompt.includes("【" + reading + "】")) problems.push(`${at}: prompt must contain 【${reading}】`);
      }
      if (b.kind === "文脈規定" || b.kind === "文法形式の判断") { if (!prompt.includes("（　）")) problems.push(`${at}: prompt needs the blank （　）`); }
      if (b.kind === "言い換え類義" && !/【[^】]+】/.test(prompt)) problems.push(`${at}: prompt must mark the phrase with 【】`);
      if (b.kind === "用法") {
        if (prompt !== text) problems.push(`${at}: 用法 prompt is the word itself, ${text}`);
        if (fine && q.choices.some(c => [...c].length < 12)) problems.push(`${at}: 用法 choices are full sentences`);
      }
    }
    if (b.star && (!prompt.includes("★") || (prompt.match(/＿＿/g) || []).length !== 3)) problems.push(`${at}: 文の組み立て prompt needs ＿＿ three times and ★ once`);
    if (b.kind === "文章の文法" && !/（[１-５]）/.test(prompt)) problems.push(`${at}: prompt names its blank, （１）…（５）`);
  });
  // Questions that share a passage sit together, and no passage is used twice.
  const all = new Set();
  for (const [group, contexts] of groups) {
    const b = expected.find(b => b.skill + b.mondai === group);
    for (let i = 0, sizes = groupsOf(b), g = 0; i < contexts.length; i += sizes[g++] || 1) {
      const run = contexts.slice(i, i + (sizes[g] || 1));
      if (new Set(run).size !== 1) problems.push(`${b.skill} 問題${b.mondai}: questions ${i + 1}–${i + run.length} must share one context`);
      if (all.has(plain(run[0]))) problems.push(`${b.skill} 問題${b.mondai}: a context is used twice`);
      all.add(plain(run[0]));
    }
    if (b.kind === "文章の文法") {
      const asked = qs.filter(q => q.skill === b.skill && q.mondai === b.mondai).map(q => (/（[１-５]）/.exec(String(q.prompt)) || [""])[0]);
      if (new Set(asked).size !== asked.length) problems.push("文章の文法: each blank is asked about once");
    }
    if (b.kind === "文章の文法") for (const mark of ["（１）", "（２）", "（３）", "（４）", "（５）"].slice(0, b.count)) if (!contexts[0].includes(mark)) problems.push(`文章の文法: the passage lacks ${mark}`);
  }
  if (qs.length === expected.length) {
    const four = expected.filter(b => b.options === 4).length, three = expected.length - four;
    if (four >= 16 && Math.min(...keys[4]) < Math.floor(four / 4 * 0.75)) problems.push(`four-choice keys are unbalanced: ${keys[4].join("/")}`);
    if (three >= 6 && Math.min(...keys[3]) < Math.floor(three / 3 * 0.6)) problems.push(`three-choice keys are unbalanced: ${keys[3].join("/")}`);
    if (targets && own / targets < OWN_LEVEL_TARGETS) problems.push(`only ${own} of ${targets} targets are ${level} items; at least ${Math.ceil(targets * OWN_LEVEL_TARGETS)} must be`);
    const profile = levelProfile(set);
    if (profile.share > OUTSIDE_KANJI) problems.push(`${(profile.share * 100).toFixed(1)}% of the kanji are outside the ${SET_LEVELS[level].draws.join("/")} inventories (limit ${OUTSIDE_KANJI * 100}%): ${profile.list.slice(0, 40).join(" ")}`);
  }
  return problems;
}

// A set against its plan (tools/plan-level-set.mjs): the theme, every key
// where the plan put it, and every target taken from that 問題's candidates.
export function validatePlan(set, plan) {
  const problems = [];
  if (set.id !== plan.id || set.theme !== plan.theme) problems.push(`id and theme must be the plan's: ${plan.id}, ${plan.theme}`);
  (set.questions || []).forEach((q, i) => {
    if (q.key !== plan.keys[i]) problems.push(`#${i + 1}: the plan puts the right answer at ${plan.keys[i]}, not ${q.key}`);
    const pool = plan.pools[q.skill + " 問題" + q.mondai];
    if (q.target && pool && !pool.some(t => JSON.stringify(t) === JSON.stringify(q.target))) problems.push(`#${i + 1}: target ${JSON.stringify(q.target)} is not one of the plan's candidates for ${q.skill} 問題${q.mondai}`);
  });
  return problems;
}

if (process.argv[1]?.endsWith("validate-level-set.mjs")) {
  const set = JSON.parse(readFileSync(process.argv[2], "utf8")), problems = validateLevelSet(set);
  if (process.argv.includes("--plan")) problems.push(...validatePlan(set, JSON.parse(readFileSync(process.argv[process.argv.indexOf("--plan") + 1], "utf8"))));
  console.log(problems.length ? problems.join("\n") : "OK");
  if (process.argv.includes("--profile") && SET_LEVELS[set.level]) { const p = levelProfile(set); console.log(`kanji outside ${set.level} and below: ${p.outside} of ${p.kanji} (${(p.share * 100).toFixed(1)}%) ${p.list.join(" ")}`); }
  process.exit(problems.length ? 1 : 0);
}
