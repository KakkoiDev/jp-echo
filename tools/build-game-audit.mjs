// Write audit/quick-round/: everything Quick round asks or plans to ask, as
// plain files another reviewer (human or AI) can check without running Echo.
// Built from the same code the game runs (n2-game.js), so what is audited is
// what is played. Usage: node tools/build-game-audit.mjs
import {readFileSync, writeFileSync, mkdirSync, rmSync} from "node:fs";
import {gamePool, nearMisses, gloss, SECONDS, KIND_LABEL} from "../n2-game.js";
import {examplesFromDecks} from "../day-radio.js";
import {recallItems} from "../n2-study.js";
import {HELD_OUT} from "../n2-comprehension.js";
import {READINGS} from "../kanji-readings.js";
import {CONNECTIVES, JOBS, connectiveSites} from "../n2-connectives.js";
import {EXCLUDED, ACCEPTED_READINGS, READING_KEY} from "../n2-game-review.js";

const repo = new URL("../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, repo), "utf8"));
const out = new URL("audit/quick-round/", repo);
const inventory = read("n2-inventory.json");
const decks = [read("decks/n2-words.json"), read("decks/n2-grammar.json")];
const examples = examplesFromDecks(inventory, decks);
const setIds = Object.keys(read("n2-sets/index.json"));
const sets = setIds.map(id => read("n2-sets/" + id + ".json"));
const playable = new Set(setIds.filter(id => !HELD_OUT.includes(id)));
const K = t => JSON.stringify(t);
const cell = v => String(v ?? "").replace(/[\t\r]/g, " ").replace(/\n/g, " ⏎ ");
const tsv = (head, rows) => [head.join("\t"), ...rows.map(r => r.map(cell).join("\t"))].join("\n") + "\n";
const plain = s => String(s || "").replace(/【[^】]*】/g, "");

rmSync(new URL("data/", out), {recursive: true, force: true});
rmSync(new URL("questions/", out), {recursive: true, force: true});
mkdirSync(new URL("data/", out), {recursive: true});
mkdirSync(new URL("questions/", out), {recursive: true});
const write = (name, text) => writeFileSync(new URL(name, out), text);

// ---- Questions, exactly as the game builds them (every set counted as sat,
// except the two held out, which the game never uses) ----
const pool = gamePool({inventory, examples, sets, sat: playable});
const byKind = new Map();
for (const q of pool) byKind.set(q.kind, [...(byKind.get(q.kind) || []), q]);
for (const [kind, list] of byKind) write("questions/" + kind + ".jsonl", list.map(q => JSON.stringify({
  id: q.id, kind, seconds: q.seconds, prompt: q.prompt, sentence: q.sentence || undefined, underline: q.needle || undefined, practice: q.practice || undefined, spoken: q.say || undefined,
  answer: q.answer, wrongCandidates: q.wrong, confusable: q.near?.length ? q.near : undefined, authoredChoices: q.fixed || undefined,
  saves: {dimension: q.dimension, target: q.target}, solution: q.solution,
})).join("\n") + "\n");

// ---- Vocabulary: every N2 word, its deck sentence, and the kinds it feeds ----
const items = recallItems(inventory), kindsOf = new Map();
for (const q of pool) if (q.target) kindsOf.set(K(q.target), [...new Set([...(kindsOf.get(K(q.target)) || []), q.kind])]);
write("data/vocabulary.tsv", tsv(["#", "word", "reading", "meaning (inventory)", "meaning (as shown)", "sentence (with readings)", "translation", "question kinds"],
  items.meaning.map((it, i) => { const ex = (examples.get(K(it.target)) || [])[0]; return [i, it.target[1], it.reading || it.target[2], it.answer, gloss(it.answer), ex?.ja, ex?.en, (kindsOf.get(K(it.target)) || []).join(" ")]; })));

// ---- Readings: every reading question's answer and all its near misses ----
write("data/readings.tsv", tsv(["word", "reading", "near misses the game may offer (accepted readings already removed; 3 picked at random)"],
  (byKind.get("reading") || []).map(q => [q.prompt, q.answer, q.wrong.join(" · ")])));

// ---- Grammar ----
write("data/grammar.tsv", tsv(["#", "pattern", "meaning", "sentence (with readings)", "translation"],
  items.grammar.map((it, i) => { const ex = (examples.get(K(it.target)) || [])[0]; return [i, it.prompt, it.answer, ex?.ja, ex?.en]; })));

// ---- Kanji: every kanji in the N2 words, with KANJIDIC readings and the
// N2 words that use it (the planned "kanji from parts" cards draw on this) ----
const kanjiWords = new Map();
for (const it of items.meaning) for (const k of new Set(it.target[1].match(/[一-鿿々]/g) || [])) kanjiWords.set(k, [...(kanjiWords.get(k) || []), it.target[1] + "（" + (it.reading || it.target[2]) + "）"]);
write("data/kanji.tsv", tsv(["kanji", "on", "kun", "meanings", "JLPT", "newspaper rank", "N2 words using it", "count"],
  [...kanjiWords].sort((a, b) => b[1].length - a[1].length).map(([k, words]) => { const r = READINGS[k] || {}; return [k, (r.on || []).join("・"), (r.kun || []).join("・"), (r.en || []).join(", "), r.jlpt, r.freq, words.join(" "), words.length]; })));

// ---- Connectives: exactly the excerpts the game asks (practice, not scored) ----
// The passage excerpts are out of the rounds (27 Nov); they are still listed here, built apart from the pool.
const conn = gamePool({inventory, examples, sets, sat: playable, excerpts: true}).filter(q => q.kind === "connective");
const counts = new Map(); for (const q of conn) counts.set(q.answer, (counts.get(q.answer) || 0) + 1);
write("data/connectives.tsv", tsv(["connective", "job", "gloss", "job explained", "questions in the game"], CONNECTIVES.map(([w, job, g]) => [w, job, g, JOBS[job], counts.get(w) || 0])));
write("data/connective-passages.tsv", tsv(["id", "answer", "job", "excerpt with the blank", "wrong choices the game may offer"], conn.map(q => [q.id, q.answer, q.solution.job, q.sentence, q.wrong.join(" · ")])));
const sites = conn;

// ---- Reviewed exceptions: items left out, readings accepted, keys changed ----
write("data/excluded.tsv", tsv(["id", "why it is left out of the game"], Object.entries(EXCLUDED)));
write("data/accepted-readings.tsv", tsv(["word", "readings never offered as wrong", "key used"], Object.keys({...ACCEPTED_READINGS, ...READING_KEY}).map(w => [w, (ACCEPTED_READINGS[w] || []).join("・"), READING_KEY[w] || ""])));

// ---- Authored exam questions the game can use (問題1–5 and 7, sets 02–18) ----
const exam = byKind.get("exam") || [];
write("data/exam-questions.tsv", tsv(["source", "問題", "prompt", "choice 1", "choice 2", "choice 3", "choice 4", "answer", "why"],
  exam.map(q => [q.solution.source, q.mondai, q.prompt, ...q.fixed, q.fixed.indexOf(q.answer) + 1, q.solution.why])));

// ---- Summary ----
const lines = [
  "# What is in this folder (generated)", "",
  "Built by `node tools/build-game-audit.mjs` from the code the game runs. Do not edit by hand: change the source and rebuild.", "",
  "## Questions the game can ask today", "",
  "| Kind | Label in the game | Seconds | Questions | File |", "| --- | --- | --- | --- | --- |",
  ...[...byKind].map(([k, l]) => `| ${k} | ${KIND_LABEL[k]} | ${k === "exam" ? "4–8" : SECONDS[k]} | ${l.length.toLocaleString("en")} | questions/${k}.jsonl |`),
  `| **all** | | | **${pool.length.toLocaleString("en")}** | |`, "",
  "Exam and connective questions count every set from 02 to 18 as sat. In the game, only sets the learner has sat are used; sets 19 and 20 are never used. Exam questions are written sections only (言語知識 問題1–5, 7); connective questions are practice and score nothing.", "",
  "## Source lists", "",
  `- data/vocabulary.tsv: ${items.meaning.length} N2 words with their deck sentence and the question kinds each feeds`,
  `- data/readings.tsv: ${(byKind.get("reading") || []).length} reading questions with every near miss`,
  `- data/grammar.tsv: ${items.grammar.length} N2 grammar patterns with their deck sentence`,
  `- data/kanji.tsv: ${kanjiWords.size} kanji used in the N2 words, with readings and the words using each`,
  `- data/connectives.tsv: ${CONNECTIVES.length} connectives with their job (planned connective cards)`,
  `- data/connective-passages.tsv: ${sites.length} connective excerpts as the game used to ask them (out of the rounds since 27 Nov; the connective is asked on its own)`,
  `- data/excluded.tsv: ${Object.keys(EXCLUDED).length} items left out of the game until fixed, with reasons`,
  `- data/accepted-readings.tsv: readings never offered as wrong, and keys changed to match what Echo teaches`,
  `- data/exam-questions.tsv: ${exam.length} authored short exam questions`, "",
];
write("SUMMARY.md", lines.join("\n"));
console.log(lines.slice(4, 16).join("\n"));
