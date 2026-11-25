// Two-way sync through the learner's gist. Each device keeps its own data;
// the gist is where they meet. One gist, one file per kind of data:
//   echo-backup.json   the library (buildBackup in app.js): sentences, notes,
//                      saved words, catalogues, preferences, deletions
//   echo-n2.json       N2 study (n2-progress.js): papers, finished attempts,
//                      recall records, Day Radio events, the goal
//   echo-reports.json  flags and bug reports (reports.js)
// A sync pulls first — a tiny version check, then only files whose content
// changed — merges each into this device, then pushes the files this device
// changed, or whose merge left this device with something the gist lacks.
// Merges are unions that never lose a review; deletions travel as dated
// tombstones, so a delete on one device is not undone by another.
//
// Pure parts (merges, tombstones, signatures, the decision what to push) are
// tested in test/sync.test.js; the engine takes its fetch from gist-backup.js.
import {GIST_API, QUIET_MS, MIN_INTERVAL_MS, parseGistId, readGistIndex, readGistFile, writeGistFiles, gistVersion} from "./gist-backup.js";

export const FILES = Object.freeze({backup: "echo-backup.json", n2: "echo-n2.json", reports: "echo-reports.json"});
const time = value => value ? Date.parse(value) || 0 : 0;

// ---- Tombstones ----
// {sentences: {id: at}, notes: {key: at}}. The later deletion wins a merge;
// an item survives a tombstone only if it was changed after the deletion.
export function mergeDeleted(...lists) {
  const out = {sentences: {}, notes: {}};
  for (const list of lists) for (const kind of ["sentences", "notes"]) for (const [id, at] of Object.entries(list?.[kind] || {})) {
    if (typeof id !== "string" || !id || !time(at)) continue;
    if (!out[kind][id] || time(at) > time(out[kind][id])) out[kind][id] = new Date(time(at)).toISOString();
  }
  return out;
}
export function applyDeleted(items, deleted = {}, {key = "id", stamp = item => item.updatedAt || item.createdAt} = {}) {
  return items.filter(item => { const at = deleted[item?.[key]]; return !at || time(stamp(item)) > time(at); });
}
const DELETED_KEY = "jp-echo-deleted";
export function readDeleted() { try { return mergeDeleted(JSON.parse(localStorage.getItem(DELETED_KEY) || "{}")); } catch { return mergeDeleted(); } }
export function saveDeleted(value) { try { localStorage.setItem(DELETED_KEY, JSON.stringify(mergeDeleted(value))); } catch {} }
export function recordDeletion(kind, ids, now = new Date()) {
  const at = now.toISOString(), current = readDeleted();
  for (const id of [].concat(ids)) if (id) current[kind][id] = at;
  saveDeleted(current);
}

export function forgetDeletion(kind, ids) {
  const current = readDeleted();
  for (const id of [].concat(ids)) if (id) delete current[kind][id];
  saveDeleted(current);
}

// Two copies of one sentence edited in the same millisecond: the library
// merge keeps the local copy on a tie, so each device would keep its own.
// Before merging, the copy with the greater content takes the local place on
// every device; reviews are still combined by the merge.
export function breakTies(current, incoming) {
  const byId = new Map((incoming || []).map(x => [x?.id, x]));
  return current.map(c => { const o = byId.get(c?.id); return o && o.updatedAt === c.updatedAt && JSON.stringify(o) > JSON.stringify(c) ? {...o, reviews: c.reviews} : c; });
}

// ---- N2 study ----
// A recall record's history is its events: two devices' records for one item
// combine their events, and the counters are recomputed from them.
export function mergeRecall(a, b) {
  if (!a) return b; if (!b) return a;
  const events = [...new Map([...(a.events || []), ...(b.events || [])].map(e => [e.at + "|" + e.grade, e])).values()].sort((x, y) => time(x.at) - time(y.at));
  const newest = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  let days = [];
  for (const e of events) { const day = e.day || localDayOf(e.at); days = e.grade === "instant" ? [...new Set([...days, day])] : []; }
  const last = events[events.length - 1];
  return {...newest, checks: Math.max(events.length, a.checks || 0, b.checks || 0), events, days: events.length ? days : (newest.days || []),
    last: last?.grade || newest.last, updatedAt: new Date(Math.max(time(a.updatedAt), time(b.updatedAt))).toISOString()};
}
const localDayOf = at => { const d = new Date(at); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
// A finished attempt beats an unfinished one, then more answers, more causes, later.
const attemptRank = a => [a?.phase === "results" ? 1 : 0, (a?.answers || []).filter(Boolean).length, Object.keys(a?.causes || {}).length, time(a?.completedAt || a?.startedAt)];
// Which copy of an attempt leads; a full tie is broken by content, so every
// device picks the same one.
function leader(a, b) {
  const ra = attemptRank(a), rb = attemptRank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] > ra[i] ? [b, a] : [a, b];
  return JSON.stringify(b) > JSON.stringify(a) ? [b, a] : [a, b];
}
// Error causes are per question and can be tagged on either device: both
// devices' tags are kept. For the same question the later dated edit wins
// (causesAt), then the leading copy's tag.
export function mergeCauses(lead, other) {
  const causes = {...(other?.causes || {}), ...(lead?.causes || {})}, at = {...(other?.causesAt || {}), ...(lead?.causesAt || {})};
  for (const index of Object.keys(other?.causes || {})) {
    const mine = time(lead?.causesAt?.[index]), theirs = time(other?.causesAt?.[index]);
    if (lead?.causes?.[index] !== undefined && theirs > mine) { causes[index] = other.causes[index]; at[index] = other.causesAt[index]; }
  }
  return {causes, causesAt: at};
}
export function betterAttempt(a, b) {
  if (!a) return b; if (!b) return a;
  const [lead, other] = leader(a, b);
  if (!lead.causes && !other.causes) return lead;
  const {causes, causesAt} = mergeCauses(lead, other);
  return {...lead, causes, ...(Object.keys(causesAt).length ? {causesAt} : {})};
}
const byId = (list, pick) => { const out = new Map(); for (const x of list || []) if (x?.id) out.set(x.id, out.has(x.id) ? pick(out.get(x.id), x) : x); return out; };
export function mergeN2(local = {}, remote = {}) {
  const pick = (map, list, choose) => { for (const x of list || []) if (x?.id) map.set(x.id, map.has(x.id) ? choose(map.get(x.id), x) : x); return [...map.values()]; };
  const localAt = time(local.goalAt), remoteAt = time(remote.goalAt);
  const useRemote = remoteAt !== localAt ? remoteAt > localAt :
    remoteAt ? remote.goal == null : local.goal == null;
  const goalSource = useRemote ? remote : local;
  return {
    app: "echo", kind: "n2", schemaVersion: 1,
    papers: pick(byId(local.papers, a => a), remote.papers, a => a),
    history: pick(byId(local.history, betterAttempt), remote.history, betterAttempt),
    recall: pick(byId(local.recall, mergeRecall), remote.recall, mergeRecall),
    events: pick(byId(local.events, a => a), remote.events, a => a),
    // Night Radio nights (n2-night.js): one per day, the later save wins.
    nights: pick(byId(local.nights, a => a), remote.nights, (a, b) => time(b.at) > time(a.at) ? b : a).sort((a, b) => String(a.day).localeCompare(String(b.day))),
    goal: goalSource.goal ?? null,
    goalAt: goalSource.goalAt || "",
  };
}

// ---- Signatures ----
// What a document holds, ignoring when it was written: if this device's data
// after a merge has the same signature as the gist's file, there is nothing
// to push back. Without this, two devices would echo each other's uploads.
export function hash(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ":" + text.length; }
const rows = (list, fn) => (list || []).map(fn).sort().join("\n");
export const signatures = {
  backup: doc => hash([
    rows(doc?.sentences, s => [s.id, time(s.updatedAt), (s.reviews || []).length, s.srs?.reps || 0, s.echoCount || 0, s.flagged ? 1 : 0].join("|")),
    rows(doc?.notes, n => [n.key, time(n.made)].join("|")),
    rows(doc?.words, w => [w.id, time(w.updatedAt), time(w.removedAt)].join("|")),
    ...["words","grammar","references"].map(key => rows(doc?.catalogues?.[key], item => JSON.stringify(item))),
    rows(Object.entries(doc?.deleted?.sentences || {}), ([id, at]) => id + "|" + time(at)),
    rows(Object.entries(doc?.deleted?.notes || {}), ([id, at]) => id + "|" + time(at)),
  ].join("\n#\n")),
  n2: doc => hash([
    rows(doc?.papers, p => p.id),
    rows(doc?.history, a => attemptRank(a).join("|") + "|" + a.id + "|" + JSON.stringify(Object.entries(a.causes || {}).sort())),
    rows(doc?.recall, r => [r.id, (r.events || []).length, time(r.updatedAt)].join("|")),
    rows(doc?.events, e => e.id),
    rows(doc?.nights, n => [n.id, time(n.at)].join("|")),
    JSON.stringify(doc?.goal || null), time(doc?.goalAt),
  ].join("\n#\n")),
  reports: doc => hash(rows(doc?.reports, r => [r.id, time(r.updatedAt), r.status].join("|"))),
};

// ---- State and dirty marks (browser) ----
// One key for the whole device: which file contents (by raw URL hash) this
// device has merged, the gist version each page last saw, and what is dirty.
const STATE_KEY = "jp-echo-sync";
export function syncState() { try { const v = JSON.parse(localStorage.getItem(STATE_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } }
export function patchSyncState(patch) { const next = {...syncState(), ...patch}; try { localStorage.setItem(STATE_KEY, JSON.stringify(next)); } catch {} return next; }
export function markDirty(kind, now = Date.now()) {
  const state = syncState();
  patchSyncState({dirty: {...(state.dirty || {}), [kind]: now}, lastChangeAt: now});
  try { globalThis.dispatchEvent?.(new CustomEvent("echo:sync-dirty", {detail: {kind}})); } catch {}
}
export function gistSettings() {
  try { const s = JSON.parse(localStorage.getItem("jp-echo-settings") || "{}"); return {on: !!s.gistAuto, token: s.gistToken || "", gist: s.gistUrl || ""}; }
  catch { return {on: false, token: "", gist: ""}; }
}

// Which kinds to push: dirty here, or a merge left this device ahead.
export function toPush({kinds, dirty = {}, ahead = {}}) { return kinds.filter(k => dirty[k] || ahead[k]); }

// ---- The engine ----
// adapters: {[kind]: {read: async () => doc, merge: async remoteDoc => mergedLocalDoc}}
// page: "app" | "n2" (each page remembers the gist version it last saw, since
// the N2 page does not merge the library). Runs under a Web Lock when the
// browser has them, so two open Echo pages never sync at once.
export async function syncGist({adapters, page, push = true, create = null, credentials = null, fetchImpl = globalThis.fetch?.bind(globalThis), onStatus = () => {}} = {}) {
  const run = () => syncOnce({adapters, page, push, create, credentials, fetchImpl, onStatus});
  if (globalThis.navigator?.locks?.request) return navigator.locks.request("echo-gist-sync", run);
  return run();
}
async function syncOnce({adapters, page, push, create, credentials, fetchImpl, onStatus}) {
  const settings = credentials || gistSettings();
  if (!settings.on || !settings.token) return {skipped: "off"};
  const kinds = Object.keys(adapters);
  let id = parseGistId(settings.gist);
  const state = syncState(), seen = {...(state.seen || {})}, ahead = {};
  const versions = {...(state.versions || {})};
  const recovery = {...(state.recovery || {})};
  // A concurrent PATCH may have displaced a revision carrying offline work.
  // Merge its touched files before our next upload, even after restarting.
  const pending = recovery[id] || [];
  for (const entry of pending) {
    if (!adapters[entry.kind]) continue;
    const prior = await readGistIndex({id, revision: entry.revision, token: settings.token, fetchImpl});
    const file = prior.files[FILES[entry.kind]];
    if (file) await adapters[entry.kind].merge(await readGistFile({file, fetchImpl}));
    ahead[entry.kind] = true;
  }
  recovery[id] = pending.filter(entry => !adapters[entry.kind]);
  const pulled = [];
  let observed = null;
  if (id) {
    onStatus("checking");
    const version = observed = await gistVersion({id, token: settings.token, fetchImpl});
    if (version !== versions[page]) {
      const index = await readGistIndex({id, token: settings.token, fetchImpl});
      for (const kind of kinds) {
        const file = index.files[FILES[kind]];
        // Not in the gist yet (a new kind, or a first sync): this device is ahead.
        if (!file) { ahead[kind] = true; continue; }
        if (file.sha && seen[FILES[kind]] === file.sha) continue;
        onStatus("pulling");
        const remote = await readGistFile({file, fetchImpl});
        const merged = await adapters[kind].merge(remote);
        seen[FILES[kind]] = file.sha; pulled.push(kind);
        if (signatures[kind](merged) !== signatures[kind](remote)) ahead[kind] = true;
      }
      versions[page] = version;
    }
  } else if (!create) return {skipped: "no-gist"};
  const dirty = syncState().dirty || {};
  for (const kind of Object.keys(ahead)) if (!dirty[kind]) dirty[kind] = Date.now();
  if (Object.keys(ahead).length) patchSyncState({dirty});
  const kindsToPush = push ? (!id ? kinds : toPush({kinds, dirty, ahead})) : [];
  let wrote = null;
  if (kindsToPush.length) {
    onStatus("pushing");
    const files = {};
    for (const kind of kindsToPush) files[FILES[kind]] = await adapters[kind].read();
    wrote = await writeGistFiles({id, token: settings.token, files, description: create?.description?.(files), fetchImpl});
    if (!id) { id = wrote.id; await create?.created?.(wrote); }
    for (const [name, sha] of Object.entries(wrote.shas)) if (Object.hasOwn(files, name)) seen[name] = sha;
    // Someone else wrote between our check and our write: look again next time.
    const overlap = observed && wrote.previous && wrote.previous !== observed;
    versions[page] = overlap ? null : wrote.version;
    if (overlap) recovery[id] = [...(recovery[id] || []), ...kindsToPush.map(kind => ({kind, revision: wrote.previous}))];
    const now = syncState().dirty || {};
    const left = {...now}; for (const kind of kindsToPush) if (now[kind] === dirty[kind]) delete left[kind];
    if (overlap) for (const kind of kindsToPush) left[kind] ||= Date.now();
    patchSyncState({dirty: left, recovery, lastPushAt: Date.now()});
  }
  patchSyncState({seen, versions, recovery, lastSyncAt: Date.now(), lastError: ""});
  return {pulled, pushed: kindsToPush, wrote};
}
// When a page may push: leaving or opening the app, a manual sync, or once
// changes have been quiet for a while — never more often than the minimum
// interval unless asked. Pulling is a tiny version check and always allowed.
export function mayPush({reason, now = Date.now(), lastChangeAt = 0, lastPushAt = 0, quietMs = QUIET_MS, minGapMs = MIN_INTERVAL_MS}) {
  if (reason === "manual") return true;
  if (now - (Number(lastPushAt) || 0) < minGapMs) return false;
  return reason === "hidden" || reason === "open" || now - (Number(lastChangeAt) || 0) >= quietMs;
}
// One scheduler per page: pull on open and when the page comes back (at most
// once a minute), push after quiet and when the page is hidden.
export function startAutoSync({adapters, page, create = null, onResult = () => {}, onError = () => {}, pullGapMs = 60_000} = {}) {
  let timer = null, running = null, lastPull = 0;
  const go = reason => {
    if (running) return running;
    const state = syncState(), now = Date.now();
    const push = mayPush({reason, now, lastChangeAt: state.lastChangeAt, lastPushAt: state.lastPushAt});
    if (!push && reason === "visible" && now - lastPull < pullGapMs) return Promise.resolve(null);
    lastPull = now;
    running = syncGist({adapters, page, push, create})
      .then(result => { onResult(result, reason); return result; })
      .catch(error => { patchSyncState({lastError: error.message || String(error)}); onError(error, reason); if (reason === "manual") throw error; return null; })
      .finally(() => { running = null; schedule(); });
    return running;
  };
  const schedule = () => {
    clearTimeout(timer);
    const state = syncState(), dirty = Object.keys(state.dirty || {}).filter(k => k in adapters);
    if (!dirty.length || !gistSettings().on) return;
    const at = Math.max((Number(state.lastChangeAt) || 0) + QUIET_MS, (Number(state.lastPushAt) || 0) + MIN_INTERVAL_MS);
    timer = setTimeout(() => go("change"), Math.max(1000, at - Date.now() + 500));
  };
  addEventListener("echo:sync-dirty", schedule);
  document.addEventListener("visibilitychange", () => go(document.hidden ? "hidden" : "visible"));
  setTimeout(() => go("open"), 1500);
  return {syncNow: () => go("manual"), schedule, run: options => syncGist({adapters, page, create, ...options}).then(result => { onResult(result, "manual"); return result; })};
}
export { GIST_API };
