// Plans new papers for a level from its inventories, so a hundred papers can
// be written without two of them asking the same thing.
// Usage: node tools/plan-level-set.mjs <level> <boss|mini> <from>-<to> <outdir> [--done <dir with finished sets>]
//   → <outdir>/<id>.plan.json and <outdir>/<id>.brief.md, one pair per paper
//
// A plan fixes what a machine can fix better than a writer: which words and
// grammar points a paper may test (the least used so far come first, and no
// two papers planned together share a candidate until the inventory runs
// out), the theme, the scenes already taken, and where each right answer
// sits (balanced and shuffled, so position tells a guesser nothing). The
// writer chooses among the candidates and writes the questions; the audit
// (docs/JLPT-LEVEL-SETS.md) decides whether they are right.
// `node tools/validate-level-set.mjs <set> --plan <plan>` holds a set to its plan.
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync} from "node:fs";
import {SET_LEVELS, blueprintOf, expectedRows, groupsOf} from "../jlpt-sets.js";

const root = new URL("../", import.meta.url), read = p => JSON.parse(readFileSync(p, "utf8"));
const inventory = level => (level === "N2" ? read(new URL("n2-inventory.json", root)) : read(new URL("levels/" + read(new URL("levels/manifest.json", root)).version + "/" + level.toLowerCase() + ".json", root)));
// A small seeded generator: the same plan comes out for the same paper id.
const seeded = text => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; }; };
const shuffle = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Scenes for a paper to live in. A paper takes one; about a third of its texts use it.
export const THEMES = ["駅と電車", "スーパーでの買い物", "学校の一日", "アルバイト", "家族と週末", "友だちとの約束", "病院と薬", "天気と季節", "料理と台所", "図書館", "郵便局と荷物", "旅行の計画", "誕生日とプレゼント", "引っ越し", "趣味とスポーツ", "動物とペット", "公園と散歩", "会社の一日", "レストランとカフェ", "映画と音楽",
  "日本語の教室", "夏休み", "祭りと行事", "バスと道案内", "部屋の片付け", "ごみとリサイクル", "山と海", "写真とカメラ", "自転車", "朝の習慣", "電話とメール", "買い物の失敗", "忘れ物と落とし物", "健康と運動", "雨の日", "市役所の手続き", "美術館と博物館", "ボランティア", "近所の人", "古い町と新しい町",
  "留学生の生活", "お正月", "花と庭", "温泉と旅館", "本と読書", "大学のサークル", "面接と仕事探し", "地震と防災", "農家と野菜", "商店街", "空港と飛行機", "寮の生活", "料理教室", "子どもの習い事", "ホテルの予約", "インターネットと買い物", "環境とエネルギー", "働き方", "言葉と文化", "科学と技術"];
// Scenes worn out or too close to published items (docs/JLPT-LEVEL-SETS.md).
const STOCK = ["a note to a child about dinner, a parcel and the laundry", "a newcomer who learns to greet the neighbours", "待った？ answered with 今来たところ", "asking where the post office is", "offering to carry a friend's heavy bag", "where to put a box or parcel", "walking from one station early to look at the shops"];

const [level, form, range, outdir] = process.argv.slice(2), doneDir = process.argv.includes("--done") ? process.argv[process.argv.indexOf("--done") + 1] : "";
if (!SET_LEVELS[level] || !["boss", "mini"].includes(form) || !/^\d+-\d+$/.test(range || "") || !outdir) { console.error("usage: node tools/plan-level-set.mjs <N5|N4|N3|N1> <boss|mini> <from>-<to> <outdir> [--done <dir>]"); process.exit(1); }
mkdirSync(outdir, {recursive: true});
const draws = SET_LEVELS[level].draws, prefix = level.toLowerCase() + (form === "mini" ? "-mini-" : "-set-");
// What has been asked so far: shipped sets, finished sets not yet shipped, and plans already made here.
const used = new Map(), themes = new Set(), count = t => used.set(t, (used.get(t) || 0) + 1);
const home = new URL("sets/" + level.toLowerCase() + "/", root);
const sources = [];
if (existsSync(new URL("index.json", home))) { const index = read(new URL("index.json", home)); for (const id of Object.keys(index.sets)) sources.push(new URL(index.edition + "/" + id + ".json", home)); }
if (doneDir && existsSync(doneDir)) for (const f of readdirSync(doneDir).filter(f => new RegExp("^" + level.toLowerCase() + "-(set|mini)-\\d+\\.json$").test(f))) sources.push(doneDir + "/" + f);
for (const src of sources) { const set = read(src); themes.add(set.theme); for (const q of set.questions) if (q.target) count(JSON.stringify(q.target)); }
for (const f of readdirSync(outdir).filter(f => f.startsWith(level.toLowerCase() + "-") && f.endsWith(".plan.json"))) { const plan = read(outdir + "/" + f); themes.add(plan.theme); for (const pool of Object.values(plan.pools)) for (const t of pool) used.set(JSON.stringify(t), (used.get(JSON.stringify(t)) || 0) + 0.34); }

const words = [], grammar = [];
for (const from of draws) { const inv = inventory(from); for (const w of inv.words) words.push({t: ["word", w[0], w[1]], gloss: w[2] || "", from, kanji: /[㐀-鿿]/.test(w[0])}); for (const g of inv.grammar) grammar.push({t: ["grammar", g[0]], gloss: [g[1], g[2]].filter(Boolean).join(" — "), from}); }
const seenKey = new Set(), unique = list => list.filter(x => { const k = JSON.stringify(x.t); if (seenKey.has(k)) return false; seenKey.add(k); return true; });
const allWords = unique(words), allGrammar = unique(grammar);

const [first, last] = range.split("-").map(Number);
for (let n = first; n <= last; n++) {
  const id = prefix + n, random = seeded(id), taken = new Set();
  // Least used first, the level's own items for about four picks in five.
  const pick = (list, want, filter = () => true) => {
    const order = shuffle(list.filter(x => filter(x) && !taken.has(JSON.stringify(x.t))), random).sort((a, b) => (used.get(JSON.stringify(a.t)) || 0) - (used.get(JSON.stringify(b.t)) || 0));
    const own = order.filter(x => x.from === level), lower = order.filter(x => x.from !== level), out = [];
    for (let i = 0; out.length < want && (own.length || lower.length); i++) { const x = (i % 5 === 4 && lower.length ? lower : own.length ? own : lower).shift(); out.push(x); taken.add(JSON.stringify(x.t)); used.set(JSON.stringify(x.t), (used.get(JSON.stringify(x.t)) || 0) + 0.34); }
    return out;
  };
  const pools = {}, glosses = {};
  for (const b of blueprintOf(level, form).filter(b => b.targeted)) {
    const list = b.skill === "Grammar" ? allGrammar : allWords, needsKanji = b.targeted === "reading" || b.targeted === "spelling";
    const got = pick(list, b.count * 3, x => !needsKanji || x.kanji);
    pools[b.skill + " 問題" + b.mondai] = got.map(x => x.t); for (const x of got) glosses[JSON.stringify(x.t)] = x.gloss + (x.from === level ? "" : " (" + x.from + ")");
  }
  // Where the right answer sits: each position equally often, in shuffled order, per number of choices.
  const rows = expectedRows(level, form), keys = Array(rows.length).fill(0);
  for (const options of [3, 4]) { const at = rows.map((b, i) => (b.options === options ? i : -1)).filter(i => i >= 0); const bag = shuffle(at.map((_, i) => i % options + 1), random); at.forEach((i, k) => { keys[i] = bag[k]; }); }
  const free = THEMES.filter(t => !themes.has(t)), theme = (free.length ? free : THEMES)[Math.floor(random() * (free.length || THEMES.length))]; themes.add(theme);
  const plan = {id, level, form, theme, questions: rows.length, keys, pools, avoid: [...STOCK, ...[...themes].filter(t => t !== theme).map(t => "the theme of another paper: " + t)]};
  writeFileSync(outdir + "/" + id + ".plan.json", JSON.stringify(plan, null, 1) + "\n");
  // The writer's brief: the common rules, then this paper.
  const layout = blueprintOf(level, form).map(b => `- ${b.skill} 問題${b.mondai} ${b.kind}: ${b.count} question${b.count > 1 ? "s" : ""}, ${b.options} choices` + (b.needsContext ? `, context ${b.chars[0]}–${b.chars[1]} characters` + (groupsOf(b).some(g => g > 1) ? `, groups of ${groupsOf(b).join(" + ")} sharing one context` : ", one context each") : "")).join("\n");
  let n0 = 0; const keyLines = blueprintOf(level, form).map(b => { const line = `- ${b.skill} 問題${b.mondai}: ${keys.slice(n0, n0 + b.count).join(" ")}`; n0 += b.count; return line; }).join("\n");
  const poolLines = Object.entries(pools).map(([where, pool]) => `### ${where} — choose ${blueprintOf(level, form).find(b => b.skill + " 問題" + b.mondai === where).count} of these ${pool.length}\n` + pool.map(t => "- `" + JSON.stringify(t) + "` " + glosses[JSON.stringify(t)]).join("\n")).join("\n\n");
  const common = readFileSync(new URL("level-set-brief.md", import.meta.url), "utf8").replaceAll("{LEVEL}", level).replaceAll("{DRAWS}", draws.join(", "));
  writeFileSync(outdir + "/" + id + ".brief.md", `${common}\n\n# This paper: ${id}\n\n- id \`${id}\`, level \`${level}\`, theme \`${theme}\` (colours about a third of the texts; the rest vary)\n- ${rows.length} questions in this order:\n${layout}\n\n## Where each right answer goes (the \`key\` of every question, in order; required)\n${keyLines}\n\n## Targets: choose only from these candidates, each at most once\nCopy the target exactly. Pick the ones that make the best questions; a candidate that cannot make a fair question is simply not chosen.\n\n${poolLines}\n\n## Do not use\n${plan.avoid.map(a => "- " + a).join("\n")}\n`);
  console.log(id, theme, rows.length, "questions");
}
