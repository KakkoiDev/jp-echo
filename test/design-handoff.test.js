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
  assert.match(app, /listening\?"Said it — show me":mode==="reading"\?"Show the meaning":"Said it — check and listen"/, "the check button says what you did and what comes next");
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
  assert.match(css, /\.review-vocab\{cursor:pointer;text-decoration:underline dotted var\(--quiet-edge\);text-decoration-thickness:1\.5px;text-underline-offset:5px/, "a word: dotted grey, 1.5px");
  assert.match(css, /\.grammar-mark\{text-decoration:underline var\(--seal\);text-decoration-thickness:2px;text-underline-offset:5px/, "grammar: solid vermilion, 2px");
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
  assert.equal((html.match(/<svg class="ripple echo"/g) || []).length, 4, "welcome, onboarding, review home and the empty library rings stay still and never carry .live");
});

test("review: the skill-mix card, the listening panel, the answer and the stats follow the October boards", () => {
  assert.doesNotMatch(html, /id="review-24h"|id="session-review-24h"/, "the 24-hour counter line is gone from Review home and the session");
  const home = html.slice(html.indexOf('<section id="review-home"'), html.indexOf('<section id="review-view"'));
  assert.ok(home.indexOf('<div id="review-skill-mix" class="skill-mix"') > home.indexOf('<div class="breakdown">') && home.indexOf('<div id="review-skill-mix"') < home.indexOf('<div class="sheet">'), "the skill mix is a card between the ring and the sheet");
  assert.match(css, /\.skill-mix\{display:flex;flex-direction:column;margin:20px 0 0;padding:14px 16px 15px;background:var\(--panel\);border:1px solid var\(--hairline\);border-radius:4px;text-align:left\}/);
  assert.match(app, /item\.append\(skillGlyph\(mode,\{state:"filled",size:30\}\)/, "the mix glyphs are filled marks");
  assert.match(css, /\.skill-glyph\[data-state="filled"\]\{background:var\(--seal\);border-color:var\(--seal\);color:var\(--seal-on\)\}/);
  assert.match(app, /"Say each one out loud before you check\. Roughly "\+spell/);
  assert.match(css, /\.review-mode-title\{margin:18px 0 0;font-family:var\(--display\);font-weight:600;font-size:22px;line-height:1\.25\}/, "card title: 22px, left");
  assert.match(app, /skillTrio\(mode,\{label:meta\.label\+" card\. This sentence turns through listening, reading and writing\.",size:26\}\)/);
  assert.match(html, /<div id="review-passive" class="review-passive" hidden><button data-ui="button" id="review-front-audio" type="button" aria-pressed="false"><svg/, "the listening card's Play is outlined, with a play icon, in a panel");
  assert.doesNotMatch(html, /id="review-front-audio" class="primary"/);
  assert.match(app, /"Plays the sentence once\. Say it with the voice, then check — the Japanese is shown after\."/);
  assert.match(app, /state===0\?" · first time":""/, "a new card says it is the first time");
  assert.match(app, /for\(const id of \[".review-meta","#review-mode-title","#review-mode-instruction"\]\)document\.querySelector\(id\)\.hidden=true/, "the checked answer drops the chip, trio, title and reason");
  assert.match(html, /<p id="review-grammar-note" class="hint">Read off the sentence when it was explained\. A row opens the grammar point\. The review never asks the model\.<\/p>/);
  assert.match(css, /#review-grammar\[hidden\]\+#review-grammar-note\{display:none\}/);
  assert.doesNotMatch(app, /t\("\{n\} points"/, "Grammar in it carries no count");
  assert.match(app, /capitalise\(spell\(done\)\)\+\(done===1\?" sentence":" sentences"\)\+" out loud\."/, "the finished screen starts with a capital and says what was done");
  assert.match(app, /Math\.round\(\(complete\?reviewQueue\.length:reviewIndex\+1\)\/reviewQueue\.length\*100\)/, "the progress bar counts the card in hand");
  assert.match(html, /<div id="review-stats" role="tabpanel" aria-labelledby="review-tab-stats" hidden><p class="overline">Past 24 hours<\/p><p class="stats-figure"><strong id="stats-24h">0<\/strong>/);
  assert.doesNotMatch(html, /review-stats-summary|Review history/);
  assert.match(app, /cell\.dataset\.level=day\.count>=8\?"full":day\.count\?"some":"none"/);
  assert.match(app, /\.reverse\(\)\);/, "day cells run oldest first, today last");
  assert.match(app, /label\.textContent=reviewModeMeta\(mode\)\.past/, "tile labels come from the track's own words");
  assert.match(html, /nothing here is a streak, and nothing is lost by missing a day\./);
});

test("sentence page: the key, the echo row, the tiles, the rows and the foot follow the Sentence board", () => {
  assert.match(html, /<span class="key-word"><span class="key-sample-word">a word<\/span> — tap to look it up<\/span><span id="sentence-key-grammar" class="key-grammar"><span class="key-sample-grammar">grammar<\/span> — explained below<\/span>/, "the underline itself is the sample, and both items always show");
  assert.doesNotMatch(app, /\$\("#sentence-key-grammar"\)\.hidden=/);
  assert.match(css, /\.sentence-play-row\{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:20px\}/);
  assert.match(css, /\.sentence-echoes \.counter strong\{font-size:22px\}/);
  assert.match(css, /\.register-label\{font-size:11px;text-transform:uppercase;letter-spacing:\.16em;color:var\(--ink-muted\)\}/);
  assert.match(html, /<p id="sentence-grammar-note" class="hint">One request, when you asked\. Kept with the sentence; shown again on the review answer without asking\.<\/p>/);
  assert.match(css, /#sentence-grammar:not\(:has\(\.grammar-list\)\)\+#sentence-grammar-note\{display:none\}/);
  assert.match(app, /label=el\("span","skill-label",done\?meta\.past:mode===next\?"next: "\+meta\.title\.toLowerCase\(\):meta\.verb\)/, "tile labels: heard / read / next: write it");
  assert.match(app, /skillGlyph\(mode,\{state:done\?"filled":mode===next\?"inactive":"default",size:30\}\)/);
  assert.match(css, /\.skill-tile\[data-next\]\{border-color:var\(--seal\)\}/);
  assert.match(app, /\(reviews\.length\?reviews\.length\+\(reviews\.length===1\?" review":" reviews"\):"No reviews yet"\)\+" · "\+\(Number\(detail\.echoCount\)\|\|0\)\+" echoes"/, "History meta: reviews · echoes · last date");
  assert.match(html, /<span class="collapse-meta">Generate a new one from your directions, or fix the furigana<\/span>/);
  assert.match(css, /\.collapse-title\{grid-column:1;font-size:14px;color:var\(--sumi\)\}/);
  const page = html.slice(html.indexOf('<section id="sentence-view"'), html.indexOf("</section>", html.indexOf('<section id="sentence-view"')));
  assert.match(page, /<div class="sentence-foot"><button id="sentence-find-references" class="plain" type="button" data-ui="button">Find missing references<\/button><button data-ui="button" id="sentence-delete" class="text-danger" type="button">/, "a quiet text link and the delete, on one row at the bottom");
  assert.ok(page.indexOf('id="sentence-find-references"') > page.indexOf('id="sentence-change"'), "Find missing references is no longer above the sentence");
  assert.match(css, /#sentence-view:has\(#sentence-change\[open\]\) :is\(\.sentence-play-row,#sentence-grammar/, "with Change this sentence open, the page is the editor");
  assert.match(page, /id="sentence-rewrite" class="primary" type="button">Generate<svg/);
  assert.match(page, /<div class="furigana-actions"><button data-ui="button" id="sentence-edit-readings" type="button" class="plain">Edit furigana<\/button>/);
  assert.match(page, /id="sentence-cancel" class="outline"/);
  assert.match(html, /<dialog id="dictionary-dialog" class="tool-sheet"><div class="sheet-handle" aria-hidden="true"><\/div><div class="dictionary-head"><h2 id="dictionary-title" lang="ja"><\/h2><button data-ui="button" id="dictionary-close" class="icon-button" type="button" aria-label="Close">/);
  assert.match(html, /id="dictionary-ask" type="button" class="plain">Ask Echo what it means here<\/button><p class="hint">Readings and senses are JMdict’s, on the device\. Only the question to Echo needs the network\.<\/p>/);
});

test("identity: the maskable icon is its own file, the glyph inside the safe zone", async () => {
  const any = await readFile(new URL("../icon-512.png", import.meta.url)), maskable = await readFile(new URL("../icon-maskable-512.png", import.meta.url));
  assert.equal(any.equals(maskable), false, "decision 2: never one file for both purposes");
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.ok(manifest.icons.some(i => i.src === "./icon-maskable-512.png" && i.purpose === "maskable"));
  assert.ok(manifest.icons.some(i => i.src === "./icon-512.png" && i.purpose === "any"));
});

test("settings is the page the boards draw: chips, rows, honest reminders, sub-pages, first run", () => {
  assert.match(css, /\.settings-index\{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0\}/, "the section index is four chips on a phone");
  assert.match(html, /<a href="#settings-device">This device <span aria-hidden="true">🔒<\/span><\/a>/);
  assert.match(css, /\.settings-row-title\{font-family:var\(--display\);font-size:17px;color:var\(--sumi\)\}/);
  assert.match(html, /<span>Speaker 1 — Echo<\/span>/);
  assert.match(app, /const tail=" — Echo has no server and sends nothing\.";/, "the reminders line never promises a push");
  assert.match(app, /return "On this device: Echo checks when it is opened\. This browser does not wake it in the background, so a reminder can only arrive on a day you open the app"\+tail;/);
  assert.doesNotMatch(app, /\$\("#remind-reach"\)\.textContent=settings\.remind\?/, "the line shows whether or not the toggle is on");
  assert.doesNotMatch(html, /settings-page-title/, "a sub-page's title lives in the header only");
  assert.match(html, /<span class="collapse-title">Advanced<\/span><span class="collapse-meta">Optional translation proxy, for browsers a provider blocks<\/span>/);
  assert.match(app, /settings\.aiCheckedAt=new Date\(\)\.toISOString\(\);persistSettings\(\)/, "the check time is remembered, not the key");
  assert.match(app, /"Key checked "\+gistWhen\(checked\)\+" · working"/);
  assert.match(html, /<h3 class="rule-heading">Backup file<\/h3><div class="asset-row"><span class="asset-copy"><strong>Export a file<\/strong><span class="hint">Every sentence, note and review as JSON\. No keys, ever\.<\/span>/);
  assert.match(app, /\$\("#export"\)\.onclick=exportHistory;\$\("#export-file"\)\.onclick=exportHistory;/, "one action, one implementation: both export buttons run exportHistory");
  assert.match(html, /<h3 class="rule-heading">From a book or a passage<\/h3><button data-ui="button" id="settings-extract" class="library-tool two-line"/);
  assert.match(html, /<h3 class="rule-heading">Furigana check<\/h3>/);
  assert.match(html, /id="reading-backfill" type="button">Resume<\/button>/);
  assert.match(html, /id="onboard-restore" class="plain" type="button">I have a backup file, or a gist<\/button>/);
  assert.match(app, /#onboard-restore"\)\.onclick=\(\)=>\{finishOnboarding\(\);openSettings\(\)\}/, "both restore paths live in Settings");
  assert.match(app, /\$\("#setup-title"\)\.textContent=step===1\?"One thing first":"Which way round\?"/);
});

test("library and the study tool: the empty library, the tool rows, grammar and word rows, the word sheet, the mora table", () => {
  assert.match(html, /<div id="empty-history" class="empty-panel" hidden><svg class="ripple echo" width="300"/, "a still ripple behind the empty library");
  assert.match(html, /<span class="empty-glyph" lang="ja" aria-hidden="true">空<\/span><strong>No sentences yet<\/strong><span>Everything you translate lands here, with its readings and its review history\.<\/span><button data-ui="button" id="empty-practice" class="primary" type="button">Write your first one<svg/);
  assert.match(html, /id="empty-starter" class="plain library-tool two-line"[\s\S]*Add 262 starter sentences[\s\S]*id="empty-import" class="plain library-tool two-line"[\s\S]*Import a deck or a backup/);
  assert.doesNotMatch(app, /\.join\(" · "\)\+" "\+t\("learned"\)/, "the tool row tally is three numbers");
  assert.match(css, /\.library-tool\.mora-open\{margin-top:0\}/);
  assert.match(css, /\.point-row:not\(:has\(\.reading\)\)\{display:grid;grid-template-columns:20px minmax\(0,1fr\) auto/, "a grammar row is its title over its gloss");
  assert.match(app, /chunkHead\(i\+1,Math\.min\(i\+20,limit\),i===0&&tool\.chip==="all",t\("most common first"\)\)/);
  assert.match(app, /const mark=el\("span","sense-mark",kanjiNumeral\(i\+1\)\)/, "senses are numbered 一 二");
  assert.match(css, /\.mora-table\.labelled \.mora-row\{grid-template-columns:22px repeat\(5,minmax\(0,1fr\)\)\}/);
  assert.match(app, /host\.classList\.toggle\("labelled",english\)/);
  assert.match(app, /\$\("#mora-show-english"\)\.checked=settings\.moraEnglish\?\?true/, "English is on by default; it draws the headings");
  assert.match(html, /<small lang="en">fuses with the i-row before it<\/small>/);
  assert.doesNotMatch(html, /【まえ】/, "no raw bracket furigana on the mora cards");
  assert.match(app, /echoLine:t\("Bundled with the app for 2,131 of the 2,136\./);
  assert.match(app, /name==="map"\|\|name==="mora"\|\|name==="settings"\)&&!isWide\(\)/, "the Mora table is a pushed screen like the study tool: no brand header, no tabs");
});
