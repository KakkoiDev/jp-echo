import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const page = read("n2-mock.html"), mock = read("n2-mock.js"), css = read("styles.css");
const results = page.slice(page.indexOf('<section id="results"'), page.indexOf("</section>", page.indexOf('<section id="results"')));

test("results: Back to the plan is the one filled button, the weakest section's practice outlined, retake a link (S1, fix 8)", () => {
  assert.match(results, /<a class="button primary" id="result-next" href="\.\/n2-mock\.html">Back to the plan<\/a><a class="button outline" id="result-drill"[^>]*>Recall weak words and grammar<\/a><button[^>]*class="link-button" id="retake"/);
  assert.equal((results.match(/button primary/g) || []).length, 1);
  assert.match(mock, /drill\.textContent = plan\.label;/);
  assert.ok(results.indexOf('id="result-next"') < results.indexOf('id="results-more"'), "the actions come before the 問題 and Time rows");
  assert.match(mock, /\$\("results-more"\)\.replaceChildren\(short \? el\("span"\) : byMondai\(\), slowest\(\)\)/);
  assert.match(mock, /title: "By 問題" \+ \(weak\.length \? " · weakest "/);
});

test("review: a segmented filter with counts, rows grouped by section, open rows show your answer and the right one (S3, fix 9)", () => {
  assert.match(results, /<div class="segmented n2-review-filter" role="tablist"[^>]*><button[^>]*role="tab"[^>]*data-show="wrong" aria-selected="true">Missed and unsure<\/button><button[^>]*data-show="all" aria-selected="false">All<\/button>/);
  assert.match(mock, /\(b\.dataset\.show === "wrong" \? "Missed and unsure" : "All"\) \+ " · " \+ counts\[b\.dataset\.show\]/);
  assert.match(mock, /const groups = SECTIONS\.map\(sec => \(\{sec, rows: items\.filter\(q => sec\.skills\.includes\(q\.skill\)\)\}\)\)/);
  assert.match(mock, /missed \+ " missed · " \+ unsure \+ " unsure"/);
  assert.match(mock, /answer && !right \? choice\(answer, "picked", "Your answer"\) : null/);
  assert.match(mock, /choice\(q\.key, "right", right \? "Right · yours" : "Right"\)/);
  assert.match(css, /\.n2-review-choice\[data-kind=picked\] \.n2-review-choice-text\{text-decoration:line-through/);
  assert.match(css, /\.n2-review-choice\[data-kind=right\]\{border-color:var\(--seal-edge\);background:var\(--seal-tint\);color:var\(--seal-deep\)\}/);
  assert.match(mock, /solution\.replaceChildren\(\.\.\.await solutionLine\(q\)\)/, "the solution gets furigana when opened");
  assert.match(mock, /class: "n2-why-label", text: "Why: "/);
  assert.match(mock, /a chip only marks the unsure ones\./);
  assert.doesNotMatch(css, /\.n2-review-stem\{[^}]*text-overflow:ellipsis/, "stems read in full");
});

// Bug handoff 25 Nov, #5: "Drill my weak items · 読解 first" opened general recall.
test("the Results practice action opens what it names for each weakest section", async () => {
  const {resultPractice} = await import("../n2-study.js");
  const r = (vocab, grammar, reading, listening) => [vocab, grammar, reading, listening].map(([got, n]) => ({got, n}));
  assert.deepEqual(resultPractice(r([9, 10], [9, 10], [3, 10], [8, 10])), {label: "Practise reading · a timed 読解 section", section: "reading"});
  assert.deepEqual(resultPractice(r([9, 10], [9, 10], [8, 10], [2, 10])), {label: "Practise listening · a timed 聴解 section", section: "listening"});
  assert.deepEqual(resultPractice(r([8, 10], [2, 10], [9, 10], [9, 10])), {label: "Recall weak grammar · 文法", href: "?view=recall&type=grammar&queue=weak"});
  assert.deepEqual(resultPractice(r([2, 10], [8, 10], [9, 10], [9, 10])), {label: "Recall weak words · 文字・語彙", href: "?view=recall&type=meaning&queue=weak"});
  assert.deepEqual(resultPractice(r([0, 0], [0, 0], [0, 0], [0, 0])), {label: "Recall weak words and grammar", href: "?view=recall&queue=weak"}, "no evidence: the label is the fallback");
  assert.deepEqual(resultPractice(r([0, 0], [0, 0], [4, 10], [0, 0])).section, "reading", "a reading-only paper still routes to reading");
  assert.match(mock, /drill\.onclick = plan\.section \? async event => \{ event\.preventDefault\(\); startSection\(plan\.section, \{data: await report\(\)\}\); \} : null;/, "a section opens the timed section, not recall");
  assert.doesNotMatch(mock, /"Drill my weak items", "\?view=recall&queue=weak"/);
});
