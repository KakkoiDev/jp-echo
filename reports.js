// Flags and bug reports: what the learner wants fixed, with why.
//
// A report is {id, kind, reasons, note, subject, screen, at, updatedAt,
// version, status, resolvedAt?, fix?}.
// - kind "card": a sentence, a word, an N2 question or check — `subject`
//   names it ({type, id, text, reading?, extra?}).
// - kind "bug": anything else; `subject` is the screen, optionally with the
//   card that was on it.
// `status` is "open", "withdrawn" (the learner removed the flag) or "fixed"
// (set by whoever fixed it, in the gist; the merge brings it back here).
//
// Reports live in their own IndexedDB database (`jp-echo-reports`), shared
// by Echo and the N2 page, and sync to the learner's backup gist as a second
// file, `echo-reports.json` (gist-backup.js `syncReports`): read, merge by
// id (the later `updatedAt` wins), write. They are not learning data, so they
// are not in `buildBackup`, an export or a deck. Pure parts are tested in
// test/reports.test.js.

import {syncReports} from "./gist-backup.js";

export const REPORT_REASONS = Object.freeze({
  card: Object.freeze([
    ["reading", "Wrong reading"],
    ["voice", "Voice says it wrong"],
    ["meaning", "Wrong meaning"],
    ["unnatural", "Unnatural Japanese"],
    ["answer", "Wrong answer or key"],
    ["other", "Something else"],
  ]),
  bug: Object.freeze([
    ["broken", "Something broke"],
    ["confusing", "Confusing"],
    ["looks", "Looks wrong"],
    ["slow", "Slow"],
    ["idea", "Idea"],
  ]),
});
export const NOTE_MAX = 2000;
const TEXT_MAX = 600;

const clip = (value, max) => String(value ?? "").replace(/[ \t]+/g, " ").trim().slice(0, max);
const time = value => Date.parse(value || 0) || 0;
const uuid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

// Where the report was made: the path and query only. A #fragment can carry a
// shared key (Settings → Invite), so it never leaves the device.
export function screenOf(location = globalThis.location, title = "") {
  const path = location ? String(location.pathname || "/") + String(location.search || "") : "";
  return {path: clip(path, 300), title: clip(title, 120)};
}

function cleanSubject(subject) {
  if (!subject || typeof subject !== "object") return null;
  const out = {type: clip(subject.type, 40) || "screen"};
  for (const key of ["id", "text", "reading", "meaning"]) if (subject[key]) out[key] = clip(subject[key], TEXT_MAX);
  if (subject.extra && typeof subject.extra === "object") {
    out.extra = {};
    for (const [k, v] of Object.entries(subject.extra).slice(0, 12)) if (v != null && v !== "") out.extra[clip(k, 40)] = clip(typeof v === "object" ? JSON.stringify(v) : v, TEXT_MAX);
  }
  return out;
}

export function createReport({kind = "bug", reasons = [], note = "", subject = null, screen = {}, version = "", device = {}, now = new Date()} = {}) {
  kind = kind === "card" ? "card" : "bug";
  const known = new Set(REPORT_REASONS[kind].map(r => r[0]));
  const at = now.toISOString();
  return {
    id: uuid(), kind,
    reasons: [...new Set((Array.isArray(reasons) ? reasons : []).filter(r => known.has(r)))],
    note: String(note ?? "").trim().slice(0, NOTE_MAX),
    subject: cleanSubject(subject),
    screen: {path: clip(screen.path, 300), title: clip(screen.title, 120)},
    version: clip(version, 40),
    device: {width: Number(device.width) || 0, theme: clip(device.theme, 10), ua: clip(device.ua, 160)},
    at, updatedAt: at, status: "open",
  };
}

// Whether a report says anything: a reason, a note, or (for a card) the card.
export const reportHasContent = report => !!(report && (report.reasons.length || report.note || report.kind === "card"));

export function withdrawReport(report, now = new Date()) {
  return {...report, status: "withdrawn", updatedAt: now.toISOString()};
}

// Merge two lists by id; the later updatedAt wins, so a "fixed" written in the
// gist and a "withdrawn" made on the phone both survive the next sync.
export function mergeReports(...lists) {
  const byId = new Map();
  for (const list of lists) for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r.id !== "string" || !r.id) continue;
    const prev = byId.get(r.id);
    if (!prev || time(r.updatedAt) >= time(prev.updatedAt)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => time(b.at) - time(a.at));
}

// The open card reports for one subject (to withdraw them with the flag).
export const openFor = (reports, type, id) => reports.filter(r => r.status === "open" && r.kind === "card" && r.subject?.type === type && r.subject?.id === id);

// The document in the gist: newest first, open ones easy to find.
export function reportsDocument(reports, now = new Date()) {
  const list = mergeReports(reports);
  return {app: "echo", kind: "reports", schemaVersion: 1, updatedAt: now.toISOString(), open: list.filter(r => r.status === "open").length, reports: list};
}

// ---- IndexedDB (browser only) ----
const DB_NAME = "jp-echo-reports", STORE = "reports";
let dbPromise = null;
function openDb() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, {keyPath: "id"});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = null; reject(request.error); };
  });
  return dbPromise;
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error("Could not save the report."));
  });
}
export const listReports = () => tx("readonly", store => store.getAll()).then(list => mergeReports(list));
export const putReport = report => tx("readwrite", store => store.put(report)).then(() => report);
export async function putReports(reports) { await tx("readwrite", store => { for (const r of reports) store.put(r); }); return reports; }

// The build that made the report: the newest Echo cache name (jp-echo-vNNN).
export async function appVersion() {
  try { const keys = await caches.keys(); return keys.filter(k => /^jp-echo-v\d+/.test(k)).sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]))[0] || ""; }
  catch { return ""; }
}
export function deviceInfo() {
  const set = document.documentElement.dataset.theme;
  const theme = set === "light" || set === "dark" ? set : (matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return {width: innerWidth, theme, ua: navigator.userAgent};
}

// ---- Sync (browser only) ----
// Both pages read the gist settings Echo keeps in localStorage. A report is
// uploaded a moment after it is filed; each page also syncs once on open, so
// a report marked "fixed" in the gist comes back. Bookkeeping is its own key.
const SYNC_KEY = "jp-echo-reports-sync", MIN_GAP_MS = 60_000;
export function reportSyncState() { try { const v = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } }
function patchSync(patch) { const next = {...reportSyncState(), ...patch}; try { localStorage.setItem(SYNC_KEY, JSON.stringify(next)); } catch {} return next; }
function gistSettings() { try { const s = JSON.parse(localStorage.getItem("jp-echo-settings") || "{}"); return {on: !!s.gistAuto, token: s.gistToken || "", gist: s.gistUrl || ""}; } catch { return {on: false, token: "", gist: ""}; } }
export function reportSyncLine() {
  const g = gistSettings(), state = reportSyncState();
  if (!g.on || !g.token) return "Saved on this device. Turn on gist backup in Settings → Backup to sync reports.";
  if (!g.gist) return "Saved on this device. Reports sync once the first gist backup has run.";
  if (state.lastError) return "Saved on this device. Last sync failed: " + state.lastError;
  return "Saved on this device and synced to your backup gist.";
}
let timer = null, running = null;
export function scheduleReportSync(delay = 1500) { clearTimeout(timer); timer = setTimeout(() => runReportSync().catch(() => {}), delay); }
export async function runReportSync({force = false} = {}) {
  if (running) return running;
  const g = gistSettings();
  if (!g.on || !g.token || !g.gist) return null;
  const state = reportSyncState();
  if (!force && !state.dirty && Date.now() - (Number(state.lastAttemptAt) || 0) < MIN_GAP_MS) return null;
  patchSync({lastAttemptAt: Date.now()});
  running = (async () => {
    try {
      const local = await listReports();
      const {reports} = await syncReports({token: g.token, gist: g.gist, reports: local, merge: mergeReports, toDocument: reportsDocument});
      await putReports(reports);
      patchSync({dirty: false, lastError: "", lastSuccessAt: Date.now(), open: reports.filter(r => r.status === "open").length});
      return reports;
    } catch (error) { patchSync({lastError: error.message || String(error)}); throw error; }
    finally { running = null; }
  })();
  return running;
}
// File a report: saved first (awaited), then a sync is scheduled.
export async function fileReport(report) { await putReport(report); patchSync({dirty: true}); scheduleReportSync(); return report; }
export async function withdrawOpen(type, id) {
  const open = openFor(await listReports(), type, id);
  if (!open.length) return 0;
  await putReports(open.map(r => withdrawReport(r))); patchSync({dirty: true}); scheduleReportSync();
  return open.length;
}
