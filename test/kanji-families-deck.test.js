import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateDeckBackup} from "../imports.js";
import {sentenceIdentity} from "../core.js";

const deck = JSON.parse(await readFile(new URL("../decks/kanji-families-core.json", import.meta.url), "utf8"));

test("kanji families deck imports as Echo version 2 sentences", () => {
  const imported = validateDeckBackup(deck);
  assert.equal(deck.schemaVersion, 2);
  assert.equal(deck.kanjiFamilies.length, 76);
  assert.equal(imported.sentences.length, 228);
  assert.equal(new Set(imported.sentences.map(s => s.id)).size, 228);
  assert.equal(new Set(imported.sentences.map(sentenceIdentity)).size, 228);
  assert.ok(imported.sentences.every(s => s.sourceLang === "en" && s.targetLang === "ja"));
  assert.ok(imported.sentences.every(s => s.source && s.target));
});

test("every parent has a radical, anchor sentence and linked derived words", () => {
  const index = new Map(deck.sentences.map(s => [s.id, s]));
  assert.equal(new Set(deck.kanjiFamilies.map(f => f.kanji)).size, 76);
  for (const family of deck.kanjiFamilies) {
    assert.match(family.kanji, /^[一-鿿]$/u);
    assert.ok(family.meaning && family.dictionaryRadical && family.dictionaryRadicalName);
    assert.equal(family.words.length, 3);
    assert.equal(family.words[0].role, "anchor");
    assert.equal(family.exampleSentenceId, family.words[0].exampleSentenceId);
    for (const [i, word] of family.words.entries()) {
      assert.equal(word.role, i ? "derived" : "anchor");
      assert.ok(word.term.includes(family.kanji));
      assert.ok(word.reading);
      const sentence = index.get(word.exampleSentenceId);
      assert.ok(sentence, `Missing example for ${family.kanji}: ${word.term}`);
      assert.ok(sentence.target.replace(/【[^】]*】/g, "").includes(family.kanji));
    }
  }
});
