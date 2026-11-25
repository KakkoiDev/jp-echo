import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const page = read("n2-mock.html"), mock = read("n2-mock.js"), css = read("styles.css");
const exam = page.slice(page.indexOf('<section id="exam"'), page.indexOf('<section id="rest"'));

test("exam head: Leave, a large centred clock, Pause; then section and progress over a 2 px bar (E1, fix 6)", () => {
  assert.match(exam, /<div class="n2-exam-top">\s*<div class="drill-head n2-exam-head"><a [^>]*aria-label="Leave\. Your answers are saved"[\s\S]*?<\/a><strong class="n2-clock" id="clock" role="timer"><\/strong><button[^>]*id="exam-pause"/);
  assert.match(exam, /<div class="n2-exam-line"><span class="drill-title n2-exam-section" id="material" lang="ja"><\/span><span class="overline" id="count"><\/span><\/div>\s*<div class="drill-bar">/);
  assert.match(css, /\.n2-exam-head \.n2-clock\{flex:1 1 auto;margin:0;text-align:center;font-size:26px/);
  assert.match(css, /\.drill-bar\{height:2px/);
});

test("exam choices: panel and hairline, the ON idiom when chosen, Unsure as a chip by the 問題 label (E3, fix 5)", () => {
  assert.match(css, /\.n2-choice\{[^}]*border:1px solid var\(--hairline\);background:var\(--panel\)/);
  assert.match(css, /\.n2-choice\[aria-checked=true\]\{border-color:var\(--seal-edge\);background:var\(--seal-tint\);color:var\(--seal-deep\)\}/);
  assert.match(css, /\.n2-choice\[aria-checked=true\] \.n2-choice-n\{background:var\(--seal\)/, "the chosen number is a filled seal");
  assert.match(exam, /<p class="overline n2-mondai-label"><span id="prompt" lang="ja"><\/span><span class="status-chip below" id="unsure-chip" hidden>Unsure<\/span><\/p>/);
  assert.match(mock, /\$\("unsure-chip"\)\.hidden = !state\.guesses\[state\.index\]/);
});

test("the 問題 instruction is legible: 15 px in ink-soft under its overline (E2, fix 7)", () => {
  assert.match(css, /\.n2-instruction\{margin-top:6px;font-size:15px;line-height:1\.6;color:var\(--ink-soft\)\}/);
});

test("question grid: grouped by 問題 with ranges, a legend, Finish says how many are blank (E4, fix 10)", () => {
  assert.match(exam, /<h2 class="n2-grid-title" id="grid-title">/);
  assert.match(exam, /<li data-key="answered">Answered<\/li><li data-key="current">Current<\/li><li data-key="blank">Blank<\/li><li data-key="unsure">Unsure<\/li>/);
  assert.match(mock, /class: "n2-grid-group"/); assert.match(mock, /class: "n2-grid-head"/);
  assert.match(mock, /"Finish · " \+ blanks \+ " blank"/);
  assert.match(exam, /class="quiet" id="grid-close"[^>]*>Keep going/);
  assert.match(mock, /c\.insertAdjacentHTML\("beforeend", flagSvg\)/, "an unsure square shows the drawn flag, not a dot or emoji");
});

test("break: a head naming the mock, estimated written scores, one filled Start listening, a quiet Later (E5, fix 15)", () => {
  const rest = page.slice(page.indexOf('<section id="rest"'), page.indexOf("</section>", page.indexOf('<section id="rest"')));
  assert.match(rest, /<div class="tool-head n2-break-head"><span class="tool-titles"><span class="tool-title">Break<\/span><span class="overline" id="rest-sub">/);
  assert.equal((rest.match(/class="primary"|button primary/g) || []).length, 1);
  assert.match(rest, /<a class="button quiet" href="\.\/n2-mock\.html">Later — back to N2<\/a>/);
  assert.match(mock, /"written section done"/); assert.match(mock, /" estimated"\), el\("strong", \{text: s\.scaled \+ " of " \+ SECTION_MAX\}\)/);
  assert.match(mock, /A direction, not a prediction\. Listening scores after the next section\./);
});

// Bug handoff 25 Nov, #1: a paused exam took keyboard answers and moves.
test("a paused attempt takes no answers, moves, unsure marks or exposure until Resume", async () => {
  const {answering} = await import("../n2-study.js");
  assert.equal(answering({phase: "written"}), true);
  assert.equal(answering({phase: "listening"}), true);
  assert.equal(answering({phase: "written", pausedAt: Date.now()}), false, "paused");
  assert.equal(answering({phase: "rest"}), false);
  assert.equal(answering({phase: "results"}), false);
  assert.equal(answering({phase: "intro"}), false);
  for (const fn of ["move", "choose"]) assert.match(mock, new RegExp("function " + fn + "\\([^)]*\\) \\{\\n    if \\(!answering\\(state\\) \\|\\| tick\\(\\)\\) return;"), fn + " is guarded");
  assert.match(mock, /function markShown\(\) \{\n    if \(archivedView \|\| !answering\(state\)/, "exposure is not recorded while paused, nor on a paused reload");
  assert.match(mock, /function openGrid\(\) \{\n    if \(!answering\(state\)\) return;/);
  assert.match(mock, /\$\("guess"\)\.onclick = \(\) => \{ if \(!answering\(state\) \|\| tick\(\)\) return;/);
  assert.match(mock, /\$\("submit"\)\.onclick = \(\) => \{ if \(answering\(state\) && !tick\(\)\) finish\(\); \};/);
  assert.match(mock, /addEventListener\("keydown", e => \{\n    if \(!answering\(state\) \|\| \$\("grid-dialog"\)\.open/, "digits, arrows and F do nothing while paused");
  assert.match(mock, /\$\("exam-pause"\)\.onclick = pause; \$\("exam-resume"\)\.onclick = resume;/, "Resume stays wired");
});
