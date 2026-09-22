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
