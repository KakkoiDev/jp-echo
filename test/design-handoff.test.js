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
  assert.match(html, /id="review-skill-mix"[\s\S]*In this session you will/);
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

test("practice: one navigation — three rows that never hide, pushed screens with a back arrow, no mode bar", () => {
  assert.match(html, /id="welcome-modes"[\s\S]*Or practise another way[\s\S]*id="welcome-discussion" class="library-tool two-line"[\s\S]*id="welcome-reading" class="library-tool two-line"[\s\S]*id="welcome-extract" class="library-tool two-line"/);
  for (const gone of ["practice-mode", "mode-sentence", "mode-discussion", "mode-reading", "mode-extract", "modesUsed", "markModeUsed", "renderWelcomeModes"]) { assert.equal(html.includes(gone), false, gone); assert.equal(app.includes(gone), false, gone); assert.equal(css.includes(gone), false, gone); }
  for (const [section, back] of [['<section id="discussion" hidden>', "discussion-back"], ['<section id="reading" hidden>', "reading-back"], ['<section id="extract-text" hidden>', "extract-back"]]) {
    const at = html.indexOf(section);
    assert.ok(at >= 0, section);
    assert.match(html.slice(at, at + 700), new RegExp('<div class="tool-head"><button data-ui="button" id="' + back + '" class="icon-button" type="button" aria-label="Back to Practice">'), back + " is the study tool's back-arrow header");
  }
  assert.match(app, /\$\("#extract-back"\)\.onclick=showStart;\$\("#discussion-back"\)\.onclick=showStart;\$\("#reading-back"\)\.onclick=showStart;/);
  assert.match(app, /function showStart\(\)\{loop\.stop\(\);current=null;renderSentence\(\);setPracticeMode\("sentence"\)\}/, "back lands on the start screen, where the rows are");
  assert.match(app, /if\(tab\.dataset\.view==="practice"&&document\.body\.dataset\.view==="practice"\)showStart\(\)/, "the Practice tab, tapped again, is the way back from a pushed screen");
  assert.match(app, /function composerVerb\(\)\{return discussionMode\?\(discussionTurns\.length\?"Send":"Begin"\):readingMode\?"Write":"Translate"\}/, "one composer; only its verb changes");
  // The three bodies follow their boards.
  assert.match(html, /<option value="new">Words never met<\/option><option value="unlearned">Met but not learned<\/option>/);
  assert.match(html, /id="extract-analyze" data-ui="button" class="outline extract-analyze"/, "Find sentences is outlined; Import is the only filled button");
  assert.match(html, /<div id="extract-foot" hidden><p class="hint">Nothing has been imported\. The sentences you keep join your library and reviews like your own\.<\/p><button id="extract-import" type="button" class="primary"/);
  assert.match(app, /\$\('#extract-import'\)\.textContent=`Import \$\{count\} selected`/);
  assert.match(app, /row\.fresh\.length===1\?'word':'words'/, "1 new word, not 1 new words");
  assert.match(app, /save\.textContent=turn\.saved\?"Saved ✓":"Save to Library"/);
  assert.match(css, /\.discussion-turn::before\{content:"Echo"/, "turns are labelled Echo and You");
  assert.doesNotMatch(html, /id="reading-new"/, "another text comes from the composer, not a New text button");
  assert.match(css, /\.reading-sentence\.selected\{background:var\(--panel\);border-color:var\(--sumi\)\}/);
});

test("discussion: starter scenes fill the box and never send", () => {
  const scenes = [...html.matchAll(/data-scene="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scenes, ["Ordering at a café", "Checking in at a hotel", "Small talk with a neighbour", "Asking a colleague for help"]);
  const wire = app.slice(app.indexOf('document.querySelectorAll("#discussion-scenes [data-scene]")'), app.indexOf("\n", app.indexOf('document.querySelectorAll("#discussion-scenes [data-scene]")')));
  assert.match(wire, /input\.value=scene\.dataset\.scene/);
  assert.doesNotMatch(wire, /beginDiscussion|replyDiscussion|\.click\(\)/, "filling is not sending");
  assert.match(app, /function composerLabel\(\)\{return discussionMode\?\(discussionTurns\.length\?"Your reply":"The scene"\)/);
  assert.match(wire, /other\.setAttribute\("aria-pressed",String\(other===scene\)\)/, "the chosen scene is the tinted chip");
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

test("settings is a route: /settings plus its sub-pages, and they round-trip", async () => {
  const {parseRoute, routeFor, SETTINGS_PAGES} = await import("../routes.js");
  assert.deepEqual([...SETTINGS_PAGES], ["ai", "speech", "backup", "import", "export", "grammar"]);
  assert.equal(routeFor(parseRoute("/settings")), "/settings");
  for (const page of SETTINGS_PAGES) assert.equal(routeFor(parseRoute("/settings/" + page)), "/settings/" + page);
  assert.equal(parseRoute("/settings/nope").notFound, true);
  assert.match(app, /else if\(route\.view==="settings"\)openSettings\(route\.settingsPage,\{route:false\}\)/, "reload and back/forward land on the page");
  assert.doesNotMatch(html, /id="settings-dialog"|id="close-settings"|id="cancel-settings"/, "no modal, no Save/Cancel");
});

test("preferences commit on change; credentials only on an explicit save", () => {
  const prefs = app.slice(app.indexOf("function saveSettings(){"), app.indexOf("// One write path"));
  for (const credential of ["providerKeys", "speechKeys", "localEndpoint", "proxyUrl", '"#provider"']) assert.equal(prefs.includes(credential), false, credential + " must not be saved with preferences");
  assert.match(prefs, /if\(settings\.gistAuto&&!gistWasOn\)settings\.gistToken=/, "the gist token only by switching backup on");
  assert.match(app, /for\(const id of \["theme","motion","voice","discussion-voice-ai","discussion-voice-user","rate","autotag","remind-time","gist-auto","gist-url"\]\)\$\("#"\+id\)\.addEventListener\("change",commitPreferences\)/, "commit on change, never on blur");
  assert.match(app, /function commitPreferences\(\)\{if\(saveSettings\(\)\)\{renderPracticeNotices\(\);writeReminderPrefs\(\);syncReminderSchedule\(\)\}else flashSaved\("Not saved/, "success is shown only after the write lands");
  assert.match(app, /return JSON\.parse\(localStorage\.getItem\("jp-echo-settings"\)\|\|"null"\)!==null/);
  for (const id of ["ai-save", "ai-check", "ai-remove", "speech-save"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(app, /The key works — checked just now\. The check used one request\./);
});

test("Back walks history only when the entry behind is where it leads", () => {
  const leave = app.slice(app.indexOf("function leaveSettings"), app.indexOf("// SettingsRow statuses"));
  assert.match(leave, /if\(settingsStack\[settingsStack\.length-1\]===target\)\{settingsStack\.pop\(\);history\.back\(\);return\}/);
  assert.match(leave, /if\(target==="main"\)\{settingsStack=\[\];return showSettingsPage\("main"\)\}/, "a pushed /settings breaks the chain");
  assert.match(app, /if\(route&&!fresh&&previous==="main"&&settingsPage!=="main"\)settingsStack\.push\("main"\)/);
});

test("settings page structure: four groups, SettingsRow rows, lock note, install panel", () => {
  const view = html.slice(html.indexOf('<section id="settings-view"'), html.indexOf('<section id="map-view"'));
  const groups = [...view.matchAll(/<section class="settings-section" id="settings-([a-z]+)"><h3>([^<]+)<\/h3>/g)].map(m => m[2]);
  assert.deepEqual(groups, ["Every day", "Languages", "Your sentences", "On this device only"]);
  for (const page of ["backup", "import", "export", "ai", "speech", "grammar"]) assert.match(view, new RegExp(`<button data-ui="button" id="settings-row-${page}" class="settings-row" type="button" data-settings-page="${page}">`));
  assert.match(view, /Keys and endpoints stay in this browser\. They are never in an export, a backup file or your gist\./);
  assert.match(view, /<span id="settings-saved" class="hint saved-note" aria-live="polite">Saved as you go<\/span>/);
  assert.match(view, /class="install-panel"/);
  assert.match(css, /\.settings-row\{display:flex;align-items:center;gap:12px;width:100%;min-height:64px/);
});

test("a chosen segment, chip or register is seal-tinted, never a sumi block", () => {
  assert.match(css, /\.segmented \[role=tab\]\[aria-selected=true\]\{background:var\(--seal-tint\);color:var\(--seal-deep\);font-weight:500;box-shadow:inset 0 -2px 0 var\(--seal\)\}/);
  assert.match(css, /#sentence-register button\.selected\{background:var\(--seal-tint\);color:var\(--seal-deep\);font-weight:500;box-shadow:inset 0 -2px 0 var\(--seal\)\}/);
  assert.match(css, /\.chips button\[aria-pressed=true\]\{background:var\(--seal-tint\);border-color:var\(--seal-edge\);color:var\(--seal-deep\)\}/);
  assert.doesNotMatch(css, /background:var\(--sumi\);color:var\(--seal-on\)/, "sumi fill is reserved for states, not for a chosen option");
});

test("the stylesheet uses the palette: no undefined tokens, no raw colours, no escaped newline", () => {
  assert.doesNotMatch(css, /var\(--paper/, "--paper was never defined; the panel token is the paper");
  assert.doesNotMatch(css, /#f6df9b|#292318/i, "extract marks use --seal-wash and --seal-deep");
  assert.equal(css.includes("\\n"), false, "a literal \\n in a stylesheet is an escape, not a newline");
  assert.match(css, /\n\.reading-sentence-text\{/, "the reading line rule applies");
  assert.doesNotMatch(css, /border:1px solid currentColor;border-radius:8px/, "generic web-app boxes are panels with a 4px radius");
});

test("the echo animation is docs/design/motion.css whole, and the live rings move with the loop", async () => {
  const motion = await readFile(new URL("../docs/design/motion.css", import.meta.url), "utf8");
  assert.ok(css.includes(motion.trim()), "styles.css carries motion.css verbatim");
  assert.doesNotMatch(css, /\.arcs:not\(\.small\)\{height:42px/, "the 42px crop that cut the outer arc is gone");
  assert.match(app, /document\.querySelectorAll\("\.arcs > \.echo, \.ripple\.echo\.live"\)\)echo\.classList\.toggle\("is-playing",active\)/, "one selector in the loop's onState");
  assert.match(app, /function loopArcs\(scope,state\)\{const active=!\["stopped","error","paused"\]\.includes\(state\)/);
  assert.match(app, /onState:\(state,index\)=>\{loopArcs\("#discussion-live",state\)/);
  assert.match(app, /onState:\(state,index\)=>\{loopArcs\("#reading",state\)/);
  for (const host of ['<article id="practice" hidden>', '<div id="review-result" hidden>', '<section id="sentence-view" hidden>']) {
    const at = html.indexOf(host), live = html.indexOf('<svg class="ripple echo live"', at);
    assert.ok(at >= 0 && live > at && live - at < 700, host + " carries the live ripple behind the sentence");
  }
  assert.equal((html.match(/<svg class="echo" width="96" height="96" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1\.6"/g) || []).length, 5, "five compact arc pairs: practice, sentence, review answer, discussion, reading");
  assert.doesNotMatch(html, /<svg class="echo" width="76"/);
  assert.equal((html.match(/<svg class="ripple echo"/g) || []).length, 3, "welcome, onboarding and review home rings stay still and never carry .live");
});
