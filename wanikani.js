// WaniKani, on your own key. Nothing here is bundled: mnemonics, readings and
// sentences are fetched into your browser with a token you supply, cached on
// the device, and never leave it. That is the pattern their API exists for.

// Mnemonics as written lean on a deity for their exclamations and, now and
// then, as a character in the story. Both are replaced before anything is
// shown. Phrases go first so "oh my god" is not left as "oh my the Giant";
// case follows the original, so a sentence still starts with a capital.
export const SCRUB = [
  ["oh my god",     "oh wow"],
  ["my god",        "wow"],
  ["good god",      "wow"],
  ["dear god",      "wow"],
  ["god damn",      "darn"],
  ["goddamn",       "darn"],
  ["jesus christ",  "whoa"],
  ["jesus",         "whoa"],
  ["christ",        "whoa"],
  ["oh lord",       "oh wow"],
  ["good lord",     "wow"],
  ["lord knows",    "who knows"],
  ["gee whiz",      "whoa"],
  ["geez",          "whoa"],
  ["jeez",          "whoa"],
  ["gee",           "whoa"],
  ["gosh",          "wow"],
  ["golly",         "wow"],
  ["omg",           "wow"],
  // As a noun — a character in the story — rather than an exclamation.
  ["god",           "the Giant"],
];

const rules = SCRUB.map(([from, to]) => [new RegExp("\\b" + from.replace(/ /g, "\\s+") + "\\b", "gi"), to]);

function matchCase(original, replacement) {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

export function scrub(text = "") {
  let out = String(text);
  for (const [pattern, to] of rules) out = out.replace(pattern, match => matchCase(match, to));
  return out;
}

// --- the sync ---------------------------------------------------------------
// Its own database, so the sentence store and its migration are never touched.
// SHAPE is bumped when what is stored changes; a sync from an older shape is
// made full again so every record is refetched into the new one.
const DB_NAME = "jp-echo-wanikani", VERSION = 2;
export const SHAPE = 2;
const API = "https://api.wanikani.com/v2/subjects";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, keyPath] of [["kanji", "characters"], ["vocabulary", "id"], ["radical", "id"], ["meta", "key"]])
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, {keyPath});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function tx(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    try { result = work(t); } catch (error) { reject(error); return; }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const get = (store, key) => new Promise((resolve, reject) => {
  const r = store.get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});

// Only what the app reads is kept, and it is kept scrubbed. A subject as
// WaniKani sends it is several kilobytes of fields nobody here looks at,
// across eight thousand subjects; and the mnemonic as it sends it is text
// this app never stores. The replacement is lossy — once "God" is "the Giant"
// on disk there is no "God" left to replace differently — so a change to the
// word list is a reason to sync again, and SCRUB_VERSION is how the app knows.
export const SCRUB_VERSION = hashList(SCRUB);
function hashList(list) {
  let h = 0;
  for (const c of JSON.stringify(list)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
export function slimKanji(subject) {
  const d = subject.data;
  return {
    characters: d.characters, id: subject.id, level: d.level,
    meanings: d.meanings.filter(m => m.accepted_answer !== false).map(m => m.meaning),
    onyomi: d.readings.filter(r => r.type === "onyomi").map(r => r.reading),
    kunyomi: d.readings.filter(r => r.type === "kunyomi").map(r => r.reading),
    meaningMnemonic: scrub(d.meaning_mnemonic || ""), readingMnemonic: scrub(d.reading_mnemonic || ""),
    vocabulary: d.amalgamation_subject_ids || [],
    components: d.component_subject_ids || [],
    hidden: !!d.hidden_at,
  };
}
// A radical is a name and, usually, a character. Some are images and have no
// character at all; the name is what a story uses either way.
export function slimRadical(subject) {
  const d = subject.data;
  return {id: subject.id, characters: d.characters || null, slug: d.slug, level: d.level,
    meanings: (d.meanings || []).filter(m => m.accepted_answer !== false).map(m => m.meaning), hidden: !!d.hidden_at};
}
export function slimVocabulary(subject) {
  const d = subject.data;
  return {
    id: subject.id, characters: d.characters, level: d.level,
    meanings: (d.meanings || []).filter(m => m.accepted_answer !== false).map(m => m.meaning),
    readings: (d.readings || []).map(r => r.reading),
    sentences: (d.context_sentences || []).map(s => ({ja: s.ja, en: scrub(s.en || "")})),
    hidden: !!d.hidden_at,
  };
}

// One page after another, following the cursor WaniKani hands back. A token
// that is wrong or revoked is a 401 and is said so; anything else is the
// status. Progress is reported per page so a first sync of eight thousand
// subjects is not a spinner with nothing behind it.
export async function syncWaniKani(token, {onProgress = () => {}, fetch: doFetch = fetch} = {}) {
  if (!token) throw new Error("Add your WaniKani token in Settings.");
  const db = await openDb();
  const meta = (await tx(db, ["meta"], "readonly", t => get(t.objectStore("meta"), "sync"))) || {key: "sync"};
  const incremental = meta.updatedAfter && meta.scrubVersion === SCRUB_VERSION && meta.shape === SHAPE;
  let url = API + "?types=radical,kanji,vocabulary" + (incremental ? "&updated_after=" + encodeURIComponent(meta.updatedAfter) : "");
  let kanji = 0, vocabulary = 0, page = 0;
  const startedAt = new Date().toISOString();
  while (url) {
    const response = await doFetch(url, {headers: {Authorization: "Bearer " + token, "Wanikani-Revision": "20170710"}});
    if (response.status === 401) throw new Error("WaniKani did not accept that token.");
    if (!response.ok) throw new Error("WaniKani answered " + response.status + ".");
    const body = await response.json();
    await tx(db, ["kanji", "vocabulary", "radical"], "readwrite", t => {
      for (const subject of body.data || []) {
        if (subject.object === "kanji") { t.objectStore("kanji").put(slimKanji(subject)); kanji++; }
        else if (subject.object === "vocabulary") { t.objectStore("vocabulary").put(slimVocabulary(subject)); vocabulary++; }
        else if (subject.object === "radical") t.objectStore("radical").put(slimRadical(subject));
      }
    });
    page++;
    onProgress({page, kanji, vocabulary, total: body.total_count});
    url = body.pages?.next_url || null;
  }
  await tx(db, ["meta"], "readwrite", t => t.objectStore("meta").put({key: "sync", updatedAfter: startedAt, syncedAt: startedAt, kanji, vocabulary, scrubVersion: SCRUB_VERSION, shape: SHAPE}));
  db.close();
  return {kanji, vocabulary, pages: page};
}

export async function waniKaniStatus() {
  const db = await openDb();
  const meta = await tx(db, ["meta"], "readonly", t => get(t.objectStore("meta"), "sync"));
  const count = await tx(db, ["kanji"], "readonly", t => new Promise((resolve, reject) => {
    const r = t.objectStore("kanji").count(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  }));
  db.close();
  // stale: the word list has changed since this data was scrubbed, so what is
  // on disk was replaced by a list that is no longer the one in the code.
  return {synced: !!meta?.syncedAt, syncedAt: meta?.syncedAt || null, kanji: count, stale: !!meta?.syncedAt && (meta.scrubVersion !== SCRUB_VERSION || meta.shape !== SHAPE)};
}

// Everything the sheet shows for one character: the kanji's own record with
// its mnemonics already scrubbed, and the sentences of the vocabulary that
// contains it. Null when the character is not on WaniKani or nothing has been
// synced, and the sheet says which.
export async function kanjiInfo(character) {
  const db = await openDb();
  const record = await tx(db, ["kanji"], "readonly", t => get(t.objectStore("kanji"), character));
  if (!record) { db.close(); return null; }
  const words = await tx(db, ["vocabulary"], "readonly", async t => {
    const store = t.objectStore("vocabulary");
    return Promise.all(record.vocabulary.map(id => get(store, id)));
  });
  const parts = await tx(db, ["radical"], "readonly", async t => {
    const store = t.objectStore("radical");
    return Promise.all((record.components || []).map(id => get(store, id)));
  });
  db.close();
  return {...record, words: words.filter(w => w && !w.hidden), parts: parts.filter(Boolean)};
}

export async function forgetWaniKani() {
  await new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = resolve; r.onerror = () => reject(r.error); r.onblocked = resolve;
  });
}

// --- rendering a mnemonic ----------------------------------------------------
// WaniKani marks its mnemonics up with a handful of its own tags. This is
// remote text, so everything is escaped first and only those tags are let
// back through, as spans. A tag it did not send cannot reach the page.
const TAGS = ["kanji", "radical", "vocabulary", "reading", "meaning", "ja"];
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
export function mnemonicHtml(text = "") {
  let html = escapeHtml(String(text));
  for (const tag of TAGS) {
    html = html.replace(new RegExp("&lt;" + tag + "&gt;([\\s\\S]*?)&lt;/" + tag + "&gt;", "g"), '<span class="wk-' + tag + '">$1</span>');
  }
  return html;
}
