// Regressions found in the October 2026 audit. Each test names the failure it
// pins; see AUDIT.md for the reproduction behind each one.
import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateDeckBackup} from "../imports.js";
import {exportBackup, isLanguage, safeLanguage} from "../core.js";
import {ANTHROPIC_MAX_TOKENS, translate} from "../api.js";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const ja = await readFile(new URL("../i18n/ja.js", import.meta.url), "utf8");
const block = (from, to) => { const start = app.indexOf(from); return app.slice(start, app.indexOf(to, start + from.length)); };

test("a backup's language codes cannot carry markup into lang attributes", () => {
  const card = {id: "x", source: "a", target: "b"};
  assert.throws(() => validateDeckBackup({schemaVersion: 2, sentences: [{...card, targetLang: 'ja"><img src=x onerror=alert(1)>'}]}), /unknown targetLang/);
  assert.throws(() => validateDeckBackup({schemaVersion: 2, sentences: [{...card, sourceLang: "<b>"}]}), /unknown sourceLang/);
  assert.equal(validateDeckBackup({schemaVersion: 2, sentences: [{...card, sourceLang: "en", targetLang: "ja"}]}).sentences.length, 1);
  assert.equal(isLanguage("ja"), true);
  assert.equal(safeLanguage('ja"><x', "ja"), "ja");
  // Records stored before validation existed are neutralised where they render.
  assert.match(app, /const itemTarget=item=>safeLanguage\(item\?\.targetLang,DEFAULT_PAIR\.targetLang\)/);
});

test("a backup never carries any stored credential, including the speech key", () => {
  const backup = exportBackup([], {apiKey: "a", providerKeys: {google: "b"}, speechKeys: {groq: "gsk_secret"}, theme: "dark"});
  assert.equal(JSON.stringify(backup).includes("gsk_secret"), false);
  assert.deepEqual(backup.preferences, {theme: "dark"});
});

test("saving a discussion turn calls only functions that exist", () => {
  const save = block("save.onclick=async()=>{", "actions.append(save)");
  assert.doesNotMatch(save, /renderLibrary|showToast/);
  assert.match(save, /toast\("Saved to your library\."\)/);
  for (const name of ["toast", "sheetError", "refreshDueBadge"]) assert.match(app, new RegExp("function " + name + "\\("));
});

test("starting a discussion cannot be sent twice while the first request runs", () => {
  const begin = block("async function beginDiscussion", "async function replyDiscussion");
  assert.match(begin, /if\(\$\("#translate"\)\.disabled\)return/);
  assert.match(begin, /finally\{\$\("#translate"\)\.disabled=false\}/);
});

test("a second tap on a grade or skip cannot act on the same card twice", () => {
  const rate = block("async function rateReview", "async function exportHistory");
  assert.match(rate, /reviewBusy\)return;reviewBusy=true;try\{/);
  assert.match(rate, /finally\{reviewBusy=false\}/);
  const skip = block("async function skipReview", "let reviewBusy");
  assert.match(skip, /if\(!sentence\|\|reviewBusy\)return;reviewBusy=true;try\{/);
});

test("reading the library for grammar re-reads each sentence before writing it", () => {
  const tag = block("async function tagUntagged", "let grammarOpen");
  assert.match(tag, /const fresh=await getSentence\(sentence\.id\);if\(!fresh\|\|isTagged\(fresh\)\)continue/);
  assert.doesNotMatch(tag, /saveSentence\(\{\.\.\.sentence,grammar/);
});

test("Anthropic requests leave room for a reading passage or a 30-sentence batch", async () => {
  assert.ok(ANTHROPIC_MAX_TOKENS >= 4096);
  const previous = global.fetch; let body;
  global.fetch = async (url, options) => { body = JSON.parse(options.body); return {ok: true, json: async () => ({content: [{type: "text", text: JSON.stringify({casual: "今日【きょう】はいい", polite: "今日【きょう】はいいです"})}]})}; };
  try { await translate("Today is good", {provider: "anthropic", providerKeys: {anthropic: "k"}}); assert.equal(body.max_tokens, ANTHROPIC_MAX_TOKENS); }
  finally { global.fetch = previous; }
});

test("Settings offers no control that nothing reads", () => {
  assert.doesNotMatch(html, /id="autolisten"/, "review answers are typed; the auto-listen toggle had no effect");
  assert.doesNotMatch(app, /autoListen/);
});

test("the Japanese catalogue has one entry per key", () => {
  const keys = [...ja.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)].map(m => m[1]);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dupes, []);
});
