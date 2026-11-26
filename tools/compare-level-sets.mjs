// Finds questions that are too alike across the papers of one level: the same
// scene, the same line to answer, the same sentence. Two writers working
// apart reach for the same stock scenes, most of all at N5 and in the short
// spoken items, and a player who meets the same question in two bosses is
// being tested on memory.
// Usage: node tools/compare-level-sets.mjs <dir with sets of one level> [--level N5] [--limit 0.5]
//   prints the pairs above the limit, most alike first; exit 1 when there are any.
import {readFileSync, readdirSync} from "node:fs";

const grams = text => { const t = String(text).replace(/[\s、。，．,.!?！？「」『』（）()・…〜~：:＿★男女１２３４５]/g, ""), out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
// Share of the smaller text's character pairs found in the other: 1 is the same text.
export const likeness = (a, b) => { const x = grams(a), y = grams(b); if (x.size < 4 || y.size < 4) return 0; let both = 0; for (const g of x) if (y.has(g)) both++; return both / Math.min(x.size, y.size); };
// What a question is "about": its own sentence for the short kinds, its passage for the others.
// The fixed wording of the paper (何と言いますか) is left out, and a question with no context is its sentence and choices together.
const body = q => (q.context ? q.context.replace(/何と言いますか。?/g, "") : q.prompt + " " + (q.choices || []).join(" "));
export const LIMIT = 0.62;
export function alike(sets, limit = LIMIT) {
  const items = [];
  for (const set of sets) { const seen = new Set(); set.questions.forEach((q, i) => { const text = body(q); if (seen.has(text)) return; seen.add(text); items.push({set: set.id, n: i + 1, kind: q.skill + q.mondai, text}); }); }
  const pairs = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]; if (a.set === b.set || a.kind !== b.kind) continue;
    const score = likeness(a.text, b.text); if (score >= limit) pairs.push({score, a, b});
  }
  return pairs.sort((p, q) => q.score - p.score);
}
if (process.argv[1]?.endsWith("compare-level-sets.mjs")) {
  const dir = process.argv[2], arg = name => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : "");
  const level = arg("--level").toLowerCase(), limit = Number(arg("--limit")) || LIMIT;
  const sets = readdirSync(dir).filter(f => /^n[1-5]-(set|mini)-\d+\.json$/.test(f) && (!level || f.startsWith(level))).map(f => JSON.parse(readFileSync(dir + "/" + f, "utf8")));
  const pairs = alike(sets, limit);
  for (const p of pairs) console.log(`${p.score.toFixed(2)} ${p.a.set}#${p.a.n} ~ ${p.b.set}#${p.b.n}  ${p.a.text.replace(/\n/g, " ").slice(0, 50)} | ${p.b.text.replace(/\n/g, " ").slice(0, 50)}`);
  console.log(pairs.length + " pairs at or above " + limit + " in " + sets.length + " sets");
  process.exit(pairs.length ? 1 : 0);
}
