import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {allDataBundle, isAllDataBundle, bundleCounts, restorePreview, countsLine, previewLine, latestRequest} from "../restore.js";
import {mergeSentences, SCHEMA_VERSION} from "../core.js";
import {mergeNotes} from "../notes.js";
import {mergeWords} from "../saved-words.js";
import {mergeN2} from "../sync.js";
import {mergeReports} from "../reports.js";
import {listGistRevisions} from "../gist-backup.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const s = (id, reviews = [], extra = {}) => ({schemaVersion: SCHEMA_VERSION, id, source: "S " + id, target: "文" + id, updatedAt: "2026-11-20T00:00:00.000Z", reviews, ...extra});
const r = (at, rating = "ok") => ({at, rating, mode: "listen"});

test("the all-data file holds the three sync documents and nothing else", () => {
  const bundle = allDataBundle({"echo-backup.json": {sentences: []}, "echo-n2.json": {history: []}, "echo-reports.json": {reports: []}, "secret.json": {token: "x"}}, new Date("2026-11-24T00:00:00Z"));
  assert.ok(isAllDataBundle(bundle));
  assert.deepEqual(Object.keys(bundle.files), ["echo-backup.json", "echo-n2.json", "echo-reports.json"]);
  assert.equal(bundle.exportedAt, "2026-11-24T00:00:00.000Z");
  assert.ok(!isAllDataBundle({sentences: []}), "a library backup is not an all-data file");
  assert.ok(!JSON.stringify(bundle).includes("token"));
});

test("a save is counted in the learner's terms", () => {
  const docs = {
    "echo-backup.json": {sentences: [s("a", [r("1"), r("2")]), s("b")]},
    "echo-n2.json": {history: [{id: "x", phase: "results"}, {id: "y", phase: "written"}], recall: [{id: "r", events: [{at: "1", grade: "instant"}, {at: "2", grade: "slow"}]}], events: [{id: "e"}]},
  };
  const c = bundleCounts(docs);
  assert.deepEqual([c.sentences, c.reviews, c.exams, c.recallChecks, c.radio], [2, 2, 1, 2, 1]);
  assert.equal(countsLine(c), "2 sentences · 2 reviews · 1 finished exam · 2 recall checks");
  assert.equal(countsLine(bundleCounts({"echo-n2.json": {history: [], recall: []}})), "0 finished exams · 0 recall checks", "a save without a library does not claim zero sentences");
});

// Apply, as applyDocuments does it with the same pure merges: an explicit
// import forgets this device's deletions of what it brings.
function applyLike(local, incoming) {
  const lb = local["echo-backup.json"] || {}, ib = incoming["echo-backup.json"];
  const out = {...local};
  if (ib) {
    const deleted = {...(lb.deleted?.sentences || {})};
    for (const x of ib.sentences || []) delete deleted[x.id];
    out["echo-backup.json"] = {...lb, sentences: mergeSentences(lb.sentences || [], ib.sentences || []), notes: mergeNotes(lb.notes || [], ib.notes || []),
      words: mergeWords(lb.words || [], ib.words || []), deleted: {sentences: deleted}};
  }
  if (incoming["echo-n2.json"]) out["echo-n2.json"] = mergeN2(local["echo-n2.json"] || {}, incoming["echo-n2.json"]);
  if (incoming["echo-reports.json"]) out["echo-reports.json"] = {reports: mergeReports(local["echo-reports.json"]?.reports || [], incoming["echo-reports.json"].reports)};
  return out;
}

test("the preview counts what Apply changes: additions, recoveries and updates, and nothing after Apply (bug handoff #3)", () => {
  const local = {
    "echo-backup.json": {sentences: [s("a", [r("1")])], deleted: {sentences: {gone: "2026-11-22T00:00:00.000Z"}}},
    "echo-n2.json": {history: [{id: "x", phase: "written"}], recall: [{id: "q", events: [{at: "1", grade: "instant"}]}], events: [{id: "e1"}]},
  };
  const incoming = {
    "echo-backup.json": {sentences: [s("a", [r("1"), r("2")]), s("new", [r("3")]), s("gone", [r("4")])]},
    "echo-n2.json": {history: [{id: "x", phase: "results"}, {id: "z", phase: "results"}], recall: [{id: "q", events: [{at: "1", grade: "instant"}, {at: "2", grade: "slow"}]}], events: [{id: "e1"}, {id: "e2"}]},
  };
  const p = restorePreview(local, incoming);
  assert.deepEqual([p.sentences, p.recovered, p.updatedSentences, p.reviews, p.exams, p.recallChecks, p.radio], [1, 1, 1, 3, 2, 1, 1]);
  assert.equal(previewLine(p), "New to this device: 1 sentence, 3 reviews, 2 finished exams, 1 recall check, 1 Day Radio play. Brought back: 1 sentence deleted here. Newer in this save: 1 sentence. Everything else here is kept.");
  assert.ok(restorePreview(applyLike(local, incoming), incoming).nothing, "after Apply the same save has nothing left to bring");
  assert.equal(previewLine(restorePreview(incoming, incoming)), "Nothing to bring in: no new or newer sentences, reviews, notes, saved words, exams, recall checks, Day Radio plays, Night Radio nights, reports or goal.");
});

test("a report-only, saved-word-only, note-only or goal-only save is not called empty (bug handoff #3)", () => {
  const empty = {"echo-backup.json": {sentences: []}, "echo-n2.json": {app: "echo", kind: "n2", schemaVersion: 1, papers: [], history: [], recall: [], events: []}, "echo-reports.json": {reports: []}};
  const report = {"echo-reports.json": {reports: [{id: "rep1", at: "2026-11-24T00:00:00Z", updatedAt: "2026-11-24T00:00:00Z", status: "open"}]}};
  const word = {"echo-backup.json": {sentences: [], words: [{id: 1001, updatedAt: "2026-11-24T00:00:00Z", from: "reader", contexts: []}]}};
  const note = {"echo-backup.json": {sentences: [], notes: [{key: "grammar:x:echo", part: "echo", text: "t", made: "2026-11-24T00:00:00Z"}]}};
  const goal = {"echo-n2.json": {papers: [], history: [], recall: [], events: [], goal: {level: "N2", date: "2026-12-06"}, goalAt: "2026-11-24T00:00:00Z"}};
  for (const [name, save, key, line] of [["report", report, "reports", "1 report"], ["saved word", word, "words", "1 saved word"], ["note", note, "notes", "1 note"]]) {
    const p = restorePreview(empty, save);
    assert.equal(p[key], 1, name); assert.ok(!p.nothing, name);
    assert.match(previewLine(p), new RegExp("New to this device: " + line), name);
    assert.ok(restorePreview(applyLike(empty, save), save).nothing, name + " is in after Apply");
  }
  const g = restorePreview(empty, goal);
  assert.ok(g.goal && !g.nothing); assert.match(previewLine(g), /Newer in this save: your exam goal\./);
  assert.ok(restorePreview(applyLike(empty, goal), goal).nothing);
});

test("Earlier saves: only the latest choice publishes, in either response order (bug handoff #2)", async () => {
  const delay = (ms, value) => new Promise(resolve => setTimeout(() => resolve(value), ms));
  for (const [slowA, slowB] of [[30, 5], [5, 30]]) {
    const gate = latestRequest(), shown = [];
    const choose = async (name, ms) => { const current = gate.begin(); const preview = await delay(ms, {save: name, line: "diff of " + name}); if (current()) shown.push(preview); };
    await Promise.all([choose("A", slowA), choose("B", slowB)]);
    assert.deepEqual(shown, [{save: "B", line: "diff of B"}], `A ${slowA} ms, B ${slowB} ms`);
  }
  const gate = latestRequest(), current = gate.begin(); gate.cancel();
  assert.equal(current(), false, "Back, close or reopen voids what is still loading");
});

test("the gist's saves are listed newest first with their time", async () => {
  const fetchImpl = async url => ({ok: true, status: 200, json: async () => (assert.match(url, /\/gists\/abc0123456789abcdef0123\/commits\?per_page=30$/), [
    {version: "v2", committed_at: "2026-11-24T05:00:00Z", change_status: {additions: 3, deletions: 1}}, {version: "v1", committed_at: "2026-11-23T05:00:00Z"}])});
  const saves = await listGistRevisions({id: "abc0123456789abcdef0123", token: "t", fetchImpl});
  assert.deepEqual(saves, [{version: "v2", at: "2026-11-24T05:00:00Z", changes: 4}, {version: "v1", at: "2026-11-23T05:00:00Z", changes: 0}]);
});

test("Backup offers earlier saves, separate upload and check times, and one all-data download that Import restores", () => {
  const app = read("../app.js"), html = read("../index.html"), imports = read("../imports.js"), sw = read("../sw.js");
  for (const id of ["saves-row", "saves-open", "saves-dialog", "saves-apply", "export-all"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(app, /"Last upload "\+gistWhen\(sync\.lastPushAt\)/);
  assert.match(app, /\+" · last check "\+gistWhen\(/);
  assert.match(app, /save:importAnything,onComplete/, "a file import accepts the all-data file");
  assert.match(app, /if\(!isAllDataBundle\(data\)\)return importBackupData\(data\)/);
  assert.match(app, /const chosen=savesChosen;if\(!chosen\)return;/, "Apply holds the preview on screen");
  assert.match(app, /const restored=await applyDocuments\(chosen\.docs\)/, "an earlier save restores through the one restore path");
  assert.match(app, /const preview=\{save,docs,counts:[^}]*line:previewLine\(restorePreview\(await localDocuments\(\),docs\)\)\};\n    if\(!current\(\)\)return;\n    savesChosen=preview;/, "one preview object, published only if still the latest choice");
  assert.match(app, /\$\("#saves-dialog"\)\.addEventListener\("close",clearSavesPreview\)/);
  assert.match(app, /\$\("#saves-back"\)\.onclick=\(\)=>\{clearSavesPreview\(\)/);
  assert.match(imports, /const message=result\.message\|\|/);
  assert.match(sw, /"\.\/restore\.js"/);
});
