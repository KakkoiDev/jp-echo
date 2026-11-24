import {createSentence} from "./core.js";
import {saveSentence} from "./db.js";
import {getWord,putWord,saveWordRecord,removeWordRecord} from "./saved-words.js";

// Explicit mutation boundary used by UI today and by HTMX forms later.
// A discussion turn is persisted before the caller is allowed to render success.
export async function saveDiscussionTurn(turn,{sourceLang,targetLang,now=()=>new Date(),save=saveSentence}={}){
  if(!turn?.source?.trim()||!turn?.target?.trim())throw new Error("A discussion turn needs both source and target text.");
  const sentence=createSentence(turn.source,{casual:turn.target,polite:turn.target},now(),undefined,{sourceLang,targetLang});
  await save(sentence);
  return sentence;
}

// Save a word (SPEC echo-reader §4.2): read what is stored, add the context,
// clear any tombstone, and resolve only once the write is done, so the sheet
// never says "Saved" before IndexedDB has it. app.js passes its `saveWord`
// wrapper, which marks the backup dirty.
export async function saveWordAction(entry,{context=null,from="echo",now=()=>new Date(),get=getWord,save=putWord}={}){
  const record=saveWordRecord(await get(Number(entry?.id)),entry,{context,from,now:now()});
  await save(record);
  return record;
}
// Remove a saved word: a tombstone, never a delete, so the removal survives a
// merge and saving again brings its contexts back.
export async function removeWordAction(id,{now=()=>new Date(),get=getWord,save=putWord}={}){
  const record=removeWordRecord(await get(Number(id)),{now:now()});
  if(record)await save(record);
  return record;
}
