// Flags and bug reports: what the learner wants fixed, with why.
//
// A report is {id, kind, reasons, note, subject, screen, at, updatedAt,
// version, status, resolvedAt?, fix?}.
// - kind "card": a sentence, a word, an N2 question or check — `subject`
//   names it ({type, id, text, reading?, extra?}).
// - kind "bug": anything else; `subject` is the screen, optionally with the
//   card that was on it.
// `status` is "open", "done" (the learner closed it), "withdrawn" (the learner removed the flag) or "fixed"
// (set by whoever fixed it, in the gist; the merge brings it back here).
//
// Reports live in their own IndexedDB database (`jp-echo-reports`), shared
// by Echo and the N2 page, and sync through the gist as `echo-reports.json`
// (sync.js): merged by id, the later `updatedAt` wins. They are not learning data, so they
// are not in `buildBackup`, an export or a deck. Pure parts are tested in
// test/reports.test.js.

import {markDirty, gistSettings, syncState} from "./sync.js";

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

// What the screen looked like when it was reported (report 84ce79be): the
// visible markup of one host element, the viewport and the settings that
// change how it renders. A web page cannot take its own screenshot offline;
// with this and styles.css at the report's version, the maintainer rebuilds
// the screen (tools/reports.mjs --html <id>). Hidden parts are left out, the
// markup is capped, and form values are never read.
export const SNAPSHOT_MAX = 16000;
export function screenSnapshot(host) {
  try {
    if (!host) return null;
    const copy = host.cloneNode(true), live = [host, ...host.querySelectorAll("*")], twin = [copy, ...copy.querySelectorAll("*")];
    live.forEach((node, i) => { if (i && (node.hidden || getComputedStyle(node).display === "none" || /^(SCRIPT|STYLE)$/.test(node.tagName))) twin[i].setAttribute("data-drop", ""); });
    for (const node of copy.querySelectorAll("[data-drop]")) node.remove();
    for (const node of copy.querySelectorAll("input,textarea")) node.removeAttribute("value");
    const root = document.documentElement, sheet = document.querySelector('link[rel=stylesheet][href*="styles.css"]')?.getAttribute("href") || "";
    return {html: copy.outerHTML, width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1, scroll: Math.round(scrollY || host.scrollTop || 0), page: Math.max(root.scrollHeight, host.scrollHeight),
      theme: (root.dataset.theme || "system") + "/" + (matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
      motion: (matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "reduce" : "full") + (root.classList.contains("motion-off") ? "/off" : root.classList.contains("motion-on") ? "/on" : ""),
      view: document.body.dataset.view || "", css: sheet};
  } catch { return null; }
}
function cleanSnapshot(s) {
  if (!s || typeof s !== "object" || !s.html) return null;
  return {html: String(s.html).slice(0, SNAPSHOT_MAX), width: Number(s.width) || 0, height: Number(s.height) || 0, dpr: Number(s.dpr) || 1, scroll: Number(s.scroll) || 0, page: Number(s.page) || 0,
    theme: clip(s.theme, 20), motion: clip(s.motion, 20), view: clip(s.view, 20), css: clip(s.css, 60)};
}
export function createReport({kind = "bug", reasons = [], note = "", subject = null, screen = {}, version = "", device = {}, snapshot = null, now = new Date()} = {}) {
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
    ...(cleanSnapshot(snapshot) ? {snapshot: cleanSnapshot(snapshot)} : {}),
    at, updatedAt: at, status: "open",
  };
}

// Whether a report says anything: a reason, a note, or (for a card) the card.
export const reportHasContent = report => !!(report && (report.reasons.length || report.note || report.kind === "card"));

// The learner's own changes to a report they filed (Your reports in the
// sheet): edit its reasons and words, or mark it done / open again. "done"
// is the learner closing it; "fixed" is the maintainer's.
export const REPORT_STATUS = Object.freeze({open: "Open", done: "Done", withdrawn: "Withdrawn", fixed: "Fixed"});
export function editReport(report, {reasons = report.reasons, note = report.note} = {}, now = new Date()) {
  const known = new Set(REPORT_REASONS[report.kind === "card" ? "card" : "bug"].map(r => r[0]));
  return {...report, reasons: [...new Set((Array.isArray(reasons) ? reasons : []).filter(r => known.has(r)))], note: String(note ?? "").trim().slice(0, NOTE_MAX), updatedAt: now.toISOString(), editedAt: now.toISOString()};
}
export function setReportStatus(report, status, now = new Date()) {
  const at = now.toISOString();
  if (status === "done") return {...report, status: "done", resolvedAt: at, updatedAt: at};
  const {resolvedAt, ...rest} = report;
  return {...rest, status: "open", updatedAt: at};
}

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
// The version that is serving this page. The worker in control says so
// itself; an older worker that cannot answer is the lowest cache, because a
// downloaded update waiting its turn already has a higher one. (Taking the
// highest made a report, and the learner, believe an update had arrived.)
const askWorker = () => new Promise(resolve => {
  const worker = globalThis.navigator?.serviceWorker?.controller;
  if (!worker || typeof MessageChannel === "undefined") return resolve("");
  const channel = new MessageChannel(), timer = setTimeout(() => resolve(""), 800);
  channel.port1.onmessage = event => { clearTimeout(timer); resolve(String(event.data || "")); };
  try { worker.postMessage("echo:version", [channel.port2]); } catch { clearTimeout(timer); resolve(""); }
});
export async function appVersion() {
  try {
    const told = await askWorker(); if (/^jp-echo-v\d+/.test(told)) return told;
    const keys = await caches.keys(); return keys.filter(k => /^jp-echo-v\d+/.test(k)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))[0] || "";
  } catch { return ""; }
}
export function deviceInfo() {
  const set = document.documentElement.dataset.theme;
  const theme = set === "light" || set === "dark" ? set : (matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  return {width: innerWidth, theme, ua: navigator.userAgent};
}

// ---- Sync (browser only) ----
// Reports are one of the gist sync's files (sync.js, FILES.reports): filing
// one saves it here, marks reports dirty and the page's sync uploads it.
// A report marked "fixed" in the gist comes back with the next pull.
export function reportSyncLine() {
  const g = gistSettings(), state = syncState();
  if (!g.on || !g.token) return "Saved on this device. Turn on gist sync in Settings → Backup to send reports.";
  if (!g.gist) return "Saved on this device. Reports sync once the first gist sync has run.";
  if (state.lastError) return "Saved on this device. Last sync failed: " + state.lastError;
  if (state.dirty?.reports || !state.lastSyncAt) return "Saved on this device. Waiting to sync reports.";
  return "Saved on this device and synced to your gist.";
}
export const reportsAdapter = () => ({
  read: async () => reportsDocument(await listReports()),
  merge: async remote => { const merged = mergeReports(await listReports(), remote?.reports || []); await putReports(merged); return reportsDocument(merged); },
});
// File a report: saved first (awaited), then marked for the next sync.
export async function fileReport(report) { await putReport(report); markDirty("reports"); return report; }
// What ReportSheet needs for Your reports: the list and the two changes,
// each saved (awaited) and marked for the next sync.
export const reportHistory = Object.freeze({
  list: () => listReports(),
  edit: async (report, changes) => { const next = editReport(report, changes); await putReport(next); markDirty("reports"); return next; },
  setStatus: async (report, status) => { const next = setReportStatus(report, status); await putReport(next); markDirty("reports"); return next; },
  labels: REPORT_STATUS,
});
// Fix this (sentence page): the instruction handed to the rewrite for a
// flagged card. A flag filed with a reason passes the learner's words on; an
// old flag without one asks the model to find the problem itself.
export function fixInstruction(reports = []) {
  const said = reports.filter(r => r.kind === "card").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const labels = new Map(REPORT_REASONS.card);
  const why = said ? [said.reasons.map(r => labels.get(r)).filter(Boolean).join(", "), said.note].filter(Boolean).join(" — ") : "";
  return "The learner flagged this card as wrong." + (why ? " They said: " + why + "." : "")
    + " Find what is incorrect or unnatural — the Japanese, its readings, the meaning, or a list marker or bracketed note left from an import — and fix it."
    + " Keep the intended meaning and keep it a complete natural sentence.";
}
// The learner's own fix closes the card's open reports (status done).
export async function closeOpen(type, id, now = new Date()) {
  const open = openFor(await listReports(), type, id);
  if (!open.length) return 0;
  await putReports(open.map(r => setReportStatus(r, "done", now)));
  markDirty("reports");
  return open.length;
}
export const cardReports = async (type, id) => (await listReports()).filter(r => r.kind === "card" && r.subject?.type === type && r.subject?.id === id && r.status !== "withdrawn");

export async function withdrawOpen(type, id) {
  const open = openFor(await listReports(), type, id);
  if (!open.length) return 0;
  await putReports(open.map(r => withdrawReport(r))); markDirty("reports");
  return open.length;
}
