// Validates one realistic N2 mock set against the blueprint (n2-forms.js BLUEPRINT).
// Usage: node tools/n2-validate-set.mjs path/to/n2-set-N.json   (exit 1 on problems)
import {readFileSync} from "node:fs";
import {BLUEPRINT} from "../n2-forms.js";
const inv = JSON.parse(readFileSync(new URL("../n2-inventory.json", import.meta.url), "utf8"));
export function validateSet(set) {
  const problems = [];
  const words = new Set(inv.words.map(w => JSON.stringify(["word", w[0], w[1]])));
  const grammar = new Set(inv.grammar.map(g => JSON.stringify(["grammar", g[0]])));
  if (!/^n2-set-\d+$/.test(set.id || "")) problems.push("id must be n2-set-<N>");
  if (!set.theme) problems.push("missing theme");
  const qs = set.questions || [];
  const expected = BLUEPRINT.flatMap(b => Array(b.count).fill(b));
  if (qs.length !== expected.length) problems.push(`expected ${expected.length} questions, got ${qs.length}`);
  const seenTargets = new Set(), keys = [0, 0, 0, 0];
  qs.forEach((q, i) => {
    const b = expected[i], at = `#${i + 1}`;
    if (!b) return;
    if (q.skill !== b.skill || q.mondai !== b.mondai) problems.push(`${at}: expected ${b.skill} 問題${b.mondai} (${b.kind}), got ${q.skill} 問題${q.mondai}`);
    const n = b.options;
    if (!Array.isArray(q.choices) || q.choices.length !== n || q.choices.some(c => typeof c !== "string" || !c.trim())) problems.push(`${at}: needs ${n} non-empty choices`);
    else if (new Set(q.choices).size !== n) problems.push(`${at}: duplicate choices`);
    if (!Number.isInteger(q.key) || q.key < 1 || q.key > n) problems.push(`${at}: key must be 1..${n}`); else keys[q.key - 1]++;
    if (!q.prompt?.trim()) problems.push(`${at}: empty prompt`);
    if (!q.why?.trim()) problems.push(`${at}: empty why`);
    if (typeof q.context !== "string") problems.push(`${at}: context must be a string`);
    if (b.needsContext && !q.context?.trim()) problems.push(`${at}: ${b.kind} needs a context`);
    if (b.skill === "Listening" && q.context && !/^[^\n：]{1,6}：/m.test(q.context)) problems.push(`${at}: listening script lines need speaker labels like 女：`);
    if (b.targeted) {
      const t = JSON.stringify(q.target);
      if (!words.has(t) && !grammar.has(t)) problems.push(`${at}: target ${t} is not in n2-inventory.json`);
      else if (seenTargets.has(t)) problems.push(`${at}: target ${t} used twice`);
      seenTargets.add(t);
      const want = b.mondai === 1 && b.skill === "Vocabulary" ? "reading" : "meaning";
      if (q.dimension !== want) problems.push(`${at}: dimension must be "${want}"`);
      if (b.skill === "Vocabulary" && b.mondai === 1 && q.target?.[0] === "word") {
        if (q.choices?.[q.key - 1] !== q.target[2]) problems.push(`${at}: 漢字読み key must be the reading ${q.target[2]}`);
        if (!q.prompt.includes("【" + q.target[1] + "】")) problems.push(`${at}: prompt must contain 【${q.target[1]}】`);
      }
      if (b.skill === "Vocabulary" && b.mondai === 2 && q.target?.[0] === "word" && q.choices?.[q.key - 1] !== q.target[1]) problems.push(`${at}: 表記 key must be the spelling ${q.target[1]}`);
    }
    if (b.skill === "Grammar" && b.mondai === 8 && !q.prompt.includes("★")) problems.push(`${at}: 文の組み立て prompt needs ★`);
  });
  if (qs.length === expected.length && Math.min(...keys) < 15) problems.push(`keys are unbalanced: ${keys.join("/")}`);
  return problems;
}
if (process.argv[1]?.endsWith("n2-validate-set.mjs")) {
  const problems = validateSet(JSON.parse(readFileSync(process.argv[2], "utf8")));
  console.log(problems.length ? problems.join("\n") : "OK");
  process.exit(problems.length ? 1 : 0);
}
