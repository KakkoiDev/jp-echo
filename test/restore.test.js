import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {allDataBundle, isAllDataBundle, bundleCounts, restorePreview, countsLine, previewLine} from "../restore.js";
import {listGistRevisions} from "../gist-backup.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const s = (id, reviews = [], extra = {}) => ({id, source: "S", target: "文", updatedAt: "2026-11-20T00:00:00.000Z", reviews, ...extra});
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

test("the preview shows only what a restore would add, and honours deletions made here", () => {
  const local = {
    "echo-backup.json": {sentences: [s("a", [r("1")])], deleted: {sentences: {gone: "2026-11-22T00:00:00.000Z"}}},
    "echo-n2.json": {history: [{id: "x", phase: "written"}], recall: [{id: "q", events: [{at: "1", grade: "instant"}]}], events: [{id: "e1"}]},
  };
  const incoming = {
    "echo-backup.json": {sentences: [s("a", [r("1"), r("2")]), s("new", [r("3")]), s("gone", [r("4")])]},
    "echo-n2.json": {history: [{id: "x", phase: "results"}, {id: "z", phase: "results"}], recall: [{id: "q", events: [{at: "1", grade: "instant"}, {at: "2", grade: "slow"}]}], events: [{id: "e1"}, {id: "e2"}]},
  };
  const p = restorePreview(local, incoming);
  assert.deepEqual([p.sentences, p.reviews, p.exams, p.recallChecks, p.radio], [1, 2, 2, 1, 1]);
  assert.equal(previewLine(p), "New to this device: 1 sentence, 2 reviews, 2 finished exams, 1 recall check, 1 Day Radio play. Everything here is kept.");
  assert.equal(previewLine(restorePreview(incoming, incoming)), "Everything in this save is already on this device.");
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
  assert.match(app, /const restored=await applyDocuments\(savesChosen\.docs\)/, "an earlier save restores through the one restore path");
  assert.match(imports, /const message=result\.message\|\|/);
  assert.match(sw, /"\.\/restore\.js"/);
});
