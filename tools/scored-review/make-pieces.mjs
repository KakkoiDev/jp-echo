// What Quick round asks whole, for an auditor looking for compounds not yet
// taken apart:  node tools/scored-review/make-pieces.mjs → tools/scored-review/pieces-data.json
// Generated: never edit the output. docs/PIECES-AUDIT-HANDOFF.md is the brief.
import {readFileSync, writeFileSync} from "node:fs";
import {CONNECTIVES} from "../../n2-connectives.js";
import {LINK_PARTS, LINK_SHOWN, WORD_PIECES} from "../../n2-game-review.js";
import {pieceKey} from "../../n2-game.js";
const root = new URL("../../", import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const inv = read("n2-inventory.json"), words = read("decks/n2-words.json").sentences, gram = read("decks/n2-grammar.json").sentences, blocks = read("n2-grammar-blocks.json");
const shape = p => ({parts: p.parts.map(([text, gloss]) => ({text, gloss})), literal: p.literal});
const dissected = [
  ...Object.entries(LINK_PARTS).map(([word, p]) => ({kind: "connective", word: LINK_SHOWN[word] || word, ...shape(p)})),
  ...Object.entries(WORD_PIECES).map(([word, p]) => ({kind: "word or pattern", word, ...shape(p)})),
  ...Object.entries(blocks.patterns).filter(([, p]) => p.parts.length > 1).map(([key, p]) => ({kind: "grammar pattern", word: inv.grammar.find(g => g[0] === key)[1],
    parts: p.parts.map(x => ({text: x.text, gloss: x.gloss || blocks.blocks[x.block]?.gloss || ""})), literal: p.literal || ""})),
];
const done = new Set(dissected.map(d => pieceKey(d.word)));
const whole = [
  ...CONNECTIVES.filter(([w]) => !LINK_PARTS[w]).map(([w, , meaning]) => ({kind: "connective", word: w, meaning})),
  ...inv.grammar.map(([key, name, meaning], i) => ({key, name, meaning, i})).filter(g => blocks.patterns[g.key]?.parts.length === 1 && !done.has(pieceKey(g.name)))
    .map(g => ({kind: "grammar pattern", word: g.name, meaning: g.meaning, sentence: gram[g.i]?.target || ""})),
  ...inv.words.map(([text, reading, meaning], i) => ({text, reading, meaning, i})).filter(w => !/[〜～]/.test(w.text) && !done.has(pieceKey(w.text)))
    .map(w => ({kind: "word", word: w.text, reading: w.reading, meaning: w.meaning, sentence: words[w.i]?.target || ""})),
];
writeFileSync(new URL("tools/scored-review/pieces-data.json", root), JSON.stringify({generated: new Date().toISOString().slice(0, 10), counts: {dissected: dissected.length, whole: whole.length}, dissected, whole}, null, 1) + "\n");
console.log({dissected: dissected.length, whole: whole.length, byKind: whole.reduce((m, w) => (m[w.kind] = (m[w.kind] || 0) + 1, m), {})});
