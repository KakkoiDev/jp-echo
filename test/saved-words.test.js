import test from "node:test";
import assert from "node:assert/strict";
import {cleanUrl, cleanContext, contextSource, isSaved, mergeWords, removeWordRecord, saveWordRecord, savedOnly, unionContexts, validateSavedWords, MAX_CONTEXTS} from "../saved-words.js";
import {saveWordAction, removeWordAction} from "../actions.js";
import {exportBackup} from "../core.js";

const kasa = {id: 1196930, w: "傘", r: "かさ", en: ["umbrella"]};
const at = iso => new Date(iso);

test("an address keeps the site and path only, and only http(s)", () => {
  assert.equal(cleanUrl("https://tenki.jp/lite/rain?token=secret#me"), "https://tenki.jp/lite/rain");
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("file:///etc/passwd"), null);
  assert.equal(cleanUrl("not a url"), null);
  assert.equal(cleanUrl("https://x.jp/" + "a".repeat(600)), null);
});

test("a context is plain, capped text; a title travels only with an address", () => {
  const c = cleanContext({text: "  急に雨が降ってきた。 ".repeat(30), title: "雨", at: "2026-11-06T00:00:00Z"});
  assert.equal(c.text.length, 240);
  assert.equal(c.url, undefined);
  assert.equal(c.title, undefined, "Sentence only: no address, no title");
  assert.equal(cleanContext({text: "  "}), null);
});

test("saving makes a record; saving again clears the tombstone and brings the contexts back", () => {
  const first = saveWordRecord(null, kasa, {context: {text: "傘を持っていけばよかった。", sentenceId: "s1"}, now: at("2026-11-04T00:00:00Z")});
  assert.deepEqual({id: first.id, w: first.w, r: first.r, lang: first.lang, from: first.from, removedAt: first.removedAt}, {id: 1196930, w: "傘", r: "かさ", lang: "ja", from: "echo", removedAt: null});
  assert.equal(first.contexts[0].sentenceId, "s1");
  assert.ok(isSaved(first));
  const removed = removeWordRecord(first, {now: at("2026-11-05T00:00:00Z")});
  assert.equal(removed.removedAt, "2026-11-05T00:00:00.000Z");
  assert.equal(isSaved(removed), false);
  assert.equal(removed.contexts.length, 1, "contexts stay on the record");
  const again = saveWordRecord(removed, kasa, {context: {text: "急に雨が降ってきたので、コンビニで傘を買った。", url: "https://tenki.jp/lite/rain", title: "雨の日の過ごし方"}, now: at("2026-11-06T00:00:00Z")});
  assert.equal(again.removedAt, null);
  assert.equal(again.savedAt, first.savedAt, "savedAt is the first save");
  assert.deepEqual(again.contexts.map(c => c.text), ["急に雨が降ってきたので、コンビニで傘を買った。", "傘を持っていけばよかった。"], "newest first, the old one back");
});

test("contexts are unioned by text and address, newest first, five at most", () => {
  const list = Array.from({length: 8}, (_, i) => ({text: "文" + i, at: new Date(Date.UTC(2026, 10, i + 1)).toISOString()}));
  const out = unionContexts(list, [{...list[7], sentenceId: "card"}]);
  assert.equal(out.length, MAX_CONTEXTS);
  assert.equal(out[0].text, "文7");
  assert.equal(out[0].sentenceId, "card", "the copy that knows its card keeps it");
});

test("merge: newer wins, a tie goes to the tombstone, and argument order never matters", () => {
  const base = saveWordRecord(null, kasa, {context: {text: "A"}, now: at("2026-11-01T00:00:00Z")});
  const phone = removeWordRecord(base, {now: at("2026-11-03T00:00:00Z")});
  const laptop = saveWordRecord(base, kasa, {context: {text: "B"}, now: at("2026-11-02T00:00:00Z")});
  for (const [a, b] of [[[phone], [laptop]], [[laptop], [phone]]]) {
    const [merged] = mergeWords(a, b);
    assert.equal(merged.removedAt, "2026-11-03T00:00:00.000Z", "the later removal wins");
    assert.deepEqual(merged.contexts.map(c => c.text).sort(), ["A", "B"], "contexts are kept for a later save");
  }
  const tieSave = saveWordRecord(base, kasa, {now: at("2026-11-03T00:00:00Z")});
  assert.ok(mergeWords([tieSave], [phone])[0].removedAt, "a tie goes to the tombstone");
  assert.ok(mergeWords([phone], [tieSave])[0].removedAt);
  const resaved = saveWordRecord(phone, kasa, {now: at("2026-11-04T00:00:00Z")});
  assert.equal(mergeWords([phone], [resaved])[0].removedAt, null, "saving again after a removal wins by time");
  const other = saveWordRecord(null, {id: 1234, w: "改札", r: "かいさつ"}, {now: at("2026-11-02T00:00:00Z")});
  assert.deepEqual(mergeWords([phone, other], [laptop]), mergeWords([laptop], [other, phone]), "deterministic");
});

test("validation drops one bad record with a reason, never the whole file", () => {
  const good = saveWordRecord(null, kasa, {context: {text: "傘", url: "https://x.jp/a?q=1"}, now: at("2026-11-01T00:00:00Z")});
  const {words, dropped} = validateSavedWords([good, {id: "1", w: "x", updatedAt: good.updatedAt}, {id: 5, w: "x", lang: "xx", updatedAt: good.updatedAt}, {id: 6, w: "<b>", updatedAt: "never"}, null]);
  assert.equal(words.length, 1);
  assert.equal(words[0].contexts[0].url, "https://x.jp/a");
  assert.deepEqual(dropped.map(d => d.index), [1, 2, 3, 4]);
  assert.deepEqual(validateSavedWords(undefined), {words: [], dropped: []});
});

test("the Saved words list holds saved words only, newest first", () => {
  const a = saveWordRecord(null, kasa, {now: at("2026-11-01T00:00:00Z")});
  const b = saveWordRecord(null, {id: 2, w: "改札", r: "かいさつ"}, {now: at("2026-11-03T00:00:00Z")});
  const c = removeWordRecord(saveWordRecord(null, {id: 3, w: "火山", r: "かざん"}, {now: at("2026-11-02T00:00:00Z")}), {now: at("2026-11-04T00:00:00Z")});
  assert.deepEqual(savedOnly([a, b, c]).map(w => w.w), ["改札", "傘"]);
});

test("a context's source line: title · domain/path · date, or Sentence only · date", () => {
  assert.equal(contextSource({text: "x", url: "https://www.tenki.jp/lite/rain", title: "雨の日の過ごし方", at: "2026-11-06T10:00:00Z"}), "雨の日の過ごし方 · tenki.jp/lite/rain · 6 Nov");
  assert.equal(contextSource({text: "x", at: "2026-11-04T10:00:00Z"}), "Sentence only · 4 Nov");
});

test("the save action resolves only after the write, and a failed write is never a success", async () => {
  let release, written; const pending = new Promise(resolve => release = resolve);
  let settled = false;
  const promise = saveWordAction(kasa, {context: {text: "傘"}, get: async () => undefined, save: async r => { written = r; await pending; }, now: () => at("2026-11-06T00:00:00Z")}).then(r => (settled = true, r));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, false, "the sheet must not say Saved before IndexedDB has it");
  release();
  assert.equal((await promise).id, written.id);
  await assert.rejects(() => saveWordAction(kasa, {get: async () => undefined, save: async () => { throw new Error("disk failed"); }}), /disk failed/);
  const removed = await removeWordAction(kasa.id, {get: async () => written, save: async () => {}, now: () => at("2026-11-07T00:00:00Z")});
  assert.equal(removed.removedAt, "2026-11-07T00:00:00.000Z");
  assert.equal(await removeWordAction(99, {get: async () => undefined, save: async () => { throw new Error("must not write"); }}), null);
});

test("a backup with saved words carries no credential", () => {
  const words = [saveWordRecord(null, kasa, {context: {text: "傘", url: "https://x.jp/?token=abc"}, now: at("2026-11-01T00:00:00Z")})];
  const settings = {apiKey: "k", providerKeys: {openai: "k"}, speechKeys: {groq: "k"}, gistToken: "t", gistUrl: "https://gist.github.com/x/aa5a315d61ae9438b18d", theme: "dark"};
  const backup = {...exportBackup([], settings, []), catalogues: {}, words};
  const keys = []; JSON.stringify(backup, (k, v) => { keys.push(k); return v; });
  for (const key of keys) assert.doesNotMatch(key, /token|^key$|apikey|gisturl|providerkeys|speechkeys/i, key);
  assert.doesNotMatch(JSON.stringify(backup), /token=abc/, "an address loses its query");
});
