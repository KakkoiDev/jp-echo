import {WORDS} from './words-data.js';
import {createReadingResolver,READING_VERSION,validateReadingCorrection} from './japanese-readings.js';
const resolve=createReadingResolver(WORDS);
export const readingSignature=s=>JSON.stringify([s.targetLang||'ja',s.target,s.casualTarget,s.politeTarget,s.readingOverrides||{}]);
export function dictionaryReadings(record,force=false){
 if((record.targetLang||'ja')!=='ja')return record;
 const checked=record.readingVersion===READING_VERSION&&record.readingSignature===readingSignature(record);
 if(checked&&!force)return record;
 const next={...record},issues=[];delete next.readingVersion;
 for(const key of ['target','casualTarget','politeTarget'])if(record[key]){const result=resolve(record[key],record.readingOverrides||{});next[key]=result.text;issues.push(...result.issues)}
 next.readingIssues=[...new Map(issues.map(i=>[i.surface,i])).values()];next.readingSignature=readingSignature(next);return next;
}
export async function backfillReadings({list,read,correct,write,onProgress=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0)),force=false}){
 const items=await list();let done=0,total=items.filter(s=>(s.targetLang||'ja')==='ja').length;
 for(const item of items){
  if((item.targetLang||'ja')!=='ja')continue;
  if(!force&&item.readingVersion===READING_VERSION&&item.readingSignature===readingSignature(item)){onProgress(++done,total);continue}
  const latest=await read(item.id);if(!latest)continue;
  const prepared=dictionaryReadings(latest,force);
  if(!force&&prepared.readingVersion===READING_VERSION&&prepared.readingSignature===readingSignature(prepared)){onProgress(++done,total);continue}
  // Dictionary-backed repairs are local. Only unresolved context needs a model.
  const needsModel=prepared.readingIssues.length>0;
  const usedModel=needsModel&&typeof correct==='function';
  const corrected=usedModel?dictionaryReadings({...prepared,...await correct(prepared),readingVersion:undefined}):prepared;
  const next={...prepared,...corrected,readingVersion:READING_VERSION,readingIssues:usedModel?[]:corrected.readingIssues};next.readingSignature=readingSignature(next);
  await write(item.id,readingSignature(latest),next);onProgress(++done,total);await yieldTask();
 }
 return {done,total};
}

export async function correctReadingDraft(text,{correct}={}){
 const prepared=dictionaryReadings({target:text},true);
 const result=prepared.readingIssues.length&&correct?await correct(prepared):prepared;
 validateReadingCorrection(text,result.target);
 return dictionaryReadings({...prepared,target:result.target},true);
}
