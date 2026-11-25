import {readGoal,goalKey,goalAtKey} from "./jlpt-goal.js";
import {betterAttempt,markDirty,mergeN2} from "./sync.js";
import {bookIds,bookName} from "./n2-forms.js";
import {NIGHT_KEY,readNights} from "./n2-night.js";

export const prefix="echo-n2-mock-v1-";
const tables=["papers","history","recall","events"];
let connection;
function open() {
  if(!connection) connection=new Promise((resolve,reject)=>{
    // v2 adds "events": Day Radio exposure and listening recall, one row each.
    const request=indexedDB.open("echo-n2-training",2);
    request.onupgradeneeded=()=>tables.forEach(name=>{if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:"id"})});
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Another Echo tab is holding the N2 data. Close other Echo tabs and reload."));
  });
  return connection;
}
export async function access(table,method,value) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(table,method==="put"?"readwrite":"readonly");
    const request=tx.objectStore(table)[method](value);
    // Every N2 write is a change for the gist sync (sync.js, FILES.n2).
    tx.oncomplete=()=>{if(method==="put")markDirty("n2");resolve(request.result)};
    tx.onabort=tx.onerror=()=>reject(tx.error);
  });
}
export function currentAttempts() {
  const result=[];
  for(const key of Object.keys(localStorage).filter(key=>key.startsWith(prefix))){
    const id=key.slice(prefix.length);
    const data=JSON.parse(localStorage.getItem(prefix+id)||"null");
    if(data && data.phase!=="ready") result.push({...data,book:id,id:data.id||"legacy-"+id});
  }
  return result;
}
export async function report() {
  const [papers,archived,recall,events]=await Promise.all(tables.map(t=>access(t,"getAll")));
  const attempts=new Map(archived.map(a=>[a.id,a]));
  currentAttempts().forEach(a=>attempts.set(a.id,a));
  return {schema:"echo.n2.study.v1",exportedAt:new Date().toISOString(),trainingGoal:readGoal(),papers,attempts:[...attempts.values()],recall,events,nights:readNights()};
}
export function scored(data) {
  const papers=new Map(data.papers.map(p=>[p.id,p]));
  const rows=[];
  for(const a of data.attempts){
    const paper=papers.get(a.paper||a.book);
    if(!paper) continue;
    paper.questions.forEach((q,index)=>{
      if(a.phase!=="results" && (a.phase==="written" || q.skill===3)) return;
      rows.push({book:a.book,attemptId:a.id,at:a.completedAt||a.startedAt||"",paper:paper.id,index,source:q.source,skill:q.skill,target:q.target,dimension:q.dimension,context:q.context,
        correct:a.answers[index]===q.key,guessed:!!a.guesses[index],answered:!!a.answers[index],seconds:Math.round(a.time[index]/1000)});
    });
  }
  return rows;
}
export function download(data) {
  const link=document.createElement("a");
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  link.href=url;link.download="echo-n2-"+new Date().toISOString().slice(0,10)+".json";
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// The N2 file in the gist sync: finished attempts (history), papers, recall
// records, Day Radio events and the goal. An attempt still in progress stays
// on its device (localStorage) until it is archived.
async function putMany(table,rows){
  if(!rows.length)return;
  const db=await open();
  await new Promise((resolve,reject)=>{const tx=db.transaction(table,"readwrite"),store=tx.objectStore(table);for(const row of rows)store.put(row);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error)});
}
export async function n2Document(){
  const [papers,history,recall,events]=await Promise.all(tables.map(t=>access(t,"getAll")));
  const finished=new Map(history.map(a=>[a.id,a]));
  for(const a of currentAttempts())if(a.phase==="results")finished.set(a.id,betterAttempt(a,finished.get(a.id)));
  return {app:"echo",kind:"n2",schemaVersion:1,papers,history:[...finished.values()],recall,events,nights:readNights(),goal:readGoal(),goalAt:localStorage.getItem(goalAtKey)||""};
}
export const n2Adapter=()=>({
  read:n2Document,
  merge:async remote=>{
    const local=await n2Document(),merged=mergeN2(local,remote||{});
    // Only rows that changed are written; a merge is not a change of its own.
    for(const table of tables){const before=new Map(local[table].map(r=>[r.id,JSON.stringify(r)]));await putMany(table,merged[table].filter(r=>before.get(r.id)!==JSON.stringify(r)))}
    if(JSON.stringify(merged.goal)!==JSON.stringify(local.goal)||merged.goalAt!==local.goalAt){
      if(merged.goal)localStorage.setItem(goalKey,JSON.stringify(merged.goal));else localStorage.removeItem(goalKey);
      if(merged.goalAt)localStorage.setItem(goalAtKey,merged.goalAt);
    }
    if(JSON.stringify(merged.nights)!==JSON.stringify(local.nights))try{localStorage.setItem(NIGHT_KEY,JSON.stringify(merged.nights))}catch{}
    return merged;
  },
});
