// An opt-in kanji-family curriculum: these examples are not review cards
// until the learner explicitly imports one into Echo's existing sentence library.
import {stripFurigana} from "./core.js";
export const CURRICULUM_URL="./decks/kanji-families-curriculum.json";
export const FAMILY_DECK_URL=CURRICULUM_URL;
let loaded=null;
export const normalizeExample=(text="")=>stripFurigana(String(text)).normalize("NFC").replace(/[\s\u3000]+/gu,"");

export function validateFamilyCurriculum(deck){
  if(deck?.schemaVersion!==2||!Array.isArray(deck.kanjiFamilies)||!Array.isArray(deck.sentences))
    throw new Error("The kanji-family curriculum is not an Echo v2 deck.");
  const byId=new Map(),byKanji=new Map();
  for(const sentence of deck.sentences){
    if(!sentence?.id||!sentence.source||!sentence.target||byId.has(sentence.id))
      throw new Error("The kanji-family curriculum has a missing or repeated sentence.");
    byId.set(sentence.id,sentence);
  }
  for(const family of deck.kanjiFamilies){
    if(!family?.kanji||[...family.kanji].length!==1||!family.meaning||
      !family.dictionaryRadical||!family.theme||!Array.isArray(family.words)||
      family.words.length<3||byKanji.has(family.kanji))
      throw new Error("The kanji-family curriculum has an invalid or repeated family.");
    for(const word of family.words){
      const sentence=byId.get(word.exampleSentenceId);
      if(!word.term?.includes(family.kanji)||!word.reading||!sentence||
         !stripFurigana(sentence.target).includes(family.kanji))
        throw new Error("The kanji-family curriculum has a broken example link.");
    }
    byKanji.set(family.kanji,family);
  }
  if(deck.kanjiFamilies.length<200)
    throw new Error("The kanji-family curriculum is incomplete.");
  return {families:deck.kanjiFamilies,byId,byKanji,deck};
}
export async function loadFamilyCurriculum(fetchImpl=fetch){
  if(fetchImpl!==fetch){
    const response=await fetchImpl(CURRICULUM_URL);
    if(!response.ok)throw new Error("Cannot load the kanji curriculum.");
    return validateFamilyCurriculum(await response.json());
  }
  if(!loaded)loaded=(async()=>{
    const response=await fetch(CURRICULUM_URL);
    if(!response.ok)throw new Error("Cannot load the kanji curriculum.");
    return validateFamilyCurriculum(await response.json());
  })().catch(error=>{loaded=null;throw error});
  return loaded;
}
// Existing catalogue consumers can continue using these small accessors.
export async function loadKanjiCurriculum(fetchImpl=fetch){
  const result=await loadFamilyCurriculum(fetchImpl);
  return result.deck;
}
export const familyFor=(curriculum,kanji)=>(curriculum.byKanji||new Map(curriculum.kanjiFamilies.map(f=>[f.kanji,f]))).get(kanji)||null;
export const cardsById=curriculum=>curriculum.byId||new Map(curriculum.sentences.map(s=>[s.id,s]));
export const familyThemes=curriculum=>[...new Set((curriculum.families||curriculum.kanjiFamilies).map(f=>f.theme))];
export function findFamilies(curriculum,{theme="all",query=""}={}){
  const q=String(query).normalize("NFKC").trim().toLocaleLowerCase();
  return (curriculum.families||curriculum.kanjiFamilies).filter(f=>{
    if(theme!=="all"&&f.theme!==theme)return false;
    if(!q)return true;
    return [f.kanji,f.meaning,f.theme,f.dictionaryRadical,f.dictionaryRadicalName,
      ...f.words.flatMap(w=>[w.term,w.reading])].join(" ").normalize("NFKC").toLocaleLowerCase().includes(q);
  });
}
export function exampleLibraryIndex(sentences=[]){
  const ids=new Set(),targets=new Set(),learnedIds=new Set(),learnedTargets=new Set();
  for(const s of sentences){
    if(!s)continue;
    if(s.id)ids.add(s.id);
    const plain=normalizeExample(s.plainTarget||s.target||"");
    if(plain)targets.add(plain);
    if(s.srs?.state===2){
      if(s.id)learnedIds.add(s.id);
      if(plain)learnedTargets.add(plain);
    }
  }
  return {ids,targets,learnedIds,learnedTargets};
}
export function exampleState(sentence,index){
  if(!sentence)return "unmet";
  const target=normalizeExample(sentence.target);
  if(index.learnedIds.has(sentence.id)||index.learnedTargets.has(target))return "learned";
  if(index.ids.has(sentence.id)||index.targets.has(target))return "met";
  return "unmet";
}
export function familyProgress(catalogue,family,index){
  let met=0,learned=0;
  const ids=new Set(family.words.map(w=>w.exampleSentenceId));
  for(const id of ids){
    const state=exampleState(catalogue.byId.get(id),index);
    if(state!=="unmet")met++;
    if(state==="learned")learned++;
  }
  return {met,learned,total:ids.size};
}
// Legacy names, in case existing integrations use them.
export const sentenceIndex=sentences=>{
  const ids=new Map(sentences.map(s=>[s.id,s]));
  const targets=new Map(sentences.map(s=>[normalizeExample(s.target),s]));
  return {ids,targets};
};
export const exampleInLibrary=(card,index)=>index.ids.get(card.id)||index.targets.get(normalizeExample(card.target))||null;
