import {WORDS} from './words-data.js';
import {createReadingResolver,READING_VERSION} from './japanese-readings.js';
const resolve=createReadingResolver(WORDS);
export const readingSignature=s=>JSON.stringify([s.targetLang||'ja',s.target,s.casualTarget,s.politeTarget]);
export function dictionaryReadings(record){
 if((record.targetLang||'ja')!=='ja')return record;
 if(record.readingVersion===READING_VERSION&&record.readingSignature===readingSignature(record))return record;
 const next={...record},issues=[];delete next.readingVersion;
 for(const key of ['target','casualTarget','politeTarget'])if(record[key]){const result=resolve(record[key],record.readingOverrides||{});next[key]=result.text;issues.push(...result.issues)}
 next.readingIssues=[...new Map(issues.map(i=>[i.surface,i])).values()];next.readingSignature=readingSignature(next);return next;
}
export async function backfillReadings({list,read,correct,write,onProgress=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0))}){
 const items=await list();let done=0,total=items.filter(s=>(s.targetLang||'ja')==='ja').length;
 for(const item of items){
  if((item.targetLang||'ja')!=='ja')continue;
  const latest=await read(item.id);if(!latest)continue;
  if(latest.readingVersion===READING_VERSION&&latest.readingSignature===readingSignature(latest)){onProgress(++done,total);continue}
  const prepared=dictionaryReadings(latest);
  const corrected=await correct(prepared);
  const next={...prepared,...corrected,readingVersion:READING_VERSION,readingIssues:[]};next.readingSignature=readingSignature(next);
  await write(item.id,readingSignature(latest),next);onProgress(++done,total);await yieldTask();
 }
 return {done,total};
}
