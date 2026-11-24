import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("Library: a 栞 Saved words row sits right under 記 Echo's notes and reuses its row", () => {
  const notes = html.indexOf('id="library-notes"'), saved = html.indexOf('id="library-saved"');
  assert.ok(notes > 0 && saved > notes && saved - notes < 700, "directly after Echo's notes");
  assert.match(html, /<div id="library-saved" class="library-notes library-saved" hidden><button data-ui="button" id="library-saved-open" class="library-notes-open" type="button"><span class="library-notes-glyph" lang="ja" aria-hidden="true">栞<\/span>Saved words <strong id="library-saved-count"><\/strong><\/button><span id="library-saved-words" class="library-notes-words"><\/span><\/div>/);
  assert.match(app, /renderLibraryNotes\(\);renderLibrarySaved\(\);/, "drawn with the Library");
  assert.match(app, /\$\("#library-saved-open"\)\.onclick=\(\)=>showView\("saved"\)/);
  assert.match(css, /\.library-notes:not\(\[hidden\]\)\+\.library-saved\{margin-top:0;border-top:0\}/);
});

test("Saved words is a pushed screen with a tool head, like Echo's notes", () => {
  assert.match(html, /<section id="saved-view" hidden><div class="tool-head"><button data-ui="button" id="saved-back" class="icon-button" type="button" aria-label="Back to Library">/);
  assert.match(app, /\$\("#saved-view"\)\.hidden=name!=="saved"/);
  assert.match(app, /name==="sentence"\|\|name==="saved"\|\|name==="map"/, "solo on a phone");
  assert.match(app, /\(name==="sentence"\|\|name==="map"\|\|name==="notes"\|\|name==="saved"\)&&tab\.dataset\.view==="library"/, "the Library tab stays current");
  assert.match(app, /else if\(name==="saved"\)renderSaved\(\)/);
  assert.match(sw, /\(\?:sentences\|words\|kanji\|grammar\)\(\?:\\\/\|\$\)/, "/words?saved=1 opens offline");
});

test("a saved row: the mark, word, reading · gloss, a Met/Learned chip only when earned, the latest context", () => {
  const row = app.slice(app.indexOf("function savedRow("), app.indexOf("// Mora v5: Echo's notes still written"));
  assert.match(row, /open\.className="notes-row saved-row"/, "Echo's notes row, reused");
  assert.match(row, /savedMarkHtml\(true\)/);
  assert.match(row, /state!=="unmet"\?'<span class="state-chip" data-state="'/, "no chip says unmet");
  assert.match(row, /markPattern\(escapeText\(context\.text\),marks\)/, "the context is escaped, then the word marked");
  assert.match(row, /contextSource\(context,/);
  assert.doesNotMatch(row, /innerHTML=[^;]*record\.w\+/, "snapshot text never reaches markup raw");
});

test("the empty state follows SavedWordsEmpty: the 栞 tile, how to save, the Library line, Open the Words wall", () => {
  const empty = html.slice(html.indexOf('id="saved-empty"'), html.indexOf("</section>", html.indexOf('id="saved-empty"')));
  assert.match(empty, /class="empty-panel saved-empty"/);
  assert.match(empty, /<span class="empty-glyph" lang="ja" aria-hidden="true">栞<\/span><strong>No saved words yet<\/strong>/);
  assert.match(empty, /Saving a word adds the sentence you met it in to your Library\./);
  assert.match(empty, /id="saved-open-words" class="outlined"[^>]*>Open the Words wall</);
  assert.doesNotMatch(empty, /<svg/, "the inline mark comes from SavedMark");
  assert.match(app, /\$\("#saved-empty-mark"\)\.innerHTML=savedMarkHtml\(false/);
});

test("word sheet (WordSaved / WordUnsaved): toggle, status line, Where you saved it, Remove at the foot", () => {
  const sheet = html.slice(html.indexOf('id="word-dialog"'), html.indexOf("</dialog>", html.indexOf('id="word-dialog"')));
  const order = ['id="word-save"', 'id="word-senses"', 'id="word-saved-status"', 'id="word-kanji"', 'id="word-more"', 'id="word-mine-head"', 'class="kanji-say"', 'id="word-saved"', 'id="word-remove"'].map(id => sheet.indexOf(id));
  assert.ok(order.every(i => i > 0), "every part is on the sheet");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "board order: header toggle, senses, status, kanji, note, sentences, say, saved contexts, remove");
  assert.match(sheet, /<p class="hint">Up to five, newest first\. The address keeps the site and path only\.<\/p>/);
  assert.match(sheet, />Remove from saved words<\/button>/);
  const render = app.slice(app.indexOf("async function renderWordSaved("), app.indexOf("async function toggleWordSaved("));
  assert.match(render, /t\("Removed from saved words\."\)/);
  assert.match(render, /t\("from the reader"\)/);
  assert.match(render, /t\("The sentence is in your Library\."\)/);
  assert.match(render, /\$\("#word-saved"\)\.hidden=!saved/, "contexts drop out of view once removed");
  assert.match(render, /markPattern\(escapeText\(context\.text\),marks\)/, "context text is escaped before the word is marked");
  assert.match(render, /chip\.hidden=saved&&chip\.dataset\.state==="unmet"/, "nothing says unmet while saved");
  // Remove is a tombstone through the wrapper, never a delete, and no toast.
  const remove = app.slice(app.indexOf("async function removeOpenWord("), app.indexOf("// Echo's way to remember a word is written"));
  assert.match(remove, /await removeWord\(target\.word\.id\);await renderWordSaved\(target\.word,\{removed:true\}\)/);
  assert.doesNotMatch(remove + render, /toast\(/);
  assert.match(app, /addEventListener\("close",\(\)=>\{loop\.stop\(\);kanjiPlaying=null;wordOpen=null;saveWorkspace\(\{modal:null\}\);refreshSavedBehindSheet\(\)\}\)/, "the list behind redraws when the sheet closes");
});

test("Save keeps the sentence the word was opened from, and names its card only if it is in the Library", () => {
  const toggle = app.slice(app.indexOf("async function toggleWordSaved("), app.indexOf("// \"Remove from saved words\" at the foot"));
  assert.match(toggle, /if\(context\?\.sentenceId&&!\(await getSentence\(context\.sentenceId\)\.catch\(\(\)=>null\)\)\)delete context\.sentenceId;/);
  assert.match(toggle, /await saveWord\(w,\{context,from:"echo"\}\);/, "awaited before the sheet says Saved");
  assert.ok(toggle.indexOf("await saveWord(") < toggle.indexOf("await renderWordSaved(w);"));
  assert.match(app, /const saveContext=\{text:context,\.\.\.\(sentence\?\.id&&!sentence\.transient\?\{sentenceId:sentence\.id\}:\{\}\)\};/);
});
