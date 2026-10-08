import {planMiniCleanup} from './mini-imports.js';
import {migrateSentence} from "./core.js";
const DB_NAME="jp-echo", STORE="sentences";
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore(STORE,{keyPath:"id"});store.createIndex("createdAt","createdAt")};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction(mode,action){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close()})}
export const saveSentence=sentence=>transaction("readwrite",store=>store.put(sentence));
export const getSentence=async id=>migrateSentence(await transaction("readonly",store=>store.get(id)));
export const deleteSentence=id=>transaction("readwrite",store=>store.delete(id));
export async function listSentences(){const items=await transaction("readonly",store=>store.getAll());return items.map(migrateSentence).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}

// Reading migrates, so nothing downstream ever meets an old record. This
// writes the migration back, once, so the store stops carrying both shapes —
// it runs at boot and is a no-op on every later load.
export async function migrateStore(){
  const items=await transaction("readonly",store=>store.getAll());
  const stale=items.filter(item=>item&&item.schemaVersion!==migrateSentence(item).schemaVersion);
  if(!stale.length)return 0;
  const db=await openDb();
  await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
    for(const item of stale)store.put(migrateSentence(item));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();return stale.length;
}
export async function replaceAll(items){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);store.clear();items.forEach(item=>store.put(item));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}

// Separate recovery database avoids changing the sentence store's schema.
async function importRecovery(action,mode='readonly'){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('jp-echo-import-recovery',1);req.onupgradeneeded=()=>req.result.createObjectStore('backups');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 try{return await new Promise((resolve,reject)=>{let result;const tx=db.transaction('backups',mode),request=action(tx.objectStore('backups'));request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}
export async function saveImportRecovery(backup,key='minihongo-v1'){if(await importRecovery(store=>store.get(key)))return;await importRecovery(store=>store.put(backup,key),'readwrite')}
export const readImportRecovery=async()=>await importRecovery(store=>store.get('minihongo-v2-word-cards'))||await importRecovery(store=>store.get('minihongo-v1'));

// Delete only archived IDs, reading current records inside the write transaction.
// Other tabs' new sentences and the latest personal review state are retained.
export async function removeArchivedMiniCards(kept,removed,catalogues){
 const db=await openDb(),ids=new Set(removed.map(s=>s.id));
 try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.getAll();request.onsuccess=()=>{const records=request.result,clean=new Map(planMiniCleanup(records,catalogues).kept.map(s=>[s.id,s]));for(const record of records){if(ids.has(record.id))store.delete(record.id);else if(clean.has(record.id))store.put(clean.get(record.id))}};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}
}

// Apply readings against the CURRENT record in one transaction, preserving reviews
// and concurrent changes. A sentence edited during the model request is deferred.
export async function applyReadingCorrection(id,expected,correction){
 const db=await openDb();let saved=null;
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.get(id);
  request.onsuccess=()=>{const raw=request.result;if(!raw)return;const record=migrateSentence(raw);
   const signature=JSON.stringify([record.targetLang||'ja',record.target,record.casualTarget,record.politeTarget,record.readingOverrides||{}]);if(signature!==expected)return;
   saved={...record,furiganaRecovery:record.furiganaRecovery||Object.fromEntries(['target','casualTarget','politeTarget'].map(k=>[k,record[k]])),updatedAt:new Date().toISOString()};
   for(const key of ['target','casualTarget','politeTarget','readingVersion','readingSignature','readingIssues'])if(Object.hasOwn(correction,key))saved[key]=correction[key];
   store.put(saved);
  };
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });return saved}finally{db.close()}
}
