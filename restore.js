// Recovery helpers for Settings → Backup (pure; test/restore.test.js).
// - One portable file with everything the gist holds: the library, N2 study
//   and reports, as the same three documents sync writes. It opens in Import,
//   offline, and restores by merging like a gist.
// - Counts and a preview for an earlier gist save, so the learner sees what a
//   restore would bring before applying it. A restore only ever merges: it
//   adds what this device lacks and keeps everything newer here.
import {FILES, mergeN2} from "./sync.js";
import {mergeSentences} from "./core.js";
import {mergeNotes} from "./notes.js";
import {mergeWords} from "./saved-words.js";
import {mergeReports} from "./reports.js";
import {mergeCatalogues} from "./catalogues.js";

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

// What restoring `incoming` would change on this device (bug handoff 25 Nov,
// #3). It runs the very merges a restore runs (applyDocuments in app.js:
// mergeSentences, mergeNotes, mergeWords, mergeCatalogues, mergeN2,
// mergeReports) and compares the result with this device, so the preview
// cannot promise less or more than Apply does. A restore is an explicit
// import, so a sentence deleted here comes back: that is a recovery, named
// as such. Both sides are normalised the same way (merged with themselves),
// so a record that only differs in shape is not counted as a change.
const sig = value => JSON.stringify(value);
function changes(base, after, key) {
  const before = new Map(base.map(x => [key(x), sig(x)]));
  const added = [], updated = [];
  for (const x of after) { const k = key(x); if (!before.has(k)) added.push(x); else if (before.get(k) !== sig(x)) updated.push(x); }
  return {added, updated};
}
const byKey = (rows, key) => new Map(rows.map(x => [key(x), x]));
export function restorePreview(local = {}, incoming = {}) {
  const lb = local[FILES.backup] || {}, ib = incoming[FILES.backup];
  const ln = local[FILES.n2] || {}, inn = incoming[FILES.n2];
  const lr = local[FILES.reports] || {}, ir = incoming[FILES.reports];
  const p = {sentences: 0, recovered: 0, updatedSentences: 0, reviews: 0, notes: 0, updatedNotes: 0, words: 0, updatedWords: 0, dictionary: 0,
    exams: 0, updatedExams: 0, papers: 0, recallChecks: 0, radio: 0, nights: 0, goal: false, reports: 0, updatedReports: 0};
  if (ib) {
    const deleted = lb.deleted?.sentences || {};
    const norm = x => mergeSentences(x, x);
    const base = norm(list(lb.sentences)), after = norm(mergeSentences(list(lb.sentences), list(ib.sentences)));
    const {added, updated} = changes(base, after, s => s.id), old = byKey(base, s => s.id);
    for (const s of added) { if (deleted[s.id]) p.recovered++; else p.sentences++; p.reviews += list(s.reviews).length; }
    p.updatedSentences = updated.length;
    for (const s of updated) p.reviews += Math.max(0, list(s.reviews).length - list(old.get(s.id)?.reviews).length);
    if (Array.isArray(ib.notes)) { const n = changes(mergeNotes(list(lb.notes), []), mergeNotes(list(lb.notes), ib.notes), x => x.key); p.notes = n.added.length; p.updatedNotes = n.updated.length; }
    // mergeWords leaves a lone record as it came and normalises a merged one.
    if (Array.isArray(ib.words)) { const norm = x => mergeWords(x, x), w = changes(norm(list(lb.words)), norm(mergeWords(list(lb.words), ib.words)), x => x.id); p.words = w.added.length; p.updatedWords = w.updated.length; }
    const lc = lb.catalogues || {}, cb = mergeCatalogues({}, lc), ca = mergeCatalogues(lc, ib.catalogues || {});
    for (const key of ["words", "grammar", "references"]) { const c = changes(list(cb[key]), list(ca[key]), x => x.id ?? sig(x)); p.dictionary += c.added.length + c.updated.length; }
  }
  if (inn) {
    const norm = d => mergeN2(d, d), base = norm(ln), after = norm(mergeN2(ln, inn));
    const h = changes(base.history, after.history, a => a.id), was = byKey(base.history, a => a.id);
    for (const a of [...h.added, ...h.updated]) if (finished(a)) { if (finished(was.get(a.id))) p.updatedExams++; else p.exams++; }
    p.papers = changes(base.papers, after.papers, x => x.id).added.length;
    const r = changes(base.recall, after.recall, x => x.id), oldRecall = byKey(base.recall, x => x.id);
    for (const x of [...r.added, ...r.updated]) p.recallChecks += Math.max(0, list(x.events).length - list(oldRecall.get(x.id)?.events).length);
    p.radio = changes(base.events, after.events, x => x.id).added.length;
    p.nights = changes(list(base.nights), list(after.nights), x => x.id).added.length;
    p.goal = sig(base.goal ?? null) !== sig(after.goal ?? null);
  }
  if (ir) { const c = changes(mergeReports(list(lr.reports)), mergeReports(list(lr.reports), list(ir.reports)), x => x.id); p.reports = c.added.length; p.updatedReports = c.updated.length; }
  p.nothing = !Object.entries(p).some(([, v]) => v);
  return p;
}

const plural = (n, one, many = one + "s") => n.toLocaleString() + " " + (n === 1 ? one : many);
export function countsLine(c) {
  return [c.hasLibrary !== false && plural(c.sentences, "sentence"), c.hasLibrary !== false && plural(c.reviews, "review"),
    c.hasN2 !== false && plural(c.exams, "finished exam"), c.hasN2 !== false && plural(c.recallChecks, "recall check")].filter(Boolean).join(" · ");
}
// Additions, recoveries and updates are told apart. With nothing to change,
// the line names what it compared rather than claiming the whole save.
export function previewLine(p) {
  if (p.nothing) return "Nothing to bring in: no new or newer sentences, reviews, notes, saved words, exams, recall checks, Day Radio plays, Night Radio nights, reports or goal.";
  const join = parts => parts.filter(Boolean).join(", ");
  const added = join([p.sentences && plural(p.sentences, "sentence"), p.reviews && plural(p.reviews, "review"), p.notes && plural(p.notes, "note"),
    p.words && plural(p.words, "saved word"), p.exams && plural(p.exams, "finished exam"), p.papers && plural(p.papers, "practice paper"),
    p.recallChecks && plural(p.recallChecks, "recall check"), p.radio && plural(p.radio, "Day Radio play"), p.nights && plural(p.nights, "Night Radio night"), p.reports && plural(p.reports, "report"),
    p.dictionary && plural(p.dictionary, "dictionary entry", "dictionary entries")]);
  const updated = join([p.updatedSentences && plural(p.updatedSentences, "sentence"), p.updatedNotes && plural(p.updatedNotes, "note"),
    p.updatedWords && plural(p.updatedWords, "saved word"), p.updatedExams && plural(p.updatedExams, "exam"), p.updatedReports && plural(p.updatedReports, "report"),
    p.goal && "your exam goal"]);
  return [added && "New to this device: " + added + ".",
    p.recovered && "Brought back: " + plural(p.recovered, "sentence") + " deleted here.",
    updated && "Newer in this save: " + updated + ".",
    "Everything else here is kept."].filter(Boolean).join(" ");
}

// Earlier saves (bug handoff 25 Nov, #2): only the latest choice may publish
// its preview. begin() returns a check that stays true until another choice,
// Back, close or reopen; cancel() voids whatever is still loading.
export function latestRequest() {
  let n = 0;
  return {begin() { const ticket = ++n; return () => ticket === n; }, cancel() { n++; }};
}
