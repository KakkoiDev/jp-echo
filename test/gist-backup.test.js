import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {GIST_FILENAME, MIN_INTERVAL_MS, QUIET_MS, downloadBackup, parseGistId, shouldAutoBackup, uploadBackup} from "../gist-backup.js";
import {exportBackup} from "../core.js";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const ID = "aa5a315d61ae9438b18d";
const backup = {schemaVersion: 2, exportedAt: "2026-10-03T00:00:00.000Z", sentences: [{id: "s1", source: "Hi", target: "やあ"}], preferences: {}, notes: []};

function github(reply, {status = 200} = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url, ...options, body: options.body ? JSON.parse(options.body) : undefined});
    const body = typeof reply === "function" ? reply(url) : reply;
    return {ok: status < 300, status, json: async () => body, text: async () => (typeof body === "string" ? body : JSON.stringify(body))};
  };
  return {calls, fetchImpl};
}

test("parseGistId accepts the shapes a user is likely to paste", () => {
  assert.equal(parseGistId(ID), ID);
  assert.equal(parseGistId(`https://gist.github.com/kakkoi/${ID}`), ID);
  assert.equal(parseGistId(`https://gist.github.com/${ID}`), ID);
  assert.equal(parseGistId(`https://api.github.com/gists/${ID}`), ID);
  assert.equal(parseGistId(`https://gist.githubusercontent.com/kakkoi/${ID}/raw/abc/echo-backup.json`), ID);
  assert.equal(parseGistId(`  https://gist.github.com/kakkoi/${ID}  `), ID);
});

test("parseGistId rejects anything else", () => {
  for (const bad of ["", null, "not a gist", "https://github.com/kakkoi/jp-echo", "https://example.com/" + ID, "https://gist.github.com/kakkoi/"]) assert.equal(parseGistId(bad), null, String(bad));
});

test("the first upload creates a secret gist holding exactly the backup", async () => {
  const {calls, fetchImpl} = github({id: ID, html_url: `https://gist.github.com/k/${ID}`});
  const result = await uploadBackup({token: "ghp_x", gist: "", backup, fetchImpl});
  assert.deepEqual(result, {id: ID, url: `https://gist.github.com/k/${ID}`, created: true, sentences: 1});
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://api.github.com/gists");
  assert.equal(calls[0].body.public, false, "never a public gist");
  assert.deepEqual(JSON.parse(calls[0].body.files[GIST_FILENAME].content), backup);
  assert.equal(calls[0].headers.authorization, "Bearer ghp_x");
});

test("later uploads PATCH the remembered gist instead of piling up copies", async () => {
  const {calls, fetchImpl} = github({id: ID, html_url: `https://gist.github.com/k/${ID}`});
  const result = await uploadBackup({token: "t", gist: `https://gist.github.com/k/${ID}`, backup, fetchImpl});
  assert.equal(result.created, false);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, `https://api.github.com/gists/${ID}`);
  assert.equal("public" in calls[0].body, false, "visibility is not touched on update");
});

test("upload refuses without a token and reports what GitHub said", async () => {
  await assert.rejects(uploadBackup({token: "", backup, fetchImpl: async () => assert.fail("no request")}), /token/);
  await assert.rejects(uploadBackup({token: "t", backup, fetchImpl: github({message: "Bad credentials"}, {status: 401}).fetchImpl}), /rejected the token \(401\): Bad credentials/);
  await assert.rejects(uploadBackup({token: "t", gist: ID, backup, fetchImpl: github({message: "Not Found"}, {status: 404}).fetchImpl}), /not found, or the token cannot update it/);
});

test("the token and gist URL never reach the uploaded document", async () => {
  const doc = exportBackup([], {gistToken: "ghp_secret", gistUrl: `https://gist.github.com/k/${ID}`, gistAuto: true, providerKeys: {google: "g"}, speechKeys: {groq: "q"}});
  const {calls, fetchImpl} = github({id: ID, html_url: "https://gist.github.com/k/" + ID});
  await uploadBackup({token: "ghp_secret", backup: doc, fetchImpl});
  const uploaded = calls[0].body.files[GIST_FILENAME].content;
  for (const secret of ["ghp_secret", ID, "\"g\"", "\"q\""]) assert.equal(uploaded.includes(secret), false, secret);
});

test("restore reads the backup, without a token, and falls back to the raw file when truncated", async () => {
  const whole = github({html_url: "https://gist.github.com/k/" + ID, files: {[GIST_FILENAME]: {content: JSON.stringify(backup)}}});
  assert.deepEqual((await downloadBackup({gist: ID, fetchImpl: whole.fetchImpl})).backup, backup);
  assert.equal(whole.calls[0].headers.authorization, undefined, "a secret gist is readable by URL");
  const truncated = github(url => url.startsWith("https://gist.githubusercontent.com") ? JSON.stringify(backup) : {files: {[GIST_FILENAME]: {truncated: true, content: "{\"sch", raw_url: "https://gist.githubusercontent.com/k/" + ID + "/raw/x/" + GIST_FILENAME}}});
  assert.deepEqual((await downloadBackup({gist: ID, fetchImpl: truncated.fetchImpl})).backup, backup);
  await assert.rejects(downloadBackup({gist: ID, fetchImpl: github({files: {"other.json": {content: "{}"}}}).fetchImpl}), /no echo-backup\.json/);
  await assert.rejects(downloadBackup({gist: "nope", fetchImpl: async () => assert.fail()}), /URL or id/);
});

test("auto backup waits for quiet, respects the minimum interval, and catches up on leave or open", () => {
  const base = {enabled: true, hasToken: true, dirty: true, lastAttemptAt: 0};
  const now = 10 * MIN_INTERVAL_MS;
  assert.equal(shouldAutoBackup({...base, lastChangeAt: now - 1000, now}), false, "still changing");
  assert.equal(shouldAutoBackup({...base, lastChangeAt: now - QUIET_MS, now}), true, "quiet long enough");
  assert.equal(shouldAutoBackup({...base, lastChangeAt: now - QUIET_MS, lastAttemptAt: now - 1000, now}), false, "uploaded moments ago");
  assert.equal(shouldAutoBackup({...base, lastChangeAt: now - 1000, now, reason: "hidden"}), true, "leaving the app does not wait for quiet");
  assert.equal(shouldAutoBackup({...base, lastChangeAt: now - 1000, now, reason: "open"}), true);
  assert.equal(shouldAutoBackup({...base, lastChangeAt: 0, lastAttemptAt: now - 1000, now, reason: "hidden"}), false, "the interval still applies on leave");
  for (const off of [{enabled: false}, {hasToken: false}, {dirty: false}]) assert.equal(shouldAutoBackup({...base, ...off, lastChangeAt: 0, now, reason: "open"}), false, JSON.stringify(off));
});

test("every write that changes a backup marks it dirty, and imports do too", () => {
  assert.match(app, /const saved=await persistSentence\(sentence\);markBackupDirty\(\)/);
  for (const name of ["deleteSentence", "putNote", "deleteNote", "replaceNotes"]) assert.match(app, new RegExp(`async function ${name}\\([^)]*\\)\\{const done=await db\\w+\\([^)]*\\);markBackupDirty\\(\\)`), name);
  assert.match(app, /await replaceAll\(merged\)\}catch\(error\)\{saveCatalogues\(importedCatalogues\);throw error\}markBackupDirty\(\)/);
  assert.match(app, /function markBackupDirty\(\)\{if\(!settings\.gistAuto\)return;/);
});

test("the gist holds the same document Export downloads", () => {
  assert.match(app, /async function buildBackup\(\)\{return \{\.\.\.exportBackup\(/);
  assert.match(app, /async function exportHistory\(\)\{const data=await buildBackup\(\)/);
  assert.match(app, /const backup=await buildBackup\(\),result=await uploadBackup\(\{token,gist,backup\}\)/, "the gist receives buildBackup() and nothing else");
});

test("an unrecognised gist URL is an error, never a silent new gist", () => {
  assert.match(app, /if\(String\(gist\|\|""\)\.trim\(\)&&!parseGistId\(gist\)\)throw new Error/);
});

test("auto backup is triggered by quiet, by leaving the app and by opening it", () => {
  assert.match(app, /visibilitychange",\(\)=>\{if\(document\.hidden\)maybeAutoBackup\("hidden"\)/);
  assert.match(app, /await restoreRoute\(\);maybeAutoBackup\("open"\)/);
  assert.match(app, /scheduleGistBackup\(QUIET_MS\+500\)/);
});

test("Settings offers the switch, token, gist, back up now and restore; the module works offline", () => {
  for (const id of ["gist-auto", "gist-token", "gist-url", "gist-now", "gist-restore", "gist-status"]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /id="gist-token" type="password"/);
  assert.match(sw, /"\.\/gist-backup\.js"/);
});
