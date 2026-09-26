import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, readFileSync, existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pull} from "../tools/wanikani-pull.mjs";

const page = (data, next = null, total = 3) => ({ok: true, status: 200, json: async () => ({data, total_count: total, pages: {next_url: next}})});
const kanji = (id, ch, mnemonic) => ({id, object: "kanji", data: {characters: ch, level: 1, hidden_at: null,
  meanings: [{meaning: "M" + id, accepted_answer: true}], readings: [{type: "onyomi", reading: "え"}], amalgamation_subject_ids: [],
  meaning_mnemonic: mnemonic, reading_mnemonic: ""}});
const word = (id, ch, en) => ({id, object: "vocabulary", data: {characters: ch, level: 1, hidden_at: null, meanings: [], readings: [],
  context_sentences: [{ja: ch + "。", en}]}});

test("pulls every page to one file, scrubbed, with the token as a bearer header", async () => {
  const out = mkdtempSync(join(tmpdir(), "wk-"));
  const seen = [];
  const doFetch = async (url, options) => {
    seen.push({url, auth: options.headers.Authorization, rev: options.headers["Wanikani-Revision"]});
    return seen.length === 1
      ? page([kanji(1, "駅", "Jesus, a station."), word(2, "駅", "Gee, far.")], "https://api.wanikani.com/v2/subjects?page_after_id=2")
      : page([kanji(3, "山", "Oh my God, a mountain.")]);
  };
  const meta = await pull({token: "tok", out, fetch: doFetch, sleep: async () => {}});
  assert.equal(seen.length, 2, "followed the cursor");
  assert.equal(seen[0].auth, "Bearer tok");
  assert.equal(seen[0].rev, "20170710");
  assert.deepEqual([meta.kanji, meta.vocabulary], [2, 1]);
  const file = JSON.parse(readFileSync(join(out, "subjects.json"), "utf8"));
  assert.equal(file.kanji.find(k => k.characters === "駅").meaningMnemonic, "Whoa, a station.");
  assert.equal(file.kanji.find(k => k.characters === "山").meaningMnemonic, "Oh wow, a mountain.");
  assert.equal(file.vocabulary[0].sentences[0].en, "Whoa, far.");
  assert.ok(!JSON.stringify(file).match(/jesus|god|gee/i), "nothing unscrubbed reaches the disk");
  assert.equal(file.meta.source, "WaniKani API v2, personal use only");
});

test("a second run is incremental, and keeps what it already had", async () => {
  const out = mkdtempSync(join(tmpdir(), "wk-"));
  await pull({token: "tok", out, fetch: async () => page([kanji(1, "駅", "one")]), sleep: async () => {}});
  const seen = [];
  const meta = await pull({token: "tok", out, fetch: async url => { seen.push(url); return page([kanji(2, "山", "two")]); }, sleep: async () => {}});
  assert.match(seen[0], /updated_after=/);
  assert.equal(meta.incremental, true);
  assert.equal(meta.kanji, 2, "the first kanji survived the second run");
});

test("a 429 is waited out, as asked, not retried into", async () => {
  const out = mkdtempSync(join(tmpdir(), "wk-"));
  let calls = 0; const waits = [];
  const doFetch = async () => ++calls === 1
    ? {ok: false, status: 429, headers: {get: h => h === "Retry-After" ? "7" : null}}
    : page([kanji(1, "駅", "x")]);
  await pull({token: "tok", out, fetch: doFetch, sleep: async ms => waits.push(ms)});
  assert.deepEqual(waits, [7000]);
  assert.equal(calls, 2);
});

test("no token, or a refused one, stops before anything is written", async () => {
  const out = mkdtempSync(join(tmpdir(), "wk-"));
  await assert.rejects(() => pull({token: "", out, fetch: async () => { throw new Error("must not be called"); }}), /WANIKANI_TOKEN=... in a .env file/);
  await assert.rejects(() => pull({token: "bad", out, fetch: async () => ({ok: false, status: 401}), sleep: async () => {}}), /did not accept that token/);
  assert.equal(existsSync(join(out, "subjects.json")), false);
});
