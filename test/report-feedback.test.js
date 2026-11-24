// Regressions for the owner's reports of 24 Nov 2026 (echo-reports.json).
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {doneToday, markDone} from "../n2-study.js";
import {instructionFor, BLUEPRINT} from "../n2-forms.js";
import {cleanSegment, splitPassage} from "../text-extraction.js";
import {createReport, editReport, setReportStatus, mergeReports, REPORT_STATUS} from "../reports.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const now = new Date("2026-11-24T15:00:00");
const today = "2026-11-24T10:00:00", yesterday = "2026-11-23T10:00:00";

test("a finished step stays in today's plan, ticked, instead of vanishing (1ccf9988)", () => {
  const papers = [{id: "adaptive-r", drill: {set: "n2-set-9", section: "reading"}, title: "読解"}, {id: "adaptive-t", drill: {tag: "exception"}}, {id: "n2-set-3@x", title: "03 · Set"}];
  const done = doneToday({now,
    recall: [{events: [{at: today, source: "delayed-check"}, {at: yesterday, source: "delayed-check"}, {at: today, source: "first"}]}],
    events: [{at: today, kind: "recall", context: {source: "delayed-check"}}, {at: today, kind: "exposure", context: {source: "day-radio"}}],
    attempts: [{phase: "results", completedAt: today, book: "adaptive-r"}, {phase: "results", completedAt: today, book: "adaptive-t"}, {phase: "results", completedAt: today, book: "n2-set-3", paper: "n2-set-3@x"}, {phase: "written", book: "adaptive-x"}],
    papers});
  assert.equal(done.check, 2, "print and audio checks of today count; yesterday's do not");
  assert.equal(done.radio, 1);
  assert.deepEqual([...done.sections], ["reading"]);
  assert.deepEqual([...done.drills], ["exception"]);
  assert.equal(done.mock, "03 · Set");
  const plan = {steps: [
    {kind: "recall", title: "Word and grammar first checks", minutes: 40},
    {kind: "section", section: "reading", title: "Timed reading", minutes: 40},
    {kind: "section", section: "listening", title: "Listening", minutes: 40},
    {kind: "drill", tag: "exception", title: "Comprehension", minutes: 20},
    {kind: "radio", title: "Day Radio", line: "By ear", minutes: 20}]};
  const marked = markDone(plan, done);
  assert.equal(marked.steps[0].kind, "check", "Today's checks, all done, stay first in the list");
  assert.equal(marked.steps[1].kind, "mock", "the mock finished today comes back, ticked");
  assert.ok(marked.steps[0].done && marked.steps[1].done);
  const byTitle = Object.fromEntries(marked.steps.map(s => [s.title, s]));
  assert.ok(byTitle["Timed reading"].done && !byTitle["Listening"].done && byTitle["Comprehension"].done && byTitle["Day Radio"].done);
  assert.match(byTitle["Day Radio"].line, /1 heard today/);
  assert.ok(!byTitle["Word and grammar first checks"].done);
  assert.equal(markDone(plan, doneToday({now})).steps.length, plan.steps.length, "nothing done adds nothing");
  assert.match(read("../n2-mock.js"), /plan = markDone\(plan, ctx\.done\);/, "every drawn plan, the coach's included, is marked");
});

test("every question shows its Japanese instruction, the November mock included (2d7bbf8b)", () => {
  const by = (skill, mondai) => BLUEPRINT.find(b => b.skill === skill && b.mondai === mondai).instruction;
  assert.equal(instructionFor({skill: "Vocabulary", prompt: "予算案は議会で【承認】された。読み方はどれか。"}), by("Vocabulary", 1));
  assert.equal(instructionFor({skill: "Vocabulary", prompt: "足りない資料を【おぎなう】。"}), by("Vocabulary", 2));
  assert.equal(instructionFor({skill: "Vocabulary", prompt: "計画はまだ検討の（　）にある。"}), by("Vocabulary", 4));
  assert.equal(instructionFor({skill: "Vocabulary", prompt: "「手続きを省いた」に近い意味はどれか。"}), by("Vocabulary", 5));
  assert.equal(instructionFor({skill: "Vocabulary", prompt: "「余裕」の使い方が自然なのはどれか。"}), by("Vocabulary", 6));
  assert.equal(instructionFor({skill: "Grammar", prompt: "引っ越し（　）、処分した。"}), by("Grammar", 7));
  assert.equal(instructionFor({skill: "Listening", prompt: "最も自然な返事はどれか。", choices: ["a", "b", "c"]}), by("Listening", 4));
  assert.equal(instructionFor({skill: "Reading", mondai: 12}), by("Reading", 12), "an authored row keeps its 問題's instruction");
  assert.equal(instructionFor({instruction: "own"}), "own");
  const bank = JSON.parse(read("../n2-echo-bank.json"));
  assert.ok(bank.every(q => instructionFor(q)), "no question of the November mock is left without one");
  assert.match(read("../n2-mock.js"), /\$\("instruction"\)\.textContent = native \? instructionFor\(/);
});

test("an exam can be paused: the clock stops, the question hides, the results say so (88181095)", () => {
  const js = read("../n2-mock.js"), html = read("../n2-mock.html"), css = read("../styles.css");
  assert.match(html, /id="exam-pause"[^>]*aria-label="Pause the timer"/);
  assert.match(html, /id="exam-paused" hidden>/);
  assert.match(js, /state\.deadline \+= gap; state\.pausedMs = \(state\.pausedMs \|\| 0\) \+ gap/, "the deadline moves by the time paused");
  assert.match(js, /if \(state\.pausedAt\) \{ \$\("clock"\)\.textContent = "Paused"; return false; \}/, "a paused clock never runs out");
  assert.match(js, /if \(active\(\) && !state\.pausedAt\) state\.time\[state\.index\]/, "paused time is not answer time");
  assert.match(js, /" · paused " \+ paused \+ " min"/);
  assert.match(css, /body\.n2-is-paused #exam>:not\(\.n2-exam-head\):not\(\.n2-paused\)\{display:none\}/);
});

test("the offline notice waits, scrolls with the page and can be closed (04301125)", () => {
  const js = read("../n2-mock.js"), css = read("../styles.css");
  assert.match(js, /offlineTimer = setTimeout\(async \(\) => \{\n    if \(navigator\.onLine !== false \|\| offlineDismissed\) return;/);
  assert.match(js, /text: "Close", onclick: \(\) => \{ offlineDismissed = true;/);
  assert.match(css, /\.n2-notices\{display:flex;flex-direction:column;gap:8px\}/, "notices are not stuck over the passage");
  assert.match(css, /\.n2-notices \.notice\.alert\{position:sticky/, "only a failed save stays in view");
});

test("Extract drops list markers and splits a heading's bracketed aside into its own card (b9c70269)", () => {
  assert.deepEqual(cleanSegment("②録音権限（案未定）"), ["録音権限", "案未定"]);
  assert.deepEqual(cleanSegment("1. 会議の日程を決める。"), ["会議の日程を決める。"]);
  assert.deepEqual(cleanSegment("（３）背景"), ["背景"]);
  assert.deepEqual(cleanSegment("・資料を準備する"), ["資料を準備する"]);
  assert.deepEqual(cleanSegment("彼は（たぶん）来ない。"), ["彼は（たぶん）来ない。"], "a sentence keeps its brackets");
  assert.deepEqual(cleanSegment("3月に行く"), ["3月に行く"], "a number that starts a sentence stays");
  assert.deepEqual(splitPassage("②録音権限（案未定）\n③議事録"), ["録音権限", "案未定", "議事録"]);
});

test("a filed report can be edited, marked done and reopened, and the change wins the sync (566ce73f, ddd503e6)", () => {
  const r = createReport({kind: "bug", reasons: ["broken"], note: "first", now: new Date("2026-11-24T04:00:00Z")});
  const edited = editReport(r, {reasons: ["looks", "nope"], note: "  second  "}, new Date("2026-11-24T05:00:00Z"));
  assert.deepEqual(edited.reasons, ["looks"]); assert.equal(edited.note, "second"); assert.equal(edited.id, r.id);
  const done = setReportStatus(edited, "done", new Date("2026-11-24T06:00:00Z"));
  assert.equal(done.status, "done"); assert.ok(done.resolvedAt);
  const reopened = setReportStatus(done, "open", new Date("2026-11-24T07:00:00Z"));
  assert.equal(reopened.status, "open"); assert.equal(reopened.resolvedAt, undefined);
  assert.equal(mergeReports([r], [done])[0].status, "done", "the later change wins on the other device");
  assert.equal(REPORT_STATUS.done, "Done");
});

test("the report sheet confirms, keeps an unsent draft, and lists Your reports (937eed22, b8daef9e)", () => {
  const c = read("../components.js"), app = read("../app.js"), n2 = read("../n2-mock.js");
  assert.match(c, /data-pane="sent"/); assert.match(c, /data-pane="history"/);
  assert.match(c, /"Report received\. It is saved on this device\."/);
  assert.match(c, /if\(syncNow\)\{line\.textContent="Sending it to your gist…";try\{await syncNow\(\)\}catch\{\}line\.textContent=lineOf\(\)\}/);
  assert.match(c, /const REPORT_DRAFT="jp-echo-report-draft"/);
  assert.match(c, /dialog\.onclose=\(\)=>\{dialog\.onclose=null;if\(!submitted\)saveDraft\(\);resolve\(submitted\)\}/, "a closed sheet keeps its words");
  assert.match(c, /REPORT_KIND_HINT=\{card:"A flag marks this card/, "the sheet says how a flag differs from a report (c38284a8)");
  for (const src of [app, n2]) { assert.match(src, /history: ?reportHistory/); assert.match(src, /syncLine: ?reportSyncLine,/); }
  assert.match(n2, /mic\.classList\.add\("is-listening"\)/, "the N2 mic shows it is listening");
});

test("tool sheets carry the report button, and the radical opens in the kanji sheet (927cfd7e)", () => {
  const c = read("../components.js"), app = read("../app.js");
  assert.match(c, /\.tool-sheet \.sheet-head, \.tool-sheet \.dictionary-head/);
  assert.match(app, /mountReportButtons\(document,button=>openReport\(\{sheet:button\?\.closest\("\.tool-sheet"\)\|\|null\}\)\)/);
  assert.match(app, /if\(id==="kanji-dialog"&&kanjiOpen\)/);
  assert.match(app, /b\.onclick=\(\)=>openKanji\(radical,kanjiCover\|\|new Map\(\)\)/);
});

test("the tools shelf has Day and Night Radio and scrolls sideways (815cb295)", () => {
  const app = read("../app.js"), css = read("../styles.css");
  assert.match(app, /\{id:"day-radio",glyph:"昼",label:"Day Radio"/);
  assert.match(app, /\{id:"radio",glyph:"夜",label:"Night Radio"/);
  assert.match(app, /if\(id==="day-radio"\)\{location\.assign\("\.\/n2-mock\.html\?view=radio"\)/);
  assert.match(css, /\.tool-shelf\{[^}]*overflow-x:auto/);
  assert.match(css, /\.tool-shelf-tile\{flex-shrink:0/);
});

// ── The second batch (24 Nov 2026, afternoon) ──
import {exampleSegments, patternNeedles} from "../n2-delayed.js";
import {recallItems, scoreSeries, scoreCaption} from "../n2-study.js";
import {examplesFromDecks} from "../day-radio.js";
import {solutionOf, whyReadings} from "../n2-forms.js";

test("every word and grammar card has an example sentence, shown with furigana and the item underlined (e5f56511)", () => {
  const inv = JSON.parse(read("../n2-inventory.json"));
  const map = examplesFromDecks(inv, [JSON.parse(read("../decks/n2-words.json")), JSON.parse(read("../decks/n2-grammar.json"))]);
  const items = recallItems(inv);
  for (const type of ["meaning", "grammar"]) assert.ok(items[type].every(i => map.get(JSON.stringify(i.target))?.length), type + ": every card has a sentence");
  const segs = exampleSegments("この方法【ほうほう】なら、問題【もんだい】は解決【かいけつ】し得【う】る。", patternNeedles("得る（える・うる）"));
  assert.deepEqual(segs.filter(s => s.mark).map(s => s.text), ["得", "る"]);
  assert.equal(segs.find(s => s.text === "方法").reading, "ほうほう");
  assert.deepEqual(patternNeedles("～ところに・～ところへ"), ["ところに", "ところへ"]);
  const js = read("../n2-mock.js");
  assert.match(js, /\$\("recall-example"\)\.hidden = !example \|\| type !== "grammar";/, "grammar shows its sentence from the start");
  assert.match(js, /playAnswer\(\);\n  \}/, "revealing plays the answer (0938f16e)");
  assert.match(js, /if \(revealed\) playAnswer\(\); else reveal\(\);/, "tapping the card again replays it");
});

test("a pattern with two meanings says which, and 得る shows both readings (22f408d3, 3ac58df2, 9cca643e)", () => {
  const g = recallItems(JSON.parse(read("../n2-inventory.json"))).grammar;
  const ichiou = g.filter(i => i.prompt === "一応");
  assert.deepEqual(ichiou.map(i => [i.sense, i.senses]), [[1, 2], [2, 2]]);
  assert.ok(!g.some(i => /[①-⑨]/.test(i.prompt)), "no circled numbers on a card");
  assert.equal(g.find(i => i.target[1] === "得る-得る").prompt, "得る（える・うる）");
});

test("Recall has a Previous card that lets a mistaken grade be redone (6799eb65)", () => {
  const js = read("../n2-mock.js"), html = read("../n2-mock.html");
  assert.match(html, /id="recall-prev"[^>]*aria-label="Previous card"/);
  assert.match(js, /data\.recall = data\.recall\.filter\(x => x\.id !== last\.row\.id\)\.concat\(last\.row\.r \? \[last\.row\.r\] : \[\]\);/, "going back restores the record from before");
});

test("first checks under way show a progress bar on the plan (report of 14:23)", () => {
  assert.match(read("../components.js"), /bar\.className="drill-bar plan-step-progress";bar\.setAttribute\("role","progressbar"\)/);
  assert.match(read("../n2-mock.js"), /progress: progressOf\(step, ctx\)/);
});

test("finished exams are charted against the pass line, drills left out (report of 14:24)", () => {
  const paper = {questions: [0, 1, 2, 3].flatMap(skill => [1, 2].map(i => ({skill, index: skill * 2 + i - 1, key: 1})))};
  const all = Array(8).fill(1), half = [1, 2, 2, 2, 1, 2, 1, 2];
  const papers = new Map([["a", paper], ["b", paper]]);
  const series = scoreSeries([{book: "b", phase: "results", completedAt: "2026-11-24T10:00:00Z", answers: half}, {book: "a", phase: "results", completedAt: "2026-11-23T10:00:00Z", answers: all}, {book: "a", phase: "written", answers: all}], papers);
  assert.deepEqual(series.map(p => [p.book, p.value, p.ok]), [["a", 180, true], ["b", 75, false]]);
  assert.match(scoreCaption(series), /^2 finished exams · last 75 \/ 180 · 1 at or over the pass line/);
  assert.match(read("../n2-mock.html"), /id="score-chart"/);
});

test("the offline notice asks the network before it shows (8907ffd7)", () => {
  assert.match(read("../n2-mock.js"), /if \(await reachable\(\)\) return;/);
});

test("solutions show the completed sentence with furigana and the answer underlined (6382b2ef, 93015bcb, a9a209ae)", () => {
  const bank = JSON.parse(read("../n2-echo-bank.json"));
  const vg = bank.filter(q => q.skill === "Vocabulary" || q.skill === "Grammar");
  assert.ok(vg.every(q => solutionOf(q)), "every November vocabulary and grammar question has a solution line");
  assert.deepEqual(solutionOf(bank.find(q => q.prompt.startsWith("計画はまだ検討"))), {text: "計画はまだ検討の段階にある。", mark: "段階", overrides: {}});
  assert.deepEqual(solutionOf(bank[0]), {text: "予算案は議会で承認された。", mark: "承認", overrides: {承認: "しょうにん"}}, "a 読み方 answer is the word's reading");
  assert.equal(solutionOf({skill: 0, prompt: "彼は何事もなかった（　）、作業を続けた。", choices: ["かのように"], key: 1}).text, "彼は何事もなかったかのように、作業を続けた。", "何 in a sentence is not a question");
  assert.deepEqual(whyReadings("～辛い（づらい） · hard to do"), {text: "～辛い · hard to do", overrides: {辛い: "づらい"}});
  assert.match(read("../n2-mock.js"), /solution\.replaceChildren\(\.\.\.await solutionLine\(q\)\)/);
});

// ── Flagged cards: Fix this ──
import {fixInstruction} from "../reports.js";

test("a flagged card offers Fix this; the fix lifts the flag and closes its reports only on Save", () => {
  assert.match(fixInstruction([]), /^The learner flagged this card as wrong\. Find what is incorrect/, "an old flag without a reason asks the model to find it");
  const r = createReport({kind: "card", reasons: ["reading", "nope"], note: "擦る is こする", subject: {type: "sentence", id: "s1"}});
  assert.match(fixInstruction([r]), /They said: Wrong reading — 擦る is こする\./, "a flag with a reason passes the learner's words on");
  const app = read("../app.js"), html = read("../index.html");
  assert.match(html, /<div id="sentence-ai"><div id="sentence-flag-fix" hidden><\/div>/);
  assert.match(app, /label:"Fix this",outline:true,onClick:\(\)=>\{fixingId=item\.id;rewriteDetailSentence\(fixInstruction\(said\)\)\}/, "Fix this goes through the one rewrite");
  assert.match(app, /const fixed=fixingId===detail\.id&&detail\.flagged===true&&!!rewrittenDraft;/, "only a saved rewrite counts as the fix");
  assert.match(app, /if\(fixed\)\{await closeOpen\("sentence",detail\.id\)/);
});
