import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {REPORT_REASONS, createReport, mergeReports, withdrawReport, openFor, reportsDocument, screenOf, reportHasContent} from "../reports.js";
import {syncReports, REPORTS_FILENAME, GIST_FILENAME} from "../gist-backup.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("a report keeps the reason, the note and what it is about, and drops unknown reasons", () => {
  const r = createReport({kind: "card", reasons: ["reading", "voice", "nonsense", "reading"], note: "  重役 is spoken おもやく  ",
    subject: {type: "n2-word", id: '["word","重役","じゅうやく"]', text: "重役", reading: "じゅうやく", extra: {view: "recall"}},
    screen: {path: "/n2-mock.html?view=recall", title: "Recall"}, version: "jp-echo-v248", now: new Date("2026-11-24T10:00:00Z")});
  assert.deepEqual(r.reasons, ["reading", "voice"]);
  assert.equal(r.note, "重役 is spoken おもやく");
  assert.equal(r.kind, "card"); assert.equal(r.status, "open");
  assert.equal(r.subject.reading, "じゅうやく"); assert.equal(r.subject.extra.view, "recall");
  assert.equal(r.at, "2026-11-24T10:00:00.000Z"); assert.equal(r.updatedAt, r.at);
  assert.ok(reportHasContent(r));
  const bug = createReport({kind: "weird", reasons: ["reading"]});
  assert.equal(bug.kind, "bug"); assert.deepEqual(bug.reasons, [], "card reasons are not bug reasons");
  assert.ok(!reportHasContent(bug));
  assert.ok(REPORT_REASONS.card.length && REPORT_REASONS.bug.length);
});

test("the screen keeps path and query, never the #fragment (it can carry a shared key)", () => {
  assert.deepEqual(screenOf({pathname: "/settings", search: "?a=1", hash: "#k=secret"}, "Settings"), {path: "/settings?a=1", title: "Settings"});
});

test("merging keeps the later update, so a fix written in the gist and a withdrawal on the phone both survive", () => {
  const a = createReport({kind: "card", subject: {type: "sentence", id: "s1"}, now: new Date("2026-11-24T10:00:00Z")});
  const b = createReport({kind: "bug", reasons: ["broken"], now: new Date("2026-11-24T11:00:00Z")});
  const fixed = {...a, status: "fixed", fix: "abc123", updatedAt: "2026-11-25T09:00:00Z"};
  const merged = mergeReports([a, b], [fixed]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(r => r.id === a.id).status, "fixed");
  assert.equal(merged[0].id, b.id, "newest first");
  assert.deepEqual(openFor(merged, "sentence", "s1"), []);
  const withdrawn = withdrawReport(b, new Date("2026-11-26T00:00:00Z"));
  assert.equal(mergeReports([b], [withdrawn])[0].status, "withdrawn");
  assert.equal(reportsDocument([a, b]).open, 2);
});

test("syncing reads the gist's reports file, merges and writes only that file", async () => {
  const mine = createReport({kind: "bug", reasons: ["looks"], now: new Date("2026-11-24T10:00:00Z")});
  const theirs = {...createReport({kind: "card", subject: {type: "sentence", id: "x"}}), status: "fixed"};
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({url, init});
    if (!init.method) return {ok: true, status: 200, json: async () => ({html_url: "https://gist.github.com/abc", files: {[GIST_FILENAME]: {content: "{}"}, [REPORTS_FILENAME]: {content: JSON.stringify({reports: [theirs]})}}})};
    return {ok: true, status: 200, json: async () => ({html_url: "https://gist.github.com/abc"})};
  };
  const {reports} = await syncReports({token: "t", gist: "0667891e19f8f468e0362ce22c8c25f3", reports: [mine], merge: mergeReports, toDocument: reportsDocument, fetchImpl});
  assert.equal(reports.length, 2);
  const patch = calls.find(c => c.init.method === "PATCH");
  const body = JSON.parse(patch.init.body);
  assert.deepEqual(Object.keys(body.files), [REPORTS_FILENAME], "the backup file is never rewritten by a report sync");
  const doc = JSON.parse(body.files[REPORTS_FILENAME].content);
  assert.equal(doc.kind, "reports"); assert.equal(doc.reports.length, 2); assert.equal(doc.open, 1);
  await assert.rejects(syncReports({token: "t", gist: "", reports: [], merge: mergeReports, toDocument: reportsDocument, fetchImpl}), /No backup gist/);
});

test("every screen head gets the one report button; a card flag asks why and withdraws on removal", () => {
  const app = read("../app.js"), n2 = read("../n2-mock.js"), components = read("../components.js"), docs = read("../COMPONENTS.md"), sw = read("../sw.js");
  assert.match(components, /export function openReportSheet/);
  assert.match(components, /export function mountReportButtons/);
  assert.match(app, /mountReportButtons\(document/); assert.match(n2, /mountReportButtons\(document/);
  assert.match(app, /latest\.flagged!==true\)\{[^}]*openReport\(\{sentence:latest,start:"card"\}\)/, "turning a flag on opens the reason sheet");
  assert.match(app, /withdrawOpen\("sentence"/, "turning it off withdraws the card's reports");
  for (const view of ["recall", "check", "day-radio"]) assert.ok(n2.includes('view: "' + view + '"'), view + " names its card");
  assert.match(n2, /type: "n2-question"/);
  assert.match(docs, /### ReportSheet/);
  assert.match(sw, /"\.\/reports\.js"/);
  assert.ok(!/fileReport[\s\S]{0,40}exportBackup/.test(app));
  assert.ok(!/reports/.test(app.match(/async function buildBackup\(\)\{[^\n]*/)[0]), "reports are not learning data: not in the backup document");
});
