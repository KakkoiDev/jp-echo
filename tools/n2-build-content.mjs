// Assembles authored N2 content into shipped files.
// Usage: node tools/n2-build-content.mjs <dir with deck/*.json and sets/*.json>
//   deck/grammar.json, deck/words-*.json → decks/n2-grammar.json, decks/n2-words.json
//   sets/n2-set-N.json                  → n2-sets/n2-set-N.json + n2-sets/index.json
import {readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync} from "node:fs";
import {validateDeckBatch} from "./n2-validate-deck.mjs";
import {validateSet} from "./n2-validate-set.mjs";
const dir = process.argv[2];
const root = new URL("../", import.meta.url);
const read = p => JSON.parse(readFileSync(p, "utf8"));
const fail = (what, problems) => { if (problems.length) { console.error(what + ":\n" + problems.slice(0, 20).join("\n")); process.exit(1); } };
const sentence = r => ({id: r.id, sourceLang: "en", targetLang: "ja", source: r.source.trim(), target: r.target.trim()});

if (existsSync(dir + "/deck/grammar.json")) {
  const rows = read(dir + "/deck/grammar.json"); fail("grammar deck", validateDeckBatch(rows));
  writeFileSync(new URL("decks/n2-grammar.json", root), JSON.stringify({schemaVersion: 2, title: "JLPT N2 grammar — one sentence per point",
    description: "221 N2 grammar points, each in one natural example sentence with readings. Made for Echo's N2 study.", sentences: rows.map(sentence)}, null, 1) + "\n");
  console.log("decks/n2-grammar.json", rows.length);
}
const wordFiles = existsSync(dir + "/deck") ? readdirSync(dir + "/deck").filter(f => /^words-\d+\.json$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6))) : [];
if (wordFiles.length) {
  const rows = wordFiles.flatMap(f => read(dir + "/deck/" + f));
  fail("word deck", validateDeckBatch(rows));
  const targets = new Set(); const dupes = rows.filter(r => targets.size === targets.add(r.target).size);
  fail("word deck duplicates", dupes.map(r => r.id + " repeats a sentence"));
  writeFileSync(new URL("decks/n2-words.json", root), JSON.stringify({schemaVersion: 2, title: "JLPT N2 vocabulary — one sentence per word",
    description: "N2 words (JMdict common and JLPT lists), each in one natural example sentence with readings. Made for Echo's N2 study.", sentences: rows.map(sentence)}, null, 1) + "\n");
  console.log("decks/n2-words.json", rows.length, "from", wordFiles.length, "files");
}
if (existsSync(dir + "/sets")) {
  mkdirSync(new URL("n2-sets/", root), {recursive: true});
  const index = existsSync(new URL("n2-sets/index.json", root)) ? read(new URL("n2-sets/index.json", root)) : {};
  for (const f of readdirSync(dir + "/sets").filter(f => /^n2-set-\d+\.json$/.test(f))) {
    const set = read(dir + "/sets/" + f);
    // Lettered choices (Ａ…Ｄ) read in order, as on the paper; the key follows.
    for (const q of set.questions) {
      const lead = q.choices.map(c => c.trim()[0]);
      if (lead.every(l => /[ＡＢＣＤ]/.test(l)) && new Set(lead).size === q.choices.length) {
        const right = q.choices[q.key - 1];
        q.choices = [...q.choices].sort((a, b) => a.trim()[0].localeCompare(b.trim()[0]));
        q.key = q.choices.indexOf(right) + 1;
      }
    }
    const problems = validateSet(set);
    if (problems.length) { console.error("skip " + f + ": " + problems.length + " problems, e.g. " + problems[0]); continue; }
    writeFileSync(new URL("n2-sets/" + f, root), JSON.stringify(set) + "\n");
    index[set.id] = set.theme;
    console.log("n2-sets/" + f, set.questions.length);
  }
  const ordered = Object.fromEntries(Object.entries(index).sort((a, b) => parseInt(a[0].slice(7)) - parseInt(b[0].slice(7))));
  writeFileSync(new URL("n2-sets/index.json", root), JSON.stringify(ordered, null, 1) + "\n");
}
