// DECK-FORMAT.md is the contract handed to people and AI agents. These tests
// hold the page, the example deck and the JSON Schema to the real importer,
// so the documentation cannot drift from what Echo accepts.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateDeckBackup, deckJSONURL} from "../imports.js";
import {LANGUAGES, mergeSentences, sentenceIdentity} from "../core.js";

const doc = await readFile(new URL("../DECK-FORMAT.md", import.meta.url), "utf8");
const example = JSON.parse(await readFile(new URL("../decks/example-deck.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../decks/deck.schema.json", import.meta.url), "utf8"));
const docExample = JSON.parse(doc.match(/## The shape\s+```json\n([\s\S]*?)```/)[1]);
const FORBIDDEN = ["srs", "reviews", "reviewTrack", "echoCount", "createdAt", "grammar", "grammarAnalysis", "vocabulary"];

test("the example on the page and the example file both import", () => {
  for (const [name, deck] of [["DECK-FORMAT.md", docExample], ["decks/example-deck.json", example]]) {
    const valid = validateDeckBackup(deck);
    assert.equal(valid.sentences.length, deck.sentences.length, name);
    assert.equal(new Set(deck.sentences.map(s => s.id)).size, deck.sentences.length, name + ": unique ids");
    assert.equal(new Set(valid.sentences.map(sentenceIdentity)).size, deck.sentences.length, name + ": unique sentences");
    for (const s of deck.sentences) for (const key of FORBIDDEN) assert.equal(key in s, false, `${name} ${s.id} models ${key}`);
  }
});

test("the examples satisfy the schema's required fields, id pattern and language list", () => {
  const sentence = schema.$defs.sentence, id = new RegExp(sentence.properties.id.pattern);
  for (const deck of [docExample, example]) {
    for (const key of schema.required) assert.ok(key in deck, key);
    assert.equal(deck.schemaVersion, schema.properties.schemaVersion.const);
    for (const s of deck.sentences) {
      for (const key of sentence.required) assert.equal(typeof s[key], "string", key);
      assert.match(s.id, id);
      for (const key of ["sourceLang", "targetLang"]) assert.ok(schema.$defs.language.enum.includes(s[key]), key);
    }
  }
});

test("the schema's language list is exactly the importer's", () => {
  assert.deepEqual(schema.$defs.language.enum, LANGUAGES.map(([code]) => code));
  assert.throws(() => validateDeckBackup({schemaVersion: 2, sentences: [{id: "x", source: "a", target: "b", targetLang: "klingon"}]}), /unknown targetLang/);
});

test("the schema's required sentence fields are the ones the importer requires", () => {
  for (const key of schema.$defs.sentence.required) {
    const s = {id: "x", source: "a", target: "b"}; delete s[key];
    assert.throws(() => validateDeckBackup({schemaVersion: 2, sentences: [s]}), new RegExp(`non-empty ${key}`), key);
  }
});

test("the page states the update rule the merge actually follows", () => {
  const [first] = validateDeckBackup({schemaVersion: 2, sentences: [{id: "d-1", source: "Cat", target: "ねこ"}]}).sentences;
  const mine = [{...first, echoCount: 5, srs: {reps: 3}}];
  const same = validateDeckBackup({schemaVersion: 2, sentences: [{id: "d-1", source: "A cat", target: "猫【ねこ】だ"}]}).sentences;
  const newer = validateDeckBackup({schemaVersion: 2, sentences: [{id: "d-1", source: "A cat", target: "猫【ねこ】だ", updatedAt: "2026-10-03T00:00:00Z"}]}).sentences;
  assert.equal(mergeSentences(mine, same)[0].source, "Cat", "without a newer updatedAt the learner's copy wins");
  const updated = mergeSentences(mine, newer)[0];
  assert.equal(updated.source, "A cat", "a newer updatedAt replaces the text");
  assert.equal(updated.echoCount, 5); assert.deepEqual(updated.srs, {reps: 3}, "progress is kept");
  assert.match(doc, /Without a newer `updatedAt`, the\s+learner's copy wins/);
});

test("the page documents GitHub blob links becoming raw links", () => {
  assert.equal(deckJSONURL("https://github.com/me/decks/blob/main/cafe.json"), "https://raw.githubusercontent.com/me/decks/main/cafe.json");
  assert.match(doc, /blob\/…` links are turned into\s+raw links automatically/);
});

test("the agent instructions name every field a deck needs and forbid the rest", () => {
  const section = doc.slice(doc.indexOf("## Instructions for an AI agent"));
  for (const key of ["id", "sourceLang", "targetLang", "source", "target", "schemaVersion", "casualTarget", "politeTarget"]) assert.match(section, new RegExp("`" + key + "`"), key);
  for (const key of ["srs", "reviews", "echoCount", "createdAt", "grammar", "vocabulary"]) assert.match(section, new RegExp("`" + key + "`"), "forbids " + key);
});
