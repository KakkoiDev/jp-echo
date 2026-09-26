// Echo's notes: what it wrote about a grammar point the first time you opened
// it, and your own version of any note, including the bundled kanji story.
// A note is {key, kind, id, part, text, echo, made, by}: `text` is what shows,
// `echo` is Echo's original so Reset can bring it back, `by` says whose the
// text is. Examples are a cache keyed the same way and never leave the device:
// a suggestion that was never kept lives nowhere else.
const DB_NAME = "jp-echo-notes", STORE = "notes";

export const noteKey = (kind, id, part) => `${kind}:${id}:${part}`;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: "key"});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function tx(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), request = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(request?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export const getNote = key => tx("readonly", store => store.get(key));
export const putNote = record => tx("readwrite", store => store.put(record));
export const deleteNote = key => tx("readwrite", store => store.delete(key));
export const listNotes = () => tx("readonly", store => store.getAll());
export async function replaceNotes(records) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite"), store = t.objectStore(STORE);
    store.clear(); for (const r of records) store.put(r);
    t.oncomplete = resolve; t.onerror = () => reject(t.error);
  });
}

// Shapes, kept pure so they can be tested without a browser.
export function makeNote({kind, id, part, text, echo = null, by = "echo", now = new Date()}) {
  return {key: noteKey(kind, id, part), kind, id, part, text, echo: echo ?? (by === "echo" ? text : null), made: now.toISOString(), by};
}
// What goes in a backup: every note but the example cache.
export const forBackup = (notes = []) => notes.filter(n => n && n.part !== "examples");
// Merge a backup's notes into what is here: the newer wins; a note that only
// exists on one side is kept. An example cache in a backup is ignored.
export function mergeNotes(current = [], incoming = []) {
  const out = new Map(current.filter(n => n?.key).map(n => [n.key, n]));
  for (const n of forBackup(incoming)) {
    if (!n?.key || typeof n.part !== "string") continue;
    const old = out.get(n.key);
    if (!old || Date.parse(n.made || 0) > Date.parse(old.made || 0)) out.set(n.key, n);
  }
  return [...out.values()];
}
