import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync, readdirSync} from "node:fs";
import vm from "node:vm";
import {LEVELS, FETCHED_LEVELS, levelFile, buildInventory, createLevels, levelKanji} from "../jlpt-levels.js";
import {READINGS} from "../kanji-readings.js";
import {splitReading, baseReadings} from "../kanji-split.js";
const split = (text, reading) => splitReading(text, reading, READINGS);
import {WORDS} from "../words-data.js";
import {GRAMMAR} from "../grammar-data.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const manifest = read("../levels/manifest.json");

test("the levels run N5 to N1, and N2 is never fetched: its inventory is part of the app", () => {
  assert.deepEqual([...LEVELS], ["N5", "N4", "N3", "N2", "N1"]);
  assert.deepEqual([...FETCHED_LEVELS], ["N5", "N4", "N3", "N1"]);
  assert.equal(levelFile("N3"), "n3.json");
});

test("levels/ is what the tool builds from Echo's own catalogues, in the shape of n2-inventory.json", () => {
  assert.deepEqual(readdirSync(new URL("../levels/", import.meta.url)).sort(), [manifest.version, "manifest.json"].sort(), "one build, no stale ones");
  const n2 = read("../n2-inventory.json");
  for (const level of FETCHED_LEVELS) {
    const shipped = read("../levels/" + manifest.version + "/" + levelFile(level));
    assert.deepEqual(shipped, buildInventory(level, {words: WORDS, grammar: GRAMMAR, split}), level + " is up to date: run tools/build-level-inventories.mjs");
    assert.deepEqual(manifest.levels[level], {words: shipped.words.length, grammar: shipped.grammar.length});
    for (const key of ["words", "grammar"]) assert.equal(Array.isArray(shipped[key]), Array.isArray(n2[key]), key);
    assert.equal(shipped.grammar[0].length, n2.grammar[0].length);
    assert.ok(shipped.words.length > 600 && shipped.grammar.length > 100, level);
    for (const row of shipped.words) assert.ok((row.length === 3 || row.length === 4) && row.every(x => typeof x === "string" && x), JSON.stringify(row));
    for (const row of shipped.grammar) assert.ok(row.length === 3 && row[0] && row[1] && typeof row[2] === "string", JSON.stringify(row));
    assert.equal(new Set(shipped.words.map(([w, r]) => w + "/" + r)).size, shipped.words.length, "no word and reading twice");
  }
});

test("an inventory takes only its level's words, once each, with the first sense as meaning", () => {
  const words = [{w: "秋", r: "あき", en: ["autumn; fall", "second sense"], jlpt: "N5"}, {w: "秋", r: "あき", en: ["again"], jlpt: "N5"},
    {w: "明らか", r: "あきらか", en: ["clear"], jlpt: "N3"}, {w: "空", r: "そら", en: [], jlpt: "N5"}, {w: "猫", r: "ねこ", en: ["cat"]}];
  const grammar = [{id: "b", title: "B", level: "N5", order: 2, hint: ""}, {id: "a", title: "A", level: "N5", order: 1, hint: "first"}, {id: "c", title: "C", level: "N4", order: 0}];
  assert.deepEqual(buildInventory("N5", {words, grammar}), {level: "N5", words: [["秋", "あき", "autumn, fall"]], grammar: [["a", "A", "first"], ["b", "B", ""]]});
});

const fakeFetch = (calls, {fail = () => false} = {}) => async url => {
  calls.push(url);
  if (fail(url)) throw new Error("offline");
  if (url.endsWith("manifest.json")) return {ok: true, json: async () => ({version: "v1"})};
  return /\/v1\/n[1345]\.json$/.test(url) ? {ok: true, json: async () => ({level: "N3", words: [["明らか", "あきらか", "clear"]], grammar: []})} : {ok: false};
};

test("a level is fetched once, at an address that carries the build", async () => {
  const calls = [], levels = createLevels({fetchImpl: fakeFetch(calls)});
  const [a, b] = await Promise.all([levels.inventory("N3"), levels.inventory("N3")]);
  assert.equal(a, b);
  assert.equal(a.words[0][0], "明らか");
  assert.deepEqual(calls, ["./levels/manifest.json", "./levels/v1/n3.json"]);
  assert.equal(await levels.inventory("N2"), null, "N2 is not a fetched level");
  assert.equal(await levels.inventory("N9"), null);
  assert.equal(calls.length, 2);
});

test("a level that cannot be had is null, and is asked for again next time", async () => {
  let offline = true; const calls = [];
  const levels = createLevels({fetchImpl: fakeFetch(calls, {fail: () => offline})});
  assert.equal(await levels.inventory("N3"), null);
  offline = false;
  assert.equal((await levels.inventory("N3")).words.length, 1);
});

test("the worker keeps a level's file once served, apart from the app's cache, and is not precaching it", async () => {
  const script = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(script.includes('"./jlpt-levels.js"'), "the loader is part of the app");
  assert.ok(!/levels\//.test(script.match(/const ASSETS=\[.*?\];/s)[0]), "the inventories are not in the precache");
  const stores = {}, handlers = {}; let online = true, network = 0;
  const caches = {open: async name => { const m = stores[name] ||= new Map(); return {match: async r => m.get(r.url), put: async (r, v) => m.set(r.url, v)}; }, keys: async () => [], delete: async () => {}};
  const self = {location: {origin: "https://echo.test"}, registration: {scope: "https://echo.test/"}, clients: {claim: async () => {}}, addEventListener: (n, h) => handlers[n] = h};
  vm.runInNewContext(script, {self, URL, Request: class {}, Response: class {}, caches, fetch: async r => { network++; if (!online) throw new Error("offline"); return {ok: true, body: r.url, clone() { return this; }}; }});
  const get = async path => { let p; handlers.fetch({request: {url: "https://echo.test" + path, method: "GET", mode: "cors"}, respondWith: x => p = x}); return p; };
  const file = "/levels/" + manifest.version + "/n3.json";
  assert.equal((await get(file)).body, "https://echo.test" + file);
  await get("/levels/manifest.json");
  assert.deepEqual(Object.keys(stores), ["jp-echo-levels"]);
  online = false; const before = network;
  assert.equal((await get(file)).body, "https://echo.test" + file, "kept offline");
  assert.equal(network, before, "a kept file never asks the network");
  assert.ok((await get("/levels/manifest.json")).ok, "the manifest falls back to its kept copy");
  assert.ok(existsSync(new URL(".." + file, import.meta.url)));
});

// ---- Kanji and their readings ----
test("a word's reading splits over its kanji, through the sound changes where kanji meet", () => {
  const parts = (t, r) => split(t, r)?.map(p => p.k + ":" + p.r + (p.r === p.base ? "" : "<" + p.base));
  assert.deepEqual(parts("就任", "しゅうにん"), ["就:しゅう", "任:にん"]);
  assert.deepEqual(parts("出発", "しゅっぱつ"), ["出:しゅっ<しゅつ", "発:ぱつ<はつ"], "small っ and a p-sound");
  assert.deepEqual(parts("学校", "がっこう"), ["学:がっ<がく", "校:こう"]);
  assert.deepEqual(parts("生け花", "いけばな"), ["生:い", "花:ばな<はな"], "voicing, and kana in the word lining up");
  assert.deepEqual(parts("受付", "うけつけ"), ["受:うけ", "付:つけ"], "a verb's noun form");
  assert.equal(split("今日", "きょう"), null, "an irregular reading belongs to the word, not to its kanji");
  assert.equal(split("ひらがな", "ひらがな"), null);
  assert.ok(baseReadings(READINGS["話"]).includes("はなし") && baseReadings(READINGS["話"]).includes("わ"));
});

test("most words of every level split cleanly, and the inventories carry the split", () => {
  const n2 = read("../n2-inventory.json"), n2Parts = read("../n2-kanji-parts.json");
  const lists = {N2: n2.words};
  for (const level of FETCHED_LEVELS) {
    const words = read("../levels/" + manifest.version + "/" + levelFile(level)).words; lists[level] = words;
    const kanji = words.filter(([w]) => /[一-鿿]/.test(w)), done = kanji.filter(row => row[3]);
    assert.ok(done.length / kanji.length > .9, level + ": " + done.length + " of " + kanji.length);
    for (const [w, r, , p] of done.slice(0, 300)) assert.equal(p, split(w, r).map(x => x.base).join("|"), w);
    for (const [w, , , p] of done) assert.equal(p.split("|").length, (w.match(/[一-鿿々]/g) || []).length, w);
  }
  for (const [w, r] of n2.words) { const p = split(w, r); assert.equal(n2Parts[w + "/" + r], p ? p.map(x => x.base).join("|") : undefined, w + ": run tools/build-level-inventories.mjs"); }
  assert.equal(n2Parts["就任/しゅうにん"], "しゅう|にん");
  assert.ok(Object.keys(n2Parts).length / n2.words.filter(([w]) => /[一-鿿]/.test(w)).length > .9);
  // The kanji each level brings: none twice, counted from all five lists.
  assert.deepEqual(manifest.kanji, levelKanji(lists), "run tools/build-level-inventories.mjs");
  const all = LEVELS.flatMap(l => [...manifest.kanji[l]]);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(LEVELS.map(l => [...manifest.kanji[l]].length), [436, 332, 638, 247, 263]);
  assert.deepEqual(levelKanji({N5: [["日本"], ["本"]], N4: [["日光"]], N2: [["光る"]]}), {N5: "日本", N4: "光", N3: "", N2: "", N1: ""});
});
