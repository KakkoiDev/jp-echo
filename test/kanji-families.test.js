import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateDeckBackup} from "../imports.js";
import {validateFamilyCurriculum,loadFamilyCurriculum,findFamilies,familyThemes,
  familyProgress,exampleLibraryIndex,exampleState} from "../kanji-families.js";

const raw=JSON.parse(await readFile(new URL("../decks/kanji-families-curriculum.json",import.meta.url),"utf8"));
const curriculum=validateFamilyCurriculum(raw);

test("the complete families deck is valid Echo material with linked vocabulary examples",()=>{
  assert.equal(curriculum.families.length,206);
  assert.equal(raw.sentences.length,694);
  assert.equal(validateDeckBackup(raw).sentences.length,694);
  assert.equal(new Set(curriculum.families.map(f=>f.kanji)).size,206);
  for(const family of curriculum.families) {
    assert.ok(family.dictionaryRadical&&family.dictionaryRadicalName&&family.meaning&&family.theme);
    assert.ok(family.words.length>=3);
    for(const word of family.words) {
      const sentence=curriculum.byId.get(word.exampleSentenceId);
      assert.ok(sentence&&word.reading&&word.term.includes(family.kanji));
    }
  }
});
test("find kanji families by parent, word, reading, meaning, radical or theme",()=>{
  assert.equal(findFamilies(curriculum,{query:"行"}).some(f=>f.kanji==="行"),true);
  assert.equal(findFamilies(curriculum,{query:"銀行"}).some(f=>f.kanji==="行"),true);
  assert.equal(findFamilies(curriculum,{query:"みらい"}).some(f=>f.kanji==="未"),true);
  assert.equal(findFamilies(curriculum,{query:"not yet"}).some(f=>f.kanji==="未"),true);
  assert.equal(findFamilies(curriculum,{query:"癶"}).some(f=>f.kanji==="発"),true);
  assert.ok(familyThemes(curriculum).length>=7);
  assert.ok(findFamilies(curriculum,{theme:"Nature"}).every(f=>f.theme==="Nature"));
});
test("curriculum loads from a URL and rejects broken links before display",async()=>{
  const fetched=await loadFamilyCurriculum(async url=>{
    assert.match(url,/kanji-families-curriculum.json$/);
    return {ok:true,json:async()=>raw};
  });
  assert.equal(fetched.families.length,206);
  const broken=structuredClone(raw);
  broken.kanjiFamilies[0].words[0].exampleSentenceId="missing";
  assert.throws(()=>validateFamilyCurriculum(broken),/broken example link/);
});
test("one sentence is counted once and no catalogue cards are automatically scheduled",()=>{
  const family=curriculum.byKanji.get("行");
  const first=curriculum.byId.get(family.words[0].exampleSentenceId);
  const index=exampleLibraryIndex([]);
  assert.deepEqual(familyProgress(curriculum,family,index),{met:0,learned:0,total:family.words.length});
  assert.equal(exampleState(first,index),"unmet");
  const scheduled=exampleLibraryIndex([{...first,srs:{state:2}}]);
  assert.equal(exampleState(first,scheduled),"learned");
  assert.deepEqual(familyProgress(curriculum,family,scheduled),{met:1,learned:1,total:family.words.length});
  const alternate=exampleLibraryIndex([{id:"personal",target:first.target,srs:{state:0}}]);
  assert.equal(exampleState(first,alternate),"met");
});

import {ALL as DICTIONARY} from "../words.js";
import {familyDictionaryMatches,dictionaryIndex} from "../kanji-families.js";

test("missed high-value compounds, including 発生, have prepared examples",()=>{
  const prepared=curriculum.byKanji.get("発").words;
  for(const word of ["発生","発展","発達","発明","発売","発行","爆発","発電"])
    assert.ok(prepared.some(entry=>entry.term===word&&curriculum.byId.has(entry.exampleSentenceId)),word);
  assert.equal(curriculum.kanjiFamilies?.length||curriculum.families.length,206);
});

test("each family exposes all other JMdict words, not just the authored sample",()=>{
  const parents=curriculum.families;
  const map=dictionaryIndex(DICTIONARY);
  assert.ok((map.get("発")||[]).some(word=>word.w==="発生"));
  const family=curriculum.byKanji.get("発");
  const extras=familyDictionaryMatches(family,DICTIONARY);
  assert.ok(extras.length>50);
  assert.ok(!extras.some(word=>word.w==="発生")); // already has a prepared sentence
  assert.ok(extras.some(word=>word.w==="発揮"));
  assert.ok(extras.some(word=>word.w==="蒸発"));
  assert.ok(familyDictionaryMatches(family,DICTIONARY,{level:"N2"}).every(w=>w.jlpt==="N2"));
  assert.ok(familyDictionaryMatches(family,DICTIONARY,{query:"はっき"}).some(w=>w.w==="発揮"));
  assert.ok(findFamilies(curriculum,{query:"蒸発",dictionary:DICTIONARY}).some(f=>f.kanji==="発"));
  for(const parent of parents){
    const other=familyDictionaryMatches(parent,DICTIONARY);
    assert.equal(new Set(other.map(w=>w.w+" / "+w.r)).size,other.length,parent.kanji);
    assert.ok(other.every(w=>w.w.includes(parent.kanji)),parent.kanji);
  }
});
