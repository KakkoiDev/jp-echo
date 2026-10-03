// The October 2026 design handoff (echo-design-handoff/HANDOFF.md). Each
// block pins one decision so a later change cannot quietly undo it.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {kanjiNumeral} from "../components.js";
import {grammarListItems, POINTS} from "../grammar.js";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const components = await readFile(new URL("../components.js", import.meta.url), "utf8");

test("SkillGlyph is one component with three states, and the emoji are gone", () => {
  assert.match(components, /export function skillGlyph\(mode,\{state="default",size=28\}=\{\}\)/);
  assert.match(components, /export function skillTrio\(/);
  assert.match(css, /\.skill-glyph\[data-state="current"\]\{background:var\(--seal-tint\);border-color:var\(--seal-edge\);color:var\(--seal-deep\)\}/);
  assert.match(css, /\.skill-glyph\[data-state="inactive"\]\{border-color:var\(--rule\);color:var\(--faint\)\}/);
  for (const emoji of ["👂", "📖", "✍️"]) { assert.equal(html.includes(emoji), false, emoji); assert.equal(app.includes(emoji), false, emoji); }
  assert.doesNotMatch(css, /review-mode-chip/);
});

test("the review card names its skill and why, from the track", () => {
  assert.match(app, /\$\("#review-skills"\)\.replaceChildren\(skillTrio\(mode,\{label:meta\.label\+" card\./);
  assert.match(app, /\$\("#review-mode-instruction"\)\.textContent=skillReason\(sentence\)/);
  assert.match(app, /listening\?"Reveal the sentence"/);
  assert.match(html, /id="review-skill-mix"[\s\S]*Today you will/);
});

test("GrammarList numbers rows with kanji and orders them as they appear", () => {
  assert.deepEqual([1, 2, 5, 10, 11, 23].map(kanjiNumeral), ["一", "二", "五", "十", "十一", "二十三"]);
  const kara = POINTS.find(p => p.id === "から-because"), shimau = POINTS.find(p => p.id === "てしまう-ちゃう");
  const items = grammarListItems([shimau.id, kara.id, "not-a-point"], [{id: shimau.id, start: 6, end: 11, quote: "てしまった"}, {id: kara.id, start: 2, end: 4, quote: "から"}]);
  assert.deepEqual(items.map(i => i.phrase), ["から", "てしまった"], "sentence order, phrase as quoted");
  assert.equal(items[0].gloss, kara.hint, "the gloss is the bundled hint: no request to show it again");
  assert.equal(items[0].level, "N5");
  assert.deepEqual(grammarListItems([kara.id], []).map(i => i.phrase), [kara.title], "no located phrase: the point's title");
});

test("pill chips are replaced by the list; the two underline styles both exist", () => {
  assert.doesNotMatch(css, /\.grammar-chip/);
  assert.match(css, /\.review-vocab\{cursor:pointer;border-bottom:1px dotted var\(--ink-muted\)/);
  assert.match(css, /\.grammar-mark\{text-decoration:underline dotted var\(--seal\);text-decoration-thickness:2px;text-underline-offset:8px/);
  assert.match(app, /if\(isWord\)\{span\.tabIndex=0;span\.setAttribute\("role","button"\)/, "only words are interactive");
  assert.match(html, /id="sentence-key" class="underline-key"/);
});

test("sentence page: design order, collapsed history and change, quiet delete", () => {
  const page = html.slice(html.indexOf('<section id="sentence-view"'), html.indexOf("</section>", html.indexOf('<section id="sentence-view"')));
  const order = ["sentence-japanese", "sentence-english", "sentence-key", "stat-echoes", "sentence-play", "sentence-register", "sentence-grammar", "sentence-review-track", "stat-due", "sentence-history-block", "sentence-change", "sentence-delete"].map(id => page.indexOf(`id="${id}"`));
  assert.ok(order.every(i => i > 0), "every part present");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in the design's order");
  assert.doesNotMatch(page, /id="sentence-edit"/, "the pencil button is gone; editing lives in Change this sentence");
  assert.match(page, /<details id="sentence-change" class="collapse-row">[\s\S]*<form id="sentence-editor">/);
  assert.match(page, /id="sentence-delete" class="text-danger"/);
  assert.match(page, /class="register-label">Hear it as</);
  assert.match(page, /<span id="sentence-added" class="overline"><\/span><span id="stat-stage" class="status-chip">/, "status chip in the session bar");
});

test("the due line names the next card and what it will ask", async () => {
  const {dueLine, recordReviewMode, ensureReviewTrack} = await import("../review-modes.js");
  let s = ensureReviewTrack({id: "a"});
  assert.equal(dueLine(s, "now"), "Due now, as a listening card — you will hear it with no text.");
  s = recordReviewMode(recordReviewMode(s, "ok"), "ok");
  assert.equal(dueLine(s, "in 3 days"), "Due in 3 days, as a writing card — you will see the meaning and type the Japanese.");
});

test("practice: empty states carry discoverability; the mode switch stays quiet", () => {
  assert.match(html, /id="welcome-modes"[\s\S]*Or practise another way[\s\S]*id="welcome-discussion" class="library-tool two-line"[\s\S]*id="welcome-reading" class="library-tool two-line"/);
  assert.match(app, /function renderWelcomeModes\(\)\{const used=modesUsed\(\);\$\("#welcome-discussion"\)\.hidden=!!used\.discussion/);
  assert.match(app, /discussionTurns=\[\{role:"ai",\.\.\.out\.ai\}\];renderDiscussion\(\);playDiscussion\(\);markModeUsed\("discussion"\)/, "a row goes after the mode is really used");
  assert.match(app, /renderReading\(\);\$\("#reading-status"\)\.textContent="";markModeUsed\("reading"\)/);
});

test("discussion: starter scenes fill the box and never send", () => {
  const scenes = [...html.matchAll(/data-scene="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scenes, ["Ordering at a café", "Checking in at a hotel", "Small talk with a neighbour", "Asking a colleague for help"]);
  const wire = app.slice(app.indexOf('document.querySelectorAll("#discussion-scenes [data-scene]")'), app.indexOf("\n", app.indexOf('document.querySelectorAll("#discussion-scenes [data-scene]")')));
  assert.match(wire, /input\.value=scene\.dataset\.scene/);
  assert.doesNotMatch(wire, /beginDiscussion|replyDiscussion|\.click\(\)/, "filling is not sending");
  assert.match(app, /function composerLabel\(\)\{return discussionMode\?\(discussionTurns\.length\?"Reply to the conversation":"Describe the conversation"\)/);
  assert.doesNotMatch(css, /reply to the conversation"\}/, "no CSS-appended second label");
});

test("sheets: your sentences, then say, then the collapsed note, then the learn footer", () => {
  for (const [prefix, notes, collapsed] of [["kanji", "kanji-story", true], ["word", "word-note", true], ["grammar", "point-notes", false]]) {
    const start = html.indexOf(`<dialog id="${prefix}-dialog"`), sheet = html.slice(start, html.indexOf("</dialog>", start));
    const at = id => sheet.indexOf(`id="${id}"`);
    const order = [`${prefix}-mine-head`, `${prefix}-say`, notes, `${prefix}-learn-nav`].map(at);
    assert.ok(order.every(i => i > 0), prefix);
    assert.deepEqual([...order].sort((a, b) => a - b), order, prefix + " in the design's order");
    assert.match(sheet, new RegExp(`id="${prefix}-learn-nav" class="learn-nav sheet-footer"`), prefix + " footer");
    assert.equal(sheet.includes(`<details id="${prefix}-more" class="collapse-row sheet-more">`), collapsed, prefix + (collapsed ? " note collapsed" : " explanation stays open"));
  }
  assert.match(html, /A story to remember it by[\s\S]*Written by Echo · you can change it/);
  for (const k of ["kanji", "grammar", "word"]) assert.match(app, new RegExp(`\\$\\("#${k}-mine-head"\\)\\.hidden=!mine\\.length;sheetCount\\(`));
  assert.match(css, /\.sheet-more:not\(:has\(> :not\(summary\):not\(\[hidden\]\)\)\)\{display:none\}/, "no empty collapsed row");
});

test("learn mode: arrow keys step like the footer, and typing stays typing", () => {
  const keys = app.slice(app.indexOf("// Learn mode in a sheet"), app.indexOf("// Desktop keys, as the sidebar legend promises."));
  assert.match(keys, /event\.target\.closest\?\.\("input,textarea,select,\[contenteditable\]"\)\)return/);
  assert.match(keys, /querySelector\(event\.key==="ArrowLeft"\?"\.nav-prev":"\.nav-next"\)/);
  assert.match(keys, /if\(!nav\|\|nav\.hidden\)return/, "only in learn mode");
});

test("onboarding offers the starter, unticked, for Japanese only, and awaits it", () => {
  assert.match(html, /<label id="setup-starter" class="starter-offer" hidden><input id="setup-starter-add" type="checkbox">/);
  assert.doesNotMatch(html, /id="setup-starter-add"[^>]*checked/, "unticked by default");
  assert.match(html, /The <span lang="ja">ミニ本語<\/span> Minihongo starter/);
  assert.match(app, /const show=\$\("#setup-target"\)\?\.value==="ja"&&!starterSeeded/);
  const save = app.slice(app.indexOf("async function saveSetup"), app.indexOf("function finishOnboarding"));
  assert.match(save, /try\{await addStarter\(\)/, "awaited before routing");
  assert.match(save, /finishOnboarding\(\)\}\s*$/, "onboarding finishes even if the download fails");
  assert.match(app, /async function addStarter\(\)\{[\s\S]*importBackupData\(await fetchDeckBackup\(MINI_DECK_URL/, "one import path for every entry point");
});

test("the starter is named ミニ本語 Minihongo in everything a learner reads", () => {
  assert.doesNotMatch(html, /Mini Hongo/);
  const visible = [...app.matchAll(/"[^"\n]*Mini Hongo[^"\n]*"/g)].map(m => m[0]);
  assert.deepEqual(visible, ['"Mini Hongo starter library"'], "only the deck file's own title (data) keeps the old spelling");
});
