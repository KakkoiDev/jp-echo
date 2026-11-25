import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {nextKicker, checkpointLine, mockTileState, historyKind} from "../n2-study.js";
import {bookName} from "../n2-forms.js";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const page = read("n2-mock.html"), mock = read("n2-mock.js"), css = read("styles.css");
const hub = page.slice(page.indexOf('<section id="hub"'), page.indexOf("<!-- Recall -->"));

test("N2Hub: countdown, the Next card with the one filled Start, then the open plan", () => {
  const order = ['id="hub-countdown"', 'id="goal-change"', 'id="plan-start-wrap"', 'id="plan-state"', 'id="plan-details" open', 'id="ai-zone"', 'id="readiness"', 'id="checkpoint"', 'id="coverage-zone"', 'id="exam-resume"', 'id="exam-list"', 'id="history"', 'id="history-list"', 'id="export-report"'];
  let at = -1;
  for (const mark of order) { const i = hub.indexOf(mark); assert.ok(i > at, mark + " comes after the previous section"); at = i; }
  assert.equal((hub.match(/class="button primary"/g) || []).length, 1, "the Next card's Start is the hub's one filled button");
  assert.equal(nextKicker(0, 6, 20), "Next · step 1 of 6 · 20 min");
  assert.equal(nextKicker(2, 7, 0), "Next · step 3 of 7");
  assert.doesNotMatch(mock, /No date set yet/);
});

test("every hub disclosure is the shared collapse-row: title, meta line, chevron", () => {
  const details = hub.match(/<details[^>]*>/g) || [];
  assert.ok(details.length >= 5);
  for (const d of details) assert.match(d, /class="[^"]*collapse-row/, d);
  for (const summary of hub.match(/<summary>[\s\S]*?<\/summary>/g)) {
    assert.match(summary, /class="collapse-title"/); assert.match(summary, /class="collapse-meta"/); assert.match(summary, /class="collapse-chevron"/);
  }
  assert.match(hub, /With your AI key[\s\S]*id="coach"[\s\S]*id="generate-open"/, "the coach controls live in one AI-key disclosure (H7)");
});

test("sprint checkpoint says the rule once and how far along (H4)", () => {
  assert.equal(checkpointLine({met: false, recent: []}), "0 of 2 in the last seven days.");
  assert.equal(checkpointLine({met: false, recent: [{meets: true, day: "2026-11-25"}, {meets: false, day: "2026-11-24"}]}), "1 of 2 in the last seven days.");
  assert.equal(checkpointLine({met: true, recent: [{meets: true}, {meets: true}]}), "Both done.");
  assert.match(mock, /Two fresh mocks on different days within seven days: 70% average, 60% in each section\. /);
});

test("mock tiles have five states and the legend names four (H5)", () => {
  assert.equal(mockTileState({live: true, best: {pass: true}}), "live");
  assert.equal(mockTileState({best: {pass: true}}), "over");
  assert.equal(mockTileState({best: {pass: false}}), "below");
  assert.equal(mockTileState({held: true}), "held");
  assert.equal(mockTileState({}), "new");
  for (const s of ["over", "below", "live", "held"]) assert.match(css, new RegExp("\\.n2-tile\\[data-state=" + s + "\\]"));
  assert.match(hub, /data-state="over">Over the line<\/li><li data-state="below">Below the line<\/li><li data-state="new">Not taken<\/li><li data-state="held">Held for unseen passages/);
  assert.match(mock, /"aria-label": label/, "a tile says its set and state to a screen reader");
});

test("history: one kind glyph per row, a filter, an empty state, and never 'undefined' (H6)", () => {
  assert.equal(historyKind("n2-set-3"), "exam");
  assert.equal(historyKind("adaptive-x", {drill: {section: "reading"}}), "section");
  assert.equal(historyKind("adaptive-x", {drill: {tag: "reason"}}), "drill");
  assert.equal(historyKind("adaptive-x", {}), "drill");
  assert.match(mock, /const GLYPH = \{exam: "試", section: "節", drill: "練"\}/);
  for (const k of ["all", "exam", "section", "drill"]) assert.match(hub, new RegExp('data-kind="' + k + '"'));
  assert.match(hub, /id="history-empty"/);
  assert.match(mock, /can't be opened/); assert.match(mock, /text: "Can't open", kind: "muted"/);
  assert.equal(bookName(undefined), "Unknown paper");
  assert.equal(bookName("undefined"), "Unknown paper");
  assert.equal(bookName("2018"), "Official workbook · 2018");
});

// Bug handoff 25 Nov, #4: the label followed its own count, not the rule.
test("the checkpoint label follows the latest-two rule: same day, separate days, a failed section, an expired pass", async () => {
  const {sprintCheckpoint, SECTIONS} = await import("../n2-study.js");
  const now = new Date(2026, 10, 25, 20);
  // One question per section; a pass answers all three, a fail misses Reading.
  const paper = id => ({id, questions: SECTIONS.map((s, index) => ({index, skill: s.skills[0], key: 1}))});
  const sit = (book, daysAgo, pass = true) => {
    const at = new Date(2026, 10, 25 - daysAgo, 9);
    return {id: book + "-a", book, paper: book, phase: "results", startedAt: at.toISOString(), completedAt: new Date(at.getTime() + 3600e3).toISOString(),
      answers: SECTIONS.map((s, i) => pass || i !== 1 ? 1 : 2), guesses: SECTIONS.map(() => false)};
  };
  const run = attempts => { const books = attempts.map(a => a.book), papers = new Map(books.map(b => [b, paper(b)])); return sprintCheckpoint(attempts, papers, books, now); };
  const sameDay = run([sit("b1", 1), sit("b2", 0), sit("b3", 0)]);
  assert.equal(sameDay.met, false);
  assert.equal(checkpointLine(sameDay), "Both scores cleared the floor on the same day. Take a fresh mock on another day.", "never 2 of 2 while unmet");
  const apart = run([sit("b1", 1), sit("b2", 0)]);
  assert.equal(apart.met, true); assert.equal(checkpointLine(apart), "Both done.");
  const failed = run([sit("b1", 1), sit("b2", 0, false)]);
  assert.equal(failed.met, false); assert.equal(checkpointLine(failed), "1 of 2 in the last seven days.");
  const expired = run([sit("b1", 9), sit("b2", 0)]);
  assert.equal(expired.met, false); assert.equal(checkpointLine(expired), "1 of 2 in the last seven days.");
});
