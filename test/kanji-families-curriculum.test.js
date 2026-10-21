import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateDeckBackup} from "../imports.js";
import {cardsById,exampleInLibrary,familyFor,familyProgress,normalizeExample,sentenceIndex,loadKanjiCurriculum,validateFamilyCurriculum,exampleLibraryIndex} from "../kanji-families.js";

const deck = JSON.parse(await readFile(new URL("../decks/kanji-families-curriculum.json",import.meta.url),"utf8"));

test("full kanji curriculum is a valid importable Echo deck", () => {
  const parsed = validateDeckBackup(deck);
  assert.equal(parsed.sentences.length,694);
  assert.equal(deck.kanjiFamilies.length,206);
  assert.equal(deck.kanjiFamilies.reduce((count,f)=>count+f.words.length,0),696);
  assert.equal(new Set(deck.kanjiFamilies.map(f=>f.kanji)).size,206);
  assert.equal(new Set(deck.sentences.map(s=>s.id)).size,694);
  assert.equal(new Set(deck.sentences.map(s=>normalizeExample(s.target))).size,694);
  assert.ok(deck.sentences.every(s=>s.sourceLang==="en"&&s.targetLang==="ja"&&s.source&&s.target));
});

test("every parent, radical, derived term and example is linked", () => {
  const cards = cardsById(deck);
  for(const family of deck.kanjiFamilies) {
    assert.ok(family.dictionaryRadical && family.dictionaryRadicalName && family.meaning && family.theme);
    assert.ok(family.words.length>=3);
    assert.equal(family.exampleSentenceId,family.words[0].exampleSentenceId);
    for(const word of family.words){
      assert.ok(word.term.includes(family.kanji),word.term+" belongs to "+family.kanji);
      assert.ok(word.reading);
      const card=cards.get(word.exampleSentenceId);
      assert.ok(card,word.term+" has an example");
      assert.ok(normalizeExample(card.target).includes(family.kanji));
    }
  }
  assert.equal(familyFor(deck,"発")?.kanji,"発");
  assert.equal(familyFor(deck,"🦆"),null);
});

test("review progress is derived only from Echo sentences, never duplicated in the curriculum", () => {
  const family=familyFor(deck,"未"),cards=cardsById(deck);
  const first=cards.get(family.words[0].exampleSentenceId);
  assert.deepEqual(familyProgress(validateFamilyCurriculum(deck),family,exampleLibraryIndex([])),{met:0,learned:0,total:new Set(family.words.map(w=>w.exampleSentenceId)).size});
  const mine=[{...first,srs:{state:2}}];
  assert.equal(exampleInLibrary(first,sentenceIndex(mine)),mine[0]);
  const copy={...first,id:"different-id",target:normalizeExample(first.target)};
  assert.equal(exampleInLibrary(first,sentenceIndex([copy])),copy);
  assert.deepEqual(familyProgress(validateFamilyCurriculum(deck),family,exampleLibraryIndex(mine)),{met:1,learned:1,total:new Set(family.words.map(w=>w.exampleSentenceId)).size});
});

test("the curriculum fetch is injectable and rejects malformed files",async()=>{
  const ok=await loadKanjiCurriculum(async()=>({ok:true,json:async()=>deck}));
  assert.equal(ok.kanjiFamilies.length,206);
  await assert.rejects(loadKanjiCurriculum(async()=>({ok:true,json:async()=>({schemaVersion:1})})),/Echo v2 deck/);
  await assert.rejects(loadKanjiCurriculum(async()=>({ok:false})),/Cannot load/);
});
