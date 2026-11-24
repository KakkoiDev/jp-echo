// Recovery helpers for Settings → Backup (pure; test/restore.test.js).
// - One portable file with everything the gist holds: the library, N2 study
//   and reports, as the same three documents sync writes. It opens in Import,
//   offline, and restores by merging like a gist.
// - Counts and a preview for an earlier gist save, so the learner sees what a
//   restore would bring before applying it. A restore only ever merges: it
//   adds what this device lacks and keeps everything newer here.
import {FILES} from "./sync.js";

export const BUNDLE_KIND = "echo-all";
export function allDataBundle(docs, now = new Date()) {
  const files = {};
  for (const name of Object.values(FILES)) if (docs[name]) files[name] = docs[name];
  return {app: "echo", kind: BUNDLE_KIND, schemaVersion: 1, exportedAt: now.toISOString(), files};
}
export const isAllDataBundle = value => !!(value && typeof value === "object" && value.app === "echo" && value.kind === BUNDLE_KIND && value.files && typeof value.files === "object");

const list = value => Array.isArray(value) ? value : [];
const reviewKey = r => (r?.at || "") + "|" + (r?.rating || "") + "|" + (r?.mode || "");
const finished = a => a?.phase === "results";

// What a set of documents holds, in the learner's terms.
export function bundleCounts(docs = {}) {
  const backup = docs[FILES.backup] || {}, n2 = docs[FILES.n2] || {}, reports = docs[FILES.reports] || {};
  const sentences = list(backup.sentences);
  return {
    sentences: sentences.length,
    reviews: sentences.reduce((n, s) => n + list(s.reviews).length, 0),
    exams: list(n2.history).filter(finished).length,
    recallChecks: list(n2.recall).reduce((n, r) => n + list(r.events).length, 0),
    radio: list(n2.events).length,
    reports: list(reports.reports).length,
    hasLibrary: !!docs[FILES.backup], hasN2: !!docs[FILES.n2], hasReports: !!docs[FILES.reports],
  };
}

// What restoring `incoming` would add to this device (never what it removes:
// a restore merges). Deletions recorded here keep their sentences away.
export function restorePreview(local = {}, incoming = {}) {
  const lb = local[FILES.backup] || {}, ib = incoming[FILES.backup] || {};
  const ln = local[FILES.n2] || {}, inn = incoming[FILES.n2] || {};
  const deleted = lb.deleted?.sentences || {};
  const localSentences = new Map(list(lb.sentences).map(s => [s.id, s]));
  let sentences = 0, reviews = 0;
  for (const s of list(ib.sentences)) {
    const here = localSentences.get(s.id);
    if (!here) { if (!deleted[s.id] || Date.parse(s.updatedAt || 0) > Date.parse(deleted[s.id])) { sentences++; reviews += list(s.reviews).length; } continue; }
    const known = new Set(list(here.reviews).map(reviewKey));
    reviews += list(s.reviews).filter(r => !known.has(reviewKey(r))).length;
  }
  const localExams = new Map(list(ln.history).map(a => [a.id, a]));
  const exams = list(inn.history).filter(a => finished(a) && !finished(localExams.get(a.id))).length;
  const localRecall = new Map(list(ln.recall).map(r => [r.id, new Set(list(r.events).map(e => e.at + "|" + e.grade))]));
  let recallChecks = 0;
  for (const r of list(inn.recall)) { const known = localRecall.get(r.id) || new Set(); recallChecks += list(r.events).filter(e => !known.has(e.at + "|" + e.grade)).length; }
  const localEvents = new Set(list(ln.events).map(e => e.id));
  const radio = list(inn.events).filter(e => !localEvents.has(e.id)).length;
  return {sentences, reviews, exams, recallChecks, radio, nothing: !(sentences || reviews || exams || recallChecks || radio)};
}

const plural = (n, one, many = one + "s") => n.toLocaleString() + " " + (n === 1 ? one : many);
export function countsLine(c) {
  return [c.hasLibrary !== false && plural(c.sentences, "sentence"), c.hasLibrary !== false && plural(c.reviews, "review"),
    c.hasN2 !== false && plural(c.exams, "finished exam"), c.hasN2 !== false && plural(c.recallChecks, "recall check")].filter(Boolean).join(" · ");
}
export function previewLine(p) {
  if (p.nothing) return "Everything in this save is already on this device.";
  const parts = [p.sentences && plural(p.sentences, "sentence"), p.reviews && plural(p.reviews, "review"), p.exams && plural(p.exams, "finished exam"),
    p.recallChecks && plural(p.recallChecks, "recall check"), p.radio && plural(p.radio, "Day Radio play")].filter(Boolean);
  return "New to this device: " + parts.join(", ") + ". Everything here is kept.";
}
