// The content Quick round scores without a reviewer having read it
// (SCORE_ALL, n2-game-review.js), gathered into one file for a reviewer:
//   node tools/scored-review/make-review.mjs   → tools/scored-review/review-data.json
// Generated: never edit the output. docs/SCORED-CONTENT-REVIEW-HANDOFF.md says how to read it.
import {readFileSync, writeFileSync} from "node:fs";
import {gamePool, choicesFor} from "../../n2-game.js";
import {examplesFromDecks} from "../../day-radio.js";

const root = new URL("../../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const inventory = read("n2-inventory.json"), words = read("decks/n2-words.json"), grammar = read("decks/n2-grammar.json");
const examples = examplesFromDecks(inventory, [words, grammar]);
const ids = Object.keys(read("n2-sets/index.json")), sets = ids.map(id => read("n2-sets/" + id + ".json"));
const pool = gamePool({inventory, examples, sets, sat: new Set(ids), grammarBlocks: read("n2-grammar-blocks.json"), excerpts: true});
const plain = s => String(s || "").replace(/【[^】]*】/g, "");

// A. Word parts: every entry of the list written with ～, with its card or the reason it has none.
const cards = new Map(pool.filter(q => q.kind === "affix").map(q => [q.target[1] + "/" + q.target[2], q]));
const parts = inventory.words.map(([text, reading, meaning], i) => ({text, reading, meaning, i})).filter(w => /[〜～]/.test(w.text)).map(w => {
  const q = cards.get(w.text + "/" + w.reading), s = words.sentences[w.i];
  return {id: q?.id || null, text: w.text, reading: w.reading, meaning: w.meaning, sentence: s.target, sentenceEn: s.source,
    ...(q ? {underlined: q.needle, answer: q.answer, side: q.side, wrongChoices: q.wrong.length, sameSideWrong: q.near.slice(0, 8)} : {noCard: "the part is not written exactly once in the sentence, or the entry is not a clean prefix or suffix"})};
});

// B. Connectives: every card as it is asked, with all the wrong choices it can draw.
// Out of the rounds since 27 Nov (the connective is asked on its own); kept here in case they return.
const links = pool.filter(q => q.kind === "link").map(q => ({id: q.id, word: q.prompt, answer: q.answer, job: q.job, shownAfterAnswer: q.solution.why, wrong: q.wrong}));
const connectives = pool.filter(q => q.kind === "connective").map(q => ({id: q.id, excerpt: q.sentence, answer: q.answer, wrong: q.wrong, shownAfterAnswer: q.solution?.meaning || "", source: q.solution?.source || q.id.slice(2).split("@")[0]}));

// C. Grammar pieces: what the first review left open.
const ledger = read("tools/grammar-blocks/reviews/2026-11-27-applied.json");
const rows = Array.isArray(ledger) ? ledger : ledger.findings || ledger.entries || [];
const open = rows.filter(r => /not|part/i.test(String(r.status || r.applied || r.result || "")));

// D. Deciding lines of reading and listening questions (the boss review shows them).
const lines = Object.fromEntries(ids.flatMap(id => { let draft; try { draft = read("tools/boss-keys/" + id + ".json"); } catch { return []; }
  const set = sets.find(s => s.id === id);
  return Object.entries(draft).map(([i, e]) => [id + "#" + i, {skill: set.questions[i].skill, mondai: set.questions[i].mondai, context: set.questions[i].context, question: set.questions[i].prompt, choices: set.questions[i].choices, key: set.questions[i].key, why: set.questions[i].why, ...e}]); }));

// E. The other levels: the lists themselves, and a fixed sample of the cards made from them.
const manifest = read("levels/manifest.json"), levels = {};
for (const level of ["N5", "N4", "N3", "N1"]) {
  const file = "levels/" + manifest.version + "/" + level.toLowerCase() + ".json", inv = read(file);
  const p = gamePool({inventory: {words: inv.words, grammar: []}, level});
  const sample = p.filter((_, i) => i % Math.ceil(p.length / 120) === 0).map(q => ({id: q.id, kind: q.kind, prompt: q.prompt, answer: q.answer, wrong: q.wrong.slice(0, 6)}));
  levels[level] = {file, words: inv.words.length, cards: p.length, byKind: p.reduce((a, q) => (a[q.kind] = (a[q.kind] || 0) + 1, a), {}), sample};
}

// F. Gap cards (27 Nov): a sentence with a gap, the form to pick; the sentence's English is shown under it.
const gaps = pool.filter(q => q.kind === "gap" || q.kind === "partgap").map(q => ({id: q.id, kind: q.kind, sentence: q.sentence, shownEnglish: q.en, answer: q.answer, likelyWrong: (q.near || []).slice(0, 12), wrongChoices: q.wrong.length}));
const out = {gaps, links, generated: new Date().toISOString().slice(0, 10), counts: {parts: parts.length, partCards: parts.filter(p => p.id).length, connectives: connectives.length, grammarOpen: open.length, lines: Object.keys(lines).length},
  parts, connectives, grammarOpen: open, lines, levels};
writeFileSync(new URL("tools/scored-review/review-data.json", root), JSON.stringify(out, null, 1) + "\n");
console.log(out.counts, Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, v.cards + " cards, sample " + v.sample.length])));
