import {createSentence} from "./core.js";
import {saveSentence} from "./db.js";

// Explicit mutation boundary used by UI today and by HTMX forms later.
// A discussion turn is persisted before the caller is allowed to render success.
export async function saveDiscussionTurn(turn,{sourceLang,targetLang,now=()=>new Date(),save=saveSentence}={}){
  if(!turn?.source?.trim()||!turn?.target?.trim())throw new Error("A discussion turn needs both source and target text.");
  const sentence=createSentence(turn.source,{casual:turn.target,polite:turn.target},now(),undefined,{sourceLang,targetLang});
  await save(sentence);
  return sentence;
}
