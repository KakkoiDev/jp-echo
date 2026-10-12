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
  assert.equal(raw.sentences.length,623);
  assert.equal(validateDeckBackup(raw).sentences.length,623);
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
