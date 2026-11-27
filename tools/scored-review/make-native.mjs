// Everything the game asks that an AI wrote, gathered for a native reader:
//   node tools/scored-review/make-native.mjs → tools/scored-review/native-review-data.json
// Generated: never edit the output. docs/NATIVE-REVIEW-HANDOFF.md is the brief.
import {readFileSync, writeFileSync} from "node:fs";
import {WORD_PIECES, LINK_PARTS, LINK_SHOWN, LINK_WHY, AFFIX_GLOSS, LIST_LABEL} from "../../n2-game-review.js";
import {CONNECTIVES, JOBS} from "../../n2-connectives.js";
const root = new URL("../../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const inv = read("n2-inventory.json"), deck = read("decks/n2-words.json").sentences;
const ids = Object.keys(read("n2-sets/index.json")), sets = Object.fromEntries(ids.map(id => [id, read("n2-sets/" + id + ".json").questions]));
const gapInput = read("tools/content/gap-input.json"), gapWrong = read("n2-gap-wrong.json").wrong;
const out = {
  generated: new Date().toISOString().slice(0, 10),
  // A. Written whole for Echo: the sentence and every choice.
  paraphrase: read("n2-paraphrase.json").items,
  pairs: read("n2-pairs.json").items,
  ordering: read("n2-ordering.json").items,
  gapWrong: Object.entries(gapWrong).map(([key, wrong]) => ({key, sentence: gapInput[key].sentence, answer: gapInput[key].answer, wrong, english: gapInput[key].english})),
  // B. Word parts the list lacked, and the meanings given to the list's parts.
  addedParts: inv.words.slice(1748).map(([word, reading, meaning], i) => ({word, reading, meaning, sentence: deck[1748 + i].target, english: deck[1748 + i].source})),
  partMeanings: AFFIX_GLOSS,
  listLabels: LIST_LABEL,
  // C. Pieces: how words, patterns and connectives are taken apart.
  connectives: CONNECTIVES.map(([word, job, meaning]) => ({word: LINK_SHOWN[word] || word, meaning, after: LINK_WHY[word] || JOBS[job], pieces: LINK_PARTS[word] || null})),
  wordPieces: {...WORD_PIECES, ...read("n2-word-pieces.json").pieces},
  // D. Translations shown under the papers' sentences, and the papers' deciding lines.
  examEnglish: Object.entries(read("n2-sets/en.json").en).map(([key, en]) => {
    const [set, i] = key.split("#"), q = sets[set][i]; return {key, question: q.prompt, answer: q.choices[q.key - 1], en}; }),
  decidingLines: Object.entries(read("n2-sets/keys.json").keys).map(([key, k]) => ({key, lines: k.lines, en: k.en})),
};
writeFileSync(new URL("tools/scored-review/native-review-data.json", root), JSON.stringify(out, null, 1) + "\n");
console.log(Object.fromEntries(Object.entries(out).filter(([k]) => k !== "generated").map(([k, v]) => [k, Array.isArray(v) ? v.length : Object.keys(v).length])));
