// score.mjs <set.json> <answers.json>: a blind solve against the key. answers = [{n, answer, confidence, note}]
import {readFileSync} from "node:fs";
const set = JSON.parse(readFileSync(process.argv[2], "utf8")), ans = JSON.parse(readFileSync(process.argv[3], "utf8"));
let agree = 0; const off = [];
for (const a of ans) { const q = set.questions[a.n - 1]; if (q && q.key === a.answer) agree++; else off.push(a); }
console.log(set.id + ": " + agree + " / " + set.questions.length + " agree (" + ans.length + " answered)");
for (const a of off) { const q = set.questions[a.n - 1]; console.log(`DISAGREE #${a.n} key ${q?.key} [${q?.choices[q.key - 1]}] solver ${a.answer} [${q?.choices[a.answer - 1]}] (${a.confidence}) ${a.note || ""}`); }
for (const a of ans) if (a.note && set.questions[a.n - 1]?.key === a.answer) console.log(`NOTE #${a.n} (${a.confidence}) ${a.note}`);
