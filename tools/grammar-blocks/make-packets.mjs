import {readFileSync, mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {randomInt} from "node:crypto";
import {inventory, validateGrammarBlocks} from "../validate-grammar-blocks.mjs";
import {sameSense, shuffle} from "../../n2-game.js";
import {GLOSS_FIX} from "../../n2-game-review.js";

const [source, destination, firstRound] = process.argv.slice(2);
if (!source || !destination) {
  console.error("Usage: node tools/grammar-blocks/make-packets.mjs <index.json> <private folder> [first-round-answers.json]");
  process.exit(1);
}

const read = path => JSON.parse(readFileSync(path, "utf8"));
const index = read(source);
const {errors} = validateGrammarBlocks(index, {draft: true});
if (errors.length) throw new Error(errors.join("\n"));
const deck = read(new URL("../../decks/n2-grammar.json", import.meta.url));
const example = new Map(deck.sentences.map(s => [s.id, s.target]));
const rows = inventory.grammar.flatMap(([key, , meaning], i) => {
  const p = index.patterns[key];
  if (!p) return [];
  return [{key, p, answer: GLOSS_FIX["g:" + key] || meaning, ids: new Set(p.parts.map(part => part.block).filter(Boolean)),
    ja: example.get("n2-grammar-" + i)}];
});
const write = (name, value) => writeFileSync(join(destination, name), JSON.stringify(value, null, 2) + "\n");
mkdirSync(destination, {recursive: true});
if (firstRound) {
  const packet = read(join(destination, "blocks-only.json"));
  const ledger = read(join(destination, "private-key.json"));
  const responses = read(firstRound);
  if (!Array.isArray(responses) || responses.length !== packet.length) throw new Error("Expected one first-round response per item");
  const byNumber = new Map(responses.map(({number, choice}) => [number, choice]));
  if (packet.some(({number}) => ![1, 2, 3, 4].includes(byNumber.get(number)))) throw new Error("Every first-round response must give its item number and a choice from 1 to 4");
  const second = packet.filter(({number}) => byNumber.get(number) !== ledger[number].choice)
    .map(item => ({...item, sentence: ledger[item.number].sentence}));
  write("blocks-and-sentence.json", second);
  console.log(second.length + " items in the second packet.");
} else {
  const packet = [], ledger = {}, deferred = [];
  const random = () => randomInt(2 ** 30) / 2 ** 30;
  for (const row of shuffle(rows, random)) {
    if (row.p.transparency !== "pending") continue;
    const peers = rows.filter(other => other.key !== row.key && !sameSense(row.answer, other.answer)
      && [...other.ids].some(id => row.ids.has(id)));
    const wrong = [];
    for (const peer of shuffle(peers, random)) {
      if (!wrong.some(answer => sameSense(answer, peer.answer))) wrong.push(peer.answer);
      if (wrong.length === 3) break;
    }
    if (wrong.length < 3 || !row.ja) {
      deferred.push({key: row.key, choices: wrong.length, sentence: Boolean(row.ja)});
      continue;
    }
    const meanings = shuffle([row.answer, ...wrong], random), number = packet.length + 1;
    packet.push({number, parts: row.p.parts.map(part => ({text: part.text, gloss: index.blocks[part.block]?.gloss || ""})), meanings});
    ledger[number] = {key: row.key, choice: meanings.indexOf(row.answer) + 1, sentence: row.ja};
  }
  write("blocks-only.json", packet);
  write("private-key.json", ledger);
  write("deferred.json", deferred);
  console.log(packet.length + " items in the first packet, " + deferred.length + " deferred.");
}
