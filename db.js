const DB_NAME="jp-echo", STORE="sentences";
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const store=request.result.createObjectStore(STORE,{keyPath:"id"});store.createIndex("createdAt","createdAt")};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction(mode,action){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close()})}
export const saveSentence=sentence=>transaction("readwrite",store=>store.put(sentence));
export const deleteSentence=id=>transaction("readwrite",store=>store.delete(id));
export async function listSentences(){const items=await transaction("readonly",store=>store.getAll());return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export async function replaceAll(items){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);store.clear();items.forEach(item=>store.put(item));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
