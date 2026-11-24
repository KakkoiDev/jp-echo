import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FILES, mergeDeleted, applyDeleted, recordDeletion, readDeleted, mergeRecall, mergeN2, betterAttempt, signatures, toPush, mayPush, syncGist, markDirty, syncState} from "../sync.js";
import {rawSha} from "../gist-backup.js";
import {mergeSentences} from "../core.js";
import {readToken, sealKey, openKey} from "../key-share.js";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

// A localStorage per simulated device.
function storage() { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear(), key: i => [...m.keys()][i], get length() { return m.size; }}; }
const asDevice = (device, fn) => { const prev = globalThis.localStorage; globalThis.localStorage = device.storage; return Promise.resolve().then(fn).finally(() => { globalThis.localStorage = prev; }); };

// An in-memory gist with the endpoints sync uses.
function fakeGist() {
  const gist = {id: "0667891e19f8f468e0362ce22c8c25f3", version: 0, files: {}, writes: 0, downloads: 0};
  let blob = 0;
  const shaOf = () => (++blob).toString(16).padStart(40, "a");
  const index = () => ({id: gist.id, html_url: "https://gist.github.com/" + gist.id, history: [{version: "v" + gist.version}, {version: "v" + (gist.version - 1)}],
    files: Object.fromEntries(Object.entries(gist.files).map(([name, f]) => [name, {raw_url: `https://gist.githubusercontent.com/u/${gist.id}/raw/${f.sha}/${name}`, content: f.content.slice(0, 50), truncated: true}]))});
  const json = body => ({ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body)});
  gist.fetch = async (url, init = {}) => {
    if (url.includes("/raw/")) { gist.downloads++; const name = url.split("/").pop(); return {ok: true, status: 200, text: async () => gist.files[name].content}; }
    if (url.endsWith("/commits?per_page=1")) return json([{version: "v" + gist.version}]);
    if (!init.method) return json(index());
    const body = JSON.parse(init.body);
    for (const [name, f] of Object.entries(body.files)) gist.files[name] = {content: f.content, sha: shaOf()};
    gist.version++; gist.writes++;
    return json(index());
  };
  return gist;
}

// A device: a library (sentences + tombstones), N2 recall rows, and adapters
// shaped like Echo's (merge = union, then tombstones).
function device(name, gist) {
  const d = {name, storage: storage(), sentences: [], recall: []};
  d.storage.setItem("jp-echo-settings", JSON.stringify({gistAuto: true, gistToken: "t", gistUrl: "https://gist.github.com/u/" + gist.id}));
  d.adapters = {
    backup: {
      read: async () => ({sentences: d.sentences, deleted: readDeleted()}),
      merge: async remote => {
        const deleted = mergeDeleted(readDeleted(), remote.deleted);
        localStorage.setItem("jp-echo-deleted", JSON.stringify(deleted));
        d.sentences = applyDeleted(mergeSentences(d.sentences, remote.sentences || []), deleted.sentences);
        return {sentences: d.sentences, deleted};
      },
    },
    n2: {
      read: async () => ({recall: d.recall}),
      merge: async remote => { const m = mergeN2({recall: d.recall}, remote); d.recall = m.recall; return m; },
    },
  };
  d.sync = () => asDevice(d, () => syncGist({adapters: d.adapters, page: "app", fetchImpl: gist.fetch}));
  d.change = (kind, fn) => asDevice(d, () => { fn(); markDirty(kind); });
  return d;
}
const sentence = (id, extra = {}) => ({id, schemaVersion: 4, source: "S " + id, target: "文" + id, createdAt: "2026-11-20T00:00:00.000Z", updatedAt: "2026-11-20T00:00:00.000Z", ...extra});

test("two devices converge through the gist: adds travel, a delete stays deleted, and nobody echoes uploads", async () => {
  const gist = fakeGist(), a = device("phone", gist), b = device("laptop", gist);
  await a.change("backup", () => { a.sentences = [sentence("s1")]; });
  await a.sync();
  assert.equal(gist.writes, 1);
  await b.sync();
  assert.deepEqual(b.sentences.map(s => s.id), ["s1"], "the laptop brings in the phone's sentence");
  assert.equal(gist.writes, 1, "a pull that changed nothing on the gist side does not write");
  await b.change("backup", () => { b.sentences = [...b.sentences, sentence("s2")]; });
  await b.sync();
  await a.sync();
  assert.deepEqual(a.sentences.map(s => s.id).sort(), ["s1", "s2"]);
  const writes = gist.writes;
  await a.sync(); await b.sync(); await a.sync();
  assert.equal(gist.writes, writes, "settled devices do not write again");
  // A delete on the phone is applied on the laptop and not brought back.
  await a.change("backup", () => { a.sentences = a.sentences.filter(s => s.id !== "s1"); recordDeletion("sentences", "s1", new Date("2026-11-24T00:00:00Z")); });
  await a.sync(); await b.sync();
  assert.deepEqual(b.sentences.map(s => s.id), ["s2"], "the laptop deletes s1 too");
  await b.change("backup", () => { b.sentences = b.sentences.map(s => ({...s, echoCount: 3, updatedAt: "2026-11-24T01:00:00.000Z"})); });
  await b.sync(); await a.sync();
  assert.deepEqual(a.sentences.map(s => s.id), ["s2"], "s1 does not come back with the laptop's next upload");
  assert.equal(a.sentences[0].echoCount, 3);
});

test("a file the gist does not have yet is uploaded on the first sync, without waiting for a change", async () => {
  const gist = fakeGist(), a = device("phone", gist);
  gist.files["echo-backup.json"] = {content: JSON.stringify({sentences: []}), sha: "b".repeat(40)};
  gist.version = 1;
  await asDevice(a, () => { a.recall = [{id: "r1", events: [], updatedAt: "2026-11-24T00:00:00Z"}]; });
  await a.sync();
  assert.ok(gist.files["echo-n2.json"], "N2 progress reaches the gist on the first sync");
});

test("a review on each device of the same card keeps both reviews and the further schedule", async () => {
  const gist = fakeGist(), a = device("phone", gist), b = device("laptop", gist);
  await a.change("backup", () => { a.sentences = [sentence("s1")]; }); await a.sync(); await b.sync();
  await a.change("backup", () => { a.sentences = [{...a.sentences[0], reviews: [{at: "2026-11-24T08:00:00Z", rating: "ok"}], srs: {reps: 1}, updatedAt: "2026-11-24T08:00:00.000Z"}]; });
  await b.change("backup", () => { b.sentences = [{...b.sentences[0], reviews: [{at: "2026-11-24T09:00:00Z", rating: "again"}], srs: {reps: 2}, updatedAt: "2026-11-24T09:00:00.000Z"}]; });
  await a.sync(); await b.sync(); await a.sync();
  for (const d of [a, b]) { assert.equal(d.sentences[0].reviews.length, 2, d.name); assert.equal(d.sentences[0].srs.reps, 2, d.name); }
});

test("N2 recall from two devices combines its checks; only changed files are downloaded", async () => {
  const gist = fakeGist(), a = device("phone", gist), b = device("laptop", gist);
  const rec = (at, grade) => ({id: "meaning|重役", updatedAt: at, checks: 1, last: grade, events: [{at, grade}], days: grade === "instant" ? [at.slice(0, 10)] : []});
  await a.change("n2", () => { a.recall = [rec("2026-11-23T10:00:00.000Z", "instant")]; }); await a.sync();
  await b.change("n2", () => { b.recall = [rec("2026-11-24T10:00:00.000Z", "slow")]; }); await b.sync(); await a.sync();
  for (const d of [a, b]) { const r = d.recall[0]; assert.equal(r.checks, 2, d.name); assert.equal(r.last, "slow", d.name); assert.deepEqual(r.days, [], "a slow answer resets the instant streak"); }
  const downloads = gist.downloads;
  await a.change("n2", () => { a.recall = [{...a.recall[0]}, rec("2026-11-24T11:00:00.000Z", "instant")].map((r, i) => i ? {...r, id: "meaning|終了"} : r); });
  await a.sync(); await b.sync();
  assert.equal(gist.downloads - downloads, 1, "the laptop downloads the N2 file only, not the unchanged library");
});

test("a write GitHub refuses with 409 right after another is retried", async () => {
  const {writeGistFiles} = await import("../gist-backup.js");
  let calls = 0;
  const fetchImpl = async () => (++calls < 3 ? {ok: false, status: 409, json: async () => ({message: "Gist cannot be updated."})} : {ok: true, status: 200, json: async () => ({id: "abc", html_url: "https://gist.github.com/abc", history: [{version: "v2"}, {version: "v1"}], files: {}})});
  const out = await writeGistFiles({id: "0667891e19f8f468e0362ce22c8c25f3", token: "t", files: {"echo-n2.json": {}}, retryMs: 1, fetchImpl});
  assert.equal(calls, 3); assert.equal(out.version, "v2"); assert.equal(out.previous, "v1");
});

test("tombstones: the later deletion wins, an edit after the deletion survives", () => {
  const d = mergeDeleted({sentences: {a: "2026-11-01T00:00:00Z"}}, {sentences: {a: "2026-11-03T00:00:00Z", b: "2026-11-02T00:00:00Z"}, notes: {"word:1:remember": "2026-11-02T00:00:00Z"}});
  assert.equal(d.sentences.a, "2026-11-03T00:00:00.000Z");
  const kept = applyDeleted([{id: "a", updatedAt: "2026-11-02T00:00:00Z"}, {id: "b", updatedAt: "2026-11-05T00:00:00Z"}, {id: "c"}], d.sentences);
  assert.deepEqual(kept.map(x => x.id), ["b", "c"]);
  assert.deepEqual(applyDeleted([{key: "word:1:remember", made: "2026-11-01"}], d.notes, {key: "key", stamp: n => n.made}), []);
});

test("N2 merge: a finished attempt beats an unfinished one; the newer goal wins; events are a union", () => {
  assert.equal(betterAttempt({id: "x", phase: "written", answers: [1, 2, 3]}, {id: "x", phase: "results", answers: [1]}).phase, "results");
  const merged = mergeN2({events: [{id: "e1"}], goal: {exam: "2026-12-06"}, goalAt: "2026-11-01T00:00:00Z", papers: [{id: "p"}]},
    {events: [{id: "e1"}, {id: "e2"}], goal: {exam: "2027-07-05"}, goalAt: "2026-11-20T00:00:00Z", papers: [{id: "p"}, {id: "q"}]});
  assert.deepEqual(merged.events.map(e => e.id), ["e1", "e2"]);
  assert.equal(merged.goal.exam, "2027-07-05");
  assert.equal(merged.papers.length, 2);
  assert.equal(mergeRecall(null, {id: "r"}).id, "r");
});

test("signatures ignore when a file was written; pushes wait for quiet but not on leave", () => {
  const doc = {sentences: [sentence("s1")], notes: [], words: [], deleted: {sentences: {}, notes: {}}};
  assert.equal(signatures.backup(doc), signatures.backup({...doc, exportedAt: "later", preferences: {x: 1}}));
  assert.notEqual(signatures.backup(doc), signatures.backup({...doc, sentences: [{...doc.sentences[0], reviews: [{}]}]}));
  assert.deepEqual(toPush({kinds: ["backup", "n2", "reports"], dirty: {n2: 1}, ahead: {reports: true}}), ["n2", "reports"]);
  const now = 10_000_000;
  assert.equal(mayPush({reason: "change", now, lastChangeAt: now - 1000, lastPushAt: 0}), false, "still typing");
  assert.equal(mayPush({reason: "change", now, lastChangeAt: now - 130_000, lastPushAt: 0}), true);
  assert.equal(mayPush({reason: "hidden", now, lastChangeAt: now - 1000, lastPushAt: 0}), true);
  assert.equal(mayPush({reason: "hidden", now, lastChangeAt: 0, lastPushAt: now - 1000}), false, "the minimum interval holds on leave");
  assert.equal(mayPush({reason: "manual", now, lastPushAt: now}), true);
  assert.equal(rawSha("https://gist.githubusercontent.com/u/abc/raw/5f6e2c29c47516d718a5fdcba1b8bfb3c7cf04df/echo-backup.json"), "5f6e2c29c47516d718a5fdcba1b8bfb3c7cf04df");
  assert.deepEqual(Object.values(FILES), ["echo-backup.json", "echo-n2.json", "echo-reports.json"]);
});

test("a device link seals the gist sync in #link=, opens with the code, and expires", async () => {
  const {token, code} = await sealKey({sync: {token: "ghp_x", gist: "https://gist.github.com/u/0667891e19f8f468e0362ce22c8c25f3"}}, 1, 1000);
  assert.equal(readToken("#link=" + token, "link"), token);
  assert.equal(readToken("#link=" + token), null, "a link is not an invite");
  const body = await openKey(token, code, 2000);
  assert.equal(body.sync.token, "ghp_x");
  await assert.rejects(openKey(token, code, 1000 + 2 * 86400000), /expired/);
});

test("both pages sync; every N2 write marks N2 dirty; a link carries no credential into a backup", () => {
  const app = read("../app.js"), n2 = read("../n2-mock.js"), progress = read("../n2-progress.js"), core = read("../core.js"), html = read("../index.html"), sw = read("../sw.js");
  assert.match(n2, /startAutoSync\(\{adapters: \{n2: n2Adapter\(\), reports: reportsAdapter\(\)\}, page: "n2"/);
  assert.match(progress, /tx\.oncomplete=\(\)=>\{if\(method==="put"\)markDirty\("n2"\)/);
  assert.match(app, /mergeIntoStore\(current=>applyDeleted\(mergeSentences\(current,incoming\),deleted\.sentences\)\)/, "sentences merge in one transaction");
  assert.match(app, /linkSeal=await sealKey\(linkPayload\(\),1\)/, "a device link lasts a day");
  assert.match(app, /url\.hash="link="\+linkSeal\.token/);
  assert.match(core, /const \{apiKey, providerKeys, speechKeys, gistToken, gistUrl, \.\.\.safe\} = preferences;/, "the gist token never enters a backup");
  for (const id of ["link-dialog", "link-device", "link-code", "link-url"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(sw, /"\.\/sync\.js"/);
});

test("a pull-only visit remembers this device's extra work for the next upload", async () => {
  const gist = fakeGist(), a = device("phone", gist), b = device("laptop", gist);
  await a.change("backup", () => { a.sentences = [sentence("phone")]; }); await a.sync();
  b.sentences = [sentence("offline")];
  await asDevice(b, () => syncGist({adapters:b.adapters,page:"app",push:false,fetchImpl:gist.fetch}));
  await b.sync(); await a.sync();
  assert.deepEqual(a.sentences.map(s=>s.id).sort(), ["offline","phone"]);
});

test("a cleared goal survives older copies in either merge order", () => {
  const clear = {goal:null, goalAt:"2026-11-24T12:00:00Z"};
  for (const stamp of ["", "2026-11-23T12:00:00Z", clear.goalAt]) {
    const old = {goal:{exam:"2026-12-06"},goalAt:stamp};
    for (const [a,b] of [[clear,old],[old,clear]]) {
      const merged=mergeN2(a,b); assert.equal(merged.goal,null); assert.equal(merged.goalAt,clear.goalAt);
    }
  }
});

test("a device restarts after displacing another writer and recovers the intervening review", async () => {
  const gist=fakeGist(), d=device("phone",gist);
  await d.change("backup",()=>{d.sentences=[sentence("own")]});
  let conflict=true;
  const fetchImpl=async (url,init={})=>{
    if(url.endsWith("/v1"))return {ok:true,json:async()=>({files:{[FILES.backup]:{content:JSON.stringify({sentences:[sentence("concurrent")]})}}})};
    if(init.method==="PATCH" && conflict){conflict=false;gist.version++}
    return gist.fetch(url,init);
  };
  const run=()=>asDevice(d,()=>syncGist({adapters:d.adapters,page:"app",fetchImpl}));
  await run(); await run();
  const restored=JSON.parse(gist.files[FILES.backup].content);
  assert.deepEqual(restored.sentences.map(s=>s.id).sort(),["concurrent","own"]);
});
