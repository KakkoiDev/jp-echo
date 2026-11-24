// Saved words (specs/echo-reader/SPEC.md §4): a dictionary word the learner
// kept, with where they met it. Saved is a mark, not a review state: a saved
// word never reaches the review queue, the due badge or the Cards filter, and
// met / learned still come only from sentences (words.js).
//
// A record is {id, w, r, lang, savedAt, updatedAt, removedAt, from,
// noteRequested, contexts:[{text, url?, title?, at, sentenceId?}]}.
// `id` is the dictionary word id; `w` and `r` are a snapshot so a row still
// renders if the id ever disappears from the dictionary. Removing sets
// `removedAt` — a tombstone — so an un-save survives every merge; saving again
// clears it and brings the contexts back.
//
// Its own database, like the notes: the sentence store, its migration and the
// worker's due counter are never touched. Writes go through the `saveWord` /
// `removeWord` wrappers in app.js, which mark the backup dirty.
import {isLanguage} from "./core.js";

const DB_NAME = "jp-echo-words", STORE = "words";
export const MAX_CONTEXTS = 5;
const TEXT_MAX = 240, TITLE_MAX = 120, URL_MAX = 500, WORD_MAX = 80;

const clip = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const iso = value => { const at = Date.parse(value); return Number.isFinite(at) ? new Date(at).toISOString() : null; };
const time = value => Date.parse(value || 0) || 0;

// The address keeps the site and path only: a query or hash often carries a
// personal token. Anything but http(s) is dropped.
export function cleanUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url; try { url = new URL(value.trim()); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const kept = url.origin + url.pathname;
  return kept.length > URL_MAX ? null : kept;
}

// One context: the sentence (plain, furigana stripped by the caller), and
// optionally where it was read. A context with no address is "Sentence only".
export function cleanContext(context, now = new Date()) {
  if (!context || typeof context !== "object") return null;
  const text = clip(context.text, TEXT_MAX);
  if (!text) return null;
  const out = {text, at: iso(context.at) || now.toISOString()};
  const url = cleanUrl(context.url);
  if (url) { out.url = url; const title = clip(context.title, TITLE_MAX); if (title) out.title = title; }
  if (typeof context.sentenceId === "string" && context.sentenceId) out.sentenceId = context.sentenceId.slice(0, 200);
  return out;
}

const contextKey = c => c.text + "\u0000" + (c.url || "");
// Contexts are one list per word: the same sentence from the same place is
// one context (the one that knows its sentence card wins), newest first, five.
export function unionContexts(...lists) {
  const byKey = new Map();
  for (const c of lists.flat()) {
    if (!c?.text) continue;
    const key = contextKey(c), old = byKey.get(key);
    if (!old) { byKey.set(key, {...c}); continue; }
    const d = time(c.at) - time(old.at);
    const winner = {...(d ? (d > 0 ? c : old) : JSON.stringify(c) >= JSON.stringify(old) ? c : old)};
    const sentenceId = [old.sentenceId, c.sentenceId].filter(Boolean).sort()[0];
    if (sentenceId) winner.sentenceId = sentenceId;
    byKey.set(key, winner);
  }
  return [...byKey.values()].sort((a, b) => time(b.at) - time(a.at) || (contextKey(a) < contextKey(b) ? -1 : 1)).slice(0, MAX_CONTEXTS);
}

export const isSaved = record => !!record && !record.removedAt;

// Save (or save again): a fresh record, or the existing one with its tombstone
// cleared and the new context first. Saving again brings old contexts back.
export function saveWordRecord(existing, entry, {context = null, from = "echo", noteRequested = false, now = new Date()} = {}) {
  const at = now.toISOString(), fresh = cleanContext(context, now);
  if (!entry || !Number.isInteger(Number(entry.id))) throw new Error("A saved word needs a dictionary word id.");
  const base = existing || {id: Number(entry.id), savedAt: at, contexts: [], noteRequested: false};
  return {
    ...base,
    id: Number(entry.id),
    w: clip(entry.w ?? base.w, WORD_MAX),
    r: clip(entry.r ?? base.r ?? "", WORD_MAX),
    lang: isLanguage(entry.lang) ? entry.lang : isLanguage(base.lang) ? base.lang : "ja",
    savedAt: base.savedAt || at,
    updatedAt: at,
    removedAt: null,
    from: from === "reader" ? "reader" : "echo",
    noteRequested: !!(base.noteRequested || noteRequested),
    contexts: unionContexts(fresh ? [fresh] : [], base.contexts || []),
  };
}

// Remove: a tombstone. The contexts stay on the record, so saving again brings
// them back; the list and the marks treat it as not saved.
export function removeWordRecord(existing, {now = new Date()} = {}) {
  if (!existing) return null;
  const at = now.toISOString();
  return {...existing, updatedAt: at, removedAt: at, noteRequested: false};
}

// What a backup or a reader file may carry. One bad record is dropped with a
// reason, never the whole file (unlike decks).
export function validateSavedWords(list) {
  const words = [], dropped = [];
  if (!Array.isArray(list)) return {words, dropped: list == null ? [] : [{index: -1, reason: "words is not a list"}]};
  list.forEach((raw, index) => {
    const reason = !raw || typeof raw !== "object" ? "not an object"
      : !Number.isInteger(raw.id) || raw.id === 0 ? "id is not a dictionary word id"
      : typeof raw.w !== "string" || !raw.w.trim() ? "no word"
      : raw.lang != null && !isLanguage(raw.lang) ? "unknown language"
      : !iso(raw.updatedAt) ? "no updatedAt" : null;
    if (reason) { dropped.push({index, reason}); return; }
    const updatedAt = iso(raw.updatedAt);
    words.push({
      id: raw.id, w: clip(raw.w, WORD_MAX), r: clip(raw.r, WORD_MAX), lang: isLanguage(raw.lang) ? raw.lang : "ja",
      savedAt: iso(raw.savedAt) || updatedAt, updatedAt, removedAt: raw.removedAt ? iso(raw.removedAt) || updatedAt : null,
      from: raw.from === "reader" ? "reader" : "echo", noteRequested: raw.noteRequested === true && !raw.removedAt,
      contexts: unionContexts((Array.isArray(raw.contexts) ? raw.contexts : []).map(c => cleanContext(c, new Date(updatedAt))).filter(Boolean)),
    });
  });
  return {words, dropped};
}

// Two copies of one word (SPEC §5.4): the newer `updatedAt` wins; on a tie the
// tombstone wins; on a further tie the greater JSON, so every device agrees.
function winnerOf(a, b) {
  const d = time(a.updatedAt) - time(b.updatedAt);
  if (d) return d > 0 ? a : b;
  if (!!a.removedAt !== !!b.removedAt) return a.removedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}
export function mergeWord(a, b) {
  if (!a) return b; if (!b) return a;
  const win = winnerOf(a, b), removedAt = win.removedAt || null;
  return {
    id: win.id, w: win.w, r: win.r, lang: win.lang,
    savedAt: [a.savedAt, b.savedAt].filter(Boolean).sort()[0] || win.savedAt,
    updatedAt: win.updatedAt, removedAt, from: win.from,
    noteRequested: !removedAt && !!(a.noteRequested || b.noteRequested),
    contexts: unionContexts(a.contexts || [], b.contexts || []),
  };
}
// Merge two lists of records by id. Pure and order-free:
// mergeWords(a,b) deep-equals mergeWords(b,a). Sorted by id.
export function mergeWords(current = [], incoming = []) {
  const out = new Map();
  for (const record of [...current, ...incoming]) {
    if (!record || !Number.isInteger(record.id)) continue;
    out.set(record.id, mergeWord(out.get(record.id), record));
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}

// The Saved words list: saved ones only, newest first.
export const savedOnly = (records = []) => records.filter(isSaved).sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || b.id - a.id);

// "雨の日の過ごし方 · tenki.jp/lite/rain · 6 Nov", or "Sentence only · 4 Nov".
export function contextSource(context, {locale = "en-GB", sentenceOnly = "Sentence only"} = {}) {
  const at = Date.parse(context?.at || ""), date = Number.isFinite(at) ? new Date(at).toLocaleDateString(locale, {day: "numeric", month: "short"}) : "";
  let place = "";
  if (context?.url) { try { const u = new URL(context.url); place = (u.host.replace(/^www\./, "") + u.pathname).replace(/\/$/, ""); } catch { place = ""; } }
  const parts = place ? [context.title, place, date] : [sentenceOnly, date];
  return parts.filter(Boolean).join(" · ");
}

// IndexedDB. Reads and writes; the app.js wrappers own when to write.
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath: "id"}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function tx(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode), request = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(request?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally { db.close(); }
}
export const listWords = () => tx("readonly", store => store.getAll());
export const getWord = id => tx("readonly", store => store.get(Number(id)));
export const putWord = record => tx("readwrite", store => store.put(record));
export async function replaceWords(records) {
  await tx("readwrite", store => { store.clear(); for (const r of records) store.put(r); return null; });
}
