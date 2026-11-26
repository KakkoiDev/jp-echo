// The authored mock exams of the levels other than N2: each level's blueprint,
// every shipped set held to it, and delivery on demand (jlpt-sets.js).
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync, existsSync, readdirSync} from "node:fs";
import {SET_LEVELS, blueprintOf, expectedRows, heldOut, setLevel, setPath, createSets, levelRows} from "../jlpt-sets.js";
import {validateLevelSet, levelProfile, OUTSIDE_KANJI} from "../tools/validate-level-set.mjs";
import {TAG} from "../n2-comprehension.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const profiles = Object.fromEntries(read("../datasets/jlpt/exam-profiles.json").profiles.map(p => [p.level, p]));
const shipped = level => { const dir = new URL("../sets/" + level.toLowerCase() + "/", import.meta.url); return existsSync(new URL("index.json", dir)) ? read("../sets/" + level.toLowerCase() + "/index.json") : null; };

test("the N3 blueprint is the JLPT N3 paper: 35 vocabulary, 23 grammar, 16 reading, 28 listening", () => {
  const count = skill => blueprintOf("N3").filter(b => b.skill === skill).reduce((n, b) => n + b.count, 0);
  assert.deepEqual(["Vocabulary", "Grammar", "Reading", "Listening"].map(count), [35, 23, 16, 28]);
  assert.equal(expectedRows("N3").length, 102);
  const three = blueprintOf("N3").filter(b => b.options === 3).map(b => b.kind);
  assert.deepEqual(three, ["発話表現", "即時応答"], "only the two spoken-reply 問題 have three choices");
});

test("every level's blueprint fits its exam profile: each 問題 sits under one of the level's clocks", () => {
  for (const [level, {blueprint, draws, heldOut: held}] of Object.entries(SET_LEVELS)) {
    const blocks = profiles[level].timedBlocks.map(b => b.id);
    assert.ok(blueprint.every(b => b.instruction && b.kind && blocks.includes(b.block)), level);
    assert.deepEqual([...new Set(blueprint.map(b => b.block))], blocks, level + " uses every clock, in order");
    assert.equal(draws.at(-1), level); assert.equal(held.length, 2, level + " holds two sets out");
    assert.ok(held.every(id => setLevel(id) === level));
    assert.ok(blueprint.filter(b => b.needsContext).every(b => b.group >= 1 && b.count % b.group === 0 && b.chars[0] < b.chars[1]), level);
  }
});

test("every shipped set passes its level's validator, sits within its level and becomes exam rows", () => {
  for (const level of Object.keys(SET_LEVELS)) {
    const index = shipped(level); if (!index) continue;
    assert.equal(index.level, level);
    const dir = "../sets/" + level.toLowerCase() + "/" + index.edition + "/";
    const files = readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith(".json"));
    assert.deepEqual(Object.keys(index.sets).sort(), files.map(f => f.slice(0, -5)).sort(), level + " index names exactly the files");
    const passages = new Set(), targets = new Map();
    for (const f of files) {
      const set = read(dir + f);
      assert.equal(set.id, f.slice(0, -5)); assert.equal(index.sets[set.id], set.theme);
      assert.deepEqual(validateLevelSet(set), [], f);
      assert.ok(levelProfile(set).share <= OUTSIDE_KANJI, f);
      const rows = levelRows(set);
      assert.ok(rows.every(r => r.instruction && r.label.includes("問題") && r.skill >= 0 && r.source === set.id + "#" + r.index), f);
      for (const q of set.questions) {
        if (q.skill === "Reading" || q.skill === "Listening") { assert.ok(q.tags.every(t => TAG[t]) && q.context.includes(q.cue), f); }
        if (q.context.length > 100) { const first = !passages.has(set.id + q.context) && passages.has(q.context); assert.ok(!first, f + " repeats a passage of another set"); passages.add(q.context); passages.add(set.id + q.context); }
        if (q.target) targets.set(JSON.stringify(q.target), (targets.get(JSON.stringify(q.target)) || 0) + 1);
      }
    }
    // Across a level's sets one item is not asked again and again.
    assert.ok([...targets.values()].every(n => n <= Math.max(2, Math.ceil(files.length / 3))), level + " repeats a target across sets too often");
  }
});

test("the validator refuses what would make a paper unfair or off-level", () => {
  const index = shipped("N3"); if (!index) return;
  const id = Object.keys(index.sets)[0], fresh = () => read("../" + setPath("N3", index.edition, id).slice(2));
  const broken = change => { const set = fresh(); change(set); return validateLevelSet(set).join("\n"); };
  assert.match(broken(s => s.questions.pop()), /expected 102 questions/);
  assert.match(broken(s => { s.questions[0].target = ["word", "就任", "しゅうにん"]; }), /not in the N5\/N4\/N3 inventories/);
  assert.match(broken(s => { s.questions[0].choices[s.questions[0].key - 1] = "ちがう"; }), /漢字読み key must be the reading/);
  assert.match(broken(s => { s.questions.at(-1).choices.push("はい。"); }), /needs 3 non-empty choices/);
  assert.match(broken(s => { s.questions.at(-1).cue = "この文は台本にありません"; }), /cue must be/);
  assert.match(broken(s => { s.questions.at(-1).tags = ["gist"]; }), /tags from TAGS/);
  assert.match(broken(s => { const q = s.questions.find(q => q.skill === "Reading" && q.mondai === 5); q.context += "。"; }), /must share one context/);
  assert.match(broken(s => { const q = s.questions.find(q => q.skill === "Listening"); q.context = q.context.replace(/^[^：]+：/, ""); }), /speaker label/);
  assert.match(broken(s => { for (const q of s.questions) if (q.choices.length === 4) { const right = q.choices[q.key - 1]; q.choices = [right, ...q.choices.filter(c => c !== right)]; q.key = 1; } }), /keys are unbalanced/);
  assert.match(broken(s => { const q = s.questions.find(q => q.skill === "Reading" && q.mondai === 6); const more = "〈" + "憂鬱な薔薇の挨拶".repeat(8) + "〉"; for (const x of s.questions) if (x.context === q.context) x.context = more + x.context.slice(more.length); }), /kanji are outside/);
});

const fakeFetch = (calls, {fail = () => false, files}) => async url => { calls.push(url); if (fail(url) || !(url in files)) return {ok: false}; return {ok: true, json: async () => files[url]}; };
test("sets are fetched on demand: the index, then only the set asked for; a failure is tried again", async () => {
  const files = {"./sets/n3/index.json": {level: "N3", edition: "e1", sets: {"n3-set-1": "a", "n3-set-2": "b"}}, "./sets/n3/e1/n3-set-1.json": {id: "n3-set-1", questions: []}, "./sets/n3/e1/n3-set-2.json": {id: "n3-set-2", questions: []}};
  let offline = true; const calls = [], sets = createSets({fetchImpl: fakeFetch(calls, {fail: () => offline, files})});
  assert.equal(await sets.set("N3", "n3-set-1"), null, "offline and never fetched");
  offline = false;
  assert.equal((await sets.set("N3", "n3-set-1")).id, "n3-set-1");
  assert.equal((await sets.set("N3", "n3-set-1")).id, "n3-set-1");
  assert.deepEqual(calls.slice(1), ["./sets/n3/index.json", "./sets/n3/e1/n3-set-1.json"], "one index, one set, once");
  assert.equal(await sets.set("N3", "n3-set-99"), null, "a set the index does not name is never asked for");
  assert.equal(await sets.index("N2"), null, "N2's sets ship with the app (n2-sets/)");
  assert.deepEqual(await sets.keep("N3"), ["n3-set-1", "n3-set-2"], "keep() brings the whole level to the device ahead of the boss");
  assert.deepEqual(heldOut("N3"), ["n3-set-9", "n3-set-10"]);
});

test("the worker keeps a set once served, in its own cache, and never precaches sets", async () => {
  const script = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(!/["']\.\/sets\//.test(script.match(/const ASSETS=\[.*?\];/s)[0]), "sets are not in the precache");
  assert.ok(/"\.\/n2-sets\//.test(script.match(/const ASSETS=\[.*?\];/s)[0]) || existsSync(new URL("../n2-sets/index.json", import.meta.url)), "N2's sets stay where they are");
  const stores = {}, handlers = {}; let online = true, network = 0;
  const caches = {open: async name => { const m = stores[name] ||= new Map(); return {match: async r => m.get(r.url), put: async (r, v) => m.set(r.url, v)}; }, keys: async () => [], delete: async () => {}};
  const self = {location: {origin: "https://echo.test"}, registration: {scope: "https://echo.test/"}, clients: {claim: async () => {}}, addEventListener: (n, h) => handlers[n] = h};
  vm.runInNewContext(script, {self, URL, Request: class {}, Response: class {}, caches, fetch: async r => { network++; if (!online) throw new Error("offline"); return {ok: true, body: r.url, clone() { return this; }}; }});
  const get = async path => { let p; handlers.fetch({request: {url: "https://echo.test" + path, method: "GET", mode: "cors"}, respondWith: x => p = x}); return p; };
  const file = "/sets/n3/2026-11/n3-set-1.json";
  assert.equal((await get(file)).body, "https://echo.test" + file);
  await get("/sets/n3/index.json");
  assert.deepEqual(Object.keys(stores), ["jp-echo-sets"]);
  online = false; const before = network;
  assert.equal((await get(file)).body, "https://echo.test" + file, "kept offline: a boss needs no network");
  assert.equal(network, before, "a kept set never asks the network");
  assert.ok((await get("/sets/n3/index.json")).ok, "the index falls back to its kept copy");
});
