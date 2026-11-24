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
